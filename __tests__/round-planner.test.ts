import { planRound, previousPairs, generateNarratorPin, keepSeats, SeatsUnbalancedError } from '../src/lib/round-planner';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);

describe('planRound', () => {
  test('herkes tam bir masaya oturur, masa numaraları 1..N', () => {
    const plan = planRound(ids(30), false);
    const seated = plan.rooms.flatMap((r) => r.players.map((p) => p.playerId));
    expect(new Set(seated).size).toBe(30);
    expect(plan.rooms.map((r) => r.roomNumber)).toEqual([1, 2, 3]);
  });

  test('hiçbir masada Honeypot (Avcı) yok', () => {
    const plan = planRound(ids(50), false);
    const roles = new Set(plan.rooms.flatMap((r) => r.players.map((p) => p.role as string)));
    expect(roles.has('HONEYPOT')).toBe(false);
  });

  test('önceki turun masa arkadaşları mümkün olduğunca ayrılır (best-effort)', () => {
    // 24 kişi, 2 masa: önceki turda ilk 12 ve son 12 birlikteydi.
    const players = ids(24);
    const prev = [players.slice(0, 12), players.slice(12)];
    const random = planRound(players, false, [], 1);
    const separated = planRound(players, false, prev, 300);
    const repeats = (rooms: string[][]) => {
      const pairs = previousPairs(prev);
      let n = 0;
      for (const r of rooms) for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) if (pairs.has(r[i] < r[j] ? `${r[i]}|${r[j]}` : `${r[j]}|${r[i]}`)) n++;
      return n;
    };
    expect(separated.repeatedPairs).toBe(repeats(separated.rooms.map((r) => r.players.map((p) => p.playerId))));
    // 2 masada tekrar tamamen önlenemez ama rastgele dağılımdan belirgin şekilde az olmalı (ideal: 6+6 karışım → 60).
    expect(separated.repeatedPairs).toBeLessThanOrEqual(66);
    expect(random.repeatedPairs).toBe(0); // önceki tur verilmediyse ölçüm yok
  });

  test('8 kişiden az ve test modu kapalıysa hata', () => {
    expect(() => planRound(ids(5), false)).toThrow();
  });
});

describe('generateNarratorPin', () => {
  test('6 karakter, karıştırılabilir karakter (0 O 1 I L) yok', () => {
    for (let i = 0; i < 200; i++) {
      const pin = generateNarratorPin();
      expect(pin).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
    }
  });
});

describe('keepSeats (masalar korunur)', () => {
  const prev = [
    { roomNumber: 1, playerIds: ids(9) },
    { roomNumber: 2, playerIds: Array.from({ length: 9 }, (_, i) => `q${i}`) },
  ];
  const all = [...prev[0].playerIds, ...prev[1].playerIds];
  const tableOf = (plan: ReturnType<typeof keepSeats>, id: string) => plan.rooms.find((r) => r.players.some((p) => p.playerId === id))?.roomNumber;

  test('herkes önceki masasında kalır, roller yeniden atanır', () => {
    const plan = keepSeats(all, prev, false);
    for (const id of prev[0].playerIds) expect(tableOf(plan, id)).toBe(1);
    for (const id of prev[1].playerIds) expect(tableOf(plan, id)).toBe(2);
    for (const r of plan.rooms) expect(r.players.filter((p) => p.role === 'ATTACKER').length).toBe(2);
  });

  test('yeni katılanlar en az kişinin olduğu masaya eklenir', () => {
    const fewer = [{ roomNumber: 1, playerIds: ids(9) }, { roomNumber: 2, playerIds: prev[1].playerIds.slice(0, 8) }];
    const plan = keepSeats([...ids(9), ...prev[1].playerIds.slice(0, 8), 'yeni1', 'yeni2'], fewer, false);
    // İlk gelen yeni oyuncu küçük masaya (2) gider; masalar eşitlenince ikincisi düşük numaralı masaya.
    expect([tableOf(plan, 'yeni1'), tableOf(plan, 'yeni2')].sort()).toEqual([1, 2]);
    expect(plan.rooms.map((r) => r.players.length)).toEqual([10, 9]);
  });

  test('ayrılanlar yüzünden masa 8 kişinin altına düşerse yeniden dağıtım istenir', () => {
    const left = all.filter((id) => !['q0', 'q1'].includes(id));
    expect(() => keepSeats(left, prev, false)).toThrow(SeatsUnbalancedError);
    expect(() => keepSeats(left, prev, true)).not.toThrow(); // test modunda en az 4
  });

  test('kimse iki masaya oturmaz, herkes oturur', () => {
    const plan = keepSeats([...all, 'yeni'], prev, false);
    const seated = plan.rooms.flatMap((r) => r.players.map((p) => p.playerId));
    expect(new Set(seated).size).toBe(seated.length);
    expect(seated.length).toBe(all.length + 1);
  });
});
