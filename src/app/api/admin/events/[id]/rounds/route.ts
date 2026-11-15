import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAdminSessionFrom } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { SeatsUnbalancedError, keepSeats, planRound } from '@/lib/round-planner';
import { lockEvent } from '@/lib/locks';
import { emitTo, rooms, emitScreenUpdated } from '@/lib/realtime';
import { NARRATOR_PIN_LIFETIME_MS } from '@/lib/tokens';
import { errors, getClientIp, isSameOrigin, isUniqueViolation, jsonError } from '@/lib/request';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Yeni tur başlatır ve rolleri CSPRNG ile atar. İlk turda oyuncular masalara rastgele dağıtılır; sonraki turlarda
 * herkes kendi masasında kalır, lobiye yeni katılanlar boş yeri olan masalara eklenir. Gövdede `{ reshuffle: true }`
 * gelirse herkes yeniden rastgele dağıtılır (eski masa arkadaşları mümkünse ayrılır). Her masanın giriş yapmış bir
 * anlatıcısı yoksa tur başlamaz.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    if (!isSameOrigin(req)) return errors.forbiddenOrigin();
    const session = await getAdminSessionFrom(req.cookies);
    if (!session) return errors.unauthorized();

    const eventId = z.string().uuid().safeParse((await ctx.params).id);
    if (!eventId.success) return errors.badRequest();
    const reshuffle = await req
      .json()
      .then((b) => b?.reshuffle === true)
      .catch(() => false);

    const event = await prisma.event.findUnique({
      where: { id: eventId.data },
      select: { id: true, status: true, allowLess8: true },
    });
    if (!event) return errors.notFound('Etkinlik');
    if (event.status === 'COMPLETED') return jsonError('Etkinlik bitti', 409);

    class Conflict extends Error {}
    const now = new Date();
    let result: { roundId: string; roundNumber: number; tables: { roomNumber: number; size: number; pinId: string }[]; repeatedPairs: number };
    try {
      result = await prisma.$transaction(
        async (tx) => {
          // Aynı etkinlikte PIN devri / oyuncu çıkarma ile çakışmasın: hepsi bu kilidi alır, okumalar kilitten SONRA yapılır.
          await lockEvent(tx, event.id);

          const lastRound = await tx.round.findFirst({
            where: { eventId: event.id },
            orderBy: { roundNumber: 'desc' },
            select: {
              roundNumber: true,
              status: true,
              rooms: { select: { roomNumber: true, assignments: { select: { playerId: true } } } },
            },
          });
          if (lastRound && lastRound.status !== 'COMPLETED') {
            throw new Conflict(`Tur ${lastRound.roundNumber} henüz bitmedi. Tüm masalar sonucu girince yeni tur başlatılabilir.`);
          }
          const roundNumber = (lastRound?.roundNumber ?? 0) + 1;

          const players = await tx.player.findMany({
            where: { eventId: event.id, status: { in: ['LOBBY', 'PLAYING'] } },
            select: { id: true },
          });

          let plan;
          try {
            plan =
              lastRound && !reshuffle
                ? keepSeats(
                    players.map((p) => p.id),
                    lastRound.rooms.map((r) => ({ roomNumber: r.roomNumber, playerIds: r.assignments.map((a) => a.playerId) })),
                    event.allowLess8
                  )
                : planRound(
                    players.map((p) => p.id),
                    event.allowLess8,
                    lastRound?.rooms.map((r) => r.assignments.map((a) => a.playerId)) ?? []
                  );
          } catch (err) {
            if (err instanceof SeatsUnbalancedError) throw new Conflict(err.message);
            throw new Conflict(err instanceof Error ? err.message : 'Masa dağılımı yapılamadı');
          }

          // Her masa numarası için giriş yapmış, süresi dolmamış aktif bir anlatıcı gerekli.
          const pins = await tx.narratorPIN.findMany({
            where: {
              eventId: event.id,
              isActive: true,
              usedAt: { not: null },
              createdAt: { gt: new Date(Date.now() - NARRATOR_PIN_LIFETIME_MS) },
            },
            select: { id: true, tableNumber: true },
          });
          const pinByTable = new Map(pins.map((p) => [p.tableNumber, p.id]));
          const missing = plan.rooms.map((r) => r.roomNumber).filter((n) => !pinByTable.has(n));
          if (missing.length) {
            throw new Conflict(
              `${plan.rooms.length} masa gerekiyor; şu masaların giriş yapmış anlatıcısı yok: ${missing.join(', ')}. ` +
                'Bu masalar için PIN üretip anlatıcıların giriş yapmasını bekleyin.'
            );
          }

          // (eventId, roundNumber) eşsiz: ek güvence.
          const round = await tx.round.create({
            data: { eventId: event.id, roundNumber, status: 'ACTIVE', startTime: now },
            select: { id: true },
          });
          for (const room of plan.rooms) {
            await tx.room.create({
              data: {
                roundId: round.id,
                roomNumber: room.roomNumber,
                narratorPinId: pinByTable.get(room.roomNumber)!,
                status: 'ACTIVE',
                startTime: now,
                assignments: { create: room.players.map((p) => ({ playerId: p.playerId, role: p.role })) },
              },
            });
          }
          await tx.player.updateMany({
            where: { id: { in: players.map((p) => p.id) }, status: { in: ['LOBBY', 'PLAYING'] } },
            data: { status: 'PLAYING' },
          });
          await tx.event.update({ where: { id: event.id }, data: { status: 'IN_PROGRESS' } });
          return {
            roundId: round.id,
            roundNumber,
            repeatedPairs: plan.repeatedPairs,
            tables: plan.rooms.map((r) => ({ roomNumber: r.roomNumber, size: r.players.length, pinId: pinByTable.get(r.roomNumber)! })),
          };
        },
        { timeout: 20_000 }
      );
    } catch (err) {
      if (err instanceof Conflict) return jsonError(err.message, 409);
      if (isUniqueViolation(err)) return jsonError('Bu tur zaten başlatıldı', 409);
      throw err;
    }

    await audit('ROUND_STARTED', 'ADMIN', session.adminId, result.roundId, getClientIp(req));

    // Yalnızca "yenile" sinyalleri; roller her istemciye kendi oturumuyla /api/player/me üzerinden gider.
    emitTo(rooms.players(event.id), 'round_started', { roundNumber: result.roundNumber });
    for (const t of result.tables) emitTo(rooms.narrator(t.pinId), 'round_started', { roundNumber: result.roundNumber });
    emitTo(rooms.admins, 'event_updated', { eventId: event.id });
    emitScreenUpdated(event.id);

    return NextResponse.json({
      success: true,
      roundNumber: result.roundNumber,
      tables: result.tables.map(({ roomNumber, size }) => ({ roomNumber, size })),
      repeatedPairs: result.repeatedPairs,
    });
  } catch (error) {
    console.error('Start round error:', error);
    return errors.server();
  }
}
