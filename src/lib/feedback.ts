import { prisma } from './prisma';

/** Oyuncunun en son oturduğu (en yüksek tur numaralı) masanın anlatıcısı. */
export async function lastNarratorOf(playerId: string): Promise<{ narratorId: string; tableNumber: number } | null> {
  const last = await prisma.roomAssignment.findFirst({
    where: { playerId },
    orderBy: { room: { round: { roundNumber: 'desc' } } },
    select: { room: { select: { narrator: { select: { id: true, tableNumber: true } } } } },
  });
  const n = last?.room.narrator;
  return n ? { narratorId: n.id, tableNumber: n.tableNumber } : null;
}
