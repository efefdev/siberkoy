import { INITIAL_STATE, advance, back, stepsFor, winner, type GuidePlayer, type GuideState } from '../src/lib/narrator-guide';
import { ROLES, roleLabel } from '../src/lib/roles';

const p = (id: string, role: string, isAlive = true): GuidePlayer => ({ id, role, isAlive });
const masa = [p('h1', 'ATTACKER'), p('h2', 'ATTACKER'), p('y', 'PATCHER'), p('a', 'ANALYST'), p('k1', 'USER'), p('k2', 'USER'), p('k3', 'USER'), p('k4', 'USER')];

describe('anlatıcı rehberi: adım sırası', () => {
  test('açılıştan sonra gece 1 başlar ve hacker’lar tanışır', () => {
    const s = advance(INITIAL_STATE);
    expect(s).toEqual({ phase: 'night', night: 1, step: 0 });
    expect(stepsFor('night', 1)[0]).toBe('hacker-tanisma');
  });

  test('ilk gece yalnızca tanışma: saldırı, yama ve sorgu yok', () => {
    expect(stepsFor('night', 1)).toEqual(['hacker-tanisma', 'koy-uyaniyor']);
  });

  test('tanışma yalnızca turun ilk gecesinde', () => {
    expect(stepsFor('night', 2)).toEqual(['saldiri', 'yama', 'analist', 'koy-uyaniyor']);
  });

  test('gece → sabah → gündüz → yeni gece', () => {
    let s: GuideState = { phase: 'night', night: 1, step: 0 };
    for (let i = 0; i < stepsFor('night', 1).length; i++) s = advance(s);
    expect(s).toEqual({ phase: 'morning', night: 1, step: 0 });
    s = advance(s);
    expect(s).toEqual({ phase: 'day', night: 1, step: 0 });
    for (let i = 0; i < stepsFor('day', 1).length; i++) s = advance(s);
    expect(s).toEqual({ phase: 'night', night: 2, step: 0 });
  });

  test('hiçbir adım seçim beklemez: her adımda ilerlenebilir', () => {
    let s: GuideState = INITIAL_STATE;
    for (let i = 0; i < 20; i++) {
      const before = JSON.stringify(s);
      s = advance(s);
      expect(JSON.stringify(s)).not.toBe(before);
    }
  });

  test('geri yalnızca aynı evre içinde', () => {
    expect(back({ phase: 'day', night: 1, step: 2 }).step).toBe(1);
    expect(back({ phase: 'day', night: 1, step: 0 })).toEqual({ phase: 'day', night: 1, step: 0 });
  });
});

describe('anlatıcı rehberi: kazanma kontrolü', () => {
  test('tüm hacker’lar elenince Savunucular kazanır', () => {
    expect(winner(masa.map((x) => (x.role === 'ATTACKER' ? { ...x, isAlive: false } : x)))).toBe('DEFENDERS');
  });

  test('hayattaki hacker sayısı savunucuya eşit ya da fazlaysa Hacker’lar kazanır', () => {
    const kalan = masa.map((x) => (['k1', 'k2', 'k3', 'k4'].includes(x.id) ? { ...x, isAlive: false } : x));
    expect(winner(kalan)).toBe('ATTACKERS');
  });

  test('oyun sürerken kazanan yok', () => {
    expect(winner(masa)).toBeNull();
    expect(winner([])).toBeNull();
  });
});

describe('rol adları', () => {
  test('her rolün klasik Vampir Köylü karşılığı var', () => {
    expect(roleLabel('ATTACKER')).toBe('Hacker (Vampir)');
    expect(roleLabel('USER')).toBe('Kullanıcı (Köylü)');
    expect(roleLabel('ANALYST')).toBe('SOC Analisti (Gözcü)');
    expect(roleLabel('PATCHER')).toBe('Yama Uzmanı (Doktor)');
    expect(Object.keys(ROLES)).not.toContain('HONEYPOT');
    expect(roleLabel('HONEYPOT')).toBe('Kullanıcı (Köylü)'); // eski turlardan kalan kayıtlar
    for (const r of Object.values(ROLES)) expect(r.classic.length).toBeGreaterThan(0);
  });
});
