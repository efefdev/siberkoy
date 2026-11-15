import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { lockActiveRoom } from '@/lib/locks';
import { getNarratorSessionFrom } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { findNarratorRoom } from '@/lib/narrator-room';
import { emitTo, rooms, emitScreenUpdated } from '@/lib/realtime';
import { errors, getClientIp, isSameOrigin, jsonError, parseBody } from '@/lib/request';

const EliminateSchema = z.object({
  playerId: z.string().uuid(),
  roomId: z.string().uuid(),
  /** Yanlışlıkla elemeyi geri al: yalnızca son UNDO_WINDOW_MS içinde ve masa sürerken. */
  undo: z.boolean().optional(),
});

// İstemci "geri al"ı 10 sn gösterir; ağ gecikmesi için sunucu biraz daha tolere eder.
const UNDO_WINDOW_MS = 15_000;

// Oyuncu eleme (gece sonucu veya oylama). Yalnızca masanın kendi anlatıcısı, masa sürerken yapabilir.
export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) return errors.forbiddenOrigin();
    const session = await getNarratorSessionFrom(req.cookies);
    if (!session) return errors.unauthorized();

    const body = await parseBody(req, EliminateSchema);
    if (!body) return errors.badRequest();

    const room = await findNarratorRoom(session, body.roomId);
    if (!room) return errors.notFound('Oda');
    if (room.status !== 'ACTIVE') return jsonError('Bu masanın oyunu bitti', 409);

    const assignment = await prisma.roomAssignment.findUnique({
      where: { roomId_playerId: { roomId: room.id, playerId: body.playerId } },
      select: { role: true },
    });
    if (!assignment) return errors.notFound('Oyuncu');

    if (body.undo) {
      const revived = await prisma.$transaction(async (tx) => {
        if (!(await lockActiveRoom(tx, room.id))) return { count: 0 };
        return tx.roomAssignment.updateMany({
          where: {
            roomId: room.id,
            playerId: body.playerId,
            isAlive: false,
            eliminatedAt: { gt: new Date(Date.now() - UNDO_WINDOW_MS) },
          },
          data: { isAlive: true, eliminatedAt: null },
        });
      });
      if (revived.count !== 1) return jsonError('Geri alma süresi doldu veya masa bitti. Gerekirse admin düzeltebilir.', 409);
      await audit('PLAYER_ELIMINATION_UNDONE', 'NARRATOR', session.narratorPinId, body.playerId, getClientIp(req));
      emitTo(rooms.narrator(session.narratorPinId), 'player_revived', { playerId: body.playerId, roomId: room.id });
      emitTo(rooms.admins, 'event_updated', { eventId: session.eventId });
      emitScreenUpdated(session.eventId);
      emitTo(rooms.player(body.playerId), 'event_updated', {});
      return NextResponse.json({ success: true });
    }

    // Atomik: aynı oyuncu iki kez elenemez; masa bu arada puanlanıp kapandıysa eleme yazılmaz.
    const updated = await prisma.$transaction(async (tx) => {
      if (!(await lockActiveRoom(tx, room.id))) return { count: 0 };
      return tx.roomAssignment.updateMany({
        where: { roomId: room.id, playerId: body.playerId, isAlive: true },
        data: { isAlive: false, eliminatedAt: new Date() },
      });
    });
    if (updated.count !== 1) return jsonError('Oyuncu zaten elendi veya masanın oyunu bitti', 409);

    await audit('PLAYER_ELIMINATED', 'NARRATOR', session.narratorPinId, body.playerId, getClientIp(req));

    // Eleme olayı yalnızca anlatıcıya ve adminlere gider (oyuncular kendi durumlarını ayrı olaydan öğrenir).
    const payload = { playerId: body.playerId, roomId: room.id };
    emitTo(rooms.narrator(session.narratorPinId), 'player_eliminated', payload);
    emitTo(rooms.admins, 'player_eliminated', payload);
    emitScreenUpdated(session.eventId);
    emitTo(rooms.player(body.playerId), 'you_were_eliminated', { roomId: room.id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Eliminate error:', error);
    return errors.server();
  }
}
