import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAdminSessionFrom } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { hashToken, newSessionToken } from '@/lib/crypto';
import { normalizeUsername, usernameKey } from '@/lib/username';
import { lockEvent } from '@/lib/locks';
import { generateNarratorPin } from '@/lib/round-planner';
import { disconnectRoom, emitTo, rooms, emitScreenUpdated } from '@/lib/realtime';
import { errors, getClientIp, isSameOrigin, isUniqueViolation, jsonError, parseBody } from '@/lib/request';

type Ctx = { params: Promise<{ id: string }> };

const Schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('kick') }),
  z.object({ action: z.literal('ban') }),
  z.object({ action: z.literal('rename'), username: z.string().max(200) }),
  z.object({ action: z.literal('transfer-code') }),
]);

const TRANSFER_CODE_TTL_MS = 10 * 60 * 1000;

/**
 * Oyuncu yönetimi.
 *  - kick: etkinlikten çıkarır; oturumu biter, isterse PIN ile yeniden katılabilir (ad serbest kalır).
 *  - ban: çıkarır ve aynı tarayıcıdan bu etkinliğe tekrar katılamaz (ad da ayrılmış kalır).
 *  - rename: uygunsuz takma adı değiştirir.
 *  - transfer-code: telefon değiştiren oyuncu için tek kullanımlık, 10 dk geçerli kod üretir. Oyuncu kodu yeni
 *    telefonda girince aynı kayda (puan, masa, rol) bağlanır; eski telefonun oturumu düşer.
 * Süren bir masadaysa masadaki kaydı değişmez; anlatıcı fiziksel olarak yönetir.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    if (!isSameOrigin(req)) return errors.forbiddenOrigin();
    const session = await getAdminSessionFrom(req.cookies);
    if (!session) return errors.unauthorized();

    const id = z.string().uuid().safeParse((await ctx.params).id);
    const body = await parseBody(req, Schema);
    if (!id.success || !body) return errors.badRequest();

    const player = await prisma.player.findUnique({ where: { id: id.data }, select: { id: true, eventId: true, status: true, usernameKey: true } });
    if (!player) return errors.notFound('Oyuncu');
    const ip = getClientIp(req);

    const active = player.status === 'LOBBY' || player.status === 'PLAYING';
    if (!active) return jsonError('Oyuncu zaten çıkarılmış', 409);

    if (body.action === 'transfer-code') {
      const event = await prisma.event.findUnique({ where: { id: player.eventId }, select: { status: true } });
      if (event?.status === 'COMPLETED') return jsonError('Etkinlik bitti', 409);
      // 8 karakter, karıştırılması kolay harfler yok: 31^8 ≈ 852 milyar olasılık. DB'de yalnızca özeti tutulur.
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = generateNarratorPin(8);
        try {
          await prisma.player.update({
            where: { id: player.id },
            data: { transferCodeHash: hashToken(code), transferCodeExpiresAt: new Date(Date.now() + TRANSFER_CODE_TTL_MS) },
          });
        } catch (err) {
          if (isUniqueViolation(err)) continue;
          throw err;
        }
        await audit('PLAYER_TRANSFER_CODE', 'ADMIN', session.adminId, player.id, ip);
        return NextResponse.json({ success: true, code, expiresInMinutes: TRANSFER_CODE_TTL_MS / 60000 });
      }
      return errors.server();
    }

    if (body.action === 'rename') {
      const username = normalizeUsername(body.username);
      if (!username) return jsonError('Takma ad 3-30 karakter olmalı ve en az bir harf/rakam içermeli', 400);
      try {
        await prisma.player.update({ where: { id: player.id }, data: { username, usernameKey: usernameKey(username) } });
      } catch (err) {
        if (isUniqueViolation(err)) return jsonError('Bu takma ad bu etkinlikte zaten kullanılıyor', 409);
        throw err;
      }
      await audit('PLAYER_RENAMED', 'ADMIN', session.adminId, player.id, ip);
      emitTo(rooms.player(player.id), 'profile_updated', {});
    } else {
      const banned = body.action === 'ban';
      // Kilit + koşullu güncelleme: eşzamanlı kick/ban birbirini ezmez, tur başlatma ile çakışmaz.
      const changed = await prisma.$transaction(async (tx) => {
        await lockEvent(tx, player.eventId);
        const r = await tx.player.updateMany({
          where: { id: player.id, status: { in: ['LOBBY', 'PLAYING'] } },
          data: {
          status: banned ? 'BANNED' : 'KICKED',
          // Oturumu geçersiz kıl: eski token'ın özeti artık hiçbir kayda karşılık gelmez.
          sessionTokenHash: hashToken(newSessionToken()),
          transferCodeHash: null,
          transferCodeExpiresAt: null,
          // Atılan oyuncunun adı serbest kalır; banlanan oyuncununki ayrılmış kalır.
          ...(banned ? {} : { usernameKey: `${player.usernameKey}#cikarildi#${player.id}` }),
          },
        });
        return r.count;
      });
      if (changed !== 1) return jsonError('Oyuncu zaten çıkarılmış', 409);
      emitTo(rooms.player(player.id), 'removed', { banned });
      disconnectRoom(rooms.player(player.id));
      await audit(banned ? 'PLAYER_BANNED' : 'PLAYER_KICKED', 'ADMIN', session.adminId, player.id, ip);
    }

    emitTo(rooms.admins, 'event_updated', { eventId: player.eventId });
    emitScreenUpdated(player.eventId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Player admin error:', error);
    return errors.server();
  }
}
