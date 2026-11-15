import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { lastNarratorOf } from '@/lib/feedback';
import { loadScoreboard } from '@/lib/scoreboard-data';
import { titleFor } from '@/lib/titles';
import { getPlayerSessionFrom } from '@/lib/auth';
import { errors } from '@/lib/request';

// Oyuncunun kendi durumu: etkinlik, son turdaki masası ve YALNIZCA kendi rolü.
export async function GET(req: NextRequest) {
  try {
    const session = await getPlayerSessionFrom(req.cookies);
    if (!session) return errors.unauthorized();

    const [event, latestRound, assignment] = await Promise.all([
      prisma.event.findUnique({ where: { id: session.eventId }, select: { id: true, name: true, status: true, theme: true, createdAt: true, closedAt: true } }),
      prisma.round.findFirst({
        where: { eventId: session.eventId },
        orderBy: { roundNumber: 'desc' },
        select: { roundNumber: true, status: true },
      }),
      prisma.roomAssignment.findFirst({
        where: { playerId: session.playerId },
        orderBy: { room: { round: { roundNumber: 'desc' } } },
        select: {
          role: true,
          isAlive: true,
          room: { select: { roomNumber: true, status: true, winningSide: true, round: { select: { roundNumber: true } } } },
        },
      }),
    ]);
    if (!event) return errors.unauthorized();

    // Masada olmak, oyuncunun en son atandığı tur etkinliğin son turuysa anlamlıdır; değilse lobide bekliyordur.
    const seated = assignment && latestRound && assignment.room.round.roundNumber === latestRound.roundNumber;

    // Etkinlik bitince: oyuncunun EN SON oynadığı masanın anlatıcısı (henüz puanlamadıysa). Tek kart.
    let feedbackTargets: { narratorId: string; tableNumber: number }[] = [];
    let summary: Awaited<ReturnType<typeof nightSummary>> = null;
    if (event.status === 'COMPLETED') {
      const target = await lastNarratorOf(session.playerId);
      const given = target
        ? await prisma.narratorFeedback.findUnique({
            where: { playerId_narratorId: { playerId: session.playerId, narratorId: target.narratorId } },
            select: { id: true },
          })
        : null;
      if (target && !given) feedbackTargets = [target];
      summary = await nightSummary(session.playerId, session.eventId, (event.closedAt ?? event.createdAt).toISOString());
    }

    return NextResponse.json({
      player: { id: session.playerId, username: session.username },
      event: { id: event.id, name: event.name, status: event.status, theme: event.theme },
      latestRoundNumber: latestRound?.roundNumber ?? 0,
      seat: seated
        ? {
            roundNumber: assignment.room.round.roundNumber,
            roomNumber: assignment.room.roomNumber,
            role: assignment.role,
            isAlive: assignment.isAlive,
            roomStatus: assignment.room.status,
            winningSide: assignment.room.winningSide,
          }
        : null,
      feedbackTargets,
      summary,
    });
  } catch (error) {
    console.error('Player me error:', error);
    return errors.server();
  }
}

/** Etkinlik bitince oyuncunun kartları için özet: sıra, puan, unvan, etkinlik tarihi. (Roller artık gizli değil ama yalnızca unvan için kullanılır.) */
async function nightSummary(playerId: string, eventId: string, date: string) {
  const board = await loadScoreboard(eventId);
  const me = board.find((r) => r.id === playerId);
  if (!me) return null;
  const [rooms, bonus] = await Promise.all([
    prisma.roomAssignment.findMany({
      where: { playerId, room: { status: 'COMPLETED' } },
      select: { role: true, isAlive: true, room: { select: { winningSide: true } } },
    }),
    prisma.scoreEvent.count({ where: { playerId, kind: 'BONUS' } }),
  ]);
  let attackerWins = 0;
  let defenderWins = 0;
  let survivedWins = 0;
  for (const r of rooms) {
    const attacker = r.role === 'ATTACKER';
    const won = r.room.winningSide === (attacker ? 'ATTACKERS' : 'DEFENDERS');
    if (!won) continue;
    if (attacker) attackerWins++;
    else defenderWins++;
    if (r.isAlive) survivedWins++;
  }
  const t = titleFor({ rank: me.rank, totalScore: me.totalScore, roundsPlayed: me.roundsPlayed, attackerWins, defenderWins, survivedWins, bonus });
  return { rank: me.rank, playerCount: board.length, totalScore: me.totalScore, roundsPlayed: me.roundsPlayed, date, ...t };
}
