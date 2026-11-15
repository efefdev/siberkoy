// Oyuncu takma adı normalizasyonu.

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;

/**
 * Görünen adı temizler: Unicode NFKC, kontrol/biçim karakterlerini (sıfır genişlikli boşluk, yön işaretleri vb.) atar,
 * boşlukları teke indirir. Geçersizse null döner.
 */
export function normalizeUsername(input: string): string | null {
  const cleaned = input
    .normalize('NFKC')
    .replace(/[\p{C}]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
  const length = [...cleaned].length;
  if (length < USERNAME_MIN || length > USERNAME_MAX) return null;
  // En az bir harf veya rakam içermeli
  if (!/[\p{L}\p{N}]/u.test(cleaned)) return null;
  return cleaned;
}

/** Eşsizlik anahtarı: "Efe", "EFE" ve "efe" aynı ad sayılır (Türkçe büyük/küçük harf kurallarıyla). */
export function usernameKey(normalized: string): string {
  return normalized.toLocaleLowerCase('tr-TR');
}
