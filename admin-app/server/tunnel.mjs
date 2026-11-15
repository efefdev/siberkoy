// SSH tüneli: knock → ssh -L → kopunca yeniden dene. Şifre terminalde sorulur, asla saklanmaz.
import { spawn } from 'node:child_process';
import net from 'node:net';
import { EventEmitter } from 'node:events';
import { knock } from './knock.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function portOpen(port) {
  return new Promise((resolve) => {
    const s = net.connect({ host: '127.0.0.1', port });
    s.setTimeout(500, () => {
      s.destroy();
      resolve(false);
    });
    s.once('connect', () => {
      s.destroy();
      resolve(true);
    });
    s.once('error', () => resolve(false));
  });
}

export class Tunnel extends EventEmitter {
  constructor({ ssh, knock: knockCfg }) {
    super();
    this.ssh = ssh;
    this.knockCfg = knockCfg;
    this.child = null;
    this.stopping = false;
    this.up = false;
    this.message = 'tünel kuruluyor';
  }

  setState(up, message) {
    this.up = up;
    this.message = message;
    this.emit('state', { up, message });
  }

  async start() {
    let attempt = 0;
    while (!this.stopping) {
      attempt += 1;
      try {
        if (this.knockCfg.enabled) {
          this.setState(false, 'port knocking yapılıyor');
          await knock({ host: this.ssh.host, sequence: this.knockCfg.sequence, delayMs: this.knockCfg.delayMs });
        }
        this.setState(false, 'SSH şifresi bekleniyor (terminale bak)');
        let wasUp = false;
        const onReady = () => (wasUp = true);
        this.once('ready', onReady);
        const code = await this.runSsh();
        this.off('ready', onReady);
        if (wasUp) attempt = 1; // bir kez bağlandıysa bekleme süresini sıfırla
        if (this.stopping) break;
        this.setState(false, `tünel kapandı (ssh çıkış kodu ${code}); yeniden bağlanılıyor`);
      } catch (err) {
        this.setState(false, `tünel hatası: ${err.message}`);
      }
      // Arka arkaya hatalarda bekleme süresini artır (en fazla 30 sn)
      await sleep(Math.min(30000, 2000 * attempt));
    }
  }

  runSsh() {
    const { host, port, user, remoteAppPort, localTunnelPort } = this.ssh;
    const args = [
      '-N',
      '-L',
      `127.0.0.1:${localTunnelPort}:127.0.0.1:${remoteAppPort}`,
      '-p',
      String(port),
      '-o',
      'ExitOnForwardFailure=yes',
      '-o',
      'ServerAliveInterval=15',
      '-o',
      'ServerAliveCountMax=3',
      '-o',
      'ConnectTimeout=15',
      '--',
      `${user}@${host}`,
    ];
    console.log(`\n→ SSH tüneli: ${user}@${host}:${port}  (sunucu 127.0.0.1:${remoteAppPort} → bu bilgisayar 127.0.0.1:${localTunnelPort})`);
    console.log('  SSH şifresi istenirse aşağıya yazın.\n');

    return new Promise((resolve) => {
      // stdio: 'inherit' → ssh şifreyi doğrudan terminalden okur; uygulama şifreyi hiç görmez.
      this.child = spawn('ssh', args, { stdio: 'inherit' });
      let watching = true;
      (async () => {
        // Şifre yazılana kadar beklenebilir: port açılana kadar yokla.
        while (watching && !this.stopping) {
          if (await portOpen(localTunnelPort)) {
            if (!this.up) {
              this.setState(true, 'bağlı');
              this.emit('ready');
            }
            return;
          }
          await sleep(500);
        }
      })();
      this.child.once('exit', (code) => {
        watching = false;
        this.child = null;
        this.setState(false, 'tünel kapandı');
        resolve(code);
      });
      this.child.once('error', (err) => {
        watching = false;
        this.child = null;
        this.setState(false, `ssh çalıştırılamadı: ${err.message}`);
        resolve(-1);
      });
    });
  }

  stop() {
    this.stopping = true;
    if (this.child) this.child.kill('SIGTERM');
  }
}
