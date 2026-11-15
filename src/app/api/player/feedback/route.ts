import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { lastNarratorOf } from '@/lib/feedback';
import { getPlayerSessionFrom } from '@/lib/auth';
import { errors, isSameOrigin, isUniqueViolation, jsonError, parseBody } from '@/lib/request';

const FeedbackSchema = z.object({
  narratorId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  message: z
    .string()
    .transform((s) => s.replace(/[\p{C}]/gu, ' ').trim())
    .pipe(z.string().max(500))
    .optional(),
});

// Oyuncu → anlatıcı puanlaması. Oyuncu kimliği istemciden değil oturum çerezinden gelir;
// yalnızca oyuncunun gerçekten masasında bulunduğu anlatıcı puanlanabilir, her anlatıcıya bir kez.
// (Geri bildirim listesi admin içindir: GET /api/admin/feedback)
export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) return errors.forbiddenOrigin();
    const session = await getPlayerSessionFrom(req.cookies);
    if (!session) return errors.unauthorized();

    const body = await parseBody(req, FeedbackSchema);
    if (!body) return errors.badRequest();

    // Yalnızca etkinlik bitince ve yalnızca oyuncunun EN SON oynadığı masanın anlatıcısı puanlanır
    // (masa devredildiyse o masayı son yöneten PIN). Tek geçerli hedef olduğundan oyuncu başına tek geri bildirim olur.
    const event = await prisma.event.findUnique({ where: { id: session.eventId }, select: { status: true } });
    if (event?.status !== 'COMPLETED') return jsonError('Anlatıcı puanlaması etkinlik bitince açılır', 409);
    const target = await lastNarratorOf(session.playerId);
    if (!target || target.narratorId !== body.narratorId) return errors.notFound('Anlatıcı');

    try {
      const feedback = await prisma.narratorFeedback.create({
        data: {
          eventId: session.eventId,
          playerId: session.playerId,
          narratorId: body.narratorId,
          rating: body.rating,
          message: body.message || null,
        },
        select: { id: true },
      });
      return NextResponse.json({ success: true, feedback });
    } catch (err) {
      if (isUniqueViolation(err)) return jsonError('Geri bildirimini zaten gönderdin', 409);
      throw err;
    }
  } catch (error) {
    console.error('Feedback error:', error);
    return errors.server();
  }
}
