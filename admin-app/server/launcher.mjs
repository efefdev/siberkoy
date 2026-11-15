#!/usr/bin/env node
// Siber Köy yerel admin paneli.
//   npm run admin            → port knocking + SSH tüneli + panel (http://localhost:4400)
//   npm run admin -- --acil  → tünel yerine acil durum izniyle doğrudan HTTPS (sunucuda admin-acil.sh gerekir)
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { APP_DIR, devConfig, loadConfig, parseArgs } from './config.mjs';
import { Tunnel } from './tunnel.mjs';
import { createUiServer } from './ui-server.mjs';

const args = parseArgs(process.argv.slice(2));
const config = args.direct ? devConfig(args.direct) : loadConfig();
const distDir = path.join(APP_DIR, 'dist');

async function buildUi() {
  if (args.skipBuild && fs.existsSync(path.join(distDir, 'index.html'))) return;
  process.stdout.write('→ Panel derleniyor... ');
  const { build } = await import('vite');
  await build({ configFile: path.join(APP_DIR, 'vite.config.mts'), logLevel: 'error' });
  console.log('tamam');
}

const state = {
  mode: args.emergency ? 'emergency' : 'tunnel',
  publicUrl: config.publicUrl,
  target: args.direct
    ? `${args.direct} (geliştirme)`
    : args.emergency
      ? `${config.publicUrl} (acil durum)`
      : `${config.ssh.user}@${config.ssh.host} (SSH tüneli)`,
  connected: false,
  message: 'başlatılıyor',
};

const target = args.direct
  ? { url: new URL(args.direct), tunnel: true }
  : args.emergency
    ? { url: new URL(config.publicUrl), tunnel: false }
    : { url: new URL(`http://127.0.0.1:${config.ssh.localTunnelPort}`), tunnel: true };

/** Sunucunun admin API'sine gerçekten ulaşılıyor mu? (401 = ulaşılıyor, oturum yok; 404 = kapalı) */
async function probe() {
  try {
    const res = await fetch(new URL('/api/admin/session', target.url), { signal: AbortSignal.timeout(5000), headers: { 'x-real-ip': 'tunnel' } });
    if (res.status === 200 || res.status === 401) return { ok: true, message: 'bağlı' };
    if (res.status === 404) {
      return {
        ok: false,
        message: args.emergency ? 'acil izin açık değil (404) — sunucuda scripts/admin-acil.sh çalıştırıldı mı, IP doğru mu?' : 'admin API bulunamadı (404)',
      };
    }
    return { ok: false, message: `sunucu ${res.status} döndü` };
  } catch {
    return { ok: false, message: args.emergency ? 'sunucuya ulaşılamıyor' : 'tünel kurulu değil' };
  }
}

function openBrowser(url) {
  if (!args.openBrowser) return;
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const cmdArgs = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  spawn(cmd, cmdArgs, { stdio: 'ignore', detached: true }).unref();
}

async function main() {
  console.log('\n  Siber Köy · Yerel Yönetim Paneli\n');
  await buildUi();

  // Her açılışta yeni yerel anahtar: yalnızca bu terminalin açtığı tarayıcı sekmesi panele erişir.
  const localToken = randomBytes(24).toString('hex');
  const server = createUiServer({ uiPort: config.uiPort, distDir, localToken, getTarget: () => target, getStatus: () => state });
  await new Promise((resolve, reject) => {
    server.once('error', (err) => reject(err.code === 'EADDRINUSE' ? new Error(`${config.uiPort} portu kullanımda. Panel zaten açık olabilir.`) : err));
    // Yalnızca bu bilgisayardan erişilir; aynı ağdaki başkaları bağlanamaz.
    server.listen(config.uiPort, '127.0.0.1', resolve);
  });
  const uiUrl = `http://localhost:${config.uiPort}/?lt=${localToken}`;
  console.log(`→ Panel: ${uiUrl}\n  (Bu bağlantıyı kimseyle paylaşma; uygulama her açılışta yenisini üretir.)`);

  let tunnel = null;

  // Bağlantı durumunu düzenli yokla (paneldeki üst şerit bunu gösterir)
  let opened = false;
  const refresh = async () => {
    if (tunnel && !tunnel.up) {
      state.connected = false;
      state.message = tunnel.message;
      return;
    }
    const r = await probe();
    state.connected = r.ok;
    state.message = r.message;
    if (r.ok && !opened) {
      opened = true;
      console.log(`✔ Sunucuya bağlanıldı. Panel tarayıcıda açılıyor: ${uiUrl}\n  (Kapatmak için bu pencerede Ctrl+C)\n`);
      openBrowser(uiUrl);
    }
  };

  if (args.direct) {
    console.log(`→ Geliştirme modu: tünel yok, istekler ${args.direct} adresine gidiyor.\n`);
  } else if (args.emergency) {
    console.log(`⚠ ACİL DURUM MODU: tünel kullanılmıyor, istekler doğrudan ${config.publicUrl} adresine gidiyor.`);
    console.log('  Sunucuda bu bilgisayarın IP\'si için scripts/admin-acil.sh çalıştırılmış olmalı.\n');
  } else {
    tunnel = new Tunnel({ ssh: config.ssh, knock: config.knock });
    tunnel.on('state', ({ up, message }) => {
      if (!up) {
        state.connected = false;
        state.message = message;
      } else refresh();
    });
    tunnel.start();
  }

  await refresh();
  const timer = setInterval(refresh, 10000);

  const shutdown = () => {
    console.log('\n→ Kapatılıyor...');
    clearInterval(timer);
    tunnel?.stop();
    server.close();
    setTimeout(() => process.exit(0), 300);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(`\n✖ ${err.message}\n`);
  process.exit(1);
});
