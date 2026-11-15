import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAdminSessionFrom } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { lockEvent } from '@/lib/locks';
import { emitScreenUpdated, emitTo, rooms } from '@/lib/realtime';
import { NARRATOR_PIN_LIFETIME_MS } from '@/lib/tokens';
import { errors, getClientIp, isSameOrigin, jsonError, parseBody } from '@/lib/request';

type Ctx = { params: Promise<{ id: string }> };
const Id = z.string().uuid();

/** Admin konsolu için etkinliğin tüm durumu. */
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getAdminSessionFrom(req.cookies);
    if (!session) return errors.unauthorized();
    const id = Id.safeParse((await ctx.params).id);
    if (!id.success) return errors.badRequest();

    const event = await prisma.event.findUnique({ where: { id: id.data } });
    if (!event) return errors.notFound('Etkinlik');

    const [players, pins, rounds, alerts] = await Promise.all([
      prisma.player.findMany({
        where: { eventId: event.id },
        orderBy: { createdAt: 'asc' },
        select: { id: true, username: true, status: true, createdAt: true },
      }),
      prisma.narratorPIN.findMany({
        where: { eventId: event.id },
        orderBy: [{ tableNumber: 'asc' }, { createdAt: 'desc' }],
        select: { id: true, pin: true, tableNumber: true, isActive: true, usedAt: true, createdAt: true },
      }),
      prisma.round.findMany({
        where: { eventId: event.id },
        orderBy: { roundNumber: 'asc' },
        select: {
          id: true,
          roundNumber: true,
          status: true,
          startTime: true,
          endTime: true,
          rooms: {
            orderBy: { roomNumber: 'asc' },
            select: {
              id: true,
              roomNumber: true,
              status: true,
              winningSide: true,
              narratorPinId: true,
              assignments: { select: { playerId: true, isAlive: true } },
            },
          },
        },
      }),
      prisma.adminAlert.findMany({
        where: { eventId: event.id, isResolved: false },
        orderBy: { createdAt: 'desc' },
        include: { room: { select: { roomNumber: true } } },
      }),
    ]);

    const now = Date.now();
    return NextResponse.json({
      event,
      players,
      narratorPins: pins.map((p) => ({
        ...p,
        // Kullanılmış PIN'in kendisi artık gösterilmez (yalnızca son 2 karakter).
        pin: p.usedAt ? `••••${p.pin.slice(-2)}` : p.pin,
        expired: p.createdAt.getTime() + NARRATOR_PIN_LIFETIME_MS <= now,
      })),
      rounds,
      alerts,
    });
  } catch (error) {
    console.error('Event state error:', error);
    return errors.server();
  }
}

const PatchSchema = z.union([
  z.object({ status: z.literal('COMPLETED') }),
  z.object({ registrationOpen: z.boolean() }),
]);

/**
 * Etkinliği bitirir ya da katılımı açar/kapatır. (WAITING → IN_PROGRESS geçişi ilk tur başlayınca otomatik olur.)
 * Masası süren bir tur varken etkinlik bitirilemez.
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    if (!isSameOrigin(req)) return errors.forbiddenOrigin();
    const session = await getAdminSessionFrom(req.cookies);
    if (!session) return errors.unauthorized();
    const id = Id.safeParse((await ctx.params).id);
    const body = await parseBody(req, PatchSchema);
    if (!id.success || !body) return errors.badRequest();

    if ('registrationOpen' in body) {
      const updated = await prisma.event.updateMany({
        where: { id: id.data, status: { not: 'COMPLETED' } },
        data: { registrationOpen: body.registrationOpen },
      });
      if (updated.count !== 1) return jsonError('Etkinlik bulunamadı veya bitti', 409);
      await audit(body.registrationOpen ? 'REGISTRATION_OPENED' : 'REGISTRATION_CLOSED', 'ADMIN', session.adminId, id.data, getClientIp(req));
      emitTo(rooms.admins, 'event_updated', { eventId: id.data });
      emitScreenUpdated(id.data);
      return NextResponse.json({ success: true });
    }

    class Conflict extends Error {}
    try {
      await prisma.$transaction(async (tx) => {
        // Tur başlatma ile yarışmasın: aynı etkinlik kilidi.
        await lockEvent(tx, id.data);
        const open = await tx.room.findMany({
          where: { status: 'ACTIVE', round: { eventId: id.data } },
          select: { roomNumber: true },
          orderBy: { roomNumber: 'asc' },
        });
        if (open.length) {
          throw new Conflict(`Masa ${open.map((r) => r.roomNumber).join(', ')} henüz sonucu girmedi. Tüm masalar bitince etkinliği bitirebilirsin.`);
        }
        const updated = await tx.event.updateMany({
          where: { id: id.data, status: { not: 'COMPLETED' } },
          data: { status: 'COMPLETED', closedAt: new Date(), registrationOpen: false },
        });
        if (updated.count !== 1) throw new Conflict('Etkinlik bulunamadı veya zaten bitti');
      });
    } catch (err) {
      if (err instanceof Conflict) return jsonError(err.message, 409);
      throw err;
    }

    await audit('EVENT_COMPLETED', 'ADMIN', session.adminId, id.data, getClientIp(req));
    emitTo(rooms.players(id.data), 'event_updated', {});
    emitScreenUpdated(id.data);
    emitTo(rooms.admins, 'event_updated', { eventId: id.data });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Event patch error:', error);
    return errors.server();
  }
}
