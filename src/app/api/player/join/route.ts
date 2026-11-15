import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { DEVICE_COOKIE, getPlayerSessionFrom, setDeviceCookie, setPlayerSessionCookie } from '@/lib/auth';
import { emitTo, rooms, emitScreenUpdated } from '@/lib/realtime';
import { hashToken, newSessionToken } from '@/lib/crypto';
import { normalizeUsername, usernameKey } from '@/lib/username';
import { errors, isSameOrigin, isUniqueViolation, jsonError, parseBody } from '@/lib/request';

const JoinSchema = z.object({
  eventPin: z.string().trim().regex(/^\d{6}$/),
  username: z.string().max(200),
});

// Oyuncu katılımı. Etkinlik bitmediği sürece açık; başladıktan sonra katılan oyuncu lobide bekler
// ve bir sonraki turda masaya dağıtılır. Oturum token'ı yalnızca HttpOnly çerezde taşınır.
export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) return errors.forbiddenOrigin();

    const body = await parseBody(req, JoinSchema);
    if (!body) return jsonError("PIN 6 haneli olmalı ve bir takma ad girilmeli", 400);

    const username = normalizeUsername(body.username);
    if (!username) return jsonError('Takma ad 3-30 karakter olmalı ve en az bir harf/rakam içermeli', 400);

    const event = await prisma.event.findUnique({ where: { eventPin: body.eventPin }, select: { id: true, status: true, registrationOpen: true } });
    if (!event) return jsonError("Geçersiz Etkinlik PIN'i", 404);
    if (event.status === 'COMPLETED') return jsonError('Bu etkinlik sona ermiştir', 403);

    // Yeniden bağlanma: bu tarayıcı zaten bu etkinliğe katılmışsa aynı oyuncu olarak devam eder.
    const existing = await getPlayerSessionFrom(req.cookies);
    if (existing && existing.eventId === event.id) {
      return NextResponse.json({ success: true, reconnected: true, player: { id: existing.playerId, username: existing.username } });
    }

    if (!event.registrationOpen) {
      return jsonError('Katılım şu an kapalı. Telefon değiştirdiysen admin’den cihaz kodu iste.', 403);
    }

    // Tarayıcı kimliği: ban yalnızca buna göre uygulanabilir (tarayıcı verisini silen biri yeni kimlik alır).
    const existingDevice = req.cookies.get(DEVICE_COOKIE)?.value;
    const deviceId = existingDevice && /^[0-9a-f]{64}$/.test(existingDevice) ? existingDevice : newSessionToken();
    const deviceIdHash = hashToken(deviceId);

    const banned = await prisma.player.findFirst({
      where: { eventId: event.id, deviceIdHash, status: 'BANNED' },
      select: { id: true },
    });
    if (banned) return jsonError('Bu etkinliğe katılımınız engellendi', 403);

    const token = newSessionToken();
    try {
      const player = await prisma.player.create({
        data: {
          eventId: event.id,
          username,
          usernameKey: usernameKey(username),
          sessionTokenHash: hashToken(token),
          deviceIdHash,
          status: 'LOBBY',
        },
        select: { id: true, username: true },
      });
      const res = NextResponse.json({ success: true, reconnected: false, player });
      setPlayerSessionCookie(res, token);
      if (deviceId !== existingDevice) setDeviceCookie(res, deviceId);
      emitTo(rooms.admins, 'event_updated', { eventId: event.id });
      emitScreenUpdated(event.id);
      return res;
    } catch (err) {
      // (eventId, usernameKey) eşsizliği veritabanında garanti; eşzamanlı aynı ad isteklerinde biri buraya düşer.
      if (isUniqueViolation(err)) return jsonError('Bu takma ad bu etkinlikte zaten kullanılıyor', 409);
      throw err;
    }
  } catch (error) {
    console.error('Join error:', error);
    return errors.server();
  }
}
