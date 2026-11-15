import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAdminSessionFrom } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { emitScoreboardUpdated } from '@/lib/realtime';
import { errors, getClientIp, isSameOrigin, parseBody } from '@/lib/request';

// Puan düzeltme yalnızca admin tarafından yapılır. Eski kayıtlar silinmez/değiştirilmez (append-only);
// düzeltme, gerekçesiyle birlikte ayrı bir ADJUSTMENT kaydı olarak eklenir (örn. hatalı +3 için -3).
const AdjustSchema = z.object({
  eventId: z.string().uuid(),
  playerId: z.string().uuid(),
  delta: z.number().int().min(-10).max(10).refine((n) => n !== 0, 'Sıfır olamaz'),
  reason: z.string().trim().min(3).max(200),
});

export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) return errors.forbiddenOrigin();
    const session = await getAdminSessionFrom(req.cookies);
    if (!session) return errors.unauthorized();

    const body = await parseBody(req, AdjustSchema);
    if (!body) return errors.badRequest();

    const player = await prisma.player.findFirst({ where: { id: body.playerId, eventId: body.eventId }, select: { id: true } });
    if (!player) return errors.notFound('Oyuncu');

    const scoreEvent = await prisma.scoreEvent.create({
      data: {
        eventId: body.eventId,
        playerId: body.playerId,
        kind: 'ADJUSTMENT',
        score: body.delta,
        reason: `Admin düzeltmesi: ${body.reason}`,
        createdBy: `ADMIN:${session.adminId}`,
      },
    });

    await audit('SCORE_ADJUSTED', 'ADMIN', session.adminId, scoreEvent.id, getClientIp(req));
    emitScoreboardUpdated(body.eventId);
    return NextResponse.json({ success: true, scoreEvent });
  } catch (error) {
    console.error('Score adjust error:', error);
    return errors.server();
  }
}
