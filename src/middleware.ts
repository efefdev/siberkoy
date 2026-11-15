import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isAdminVia } from '@/lib/admin-via';

/**
 * Admin API'si internete kapalıdır. Erişim yolları:
 *  - SSH tüneli: istek sunucunun yalnızca içeriye açık 127.0.0.1:3000 portundaki Nginx girişinden gelir (`tunnel`).
 *  - Acil durum: Nginx yalnızca izin verilen IP için `X-Siberkoy-Via: admin-emergency` yazar.
 * Nginx'ten gelen her normal istekte bu başlık `public` olarak ezilir (istemci değiştiremez).
 * Üretimde fail-closed: başlık `tunnel`/`admin-emergency` değilse (yoksa da) 404. Böylece uygulama yanlışlıkla
 * Nginx'siz yayınlanırsa admin API'si açık kalmaz. Geliştirmede (Nginx yok) yalnızca `public` reddedilir.
 * Bu, Nginx'teki engelin arkasındaki ikinci katmandır.
 */
export function middleware(request: NextRequest) {
  if (!isAdminVia(request.headers.get('x-siberkoy-via'), process.env.NODE_ENV === 'production')) {
    return new NextResponse('Not Found', { status: 404 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/admin/:path*'],
};
