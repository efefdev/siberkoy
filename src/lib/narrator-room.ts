import { prisma } from './prisma';
import type { NarratorSession } from './auth';

/**
 * Odayı yalnızca oturumdaki anlatıcıya aitse döner (IDOR koruması). Başka masanın odası "bulunamadı" sayılır.
 */
export async function findNarratorRoom(session: NarratorSession, roomId: string) {
  return prisma.room.findFirst({
    where: { id: roomId, narratorPinId: session.narratorPinId, round: { eventId: session.eventId } },
    select: { id: true, roundId: true, status: true, round: { select: { eventId: true } } },
  });
}
