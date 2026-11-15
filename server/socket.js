// Socket.io kimlik doğrulama ve oda yönetimi (CommonJS; server.js tarafından yüklenir).
// Oda adları src/lib/realtime.ts ile aynı olmalıdır.
const { createHash } = require('crypto');
const { jwtVerify } = require('jose');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const isProduction = process.env.NODE_ENV === 'production';
// Çerez adları src/lib/tokens.ts ile aynı olmalı. Üretimde __Host- öneki: yalnızca Secure, Domain'siz, Path=/
// çerez kabul edilir; alt alan adından ya da HTTP'den ezilemez.
const COOKIE_PREFIX = isProduction ? '__Host-' : '';
const COOKIES = {
  admin: `${COOKIE_PREFIX}admin_session`,
  narrator: `${COOKIE_PREFIX}narrator_session`,
  player: `${COOKIE_PREFIX}player_session`,
};

/** src/lib/admin-via.ts ile aynı kural: üretimde yalnızca tünel/acil yol, geliştirmede `public` dışı her şey. */
function isAdminVia(via) {
  if (isProduction) return via === 'tunnel' || via === 'admin-emergency';
  return via !== 'public';
}

// Geçersiz oturum çereziyle veritabanını yoran bağlantı selini sınırla: aynı IP'den dakikada 300 başarısız
// kimlik sorgusundan sonra o IP'den gelen oyuncu çerezleri bir dakika boyunca DB'ye sorulmaz. Bu sürede oyuncu
// çerezli bağlantı anonim sayılmaz, `busy` hatasıyla reddedilir; istemci kısa bir beklemeden sonra yeniden dener.
// Admin ve anlatıcı kimlikleri imzalı JWT olduğu için bloktan etkilenmez (sahte imza DB'ye hiç gitmez).
const FAILED_LOOKUP_LIMIT = 300;
const failedLookups = new Map();
function lookupBlocked(ip) {
  const e = failedLookups.get(ip);
  return Boolean(e && Date.now() - e.start < 60_000 && e.count >= FAILED_LOOKUP_LIMIT);
}
function recordFailedLookup(ip) {
  const now = Date.now();
  const e = failedLookups.get(ip);
  if (!e || now - e.start >= 60_000) failedLookups.set(ip, { start: now, count: 1 });
  else e.count += 1;
  if (failedLookups.size > 10_000) {
    for (const [k, v] of failedLookups) if (now - v.start >= 60_000) failedLookups.delete(k);
  }
}

class BusyError extends Error {
  constructor() {
    super('busy');
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NARRATOR_PIN_LIFETIME_MS = 8 * 60 * 60 * 1000;
const PLAYER_SESSION_MS = 12 * 60 * 60 * 1000;

function getJwtKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET tanımlı değil veya 32 karakterden kısa. `openssl rand -hex 64` ile üretin.');
  }
  return new TextEncoder().encode(secret);
}

function allowedOrigins() {
  const list = [(process.env.NEXT_PUBLIC_APP_URL || 'https://siberkoy.omusiber.org').replace(/\/+$/, '')];
  if (process.env.NODE_ENV !== 'production') list.push('http://localhost:3000', 'http://127.0.0.1:3000');
  return list;
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

async function verify(token, audience, key) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'], issuer: 'siberkoy', audience });
    return payload.type === audience && typeof payload.sub === 'string' ? payload : null;
  } catch {
    return null;
  }
}

