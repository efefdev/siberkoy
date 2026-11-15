import { NextRequest, NextResponse } from 'next/server';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { setAdminSessionCookie } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { ADMIN_VIA_EMERGENCY } from '@/lib/admin-via';
import { adminAccountLimiter, adminIpLimiter } from '@/lib/rate-limit';
import { errors, getClientIp, isSameOrigin, jsonError, parseBody } from '@/lib/request';

const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(256),
});

const GENERIC_ERROR = 'E-posta veya şifre hatalı';

// Olmayan e-postada da gerçek bir Argon2id doğrulaması yapılır; yanıt süresi hesabın varlığını ele vermez.
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash() {
  dummyHashPromise ??= argon2.hash(randomBytes(32).toString('hex'), { type: argon2.argon2id });
  return dummyHashPromise;
}

function lockedResponse(ms: number) {
  const minutes = Math.max(1, Math.ceil(ms / 60000));
  return jsonError(`Çok fazla başarısız deneme. Lütfen ${minutes} dakika sonra tekrar deneyin.`, 429);
}

export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) return errors.forbiddenOrigin();
    const ip = getClientIp(req);

    const ipLock = adminIpLimiter.lockedFor(ip);
    if (ipLock) return lockedResponse(ipLock);

    const body = await parseBody(req, LoginSchema);
    if (!body) return errors.badRequest();

    // Hesap kilidi yalnızca acil (internete açık IP) yolundan gelen denemeleri sayar ve yalnızca o yolu kilitler.
    // Böylece acil izin açıkken aynı dış IP'yi paylaşan biri hesabı kilitlese bile SSH tünelinden giriş her zaman mümkündür.
    const viaEmergency = req.headers.get('x-siberkoy-via') === ADMIN_VIA_EMERGENCY;
    const accountKey = body.email;
    if (viaEmergency) {
      const accountLock = adminAccountLimiter.lockedFor(accountKey);
      if (accountLock) return lockedResponse(accountLock);
    }

    const admin = await prisma.admin.findUnique({ where: { email: body.email } });
    const valid = admin
      ? await argon2.verify(admin.passwordHash, body.password)
      : (await argon2.verify(await getDummyHash(), body.password), false);

    if (!admin || !valid) {
      adminIpLimiter.recordFailure(ip);
      if (viaEmergency) adminAccountLimiter.recordFailure(accountKey);
      await audit('ADMIN_LOGIN_FAILED', 'SYSTEM', 'anonymous', admin?.id ?? null, ip);
      return jsonError(GENERIC_ERROR, 401);
    }

    adminIpLimiter.reset(ip);
    if (viaEmergency) adminAccountLimiter.reset(accountKey);

    const res = NextResponse.json({ success: true });
    await setAdminSessionCookie(res, admin.id, admin.email);
    await audit('ADMIN_LOGIN', 'ADMIN', admin.id, null, ip);
    return res;
  } catch (error) {
    console.error('Admin login error:', error);
    return errors.server();
  }
}
