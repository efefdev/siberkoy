import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { narratorPinExpiresAt, setNarratorSessionCookie } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { narratorIpLimiter } from '@/lib/rate-limit';
import { NARRATOR_PIN_LIFETIME_MS } from '@/lib/tokens';
import { errors, getClientIp, isSameOrigin, jsonError, parseBody } from '@/lib/request';

const LoginSchema = z.object({
  pin: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4,32}$/),
});

// Hangi koşulun tutmadığı (yok / kullanılmış / süresi dolmuş / iptal) bilerek ayırt edilmez.
const GENERIC_ERROR = 'Geçersiz, kullanılmış veya süresi dolmuş PIN';

// Anlatıcı PIN'i tek kullanımlıktır: ilk başarılı girişte kilitlenir (usedAt dolar), başka cihazdan tekrar kullanılamaz.
// Anlatıcının cihazı kapanırsa admin yeni PIN üretip masayı devreder.
export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) return errors.forbiddenOrigin();
    const ip = getClientIp(req);

    const locked = narratorIpLimiter.lockedFor(ip);
    if (locked) {
      return jsonError(`Çok fazla başarısız deneme. Lütfen ${Math.ceil(locked / 60000)} dakika sonra tekrar deneyin.`, 429);
    }

    const body = await parseBody(req, LoginSchema);
    if (!body) {
      narratorIpLimiter.recordFailure(ip);
      return jsonError(GENERIC_ERROR, 401);
    }

    const now = new Date();
    // Atomik kilit: iki cihaz aynı anda girmeye çalışırsa yalnızca biri başarılı olur.
    const claimed = await prisma.narratorPIN.updateMany({
      where: {
        pin: body.pin,
        isActive: true,
        usedAt: null,
        createdAt: { gt: new Date(now.getTime() - NARRATOR_PIN_LIFETIME_MS) },
        event: { status: { not: 'COMPLETED' } },
      },
      data: { usedAt: now },
    });

    if (claimed.count !== 1) {
      narratorIpLimiter.recordFailure(ip);
      await audit('NARRATOR_LOGIN_FAILED', 'SYSTEM', 'anonymous', null, ip);
      return jsonError(GENERIC_ERROR, 401);
    }

    const pin = await prisma.narratorPIN.findUniqueOrThrow({
      where: { pin: body.pin },
      select: { id: true, eventId: true, createdAt: true, event: { select: { name: true } } },
    });

    narratorIpLimiter.reset(ip);
    await audit('NARRATOR_LOGIN', 'NARRATOR', pin.id, null, ip);

    const res = NextResponse.json({ success: true, eventName: pin.event.name });
    await setNarratorSessionCookie(res, pin.id, pin.eventId, narratorPinExpiresAt(pin.createdAt));
    return res;
  } catch (error) {
    console.error('Narrator login error:', error);
    return errors.server();
  }
}
