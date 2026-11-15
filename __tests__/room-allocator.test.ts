import { calculateRoomAllocation } from '../src/lib/room-allocator';

describe('calculateRoomAllocation', () => {
  // İdeal masa 8-9 kişi: 9'u aşan masa varsa aşmayan dağılım tercih edilir.
  test.each([
    [16, [8, 8]],
    [17, [9, 8]],
    [18, [9, 9]],
    [30, [10, 10, 10]], // 4 masa için 32 kişi gerekir (en az 8); 10'luk 3 masa tek seçenek
    [36, [9, 9, 9, 9]],
    [40, [8, 8, 8, 8, 8]],
    [48, [8, 8, 8, 8, 8, 8]],
    [50, [9, 9, 8, 8, 8, 8]],
    [54, [9, 9, 9, 9, 9, 9]],
  ])('%d kişi → %j', (n, sizes) => {
    const result = calculateRoomAllocation(n);
    expect(result.roomSizes).toEqual(sizes);
    expect(result.roomCount).toBe(sizes.length);
  });

  test.each([
    [55, [10, 9, 9, 9, 9, 9]],
    [60, [10, 10, 10, 10, 10, 10]],
    [66, [11, 11, 11, 11, 11, 11]],
    [96, [16, 16, 16, 16, 16, 16]],
  ])('en fazla 6 masa: %d kişi → %j', (n, sizes) => {
    expect(calculateRoomAllocation(n).roomSizes).toEqual(sizes);
  });

  test('hiçbir sayıda 6 masadan fazlası açılmaz; 96 kişiden fazlası için hata', () => {
    for (let n = 8; n <= 96; n++) expect(calculateRoomAllocation(n).roomCount).toBeLessThanOrEqual(6);
    expect(() => calculateRoomAllocation(97)).toThrow();
  });

  test('37 kişi → 4 masa, aralarında en fazla 1 fark', () => {
    const result = calculateRoomAllocation(37);
    expect(result.roomCount).toBe(4);
    expect(Math.max(...result.roomSizes) - Math.min(...result.roomSizes)).toBeLessThanOrEqual(1);
  });

  test('16-54 kişi arası hiçbir masa 8 kişinin altına düşmez, 9’u yalnızca zorunluysa aşar', () => {
    for (let n = 16; n <= 54; n++) {
      const sizes = calculateRoomAllocation(n).roomSizes;
      expect(Math.min(...sizes)).toBeGreaterThanOrEqual(8);
      // 9'u aşan masa ancak n kişiyle 8-9'luk masalar kurulamıyorsa olur
      const fits89 = Array.from({ length: Math.floor(n / 8) }, (_, i) => i + 1).some((r) => n >= 8 * r && n <= 9 * r);
      if (fits89) expect(Math.max(...sizes)).toBeLessThanOrEqual(9);
    }
  });

  test('Toplam kişi sayısı korunur', () => {
    [15, 24, 30, 36, 48, 60].forEach(n => {
      const result = calculateRoomAllocation(n);
      const total = result.roomSizes.reduce((a, b) => a + b, 0);
      expect(total).toBe(n);
    });
  });

  test('Min 8, max 16 kural ihlali olmamalı', () => {
    [8, 12, 16, 24, 30, 48, 64].forEach(n => {
      const result = calculateRoomAllocation(n);
      result.roomSizes.forEach(size => {
        expect(size).toBeGreaterThanOrEqual(8);
        expect(size).toBeLessThanOrEqual(16);
      });
    });
  });

  test('8 kişi altında allowLess8=false → hata fırlatır', () => {
    expect(() => calculateRoomAllocation(5, false)).toThrow();
  });

  test('8 kişi altında allowLess8=true → 1 masa döner', () => {
    const result = calculateRoomAllocation(4, true);
    expect(result.roomCount).toBe(1);
    expect(result.roomSizes[0]).toBe(4);
  });

  test('test modunda bile 4 kişi altı (0 dahil) → hata', () => {
    [0, 1, 3].forEach((n) => expect(() => calculateRoomAllocation(n, true)).toThrow());
  });
});
