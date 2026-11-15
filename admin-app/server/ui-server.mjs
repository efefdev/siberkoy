// Yerel admin sunucusu: build edilmiş paneli servis eder, admin API'si ve socket.io isteklerini hedefe aktarır.
// Hedef: SSH tüneli (http://127.0.0.1:<localTunnelPort>) ya da acil durumda https://<publicUrl>.
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import fs from 'node:fs';
import path from 'node:path';
import { CookieJar, allowedOrigins, forwardHeaders, hasLocalToken, isAllowedHost, isAllowedOrigin, isProxiedPath, takeLocalTokenParam } from './guard.mjs';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

function securityHeaders(uiPort) {
  return {
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      `connect-src 'self' ${allowedOrigins(uiPort).map((o) => o.replace('http', 'ws')).join(' ')}`,
      "frame-ancestors 'none'",
      "base-uri 'none'",
      "form-action 'self'",
    ].join('; '),
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  };
}

function sendJson(res, status, body, extra = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra });
  res.end(JSON.stringify(body));
}

/**
 * @param {{ uiPort:number, distDir:string, localToken:string, getTarget:()=>({url:URL, tunnel:boolean}), getStatus:()=>object }} opts
 */
export function createUiServer({ uiPort, distDir, localToken, getTarget, getStatus }) {
  const sec = securityHeaders(uiPort);
  // Admin oturum çerezi burada, sürecin belleğinde durur; tarayıcıya hiç verilmez. Uygulama kapanınca silinir.
  const jar = new CookieJar();
  const NO_TOKEN = { error: 'Yerel oturum anahtarı geçersiz. Paneli terminalde yazan bağlantıdan aç.', localToken: false };

  const server = http.createServer((req, res) => {
    const url = req.url || '/';

    // DNS rebinding koruması
    if (!isAllowedHost(req.headers.host, uiPort)) return sendJson(res, 403, { error: 'Geçersiz Host' });

    if (url === '/__local/status') return sendJson(res, 200, getStatus(), sec);

    if (isProxiedPath(url)) {
      if (!isAllowedOrigin(req.method, req.headers.origin, uiPort)) return sendJson(res, 403, { error: 'İzin verilmeyen kaynak' });
      // socket.io'nun HTTP (polling) istekleri anahtarı sorgu parametresinde taşır; diğerleri X-Local-Token başlığında.
      const fromQuery = url.startsWith('/socket.io/') ? takeLocalTokenParam(url) : null;
      const token = req.headers['x-local-token'] ?? fromQuery?.token;
      if (!hasLocalToken(token, localToken)) return sendJson(res, 401, NO_TOKEN);
      if (fromQuery) req.url = fromQuery.url;
      return proxyHttp(req, res, getTarget(), jar);
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'Yöntem desteklenmiyor' });
    return serveStatic(req, res, url, distDir, sec);
  });

  // socket.io WebSocket yükseltmesi
  server.on('upgrade', (req, socket, head) => {
    const url = req.url || '/';
    if (!isAllowedHost(req.headers.host, uiPort) || !url.startsWith('/socket.io/') || !allowedOrigins(uiPort).includes(req.headers.origin)) {
      socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');
      return;
    }
    const { token, url: cleanUrl } = takeLocalTokenParam(url);
    if (!hasLocalToken(token, localToken)) {
      socket.end('HTTP/1.1 401 Unauthorized\r\n\r\n');
      return;
    }
    req.url = cleanUrl;
    proxyUpgrade(req, socket, head, getTarget(), jar);
  });

  return server;
}

function proxyHttp(req, res, { url: target, tunnel }, jar) {
  const client = target.protocol === 'https:' ? https : http;
  const upstream = client.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      method: req.method,
      path: req.url,
      headers: forwardHeaders(req.headers, target.host, { tunnel, cookie: jar.header() }),
      timeout: 20000,
    },
    (up) => {
      const headers = { ...up.headers };
      // Oturum çerezi tarayıcıya iletilmez; yerel bellekte saklanır.
      jar.store(headers['set-cookie']);
      delete headers['set-cookie'];
      delete headers['strict-transport-security']; // localhost'a HSTS yazılmasın
      res.writeHead(up.statusCode || 502, headers);
      up.pipe(res);
    }
  );
  upstream.on('timeout', () => upstream.destroy(new Error('zaman aşımı')));
  upstream.on('error', () => {
    if (!res.headersSent) sendJson(res, 502, { error: 'Sunucuya ulaşılamıyor (tünel kapalı olabilir)' });
    else res.destroy();
  });
  req.pipe(upstream);
}

function proxyUpgrade(req, socket, head, { url: target, tunnel }, jar) {
  const port = Number(target.port || (target.protocol === 'https:' ? 443 : 80));
  const upstream =
    target.protocol === 'https:'
      ? tls.connect({ host: target.hostname, port, servername: target.hostname })
      : net.connect({ host: target.hostname, port });

  upstream.once(target.protocol === 'https:' ? 'secureConnect' : 'connect', () => {
    const headers = forwardHeaders(req.headers, target.host, { tunnel, cookie: jar.header() });
    // WebSocket için gerekli bağlantı başlıkları geri eklenir
    headers.connection = 'Upgrade';
    headers.upgrade = req.headers.upgrade || 'websocket';
    let raw = `${req.method} ${req.url} HTTP/1.1\r\n`;
    for (const [k, v] of Object.entries(headers)) {
      for (const val of Array.isArray(v) ? v : [v]) raw += `${k}: ${val}\r\n`;
    }
    upstream.write(raw + '\r\n');
    if (head && head.length) upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  });
  const close = () => {
    socket.destroy();
    upstream.destroy();
  };
  upstream.on('error', close);
  socket.on('error', close);
  upstream.on('close', () => socket.destroy());
  socket.on('close', () => upstream.destroy());
}

function serveStatic(req, res, url, distDir, sec) {
  let pathname;
  try {
    pathname = decodeURIComponent(url.split('?')[0]);
  } catch {
    return sendJson(res, 400, { error: 'Geçersiz adres' });
  }
  let file = path.normalize(path.join(distDir, pathname));
  // Dizin dışına çıkma (../) engeli
  if (!file.startsWith(distDir + path.sep) && file !== distDir) return sendJson(res, 403, { error: 'Yasak' });
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(distDir, 'index.html'); // SPA
  if (!fs.existsSync(file)) {
    res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Panel henüz derlenmedi. `npm run admin:build` çalıştırın.');
  }
  const ext = path.extname(file);
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=31536000, immutable',
    ...sec,
  });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
}
