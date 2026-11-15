// Ortam değişkenlerinden okunan güvenlik ayarları. Eksik/zayıf değerle uygulama ÇALIŞMAZ (sabit yedek değer yok).

const MIN_SECRET_LENGTH = 32;

let cachedKey: Uint8Array | null = null;

export function getJwtKey(): Uint8Array {
  if (cachedKey) return cachedKey;
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET tanımlı değil veya ${MIN_SECRET_LENGTH} karakterden kısa. ` +
        '`openssl rand -hex 64` ile üretip .env dosyasına ekleyin.'
    );
  }
  cachedKey = new TextEncoder().encode(secret);
  return cachedKey;
}

/** Tarayıcının uygulamaya eriştiği kök adres (CSP, CORS ve Origin kontrolü için). */
export function getAppOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://siberkoy.omusiber.org').replace(/\/+$/, '');
}

export const isProduction = process.env.NODE_ENV === 'production';
