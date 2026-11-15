import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAdminSessionFrom } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { emitTo, rooms } from '@/lib/realtime';
import { errors, getClientIp, isSameOrigin } from '@/lib/request';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    if (!isSameOrigin(req)) return errors.forbiddenOrigin();
    const session = await getAdminSessionFrom(req.cookies);
    if (!session) return errors.unauthorized();
    const id = z.string().uuid().safeParse((await ctx.params).id);
    if (!id.success) return errors.badRequest();

    const alert = await prisma.adminAlert.findUnique({ where: { id: id.data }, select: { id: true, eventId: true } });
    if (!alert) return errors.notFound('Bildirim');
    await prisma.adminAlert.update({ where: { id: alert.id }, data: { isResolved: true } });

    await audit('ALERT_RESOLVED', 'ADMIN', session.adminId, alert.id, getClientIp(req));
    emitTo(rooms.admins, 'event_updated', { eventId: alert.eventId });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Resolve alert error:', error);
    return errors.server();
  }
}
