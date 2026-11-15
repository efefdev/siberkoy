// Ek-A puanlama kuralları (değiştirilmedi, yalnızca saf fonksiyona taşındı):
// Kazanan takım: +3, kazanan takımdan oyun sonunda hayatta olanlar: +1. (Eski etkinliklerde BONUS kaydı da olabilir.)

export type WinningSide = 'DEFENDERS' | 'ATTACKERS';

export interface AssignmentForScoring {
  playerId: string;
  role: string;
  isAlive: boolean;
}

export interface ScoreRow {
  playerId: string;
  kind: 'WIN' | 'SURVIVE';
  score: number;
  reason: string;
}

export function isAttackerRole(role: string): boolean {
  return role === 'ATTACKER';
}

export function computeRoomScores(assignments: AssignmentForScoring[], winningSide: WinningSide): ScoreRow[] {
  const sideLabel = winningSide === 'DEFENDERS' ? 'Savunucular' : 'Hacker’lar';
  const rows: ScoreRow[] = [];
  for (const a of assignments) {
    const attacker = isAttackerRole(a.role);
    const won = winningSide === 'ATTACKERS' ? attacker : !attacker;
    if (!won) continue;
    rows.push({ playerId: a.playerId, kind: 'WIN', score: 3, reason: `Takımı kazandı (${sideLabel})` });
    if (a.isAlive) {
      rows.push({ playerId: a.playerId, kind: 'SURVIVE', score: 1, reason: 'Oyun sonunda hayatta kaldı' });
    }
  }
  return rows;
}

/**
 * Masa sonucu düzeltmesi: oyuncunun bu masadan şu an sahip olduğu sonuç puanı (WIN/SURVIVE + önceki düzeltmeler,
 * bonus hariç) ile yeni sonuca göre alması gereken puan arasındaki fark. Kayıtlar append-only olduğundan
 * fark, ADJUSTMENT kaydı olarak yazılır. Farkı 0 olan oyuncu için satır üretilmez.
 */
export function computeRescoreDeltas(
  current: Map<string, number>,
  assignments: AssignmentForScoring[],
  winningSide: WinningSide
): { playerId: string; delta: number }[] {
  const target = new Map<string, number>();
  for (const a of assignments) target.set(a.playerId, 0);
  for (const r of computeRoomScores(assignments, winningSide)) target.set(r.playerId, (target.get(r.playerId) ?? 0) + r.score);
  const out: { playerId: string; delta: number }[] = [];
  for (const [playerId, want] of target) {
    const delta = want - (current.get(playerId) ?? 0);
    if (delta !== 0) out.push({ playerId, delta });
  }
  return out;
}
