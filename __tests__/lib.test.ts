import { normalizeUsername, usernameKey } from '../src/lib/username';
import { computeRoomScores } from '../src/lib/scoring';
import { buildScoreboard } from '../src/lib/scoreboard';
import { FailureLimiter } from '../src/lib/rate-limit';

describe('normalizeUsername', () => {
  test('boşlukları kırpar ve teke indirir', () => {
    expect(normalizeUsername('  Veri   Vampiri  ')).toBe('Veri Vampiri');
  });
  test('sıfır genişlikli ve yön kontrol karakterlerini atar', () => {
    expect(normalizeUsername('ef​e‮')).toBe('efe');
  });
  test('çok kısa / çok uzun / yalnızca sembol reddedilir', () => {
    expect(normalizeUsername('ab')).toBeNull();
    expect(normalizeUsername('a'.repeat(31))).toBeNull();
    expect(normalizeUsername('!!!')).toBeNull();
  });
  test('Türkçe büyük/küçük harf aynı anahtarı üretir', () => {
    expect(usernameKey(normalizeUsername('IŞIK')!)).toBe(usernameKey(normalizeUsername('ışık')!));
    expect(usernameKey('Efe')).toBe(usernameKey('EFE'));
  });
});

describe('computeRoomScores (Ek-A: kazanan +3, hayatta kalan kazanan +1)', () => {
  const room = [
    { playerId: 'a1', role: 'ATTACKER', isAlive: true },
    { playerId: 'a2', role: 'ATTACKER', isAlive: false },
    { playerId: 'u1', role: 'USER', isAlive: true },
    { playerId: 'h1', role: 'PATCHER', isAlive: false },
  ];
  test('savunucular kazanınca saldırgan olmayan herkes +3, hayatta olan ayrıca +1', () => {
    const rows = computeRoomScores(room, 'DEFENDERS');
    const total = (id: string) => rows.filter((r) => r.playerId === id).reduce((s, r) => s + r.score, 0);
    expect(total('u1')).toBe(4);
    expect(total('h1')).toBe(3);
    expect(total('a1')).toBe(0);
  });
  test('saldırganlar kazanınca yalnızca saldırganlar puan alır', () => {
    const rows = computeRoomScores(room, 'ATTACKERS');
    expect(new Set(rows.map((r) => r.playerId))).toEqual(new Set(['a1', 'a2']));
  });
});

describe('buildScoreboard', () => {
  const t = (m: number) => new Date(Date.UTC(2026, 9, 12, 12, m));
  const P = (...ids: string[]) => ids.map((id) => ({ id, username: id.toUpperCase() }));
  test('puan eşitliğinde ortalama süresi kısa olan üstte', () => {
    const board = buildScoreboard(
      P('p1', 'p2', 'p3'),
      [
        { playerId: 'p1', score: 4 },
        { playerId: 'p2', score: 4 },
        { playerId: 'p3', score: 7 },
      ],
      [
        { playerId: 'p1', startTime: t(0), endTime: t(30) },
        { playerId: 'p2', startTime: t(0), endTime: t(10) },
      ]
    );
    expect(board.map((b) => b.id)).toEqual(['p3', 'p2', 'p1']);
    expect(board.map((b) => b.rank)).toEqual([1, 2, 3]);
  });
  test('puan eşitse daha çok tur oynayan üstte (süresi daha uzun olsa da)', () => {
    const board = buildScoreboard(
      P('gec', 'erken'),
      [
        { playerId: 'gec', score: 4 },
        { playerId: 'erken', score: 4 },
      ],
      [
        { playerId: 'gec', startTime: t(0), endTime: t(5) },
        { playerId: 'erken', startTime: t(0), endTime: t(20) },
        { playerId: 'erken', startTime: t(30), endTime: t(50) },
      ]
    );
    expect(board.map((b) => b.id)).toEqual(['erken', 'gec']);
    expect(board[0].roundsPlayed).toBe(2);
  });
  test('ortalama kullanılır, toplam değil', () => {
    const board = buildScoreboard(
      P('a', 'b'),
      [],
      [
        { playerId: 'a', startTime: t(0), endTime: t(10) },
        { playerId: 'a', startTime: t(0), endTime: t(10) },
        { playerId: 'b', startTime: t(0), endTime: t(12) },
        { playerId: 'b', startTime: t(0), endTime: t(12) },
      ]
    );
    expect(board.map((b) => b.id)).toEqual(['a', 'b']);
  });
  test('puan, tur ve süre aynıysa sıra paylaşılır; puansız oyuncu da listede', () => {
    const board = buildScoreboard(P('p1', 'p2', 'p3'), [{ playerId: 'p1', score: 3 }, { playerId: 'p2', score: 3 }], []);
    expect(board.map((b) => b.rank)).toEqual([1, 1, 3]);
    expect(board[2]).toMatchObject({ id: 'p3', totalScore: 0 });
  });
  test('listede olmayan (banlı) oyuncunun puanı görünmez', () => {
    const board = buildScoreboard(P('p1'), [{ playerId: 'ban', score: 9 }], []);
    expect(board.map((b) => b.id)).toEqual(['p1']);
  });
  test('negatif düzeltmeler toplama dahil edilir', () => {
    const board = buildScoreboard(P('p1'), [{ playerId: 'p1', score: 3 }, { playerId: 'p1', score: -3 }], []);
    expect(board[0].totalScore).toBe(0);
  });
});

