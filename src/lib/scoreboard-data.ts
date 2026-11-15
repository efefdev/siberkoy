// Skor tablosunu veritabanından kurar (herkese açık tablo, büyük ekran, oyuncu rozeti ve rapor aynı hesabı kullanır).
import { prisma } from './prisma';
import { buildScoreboard, type ScoreboardEntry } from './scoreboard';

export async function loadScoreboard(eventId: string): Promise<ScoreboardEntry[]> {
  // Banlanan oyuncular listeden düşer; atılanlar (genelde telefon değişimi) puanlarıyla kalır.
  const [players, scoreEvents, finishedAssignments] = await Promise.all([
    prisma.player.findMany({ where: { eventId, status: { not: 'BANNED' } }, select: { id: true, username: true } }),
    prisma.scoreEvent.findMany({ where: { eventId }, select: { playerId: true, score: true } }),
    prisma.roomAssignment.findMany({
      where: { room: { status: 'COMPLETED', round: { eventId } } },
      select: { playerId: true, room: { select: { startTime: true, endTime: true } } },
    }),
  ]);
  return buildScoreboard(
    players,
    scoreEvents,
    finishedAssignments.map((a) => ({ playerId: a.playerId, startTime: a.room.startTime, endTime: a.room.endTime }))
  );
}
