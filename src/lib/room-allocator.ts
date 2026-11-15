export interface RoomAllocation {
  roomCount: number;
  roomSizes: number[];
}

/**
 * Siber Köy Masa Dağıtım Algoritması
 * Kurallar:
 * - Minimum 8, Maksimum 16 kişi (admin 'allowLess8' seçmediyse).
 * - İdeal 8-9 kişi (daha küçük masa: herkes daha çok konuşur, oyun daha hızlı döner).
 * - Masalar arası fark en fazla 1 olabilir.
 */
/** İdeal masa büyüklüğü 8-9 kişi. */
export const IDEAL_MAX = 9;
/** En fazla masa sayısı (o kadar anlatıcı var). Kalabalıkta masalar 9'un üstüne büyür, en fazla 16. */
export const MAX_ROOMS = 6;
const IDEAL_CENTER = 8.5;

export function calculateRoomAllocation(totalPlayers: number, allowLess8: boolean = false): RoomAllocation {
  if (totalPlayers < 8 && !allowLess8) {
    throw new Error("Katılımcı sayısı yetersiz. En az 8 kişi gereklidir.");
  }
  
  if (totalPlayers < 4) {
    // Test modunda bile: 1 hacker + analist + yama + en az 1 kullanıcı gerekir.
    throw new Error("Katılımcı sayısı yetersiz. Test modunda bile en az 4 kişi gereklidir.");
  }

  if (totalPlayers < 8 && allowLess8) {
    // Test durumu için tek masa
    return { roomCount: 1, roomSizes: [totalPlayers] };
  }

  let bestR = 1;
  let bestAvgDiff = Infinity;
  let bestOverflow = Infinity;
  let validAllocations: RoomAllocation[] = [];

  // R: Masa sayısı (1'den N'e kadar deneyebiliriz, pratikte 1'den totalPlayers/8'e kadar)
  const maxRooms = Math.min(MAX_ROOMS, Math.max(1, Math.floor(totalPlayers / 8)));

  for (let R = 1; R <= maxRooms; R++) {
    const baseSize = Math.floor(totalPlayers / R);
    const remainder = totalPlayers % R;

    const minSizeInConfig = baseSize;
    const maxSizeInConfig = baseSize + (remainder > 0 ? 1 : 0);

    // Geçerlilik kontrolü (min 8, max 16)
    if (minSizeInConfig >= 8 && maxSizeInConfig <= 16) {
      const sizes: number[] = [];
      for (let i = 0; i < R; i++) {
        sizes.push(i < remainder ? baseSize + 1 : baseSize);
      }

      validAllocations.push({
        roomCount: R,
        roomSizes: sizes
      });

      // İdeal masa 8-9 kişidir: 9'u aşan bir masa varsa, aşmayan alternatif tercih edilir.
      // Birincil kriter: 9'u aşan masaların toplam taşması (overflow),
      // ikincil kriter: ortalama boyutun 8.5'e (ideal aralığın orta noktası) yakınlığı.
      const overflow = sizes.reduce((sum, s) => sum + Math.max(0, s - IDEAL_MAX), 0);
      const avgSize = totalPlayers / R;
      const diffFromIdeal = Math.abs(avgSize - IDEAL_CENTER);

      if (overflow < bestOverflow || (overflow === bestOverflow && diffFromIdeal < bestAvgDiff)) {
        bestOverflow = overflow;
        bestAvgDiff = diffFromIdeal;
        bestR = R;
      }
    }
  }
  
  if (validAllocations.length === 0) {
    // Teori olarak matematiksel bir boşluk olabilir mi? 
    // Örn: N=15 için baseSize 15 (Geçerli R=1). 
    // Eğer hiçbir geçerli R bulunamazsa, kuralları en az bozan durumu "best-effort" ile döndürelim
    throw new Error(`Bu katılımcı sayısı ile kurallara uygun masa dağılımı yapılamıyor (en fazla ${MAX_ROOMS} masa, masa başına 8-16 kişi; en fazla ${MAX_ROOMS * 16} oyuncu).`);
  }

  // En iyi R'yi döndür
  const bestAllocation = validAllocations.find(a => a.roomCount === bestR)!;
  return bestAllocation;
}

/**
 * Oyuncuları odalara (rastgele ve eski arkadaşlarından mümkün olduğunca uzak) dağıtır.
 */
export function assignPlayersToRooms(
  playerIds: string[], 
  allocation: RoomAllocation,
  previousAssignments: Array<{playerId: string, roomId: string}> = [] // Gelecek turlarda best-effort için
): string[][] {
  // Fisher-Yates shuffle ve CSPRNG ile oyuncuları rastgele karıştır
  const shuffled = [...playerIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const randomBuffer = new Uint32Array(1);
    crypto.getRandomValues(randomBuffer);
    const j = randomBuffer[0] % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Odalara yerleştirme
  const rooms: string[][] = Array.from({ length: allocation.roomCount }, () => []);
  let playerIndex = 0;
  
  for (let i = 0; i < allocation.roomCount; i++) {
    const size = allocation.roomSizes[i];
    for (let j = 0; j < size; j++) {
      rooms[i].push(shuffled[playerIndex]);
      playerIndex++;
    }
  }

  return rooms;
}
