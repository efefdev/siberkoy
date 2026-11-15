import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAdminSessionFrom } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { generateNarratorPin } from '@/lib/round-planner';
import { lockEvent } from '@/lib/locks';
import { disconnectRoom, emitTo, rooms } from '@/lib/realtime';
import { errors, getClientIp, isSameOrigin, isUniqueViolation, jsonError, parseBody } from '@/lib/request';

type Ctx = { params: Promise<{ id: string }> };

const Schema = z.object({ tableNumber: z.number().int().min(1).max(20) });

/**
 * Bir masa için anlatıcı PIN'i üretir. Masada zaten aktif bir PIN varsa o PIN iptal edilir ve süren turdaki masa
 * yeni PIN'e devredilir (anlatıcının telefonu kapandı / anlatıcı değişti senaryosu).
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    if (!isSameOrigin(req)) return errors.forbiddenOrigin();
    const session = await getAdminSessionFrom(req.cookies);
    if (!session) return errors.unauthorized();

    const eventId = z.string().uuid().safeParse((await ctx.params).id);
    const body = await parseBody(req, Schema);
    if (!eventId.success || !body) return errors.badRequest();

    const event = await prisma.event.findUnique({ where: { id: eventId.data }, select: { status: true } });
    if (!event) return errors.notFound('Etkinlik');
    if (event.status === 'COMPLETED') return jsonError('Etkinlik bitti', 409);

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const result = await prisma.$transaction(async (tx) => {
          // Aynı masaya eşzamanlı iki PIN üretimi ya da tur başlatma ile çakışmayı önler.
          await lockEvent(tx, eventId.data);
          const previous = await tx.narratorPIN.findMany({
            where: { eventId: eventId.data, tableNumber: body.tableNumber, isActive: true },
            select: { id: true },
          });
          const previousIds = previous.map((p) => p.id);
          if (previousIds.length) {
            await tx.narratorPIN.updateMany({ where: { id: { in: previousIds } }, data: { isActive: false } });
          }
          const pin = await tx.narratorPIN.create({
            data: { eventId: eventId.data, tableNumber: body.tableNumber, pin: generateNarratorPin() },
            select: { id: true, pin: true, tableNumber: true, createdAt: true },
          });
          let handedOver = 0;
          if (previousIds.length) {
            const moved = await tx.room.updateMany({
              where: { narratorPinId: { in: previousIds }, status: 'ACTIVE' },
              data: { narratorPinId: pin.id },
            });
            handedOver = moved.count;
          }
          return { pin, previousIds, handedOver };
        });

        // Eski anlatıcı cihazının açık bağlantıları kapatılır; rol bilgisini dinlemeye devam edemez.
        for (const old of result.previousIds) disconnectRoom(rooms.narrator(old));
        await audit('NARRATOR_PIN_CREATED', 'ADMIN', session.adminId, result.pin.id, getClientIp(req));
        emitTo(rooms.admins, 'event_updated', { eventId: eventId.data });

        return NextResponse.json({ success: true, pin: result.pin, replaced: result.previousIds.length, handedOver: result.handedOver });
      } catch (err) {
        if (!isUniqueViolation(err)) throw err; // PIN çakışması: yeniden dene
      }
    }
    return jsonError('PIN üretilemedi, tekrar deneyin', 500);
  } catch (error) {
    console.error('Narrator PIN error:', error);
    return errors.server();
  }
}
