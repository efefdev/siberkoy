import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CONFIG_PATH = path.join(APP_DIR, 'admin.config.json');

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

const isPort = (n) => Number.isInteger(n) && n > 0 && n < 65536;

/** Geliştirme modu (--hedef): ayar dosyası gerekmez. */
export function devConfig(direct) {
  return { publicUrl: direct, uiPort: 4400, ssh: null, knock: { enabled: false } };
}

export function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    fail(
      `Ayar dosyası yok: ${path.relative(process.cwd(), CONFIG_PATH)}\n` +
        '  admin-app/admin.config.example.json dosyasını admin.config.json adıyla kopyalayıp doldurun.\n' +
        '  (Bu dosya Git\'e girmez; SSH sunucusu ve knock dizisi yalnızca bu bilgisayarda durur.)'
    );
  }
  let c;
  try {
    c = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (e) {
    fail(`admin.config.json okunamadı: ${e.message}`);
  }

  const publicUrl = String(c.publicUrl || '').replace(/\/+$/, '');
  if (!/^https:\/\/[^/]+$/.test(publicUrl)) fail('publicUrl "https://alanadi" biçiminde olmalı.');
  const uiPort = c.uiPort ?? 4400;
  if (!isPort(uiPort)) fail('uiPort geçerli bir port olmalı.');

  const ssh = c.ssh || {};
  if (!ssh.host || !ssh.user) fail('ssh.host ve ssh.user zorunlu.');
  // "-" ile başlayan değerler ssh'a seçenek olarak geçebilir (örn. -oProxyCommand=...): reddedilir.
  if (!/^[A-Za-z0-9_][A-Za-z0-9._-]*$/.test(ssh.user) || !/^[A-Za-z0-9][A-Za-z0-9.:_-]*$/.test(ssh.host)) {
    fail('ssh.host / ssh.user geçersiz karakter içeriyor.');
  }
  ssh.port = ssh.port ?? 22;
  ssh.remoteAppPort = ssh.remoteAppPort ?? 3000;
  ssh.localTunnelPort = ssh.localTunnelPort ?? 43000;
  for (const k of ['port', 'remoteAppPort', 'localTunnelPort']) if (!isPort(ssh[k])) fail(`ssh.${k} geçerli bir port olmalı.`);

  const knock = c.knock || { enabled: false };
  if (knock.enabled) {
    if (!Array.isArray(knock.sequence) || knock.sequence.length === 0) fail('knock.sequence boş olamaz (ya da knock.enabled=false yapın).');
    for (const s of knock.sequence) {
      if (!isPort(s.port) || !['tcp', 'udp'].includes(s.protocol)) fail('knock.sequence öğeleri {"port": 7000, "protocol": "tcp"|"udp"} biçiminde olmalı.');
    }
    knock.delayMs = knock.delayMs ?? 300;
  }

  return { publicUrl, uiPort, ssh, knock };
}

export function parseArgs(argv) {
  const i = argv.indexOf('--hedef');
  const direct = i >= 0 ? argv[i + 1] : null;
  if (direct && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(direct)) {
    fail('--hedef yalnızca bu bilgisayardaki bir sunucu olabilir (örn. http://127.0.0.1:3000).');
  }
  return {
    direct, // geliştirme: tünel olmadan yerel sunucuya bağlan
    emergency: argv.includes('--acil'),
    openBrowser: !argv.includes('--tarayici-yok'),
    skipBuild: argv.includes('--build-yok'),
  };
}
