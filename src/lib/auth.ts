// Oturum yönetimi: admin (JWT), anlatıcı (JWT + DB kontrolü), oyuncu (rastgele token, DB'de SHA-256 özeti).
// Route handler'lar çerezi istekten (req.cookies) okur; sayfalar (server component) next/headers kullanır.
import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';
import { prisma } from './prisma';
import { isProduction } from './config';
import { hashToken } from './crypto';
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_SECONDS,
  NARRATOR_COOKIE,
  NARRATOR_PIN_LIFETIME_MS,
  PLAYER_COOKIE,
  PLAYER_SESSION_SECONDS,
  signAdminToken,
  signNarratorToken,
  verifyAdminToken,
  verifyNarratorToken,
  type AdminClaims,
} from './tokens';

/** `req.cookies` veya `await cookies()` ile uyumlu en küçük arayüz. */
export interface CookieReader {
  get(name: string): { value: string } | undefined;
}

export interface NarratorSession {
  narratorPinId: string;
  eventId: string;
}

export interface PlayerSession {
  playerId: string;
  eventId: string;
  username: string;
}

const baseCookie = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax' as const,
  path: '/',
};

// ─── Admin ─────────────────────────────────────

export async function getAdminSessionFrom(jar: CookieReader): Promise<AdminClaims | null> {
  return verifyAdminToken(jar.get(ADMIN_COOKIE)?.value);
}

/** Server component'ler için. */
export async function getAdminSession(): Promise<AdminClaims | null> {
  return getAdminSessionFrom(await cookies());
}

export async function setAdminSessionCookie(res: NextResponse, adminId: string, email: string) {
  const token = await signAdminToken(adminId, email);
  res.cookies.set(ADMIN_COOKIE, token, { ...baseCookie, maxAge: ADMIN_SESSION_SECONDS });
}

export function clearAdminSessionCookie(res: NextResponse) {
  res.cookies.set(ADMIN_COOKIE, '', { ...baseCookie, maxAge: 0 });
}

// ─── Anlatıcı ──────────────────────────────────

export function narratorPinExpiresAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + NARRATOR_PIN_LIFETIME_MS);
}

/**
 * İmzayı doğrular, ardından PIN'in hâlâ aktif (admin iptal etmemiş), süresi dolmamış ve etkinliğin bitmemiş
 * olduğunu veritabanından kontrol eder.
 */
export async function getNarratorSessionFrom(jar: CookieReader): Promise<NarratorSession | null> {
  const claims = await verifyNarratorToken(jar.get(NARRATOR_COOKIE)?.value);
  if (!claims) return null;

  const pin = await prisma.narratorPIN.findUnique({
    where: { id: claims.narratorPinId },
    select: { id: true, eventId: true, isActive: true, usedAt: true, createdAt: true, event: { select: { status: true } } },
  });
  if (
    !pin ||
    !pin.isActive ||
    !pin.usedAt ||
    pin.eventId !== claims.eventId ||
    pin.event.status === 'COMPLETED' ||
    narratorPinExpiresAt(pin.createdAt).getTime() <= Date.now()
  ) {
    return null;
  }
  return { narratorPinId: pin.id, eventId: pin.eventId };
}

export async function getNarratorSession(): Promise<NarratorSession | null> {
  return getNarratorSessionFrom(await cookies());
}

export async function setNarratorSessionCookie(res: NextResponse, narratorPinId: string, eventId: string, expiresAt: Date) {
  const token = await signNarratorToken(narratorPinId, eventId, expiresAt);
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  res.cookies.set(NARRATOR_COOKIE, token, { ...baseCookie, maxAge });
}

// ─── Oyuncu ────────────────────────────────────

export async function getPlayerSessionFrom(jar: CookieReader): Promise<PlayerSession | null> {
  const token = jar.get(PLAYER_COOKIE)?.value;
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;

  const player = await prisma.player.findUnique({
    where: { sessionTokenHash: hashToken(token) },
    select: { id: true, eventId: true, username: true, createdAt: true, status: true },
  });
  // Süre sınırı sunucuda da uygulanır (yalnızca çerezin maxAge'ine güvenilmez). Atılan/banlanan oyuncunun oturumu yoktur.
  if (!player || player.createdAt.getTime() + PLAYER_SESSION_SECONDS * 1000 <= Date.now()) return null;
  if (player.status !== 'LOBBY' && player.status !== 'PLAYING') return null;
  return { playerId: player.id, eventId: player.eventId, username: player.username };
}

export async function getPlayerSession(): Promise<PlayerSession | null> {
  return getPlayerSessionFrom(await cookies());
}

export function setPlayerSessionCookie(res: NextResponse, token: string) {
  res.cookies.set(PLAYER_COOKIE, token, { ...baseCookie, maxAge: PLAYER_SESSION_SECONDS });
}

/** Tarayıcıya özgü uzun ömürlü kimlik (yalnızca ban kontrolü için; DB'de özeti tutulur). */
export const DEVICE_COOKIE = `${isProduction ? '__Host-' : ''}koy_device`;
export function setDeviceCookie(res: NextResponse, deviceId: string) {
  res.cookies.set(DEVICE_COOKIE, deviceId, { ...baseCookie, maxAge: 60 * 60 * 24 * 365 });
}

/** Admin API'leri için kısa yol: oturum yoksa null. */
export async function requireAdmin(jar: CookieReader) {
  return getAdminSessionFrom(jar);
}
