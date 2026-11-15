import { NextRequest, NextResponse } from 'next/server';
import { clearAdminSessionCookie, getAdminSessionFrom } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { errors, getClientIp, isSameOrigin } from '@/lib/request';

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return errors.forbiddenOrigin();
  const session = await getAdminSessionFrom(req.cookies);
  const res = NextResponse.json({ success: true });
  clearAdminSessionCookie(res);
  if (session) await audit('ADMIN_LOGOUT', 'ADMIN', session.adminId, null, getClientIp(req));
  return res;
}
