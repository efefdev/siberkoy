import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAppOrigin, isProduction } from './config';

/**
 * İstemci IP'si. Nginx `X-Real-IP` başlığını gerçek bağlantı adresiyle ezer; `X-Forwarded-For`
 * istemci tarafından uydurulabildiği için kullanılmaz. Uygulama portu dışarı açık olmadığı sürece güvenilirdir.
 */
export function getClientIp(req: NextRequest): string {
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

/**
 * Durum değiştiren isteklerde (POST/PATCH/DELETE) başka siteden gelen istekleri reddeder (CSRF'e ek katman).
 * Origin başlığı yoksa (tarayıcı dışı istemci) çerez de gönderilmeyeceği için izin verilir.
 */
export function isSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  const allowed = new Set([getAppOrigin()]);
  if (!isProduction) {
    allowed.add('http://localhost:3000');
    allowed.add('http://127.0.0.1:3000');
  }
  return allowed.has(origin);
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export const errors = {
  badRequest: () => jsonError('Geçersiz istek', 400),
  unauthorized: () => jsonError('Yetkisiz erişim', 401),
  forbiddenOrigin: () => jsonError('İzin verilmeyen kaynak', 403),
  notFound: (what = 'Kayıt') => jsonError(`${what} bulunamadı`, 404),
  server: () => jsonError('Sunucu hatası', 500),
};

/** Gövdeyi JSON olarak okuyup şemaya göre doğrular; hata durumunda null döner. */
export async function parseBody<T extends z.ZodTypeAny>(req: NextRequest, schema: T): Promise<z.infer<T> | null> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return null;
  }
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Prisma eşsizlik ihlali (P2002) mi? */
export function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002';
}
