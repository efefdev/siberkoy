import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFrom } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { narratorIpLimiter, playerCodeIpLimiter } from '@/lib/rate-limit';
import { errors, getClientIp, isSameOrigin } from '@/lib/request';

/**
 * Anlatıcı PIN'i ve oyuncu cihaz kodu deneme kilitlerini temizler. Ortak Wi-Fi'da tüm cihazlar aynı IP'den
 * çıktığı için birkaç hatalı yazım herkesi kilitleyebilir; admin bunu tek tıkla açar. Admin giriş kilitleri bu
 * uç noktayla açılmaz.
 */
export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) return errors.forbiddenOrigin();
    const session = await getAdminSessionFrom(req.cookies);
    if (!session) return errors.unauthorized();
    narratorIpLimiter.clear();
    playerCodeIpLimiter.clear();
    await audit('RATE_LIMITS_CLEARED', 'ADMIN', session.adminId, null, getClientIp(req));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Rate limit reset error:', error);
    return errors.server();
  }
}