/** Bağlanan istemcinin kimliğini çerezlerden çıkarır. Kimliksiz bağlantı yalnızca skor tablosunu dinleyebilir. */
async function identify(cookieHeader, via, key, ip = 'unknown') {
  const cookies = parseCookies(cookieHeader);

  // Admin kimliği yalnızca tünelden (Nginx'ten geçmeyen) ya da acil durum izniyle gelen bağlantıya verilir.
  const admin = isAdminVia(via) ? await verify(cookies[COOKIES.admin], 'admin', key) : null;
  if (admin) return { role: 'admin', id: admin.sub, exp: admin.exp };

  const narrator = await verify(cookies[COOKIES.narrator], 'narrator', key);
  if (narrator) {
    const pin = await prisma.narratorPIN.findUnique({
      where: { id: narrator.sub },
      select: { isActive: true, usedAt: true, createdAt: true, eventId: true, event: { select: { status: true } } },
    });
    const valid =
      pin &&
      pin.isActive &&
      pin.usedAt &&
      pin.eventId === narrator.eventId &&
      pin.event.status !== 'COMPLETED' &&
      pin.createdAt.getTime() + NARRATOR_PIN_LIFETIME_MS > Date.now();
    if (valid) return { role: 'narrator', id: narrator.sub, eventId: pin.eventId, exp: narrator.exp };
    recordFailedLookup(ip);
  }

  const playerToken = cookies[COOKIES.player];
  if (playerToken && /^[0-9a-f]{64}$/.test(playerToken)) {
    if (lookupBlocked(ip)) throw new BusyError();
    const hash = createHash('sha256').update(playerToken).digest('hex');
    const player = await prisma.player.findUnique({
      where: { sessionTokenHash: hash },
      select: { id: true, eventId: true, createdAt: true, status: true },
    });
    const active = player && (player.status === 'LOBBY' || player.status === 'PLAYING');
    if (active && player.createdAt.getTime() + PLAYER_SESSION_MS > Date.now()) {
      return { role: 'player', id: player.id, eventId: player.eventId };
    }
    recordFailedLookup(ip);
  }

  return { role: 'anonymous' };
}

function attachSocket(httpServer) {
  const key = getJwtKey();
  const origins = allowedOrigins();

  const io = new Server(httpServer, {
    cors: { origin: origins, methods: ['GET', 'POST'], credentials: true },
    // WebSocket bağlantılarında CORS uygulanmaz; Origin başlığını burada kendimiz kontrol ederiz.
    allowRequest: (req, callback) => {
      const origin = req.headers.origin;
      callback(null, !origin || origins.includes(origin));
    },
    maxHttpBufferSize: 10_000, // İstemciden yalnızca küçük mesajlar beklenir
    connectTimeout: 10_000,
  });

  io.use(async (socket, next) => {
    try {
      const h = socket.request.headers;
      const ip = (typeof h['x-real-ip'] === 'string' && h['x-real-ip']) || socket.handshake.address || 'unknown';
      socket.data.identity = await identify(h.cookie, h['x-siberkoy-via'], key, ip);
      next();
    } catch (err) {
      if (err instanceof BusyError) return next(new Error('busy'));
      console.error('Socket kimlik doğrulama hatası:', err);
      next(new Error('auth_error'));
    }
  });

  io.on('connection', (socket) => {
    const identity = socket.data.identity;

    // Kimliğe göre özel odalar sunucu tarafından atanır; istemci bunları seçemez.
    if (identity.role === 'admin') socket.join('admins');
    if (identity.role === 'narrator') socket.join(`narrator:${identity.id}`);
    if (identity.role === 'player') {
      socket.join(`player:${identity.id}`);
      socket.join(`players:${identity.eventId}`);
    }

    // Token süresi dolunca bağlantıyı kapat (açık kalan WebSocket ile süresiz yetki olmasın).
    if (identity.exp) {
      const ms = identity.exp * 1000 - Date.now();
      const timer = setTimeout(() => socket.disconnect(true), Math.max(0, Math.min(ms, 2 ** 31 - 1)));
      socket.on('disconnect', () => clearTimeout(timer));
    }

    // Herkese açık: skor tablosu "yenile" sinyalleri. Tek seferde tek etkinlik.
    socket.on('scoreboard:join', (eventId) => {
      if (typeof eventId !== 'string' || !UUID_RE.test(eventId)) return;
      for (const room of socket.rooms) {
        if (room.startsWith('scoreboard:')) socket.leave(room);
      }
      socket.join(`scoreboard:${eventId}`);
    });
  });

  return io;
}

module.exports = { attachSocket, getJwtKey, identify, isAdminVia, COOKIES };
