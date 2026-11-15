// İmzalı oturum token'ları (JWT, HS256). Edge (middleware) ve Node ortamında çalışır: yalnızca `jose` kullanır.
import { SignJWT, jwtVerify } from 'jose';
import { getJwtKey } from './config';

// Üretimde __Host- öneki: tarayıcı bu çerezleri yalnızca Secure, Domain'siz ve Path=/ ise kabul eder
// (alt alan adından ya da düz HTTP'den ezilemez). server/socket.js'teki adlarla aynı olmalı.
const COOKIE_PREFIX = process.env.NODE_ENV === 'production' ? '__Host-' : '';
export const ADMIN_COOKIE = `${COOKIE_PREFIX}admin_session`;
export const NARRATOR_COOKIE = `${COOKIE_PREFIX}narrator_session`;
export const PLAYER_COOKIE = `${COOKIE_PREFIX}player_session`;

export const ADMIN_SESSION_SECONDS = 60 * 60 * 12; // 12 saat
export const NARRATOR_PIN_LIFETIME_MS = 8 * 60 * 60 * 1000; // PIN oluşturulduktan 8 saat sonra geçersiz
export const PLAYER_SESSION_SECONDS = 60 * 60 * 12;

const ISSUER = 'siberkoy';

export interface AdminClaims {
  type: 'admin';
  adminId: string;
  email: string;
}

export interface NarratorClaims {
  type: 'narrator';
  narratorPinId: string;
  eventId: string;
}

export async function signAdminToken(adminId: string, email: string): Promise<string> {
  return new SignJWT({ type: 'admin', email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setAudience('admin')
    .setSubject(adminId)
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_SESSION_SECONDS}s`)
    .sign(getJwtKey());
}

export async function signNarratorToken(narratorPinId: string, eventId: string, expiresAt: Date): Promise<string> {
  return new SignJWT({ type: 'narrator', eventId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setAudience('narrator')
    .setSubject(narratorPinId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(getJwtKey());
}

/** Geçersiz, süresi dolmuş veya başka türde (örn. anlatıcı) token için null döner. */
export async function verifyAdminToken(token: string | undefined | null): Promise<AdminClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getJwtKey(), {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: 'admin',
    });
    if (payload.type !== 'admin' || typeof payload.sub !== 'string' || typeof payload.email !== 'string') return null;
    return { type: 'admin', adminId: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

export async function verifyNarratorToken(token: string | undefined | null): Promise<NarratorClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getJwtKey(), {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: 'narrator',
    });
    if (payload.type !== 'narrator' || typeof payload.sub !== 'string' || typeof payload.eventId !== 'string') return null;
    return { type: 'narrator', narratorPinId: payload.sub, eventId: payload.eventId };
  } catch {
    return null;
  }
}
