// Küçük Türkçe metin yardımcıları (admin uygulaması ile paylaşılır).

/** Türkçe belirtme hâli eki: 1’i, 2’yi, 3’ü, 6’yı, 9’u, 10’u, 40’ı … */
export function accusative(n: number): string {
  const ones = ['', 'i', 'yi', 'ü', 'ü', 'i', 'yı', 'yi', 'i', 'u'];
  const tens = ['', 'u', 'yi', 'u', 'ı', 'yi', 'ı', 'i', 'i', 'ı'];
  const v = Math.abs(n);
  if (v === 0) return `${n}’ı`;
  if (v % 10) return `${n}’${ones[v % 10]}`;
  if (v % 100) return `${n}’${tens[(v / 10) % 10]}`;
  return `${n}’ü`;
}