describe('FailureLimiter', () => {
  test('limit aşılınca kilitler, süre dolunca açar', () => {
    let now = 0;
    const l = new FailureLimiter({ maxFailures: 3, windowMs: 1000, lockMs: 5000 }, () => now);
    l.recordFailure('ip');
    l.recordFailure('ip');
    expect(l.lockedFor('ip')).toBe(0);
    l.recordFailure('ip');
    expect(l.lockedFor('ip')).toBe(5000);
    now = 5001;
    expect(l.lockedFor('ip')).toBe(0);
  });
  test('pencere dolunca sayaç sıfırlanır', () => {
    let now = 0;
    const l = new FailureLimiter({ maxFailures: 2, windowMs: 1000, lockMs: 5000 }, () => now);
    l.recordFailure('ip');
    now = 2000;
    l.recordFailure('ip');
    expect(l.lockedFor('ip')).toBe(0);
  });
});

describe('accusative (Türkçe belirtme hâli eki)', () => {
  test.each([
    [1, '1’i'], [2, '2’yi'], [3, '3’ü'], [4, '4’ü'], [5, '5’i'], [6, '6’yı'], [7, '7’yi'], [8, '8’i'], [9, '9’u'],
    [10, '10’u'], [12, '12’yi'], [20, '20’yi'], [40, '40’ı'], [60, '60’ı'], [100, '100’ü'],
  ])('%d → %s', (n, out) => {
    const { accusative } = require('../src/lib/text');
    expect(accusative(n)).toBe(out);
  });
});

describe('computeRescoreDeltas (masa sonucu düzeltme)', () => {
  const { computeRescoreDeltas } = require('../src/lib/scoring');
  const room = [
    { playerId: 'a1', role: 'ATTACKER', isAlive: true },
    { playerId: 'u1', role: 'USER', isAlive: true },
    { playerId: 'u2', role: 'USER', isAlive: false },
  ];
  test('savunucu → saldırgan düzeltmesi: eski puanlar geri alınır, yenisi verilir', () => {
    const current = new Map([['u1', 4], ['u2', 3]]);
    const d = computeRescoreDeltas(current, room, 'ATTACKERS');
    expect(Object.fromEntries(d.map((x: { playerId: string; delta: number }) => [x.playerId, x.delta]))).toEqual({ a1: 4, u1: -4, u2: -3 });
  });
  test('aynı sonuç ikinci kez girilirse fark yok', () => {
    const current = new Map([['a1', 4]]);
    expect(computeRescoreDeltas(current, room, 'ATTACKERS')).toEqual([]);
  });
});

describe('titleFor (rozet unvanı)', () => {
  const { titleFor } = require('../src/lib/titles');
  const base = { rank: 5, totalScore: 4, roundsPlayed: 2, attackerWins: 0, defenderWins: 0, survivedWins: 0, bonus: 0 };
  test('birinci her zaman efsane', () => expect(titleFor({ ...base, rank: 1, attackerWins: 2 }).title).toBe('Köyün Efsanesi'));
  test('puansız birinci efsane sayılmaz', () => expect(titleFor({ ...base, rank: 1, totalScore: 0 }).title).toBe('Cesur Köylü'));
  test('iki saldırgan galibiyeti', () => expect(titleFor({ ...base, attackerWins: 2 }).title).toBe('Baş Vampir'));
  test('bir saldırgan galibiyeti', () => expect(titleFor({ ...base, attackerWins: 1, defenderWins: 1 }).title).toBe('Sinsi Vampir'));
  test('her masada kazanıp hayatta kaldı', () => expect(titleFor({ ...base, defenderWins: 2, survivedWins: 2 }).title).toBe('Hayatta Kalan'));
  test('iki savunucu galibiyeti', () => expect(titleFor({ ...base, defenderWins: 2, survivedWins: 1 }).title).toBe('Gölge Avcısı'));
  test('bonus', () => expect(titleFor({ ...base, bonus: 1 }).title).toBe('Bilge Köylü'));
});
