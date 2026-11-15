// Skor tablosu hesaplaması (saf fonksiyon, test edilebilir).
// Sıralama: toplam puan (azalan) → bitirilen masa sayısı (azalan, daha çok tur oynayan üstte)
// → bitirilen masaların ORTALAMA süresi (artan, hızlı olan üstte) → ad. Puan, masa sayısı ve
// ortalama süre birebir aynıysa sıra paylaşılır. Hiç puanı olmayan oyuncular da listede yer alır.

export interface PlayerInput {
  id: string;
  username: string;
}

export interface ScoreInput {
  playerId: string;
  score: number;
}

export interface RoomTimeInput {
  playerId: string;
  startTime: Date | null;
  endTime: Date | null;
}

export interface ScoreboardEntry {
  rank: number;
  id: string;
  username: string;
  totalScore: number;
  roundsPlayed: number;
}

export function buildScoreboard(players: PlayerInput[], scores: ScoreInput[], roomTimes: RoomTimeInput[]): ScoreboardEntry[] {
  const rows = new Map<string, { id: string; username: string; totalScore: number; rounds: number; totalMs: number; timed: number }>();
  for (const p of players) rows.set(p.id, { id: p.id, username: p.username, totalScore: 0, rounds: 0, totalMs: 0, timed: 0 });

  // Listede olmayan oyuncunun (ör. banlı) puanı yok sayılır.
  for (const s of scores) {
    const r = rows.get(s.playerId);
    if (r) r.totalScore += s.score;
  }

  for (const t of roomTimes) {
    const r = rows.get(t.playerId);
    if (!r) continue;
    r.rounds += 1;
    if (!t.startTime || !t.endTime) continue;
    const ms = t.endTime.getTime() - t.startTime.getTime();
    if (ms < 0) continue;
    r.totalMs += ms;
    r.timed += 1;
  }

  const avg = (r: { totalMs: number; timed: number }) => (r.timed ? r.totalMs / r.timed : Number.POSITIVE_INFINITY);
  type Tier = { totalScore: number; rounds: number; totalMs: number; timed: number };
  const sameTier = (a: Tier, b: Tier) =>
    a.totalScore === b.totalScore && a.rounds === b.rounds && avg(a) === avg(b);

  const sorted = Array.from(rows.values()).sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (b.rounds !== a.rounds) return b.rounds - a.rounds;
    const d = avg(a) - avg(b);
    if (d !== 0 && !Number.isNaN(d)) return d;
    return a.username.localeCompare(b.username, 'tr');
  });

  const result: ScoreboardEntry[] = [];
  sorted.forEach((p, idx) => {
    const prev = idx > 0 ? sorted[idx - 1] : null;
    const rank = prev && sameTier(prev, p) ? result[idx - 1].rank : idx + 1;
    result.push({ rank, id: p.id, username: p.username, totalScore: p.totalScore, roundsPlayed: p.rounds });
  });
  return result;
}
