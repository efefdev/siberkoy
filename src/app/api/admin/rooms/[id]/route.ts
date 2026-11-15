import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAdminSessionFrom } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { lockActiveRoom, lockRound } from '@/lib/locks';
import { computeRescoreDeltas } from '@/lib/scoring';
import { emitScoreboardUpdated, emitTo, rooms, emitScreenUpdated } from '@/lib/realtime';
import { errors, getClientIp, isSameOrigin, jsonError, parseBody } from '@/lib/request';

type Ctx = { params: Promise<{ id: string }> };

const Schema = z.discriminatedUnion('action', [
  // Süren masada yanlışlıkla elenen oyuncuyu geri getir.
  z.object({ action: z.literal('revive'), playerId: z.string().uuid() }),
  // Bitmiş masanın sonucunu düzelt: doğru kazanan taraf ve (isteğe bağlı) oyun sonunda hayatta olanlar.
  z.object({
    action: z.literal('rescore'),
    winningSide: z.enum(['DEFENDERS', 'ATTACKERS']),
    aliveIds: z.array(z.string().uuid()).max(32).optional(),
    reason: z.string().trim().min(3).max(200),
  }),
]);

class Conflict extends Error {}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    if (!isSameOrigin(req)) return errors.forbiddenOrigin();
    const session = await getAdminSessionFrom(req.cookies);
    if (!session) return errors.unauthorized();
    const id = z.string().uuid().safeParse((await ctx.params).id);
    const body = await parseBody(req, Schema);
    if (!id.success || !body) return errors.badRequest();

    const room = await prisma.room.findUnique({
      where: { id: id.data },
      select: { id: true, roundId: true, roomNumber: true, narratorPinId: true, round: { select: { eventId: true, event: { select: { status: true } } } } },
    });
    if (!room) return errors.notFound('Masa');
    const eventId = room.round.eventId;
    const ip = getClientIp(req);

    if (body.action === 'revive') {
      const r = await prisma.$transaction(async (tx) => {
        if (!(await lockActiveRoom(tx, room.id))) return { count: 0 };
        return tx.roomAssignment.updateMany({
          where: { roomId: room.id, playerId: body.playerId, isAlive: false },
          data: { isAlive: true, eliminatedAt: null },
        });
      });
      if (r.count !== 1) return jsonError('Oyuncu bu masada elenmiş değil ya da masa bitti (bitmiş masa için “sonucu düzelt”).', 409);
      await audit('PLAYER_REVIVED', 'ADMIN', session.adminId, body.playerId, ip);
      if (room.narratorPinId) emitTo(rooms.narrator(room.narratorPinId), 'player_revived', { playerId: body.playerId, roomId: room.id });
      emitTo(rooms.player(body.playerId), 'event_updated', {});
      emitTo(rooms.admins, 'event_updated', { eventId });
      emitScreenUpdated(eventId);
      return NextResponse.json({ success: true });
    }

    if (room.round.event.status === 'COMPLETED') return jsonError('Etkinlik bitti; tek tek puan düzeltmeyi kullan.', 409);

    let changes: { playerId: string; delta: number }[] = [];
    try {
      changes = await prisma.$transaction(async (tx) => {
        await lockRound(tx, room.roundId);
        const current = await tx.room.findUniqueOrThrow({ where: { id: room.id }, select: { status: true } });
        if (current.status !== 'COMPLETED') throw new Conflict('Masa henüz bitmedi; sonucu anlatıcı girer.');

        const assignments = await tx.roomAssignment.findMany({
          where: { roomId: room.id },
          select: { playerId: true, role: true, isAlive: true },
        });
        if (body.aliveIds) {
          const seated = new Set(assignments.map((a) => a.playerId));
          if (body.aliveIds.some((p) => !seated.has(p))) throw new Conflict('Listede bu masada olmayan oyuncu var.');
          const alive = new Set(body.aliveIds);
          for (const a of assignments) a.isAlive = alive.has(a.playerId);
          for (const a of assignments) {
            await tx.roomAssignment.update({
              where: { roomId_playerId: { roomId: room.id, playerId: a.playerId } },
              data: { isAlive: a.isAlive },
            });
          }
        }

        // Bonus hariç, bu masadan gelen tüm sonuç puanları (önceki düzeltmeler dahil).
        const sums = await tx.scoreEvent.groupBy({
          by: ['playerId'],
          where: { roomId: room.id, kind: { not: 'BONUS' } },
          _sum: { score: true },
        });
        const deltas = computeRescoreDeltas(
          new Map(sums.map((s) => [s.playerId, s._sum.score ?? 0])),
          assignments,
          body.winningSide
        );
        if (deltas.length) {
          await tx.scoreEvent.createMany({
            data: deltas.map((d) => ({
              eventId,
              playerId: d.playerId,
              roomId: room.id,
              kind: 'ADJUSTMENT',
              score: d.delta,
              reason: `Masa ${room.roomNumber} sonucu düzeltildi: ${body.reason}`,
              createdBy: `ADMIN:${session.adminId}`,
            })),
          });
        }
        await tx.room.update({ where: { id: room.id }, data: { winningSide: body.winningSide } });
        return deltas;
      });
    } catch (err) {
      if (err instanceof Conflict) return jsonError(err.message, 409);
      throw err;
    }

    await audit('ROOM_RESCORED', 'ADMIN', session.adminId, room.id, ip);
    emitScoreboardUpdated(eventId);
    emitTo(rooms.admins, 'event_updated', { eventId });
    return NextResponse.json({ success: true, changed: changes.length });
  } catch (error) {
    console.error('Room admin error:', error);
    return errors.server();
  }
}
