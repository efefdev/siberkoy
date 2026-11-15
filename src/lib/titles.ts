// Etkinlik sonu unvanları (oyuncu rozeti). Saf fonksiyon; rol bilgisi yalnızca etkinlik bittikten sonra kullanılır.

export interface PlayerNightStats {
  rank: number;
  totalScore: number;
  roundsPlayed: number;
  attackerWins: number; // hacker olarak kazandığı masa
  defenderWins: number; // savunucu olarak kazandığı masa
  survivedWins: number; // kazanıp sonunda hayatta kaldığı masa
  bonus: number; // bonus soru sayısı
}

export interface Title {
  title: string;
  line: string;
}

export function titleFor(s: PlayerNightStats): Title {
  if (s.rank === 1 && s.totalScore > 0) return { title: 'Köyün Efsanesi', line: 'Gecenin en yüksek puanı senin.' };
  if (s.attackerWins >= 2) return { title: 'Baş Vampir', line: 'Köyü birden fazla kez ele geçirdin.' };
  if (s.attackerWins === 1) return { title: 'Sinsi Vampir', line: 'Kimse fark etmeden ağı düşürdün.' };
  if (s.roundsPlayed > 0 && s.survivedWins === s.roundsPlayed) return { title: 'Hayatta Kalan', line: 'Her masada sonuna kadar ayaktaydın.' };
  if (s.defenderWins >= 2) return { title: 'Gölge Avcısı', line: 'Vampirleri defalarca ağdan attın.' };
  if (s.defenderWins === 1) return { title: 'Köyün Bekçisi', line: 'Köyü hacker’lardan korudun.' };
  if (s.bonus > 0) return { title: 'Bilge Köylü', line: 'Bonus soruyu herkesten önce bildin.' };
  return { title: 'Cesur Köylü', line: 'Karanlık gecede köyde kaldın.' };
}
