import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFrom } from '@/lib/auth';
import { errors } from '@/lib/request';

/** Yerel admin uygulaması açılışta oturumun geçerli olup olmadığını buradan sorar. */
export async function GET(req: NextRequest) {
  const session = await getAdminSessionFrom(req.cookies);
  if (!session) return errors.unauthorized();
  return NextResponse.json({ email: session.email });
}
