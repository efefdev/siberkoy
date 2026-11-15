// Tur planlama: oyuncuları masalara böler ve rolleri atar (saf fonksiyon, test edilebilir).
import { randomInt } from 'crypto';
import { assignRoles, type Role } from './role-allocator';
import { calculateRoomAllocation, type RoomAllocation } from './room-allocator';

export interface PlannedRoom {
  roomNumber: number; // = fiziksel masa numarası (1'den başlar)
  players: { playerId: string; role: Role }[];
}

export interface RoundPlan {
  allocation: RoomAllocation;
  rooms: PlannedRoom[];
  repeatedPairs: number; // önceki turda da aynı masada olan oyuncu çifti sayısı
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1); // CSPRNG, modülo yanlılığı yok
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pairKey(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Önceki turun masa listesinden "birlikte oynamış" çift kümesi. */
export function previousPairs(previousRooms: string[][]): Set<string> {
  const pairs = new Set<string>();
  for (const room of previousRooms) {
    for (let i = 0; i < room.length; i++) {
      for (let j = i + 1; j < room.length; j++) pairs.add(pairKey(room[i], room[j]));
    }
  }
  return pairs;
}

function countRepeats(rooms: string[][], pairs: Set<string>): number {
  if (pairs.size === 0) return 0;
  let n = 0;
  for (const room of rooms) {
    for (let i = 0; i < room.length; i++) {
      for (let j = i + 1; j < room.length; j++) if (pairs.has(pairKey(room[i], room[j]))) n++;
    }
  }
  return n;
}

function split(players: string[], sizes: number[]): string[][] {
  const rooms: string[][] = [];
  let k = 0;
  for (const size of sizes) {
    rooms.push(players.slice(k, k + size));
    k += size;
  }
  return rooms;
}

/**
 * Masaları planlar. Eski masa arkadaşlarını ayırmak "best-effort"tur (docs/DECISIONS.md): birçok rastgele
 * karıştırma denenir, en az tekrar eden çifti içeren seçilir. Kesin kısıt değildir, tur asla tıkanmaz.
 */
export function planRound(
  playerIds: string[],
  allowLess8: boolean,
  previousRooms: string[][] = [],
  attempts = 300
): RoundPlan {
  const allocation = calculateRoomAllocation(playerIds.length, allowLess8);
  const pairs = previousPairs(previousRooms);

  let best = split(shuffle(playerIds), allocation.roomSizes);
  let bestScore = countRepeats(best, pairs);
  for (let t = 1; t < attempts && bestScore > 0; t++) {
    const candidate = split(shuffle(playerIds), allocation.roomSizes);
    const score = countRepeats(candidate, pairs);
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return {
    allocation,
    repeatedPairs: bestScore,
    rooms: best.map((ids, i) => ({ roomNumber: i + 1, players: assignRoles(ids) })),
  };
}

// Anlatıcı PIN'i: karıştırılması kolay karakterler (0/O, 1/I/L) yok. 6 karakter, 31^6 ≈ 887 milyon olasılık.
const PIN_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Masa korunarak kurulamadığında (masa çok küçüldü/büyüdü): admin "yeniden dağıt" ile başlatmalı. */
export class SeatsUnbalancedError extends Error {}

/**
 * Masaları korur: oyuncular bir önceki turdaki masa numaralarında kalır, roller yeniden dağıtılır.
 * Önceki turda masası olmayan (lobiye sonradan katılan) oyuncular rastgele sırayla en az kişinin olduğu masaya eklenir.
 * Ayrılanlar yüzünden boşalan masa listeden düşmez; masa sınırların (en az 8, test modunda 4; en fazla 16) dışına
 * çıkarsa SeatsUnbalancedError fırlatılır ve admin masaları yeniden dağıtarak başlatır.
 */
export function keepSeats(
  playerIds: string[],
  previousRooms: { roomNumber: number; playerIds: string[] }[],
  allowLess8: boolean
): RoundPlan {
  const active = new Set(playerIds);
  const seats = new Map<number, string[]>();
  const seated = new Set<string>();
  for (const room of [...previousRooms].sort((a, b) => a.roomNumber - b.roomNumber)) {
    const stay = room.playerIds.filter((id) => active.has(id) && !seated.has(id));
    stay.forEach((id) => seated.add(id));
    seats.set(room.roomNumber, stay);
  }
  if (seats.size === 0) throw new SeatsUnbalancedError('Önceki turun masaları bulunamadı.');

  for (const id of shuffle(playerIds.filter((pid) => !seated.has(pid)))) {
    const [roomNumber] = [...seats.entries()].sort((a, b) => a[1].length - b[1].length || a[0] - b[0])[0];
    seats.get(roomNumber)!.push(id);
  }

  const min = allowLess8 ? 4 : 8;
  const bad = [...seats.entries()].filter(([, ids]) => ids.length < min || ids.length > 16);
  if (bad.length) {
    throw new SeatsUnbalancedError(
      `Masalar korunarak tur başlatılamıyor: ${bad.map(([n, ids]) => `masa ${n}'de ${ids.length} kişi`).join(', ')} ` +
        `(her masada ${min}-16 kişi olmalı). “Masaları yeniden dağıt” ile başlatın.`
    );
  }

  const rooms = [...seats.entries()].sort((a, b) => a[0] - b[0]).map(([roomNumber, ids]) => ({ roomNumber, players: assignRoles(ids) }));
  return {
    allocation: { roomCount: rooms.length, roomSizes: rooms.map((r) => r.players.length) },
    rooms,
    repeatedPairs: 0,
  };
}

export function generateNarratorPin(length = 6): string {
  let out = '';
  for (let i = 0; i < length; i++) out += PIN_ALPHABET[randomInt(PIN_ALPHABET.length)];
  return out;
}
