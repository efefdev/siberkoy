import { getRoleDistribution, assignRoles } from '../src/lib/role-allocator';

describe('getRoleDistribution', () => {
  // Ek-A rol tablosu doğrulama
  const table = [
    [4,  1, 1, 1, 1],
    [7,  1, 1, 1, 4],
    [8,  2, 1, 1, 4],
    [9,  2, 1, 1, 5],
    [10, 2, 1, 1, 6],
    [11, 3, 1, 1, 6],
    [12, 3, 1, 1, 7],
    [13, 3, 1, 1, 8],
    [14, 4, 1, 1, 8],
    [15, 4, 1, 1, 9],
    [16, 4, 1, 1, 10],
  ];

  test.each(table)(
    '%d kişi: %d hacker, %d analist, %d yama, %d kullanıcı',
    (players, attackers, analysts, patchers, users) => {
      const dist = getRoleDistribution(players);
      expect(dist.ATTACKER).toBe(attackers);
      expect(dist.ANALYST).toBe(analysts);
      expect(dist.PATCHER).toBe(patchers);
      expect(dist.USER).toBe(users);
      expect(dist.ATTACKER + dist.ANALYST + dist.PATCHER + dist.USER).toBe(players);
    }
  );

  test('Honeypot (Avcı) kaldırıldı: hiçbir masa büyüklüğünde dağıtılmaz', () => {
    for (let n = 4; n <= 16; n++) expect(Object.keys(getRoleDistribution(n))).toEqual(['ATTACKER', 'ANALYST', 'PATCHER', 'USER']);
  });
});

describe('assignRoles', () => {
  test('Atanan rol sayısı oyuncu sayısına eşit olmalı', () => {
    const players = Array.from({ length: 10 }, (_, i) => `player_${i}`);
    const result = assignRoles(players);
    expect(result.length).toBe(10);
  });

  test('Her oyuncuya tam olarak 1 rol atanmalı', () => {
    const players = Array.from({ length: 12 }, (_, i) => `player_${i}`);
    const result = assignRoles(players);
    const uniquePlayers = new Set(result.map(r => r.playerId));
    expect(uniquePlayers.size).toBe(12);
  });

  test('Geçersiz rol atanmamalı', () => {
    const validRoles = ['ATTACKER', 'ANALYST', 'PATCHER', 'USER'];
    const players = Array.from({ length: 10 }, (_, i) => `player_${i}`);
    const result = assignRoles(players);
    result.forEach(r => {
      expect(validRoles).toContain(r.role);
    });
  });
});
