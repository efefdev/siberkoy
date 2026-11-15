import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { DEVICE_COOKIE, setDeviceCookie, setPlayerSessionCookie } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { hashToken, newSessionToken } from '@/lib/crypto';
import { playerCodeIpLimiter } from '@/lib/rate-limit';
import { disconnectRoom, emitTo, rooms } from '@/lib/realtime';
import { errors, getClientIp, isSameOrigin, jsonError, parseBody } from '@/lib/request';

const Schema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .transform((s) => s.replace(/[\s-]/g, ''))
    .pipe(z.string().regex(/^[A-Z0-9]{8}$/)),
});

const GENERIC_ERROR = 'Kod geçersiz ya da süresi dolmuş. Admin’den yeni kod iste.';

/**
 * Telefon değiştirme: admin'in ürettiği tek kullanımlık kodla bu tarayıcıyı mevcut oyuncu kaydına bağlar.
 * Yeni oturum token'ı üretilir; eski telefonun oturumu (eski token özeti) aynı anda geçersiz olur.
 */
export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) return errors.forbiddenOrigin();
    const ip = getClientIp(req);
    const locked = playerCodeIpLimiter.lockedFor(ip);
    if (locked) return jsonError(`Çok fazla hatalı deneme. ${Math.ceil(locked / 60000)} dakika sonra tekrar dene.`, 429);

    const body = await parseBody(req, Schema);
    if (!body) {
      playerCodeIpLimiter.recordFailure(ip);
      return jsonError(GENERIC_ERROR, 401);
    }

    const codeHash = hashToken(body.code);
    const player = await prisma.player.findUnique({
      where: { transferCodeHash: codeHash },
      select: { id: true, eventId: true, username: true },
    });

    const existingDevice = req.cookies.get(DEVICE_COOKIE)?.value;
    const deviceId = existingDevice && /^[0-9a-f]{64}$/.test(existingDevice) ? existingDevice : newSessionToken();
    const token = newSessionToken();

    // Atomik: kod tek kullanımlık, süresi dolmamış, oyuncu hâlâ etkin ve etkinlik bitmemiş olmalı.
    const claimed = player
      ? await prisma.player.updateMany({
          where: {
            id: player.id,
            transferCodeHash: codeHash,
            transferCodeExpiresAt: { gt: new Date() },
            status: { in: ['LOBBY', 'PLAYING'] },
            event: { status: { not: 'COMPLETED' } },
          },
          data: {
            sessionTokenHash: hashToken(token),
            deviceIdHash: hashToken(deviceId),
            transferCodeHash: null,
            transferCodeExpiresAt: null,
          },
        })
      : { count: 0 };

    if (claimed.count !== 1 || !player) {
      playerCodeIpLimiter.recordFailure(ip);
      return jsonError(GENERIC_ERROR, 401);
    }

    // Eski telefonun açık bağlantısı kapanır.
    emitTo(rooms.player(player.id), 'removed', { banned: false, transferred: true });
    disconnectRoom(rooms.player(player.id));
    await audit('PLAYER_DEVICE_TRANSFER', 'PLAYER', player.id, null, ip);
    emitTo(rooms.admins, 'event_updated', { eventId: player.eventId });

    const res = NextResponse.json({ success: true, player: { id: player.id, username: player.username } });
    setPlayerSessionCookie(res, token);
    if (deviceId !== existingDevice) setDeviceCookie(res, deviceId);
    return res;
  } catch (error) {
    console.error('Player transfer error:', error);
    return errors.server();
  }
}
