// Anlatıcı rehberi: masadaki oyunun adım sırası (kurallar kitapçığı, "Oyun Akışı").
// Rehber seçim istemez: anlatıcı herkesin rolünü ekranda görür, yalnızca sırayı ve okunacak metni izler.
// Bileşenden bağımsız, saf fonksiyonlar: test edilebilir, sunucuya hiçbir şey yazmaz.

export type Phase = 'intro' | 'night' | 'morning' | 'day' | 'over';

export type StepId =
  | 'acilis'
  | 'hacker-tanisma'
  | 'saldiri'
  | 'yama'
  | 'analist'
  | 'koy-uyaniyor'
  | 'sabah-raporu'
  | 'tartisma'
  | 'oylama'
  | 'karar';

export interface GuidePlayer {
  id: string;
  role: string;
  isAlive: boolean;
}

export interface GuideState {
  phase: Phase;
  night: number; // 0 = henüz gece olmadı
  step: number; // bulunulan evredeki adımın sırası
}

export const INITIAL_STATE: GuideState = { phase: 'intro', night: 0, step: 0 };

/**
 * Evredeki adımlar. Turun ilk gecesi yalnızca tanışma gecesidir: Hacker'lar birbirini tanır, kimse rolünü
 * kullanmaz (saldırı, yama, sorgu yok). Roller her turda yeniden dağıtıldığı için her turun ilk gecesi böyledir.
 */
export function stepsFor(phase: Phase, night: number): StepId[] {
  switch (phase) {
    case 'intro':
      return ['acilis'];
    case 'night':
      return night === 1 ? ['hacker-tanisma', 'koy-uyaniyor'] : ['saldiri', 'yama', 'analist', 'koy-uyaniyor'];
    case 'morning':
      return ['sabah-raporu'];
    case 'day':
      return ['tartisma', 'oylama', 'karar'];
    case 'over':
      return [];
  }
}

/** Bir sonraki adım ya da evre. Son gündüz adımından sonra yeni gece başlar. */
export function advance(state: GuideState): GuideState {
  const steps = stepsFor(state.phase, state.night);
  if (state.step + 1 < steps.length) return { ...state, step: state.step + 1 };
  switch (state.phase) {
    case 'intro':
      return { phase: 'night', night: 1, step: 0 };
    case 'night':
      return { ...state, phase: 'morning', step: 0 };
    case 'morning':
      return { ...state, phase: 'day', step: 0 };
    case 'day':
      return { phase: 'night', night: state.night + 1, step: 0 };
    case 'over':
      return state;
  }
}

/** Bir adım geri (yalnızca aynı evre içinde). */
export function back(state: GuideState): GuideState {
  return state.step > 0 ? { ...state, step: state.step - 1 } : state;
}

export const isAttacker = (role: string) => role === 'ATTACKER';

/** Kazanma kontrolü (kitapçık): tüm hacker'lar elendiyse Savunucular, hayattaki hacker ≥ savunucu ise Hacker'lar. */
export function winner(players: GuidePlayer[]): 'DEFENDERS' | 'ATTACKERS' | null {
  if (players.length === 0) return null;
  const alive = players.filter((p) => p.isAlive);
  const attackers = alive.filter((p) => isAttacker(p.role)).length;
  const defenders = alive.length - attackers;
  if (attackers === 0) return 'DEFENDERS';
  if (attackers >= defenders) return 'ATTACKERS';
  return null;
}
