import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { loadScoreboard } from '@/lib/scoreboard-data';
import { getAppOrigin } from '@/lib/config';
import { errors } from '@/lib/request';

/**
 * Büyük ekran (projeksiyon) verisi. Yalnızca salondaki herkesin zaten gördüğü bilgiler:
 * katılım kodu (katılım açıkken), oyuncu sayısı, masaların durumu (hayatta kalan sayısı), finalde ilk 3.
 * Rol, masa üyeleri gibi gizli bilgi yoktur.
 */
export async function GET(req: NextRequest) {
  try {
    const eventId = z.string().uuid().safeParse(req.nextUrl.searchParams.get('eventId'));
    if (!eventId.success) return errors.badRequest();

    const event = await prisma.event.findUnique({
      where: { id: eventId.data },
      select: { id: true, name: true, status: true, theme: true, isPractice: true, registrationOpen: true, eventPin: true },
    });
    if (!event) return errors.notFound('Etkinlik');

    const [playerCount, rounds] = await Promise.all([
      prisma.player.count({ where: { eventId: event.id, status: { in: ['LOBBY', 'PLAYING'] } } }),
      prisma.round.findMany({
        where: { eventId: event.id },
        orderBy: { roundNumber: 'asc' },
        select: {
          roundNumber: true,
          status: true,
          rooms: {
            orderBy: { roomNumber: 'asc' },
            select: { roomNumber: true, status: true, winningSide: true, assignments: { select: { isAlive: true } } },
          },
        },
      }),
    ]);

    const current = rounds.at(-1);
    const completed = event.status === 'COMPLETED';
    const podium = completed ? (await loadScoreboard(event.id)).filter((r) => r.totalScore > 0).slice(0, 3) : [];
    const allRooms = rounds.flatMap((r) => r.rooms);

    return NextResponse.json({
      event: { name: event.name, status: event.status, theme: event.theme, isPractice: event.isPractice },
      // Katılım kodu yalnızca katılım açıkken ve etkinlik bitmemişken gösterilir.
      join: !completed && event.registrationOpen ? { pin: event.eventPin, url: getAppOrigin() } : null,
      playerCount,
      round: current
        ? {
            number: current.roundNumber,
            status: current.status,
            tables: current.rooms.map((r) => ({
              number: r.roomNumber,
              status: r.status,
              size: r.assignments.length,
              alive: r.assignments.filter((a) => a.isAlive).length,
              winningSide: r.status === 'COMPLETED' ? r.winningSide : null,
            })),
          }
        : null,
      stats: {
        rounds: rounds.length,
        tables: allRooms.length,
        defenderWins: allRooms.filter((r) => r.winningSide === 'DEFENDERS').length,
        attackerWins: allRooms.filter((r) => r.winningSide === 'ATTACKERS').length,
      },
      podium: podium.map((p) => ({ rank: p.rank, username: p.username, totalScore: p.totalScore })),
    });
  } catch (error) {
    console.error('Screen error:', error);
    return errors.server();
  }
}
