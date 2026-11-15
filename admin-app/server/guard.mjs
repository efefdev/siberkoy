// Yerel sunucunun güvenlik kuralları (saf fonksiyonlar; guard.test.mjs ile test edilir).
//
// Yerel panel http://localhost:<port> üzerinde çalışır. Bilgisayardaki başka bir web sitesinin bu porta
// istek atıp admin oturumunu kullanmasını (CSRF) ve DNS rebinding saldırılarını engellemek için:
//  - Host başlığı yalnızca localhost / 127.0.0.1 olabilir,
//  - durum değiştiren isteklerde ve WebSocket'te Origin başlığı bu yerel adres olmak zorundadır,
//  - yalnızca admin API'si ve socket.io sunucuya aktarılır,
//  - admin oturum çerezi TARAYICIYA VERİLMEZ: yerel sunucu onu kendi belleğinde (CookieJar) tutar. Tarayıcılar
//    çerezleri porta göre ayırmadığından localhost'taki başka bir uygulama (ör. bir geliştirme sunucusu) tarayıcıdaki
//    admin çerezini alabilirdi. Tarayıcı yerine her açılışta üretilen yerel anahtarı (X-Local-Token) gönderir;
//    bu anahtar özel başlıkta taşındığı için başka bir site tarafından da gönderilemez.

import { timingSafeEqual } from 'node:crypto';

export function allowedOrigins(uiPort) {
  return [`http://localhost:${uiPort}`, `http://127.0.0.1:${uiPort}`];
}

export function isAllowedHost(hostHeader, uiPort) {
  return hostHeader === `localhost:${uiPort}` || hostHeader === `127.0.0.1:${uiPort}`;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Durum değiştiren isteklerde Origin zorunlu ve yerel olmalı; GET'te varsa yine yerel olmalı. */
export function isAllowedOrigin(method, origin, uiPort) {
  if (!origin) return SAFE_METHODS.has(method);
  return allowedOrigins(uiPort).includes(origin);
}

export function isProxiedPath(url) {
  return url.startsWith('/api/admin/') || url === '/api/admin' || url.startsWith('/socket.io/');
}

/** Sunucuya gidecek istek başlıkları: kimlik/iz başlıkları temizlenir, Host hedefe çevrilir. */
export function forwardHeaders(incoming, targetHost, { tunnel, cookie }) {
  const drop = new Set([
    'host',
    'origin',
    'referer',
    'x-forwarded-for',
    'x-forwarded-proto',
    'x-forwarded-host',
    'x-real-ip',
    'x-siberkoy-via',
    'x-local-token',
    'cookie',
    'connection',
    'keep-alive',
    'proxy-connection',
    'transfer-encoding',
  ]);
  const out = {};
  for (const [k, v] of Object.entries(incoming)) {
    if (v === undefined || drop.has(k.toLowerCase())) continue;
    out[k] = v;
  }
  out.host = targetHost;
  // Tarayıcının çerezleri yerine yerel sunucunun sakladığı oturum çerezi gönderilir.
  if (cookie) out.cookie = cookie;
  // Tünelden gelen istekler Nginx'ten geçmez; denetim kaydında kaynak olarak "tunnel" görünsün.
  if (tunnel) out['x-real-ip'] = 'tunnel';
  return out;
}

/** Yerel anahtar karşılaştırması (sabit zamanlı). */
export function hasLocalToken(value, token) {
  if (typeof value !== 'string' || !token || value.length !== token.length) return false;
  return timingSafeEqual(Buffer.from(value), Buffer.from(token));
}

/** WebSocket yükseltmesinde anahtar `lt` sorgu parametresiyle gelir (tarayıcı WebSocket'e başlık ekleyemez); sunucuya iletilmez. */
export function takeLocalTokenParam(url) {
  const u = new URL(url, 'http://local');
  const token = u.searchParams.get('lt');
  u.searchParams.delete('lt');
  return { token, url: u.pathname + (u.search || '') };
}

/**
 * Sunucunun Set-Cookie başlıklarını bellekte tutar ve sonraki isteklere Cookie olarak ekler.
 * Max-Age / Expires dikkate alınır; Max-Age=0 veya boş değer çerezi siler (çıkış).
 */
export class CookieJar {
  constructor(now = () => Date.now()) {
    this.now = now;
    this.cookies = new Map();
  }

  store(values) {
    if (!values) return;
    for (const raw of Array.isArray(values) ? values : [values]) {
      const parts = raw.split(';').map((p) => p.trim());
      const eq = parts[0].indexOf('=');
      if (eq <= 0) continue;
      const name = parts[0].slice(0, eq);
      const value = parts[0].slice(eq + 1);
      let expiresAt = Infinity;
      for (const attr of parts.slice(1)) {
        const [k, v = ''] = attr.split('=');
        const key = k.toLowerCase();
        if (key === 'max-age' && /^-?\d+$/.test(v)) expiresAt = this.now() + Number(v) * 1000;
        else if (key === 'expires' && expiresAt === Infinity) {
          const t = Date.parse(v);
          if (!Number.isNaN(t)) expiresAt = t;
        }
      }
      if (value === '' || expiresAt <= this.now()) this.cookies.delete(name);
      else this.cookies.set(name, { value, expiresAt });
    }
  }

  header() {
    const t = this.now();
    const out = [];
    for (const [name, c] of this.cookies) {
      if (c.expiresAt <= t) this.cookies.delete(name);
      else out.push(`${name}=${c.value}`);
    }
    return out.length ? out.join('; ') : undefined;
  }
}
