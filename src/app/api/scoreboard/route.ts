import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { loadScoreboard } from '@/lib/scoreboard-data';
import { errors } from '@/lib/request';

// Herkese açık skor tablosu: yalnızca takma ad ve toplam puan döner (rol, masa vb. gizli bilgi yok).
export async function GET(req: NextRequest) {
  try {
    const eventId = z.string().uuid().safeParse(req.nextUrl.searchParams.get('eventId'));
    if (!eventId.success) return errors.badRequest();

    const event = await prisma.event.findUnique({ where: { id: eventId.data }, select: { name: true, status: true, theme: true } });
    if (!event) return errors.notFound('Etkinlik');

    const scoreboard = await loadScoreboard(eventId.data);

    return NextResponse.json({ scoreboard, eventName: event.name, eventStatus: event.status, theme: event.theme });
  } catch (error) {
    console.error('Scoreboard error:', error);
    return errors.server();
  }
}
