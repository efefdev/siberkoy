import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAdminSessionFrom } from '@/lib/auth';
import { errors } from '@/lib/request';

// Yalnızca admin: bir etkinliğin anlatıcı geri bildirimleri ve anlatıcı bazında ortalamalar.
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSessionFrom(req.cookies);
    if (!session) return errors.unauthorized();

    const eventId = z.string().uuid().safeParse(req.nextUrl.searchParams.get('eventId'));
    if (!eventId.success) return errors.badRequest();

    const feedbacks = await prisma.narratorFeedback.findMany({
      where: { eventId: eventId.data },
      include: { player: { select: { username: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const byNarrator = new Map<string, { total: number; count: number }>();
    for (const f of feedbacks) {
      const e = byNarrator.get(f.narratorId) ?? { total: 0, count: 0 };
      e.total += f.rating;
      e.count += 1;
      byNarrator.set(f.narratorId, e);
    }
    const averages = Array.from(byNarrator, ([narratorId, d]) => ({
      narratorId,
      averageRating: Number((d.total / d.count).toFixed(2)),
      totalFeedbacks: d.count,
    }));

    return NextResponse.json({ feedbacks, averages });
  } catch (error) {
    console.error('Admin feedback error:', error);
    return errors.server();
  }
}
