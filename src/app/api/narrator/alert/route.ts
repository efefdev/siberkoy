import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getNarratorSessionFrom } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { findNarratorRoom } from '@/lib/narrator-room';
import { emitTo, rooms } from '@/lib/realtime';
import { errors, getClientIp, isSameOrigin, parseBody } from '@/lib/request';

const AlertSchema = z.object({
  roomId: z.string().uuid().optional(),
  message: z
    .string()
    .transform((s) => s.replace(/[\p{C}]/gu, ' ').trim())
    .pipe(z.string().min(1).max(250)),
});

// Anlatıcıdan admine yardım bildirimi. Etkinlik bilgisi istemciden değil oturumdan alınır.
export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) return errors.forbiddenOrigin();
    const session = await getNarratorSessionFrom(req.cookies);
    if (!session) return errors.unauthorized();

    const body = await parseBody(req, AlertSchema);
    if (!body) return errors.badRequest();

    let roomId: string | null = null;
    if (body.roomId) {
      const room = await findNarratorRoom(session, body.roomId);
      if (!room) return errors.notFound('Oda');
      roomId = room.id;
    }

    const alert = await prisma.adminAlert.create({
      data: { eventId: session.eventId, roomId, message: body.message },
      include: { room: { select: { roomNumber: true } } },
    });

    await audit('NARRATOR_ALERT_ADMIN', 'NARRATOR', session.narratorPinId, alert.id, getClientIp(req));
    emitTo(rooms.admins, 'new_admin_alert', alert);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Alert admin error:', error);
    return errors.server();
  }
}
