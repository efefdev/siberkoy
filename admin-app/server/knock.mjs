// Port knocking: SSH'den önce sunucunun "kapısını" verilen sırayla çalar.
import net from 'node:net';
import dgram from 'node:dgram';
import { lookup } from 'node:dns/promises';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function knockTcp(address, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: address, port });
    const done = () => {
      socket.destroy();
      resolve();
    };
    socket.setTimeout(400, done);
    socket.once('connect', done);
    socket.once('error', done); // Kapalı port beklenen durum: SYN gönderildi, yeterli.
  });
}

function knockUdp(address, family, port) {
  return new Promise((resolve) => {
    const socket = dgram.createSocket(family === 6 ? 'udp6' : 'udp4');
    socket.send(Buffer.from([0]), port, address, () => {
      socket.close();
      resolve();
    });
  });
}

/** @param {{host:string, sequence:{port:number, protocol:'tcp'|'udp'}[], delayMs?:number}} opts */
export async function knock({ host, sequence, delayMs = 300 }) {
  // Tüm vuruşlar aynı IP'ye gitsin (DNS her seferinde farklı adres dönebilir).
  const { address, family } = await lookup(host);
  for (const step of sequence) {
    if (step.protocol === 'udp') await knockUdp(address, family, step.port);
    else await knockTcp(address, step.port);
    await sleep(delayMs);
  }
  return address;
}
