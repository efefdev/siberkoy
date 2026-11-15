import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getNarratorSessionFrom } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { computeRoomScores } from '@/lib/scoring';
import { lockRound } from '@/lib/locks';
import { emitScoreboardUpdated, emitTo, rooms } from '@/lib/realtime';
import { errors, getClientIp, isSameOrigin, jsonError, parseBody } from '@/lib/request';

const ScoreSchema = z.object({
  roomId: z.string().uuid(),
  winningSide: z.enum(['DEFENDERS', 'ATTACKERS']),
});

class RoomAlreadyScored extends Error {}

// Masa sonucunu girer ve puanları hesaplar. Masa başına YALNIZCA BİR KEZ yapılabilir;
// hata olursa düzeltmeyi admin yapar (/api/admin/scores/adjust).
export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) return errors.forbiddenOrigin();
    const session = await getNarratorSessionFrom(req.cookies);
    if (!session) return errors.unauthorized();

    const body = await parseBody(req, ScoreSchema);
    if (!body) return errors.badRequest();

    const room = await findRoom(session.narratorPinId, session.eventId, body.roomId);
    if (!room) return errors.notFound('Oda');

    const now = new Date();
    let added = 0;
    let seatedPlayers: string[] = [];
    try {
      [added, seatedPlayers] = await prisma.$transaction(async (tx) => {
        // Atomik durum geçişi ACTIVE → COMPLETED: eşzamanlı ikinci istek count=0 alır ve hiçbir puan yazılmaz.
        const claimed = await tx.room.updateMany({
          where: { id: room.id, status: 'ACTIVE', narratorPinId: session.narratorPinId },
          data: { status: 'COMPLETED', endTime: now, winningSide: body.winningSide },
        });
        if (claimed.count !== 1) throw new RoomAlreadyScored();

        const assignments = await tx.roomAssignment.findMany({
          where: { roomId: room.id },
          select: { playerId: true, role: true, isAlive: true },
        });
        const rows = computeRoomScores(assignments, body.winningSide);
        if (rows.length > 0) {
          await tx.scoreEvent.createMany({
            data: rows.map((r) => ({
              eventId: session.eventId,
              playerId: r.playerId,
              roomId: room.id,
              kind: r.kind,
              score: r.score,
              reason: r.reason,
              createdBy: `NARRATOR:${session.narratorPinId}`,
            })),
          });
        }

        // Tur, yalnızca TÜM masalar bitince tamamlanır. Kilit: son iki masa aynı anda biterse
        // ikinci işlem birincinin commit'ini görür ve turu kapatır.
        await lockRound(tx, room.roundId);
        const unfinished = await tx.room.count({ where: { roundId: room.roundId, status: { not: 'COMPLETED' } } });
        if (unfinished === 0) {
          await tx.round.update({ where: { id: room.roundId }, data: { status: 'COMPLETED', endTime: now } });
        }
        return [rows.length, assignments.map((a) => a.playerId)] as const;
      });
    } catch (err) {
      if (err instanceof RoomAlreadyScored) {
        return jsonError('Bu masanın sonucu zaten girildi. Düzeltme için admine başvurun.', 409);
      }
      throw err;
    }

    await audit('ROOM_SCORES_SUBMITTED', 'NARRATOR', session.narratorPinId, room.id, getClientIp(req));
    emitScoreboardUpdated(session.eventId);
    emitTo(rooms.admins, 'room_completed', { roomId: room.id, roundId: room.roundId });
    for (const id of seatedPlayers) emitTo(rooms.player(id), 'event_updated', {});

    return NextResponse.json({ success: true, scoresAdded: added });
  } catch (error) {
    console.error('Score submit error:', error);
    return errors.server();
  }
}

function findRoom(narratorPinId: string, eventId: string, roomId: string) {
  return prisma.room.findFirst({
    where: { id: roomId, narratorPinId, round: { eventId } },
    select: { id: true, roundId: true },
  });
}
