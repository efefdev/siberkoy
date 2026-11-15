import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAdminSessionFrom } from '@/lib/auth';
import { loadScoreboard } from '@/lib/scoreboard-data';
import { errors } from '@/lib/request';

type Ctx = { params: Promise<{ id: string }> };

/** Etkinlik raporu: Excel ve PDF özeti ile paylaşım tasarımları için tüm veriler (yalnızca admin). */
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getAdminSessionFrom(req.cookies);
    if (!session) return errors.unauthorized();
    const id = z.string().uuid().safeParse((await ctx.params).id);
    if (!id.success) return errors.badRequest();

    const event = await prisma.event.findUnique({
      where: { id: id.data },
      select: { id: true, name: true, status: true, createdAt: true, closedAt: true, theme: true, isPractice: true },
    });
    if (!event) return errors.notFound('Etkinlik');

    const [board, players, rounds, scoreEvents, feedback, pins] = await Promise.all([
      loadScoreboard(event.id),
      prisma.player.findMany({ where: { eventId: event.id }, select: { id: true, username: true, status: true, createdAt: true } }),
      prisma.round.findMany({
        where: { eventId: event.id },
        orderBy: { roundNumber: 'asc' },
        select: {
          roundNumber: true,
          startTime: true,
          endTime: true,
          rooms: {
            orderBy: { roomNumber: 'asc' },
            select: {
              roomNumber: true,
              status: true,
              winningSide: true,
              startTime: true,
              endTime: true,
              bonusAwardedAt: true,
              narrator: { select: { tableNumber: true } },
              assignments: { select: { playerId: true, role: true, isAlive: true } },
            },
          },
        },
      }),
      prisma.scoreEvent.findMany({
        where: { eventId: event.id },
        orderBy: { createdAt: 'asc' },
        select: { playerId: true, kind: true, score: true, reason: true, createdBy: true, createdAt: true, room: { select: { roomNumber: true, round: { select: { roundNumber: true } } } } },
      }),
      prisma.narratorFeedback.findMany({
        where: { eventId: event.id },
        orderBy: { createdAt: 'asc' },
        select: { rating: true, message: true, createdAt: true, narrator: { select: { tableNumber: true } } },
      }),
      prisma.narratorPIN.count({ where: { eventId: event.id, usedAt: { not: null } } }),
    ]);

    const nameOf = new Map(players.map((p) => [p.id, p.username]));
    const rooms = rounds.flatMap((r) => r.rooms.map((room) => ({ ...room, roundNumber: r.roundNumber })));
    const finished = rooms.filter((r) => r.status === 'COMPLETED' && r.startTime && r.endTime);
    const avgTableMinutes = finished.length
      ? Math.round(finished.reduce((s, r) => s + (r.endTime!.getTime() - r.startTime!.getTime()), 0) / finished.length / 60000)
      : null;
    const firstStart = rounds[0]?.startTime ?? null;
    const lastEnd = rounds.reduce<Date | null>((m, r) => (r.endTime && (!m || r.endTime > m) ? r.endTime : m), null);
    const ratings = feedback.map((f) => f.rating);

    return NextResponse.json({
      event,
      stats: {
        players: players.filter((p) => p.status !== 'BANNED').length,
        removed: players.filter((p) => p.status === 'KICKED' || p.status === 'BANNED').length,
        rounds: rounds.length,
        tables: rooms.length,
        narrators: pins,
        defenderWins: rooms.filter((r) => r.winningSide === 'DEFENDERS').length,
        attackerWins: rooms.filter((r) => r.winningSide === 'ATTACKERS').length,
        eliminations: rooms.reduce((s, r) => s + r.assignments.filter((a) => !a.isAlive).length, 0),
        bonuses: rooms.filter((r) => r.bonusAwardedAt).length,
        avgTableMinutes,
        durationMinutes: firstStart && lastEnd ? Math.round((lastEnd.getTime() - firstStart.getTime()) / 60000) : null,
        feedbackCount: ratings.length,
        avgRating: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null,
      },
      scoreboard: board,
      players: players.map((p) => ({ username: p.username, status: p.status, joinedAt: p.createdAt })),
      tables: rooms.map((r) => ({
        round: r.roundNumber,
        table: r.roomNumber,
        narratorTable: r.narrator?.tableNumber ?? null,
        status: r.status,
        winningSide: r.winningSide,
        size: r.assignments.length,
        alive: r.assignments.filter((a) => a.isAlive).length,
        minutes: r.startTime && r.endTime ? Math.round((r.endTime.getTime() - r.startTime.getTime()) / 60000) : null,
        bonus: Boolean(r.bonusAwardedAt),
      })),
      roles: rooms.flatMap((r) =>
        r.assignments.map((a) => ({ round: r.roundNumber, table: r.roomNumber, username: nameOf.get(a.playerId) ?? '?', role: a.role, alive: a.isAlive }))
      ),
      scores: scoreEvents.map((s) => ({
        username: nameOf.get(s.playerId) ?? '?',
        kind: s.kind,
        score: s.score,
        reason: s.reason,
        by: s.createdBy.split(':')[0],
        round: s.room?.round.roundNumber ?? null,
        table: s.room?.roomNumber ?? null,
        at: s.createdAt,
      })),
      feedback: feedback.map((f) => ({ table: f.narrator.tableNumber, rating: f.rating, message: f.message, at: f.createdAt })),
    });
  } catch (error) {
    console.error('Report error:', error);
    return errors.server();
  }
}
