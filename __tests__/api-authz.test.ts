/**
 * API yetki testleri: veritabanı taklit edilir (mock), gerçek route handler'lar çalıştırılır.
 * Amaç, inceleme raporundaki kritik açıkların tekrar açılmamasını garanti etmek.
 */
process.env.JWT_SECRET = 'test-secret-0123456789abcdef0123456789abcdef';

import { NextRequest } from 'next/server';

const prisma = {
  narratorPIN: { findUnique: jest.fn(), updateMany: jest.fn(), findUniqueOrThrow: jest.fn() },
  room: { findFirst: jest.fn(), updateMany: jest.fn(), count: jest.fn() },
  round: { update: jest.fn() },
  roomAssignment: { findUnique: jest.fn(), findMany: jest.fn(), updateMany: jest.fn(), findFirst: jest.fn() },
  scoreEvent: { createMany: jest.fn(), create: jest.fn() },
  player: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
  event: { findUnique: jest.fn() },
  auditLog: { create: jest.fn() },
  adminAlert: { create: jest.fn() },
  narratorFeedback: { create: jest.fn(), findMany: jest.fn() },
  $transaction: jest.fn(),
  $executeRaw: jest.fn(),
  $queryRaw: jest.fn(),
};
jest.mock('@/lib/prisma', () => ({ prisma }));
jest.mock('next/headers', () => ({ cookies: jest.fn() }));

import { signNarratorToken, signAdminToken } from '../src/lib/tokens';
import { POST as scoresPOST } from '../src/app/api/narrator/scores/route';
import { POST as eliminatePOST } from '../src/app/api/narrator/eliminate/route';
import { POST as alertPOST } from '../src/app/api/narrator/alert/route';
import { POST as narratorLoginPOST } from '../src/app/api/narrator/login/route';
import { POST as joinPOST } from '../src/app/api/player/join/route';
import { POST as feedbackPOST } from '../src/app/api/player/feedback/route';
import { GET as adminFeedbackGET } from '../src/app/api/admin/feedback/route';
import { POST as adjustPOST } from '../src/app/api/admin/scores/adjust/route';

const EVENT = '11111111-1111-4111-8111-111111111111';
const PIN = '22222222-2222-4222-8222-222222222222';
const ROOM = '33333333-3333-4333-8333-333333333333';
const PLAYER = '44444444-4444-4444-8444-444444444444';

function req(url: string, init: { method?: string; body?: unknown; cookie?: string; origin?: string } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'x-real-ip': '10.0.0.1' };
  if (init.cookie) headers.cookie = init.cookie;
  if (init.origin) headers.origin = init.origin;
  return new NextRequest(`http://localhost:3000${url}`, {
    method: init.method ?? 'POST',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

async function narratorCookie() {
  const token = await signNarratorToken(PIN, EVENT, new Date(Date.now() + 3600_000));
  return `narrator_session=${token}`;
}

function validPin() {
  prisma.narratorPIN.findUnique.mockResolvedValue({
    id: PIN, eventId: EVENT, isActive: true, usedAt: new Date(), createdAt: new Date(), event: { status: 'IN_PROGRESS' },
  });
}

const io = { to: jest.fn() };
const emit = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  io.to.mockReturnValue({ emit });
  globalThis.io = io as unknown as typeof globalThis.io;
  prisma.$transaction.mockImplementation((fn: (tx: typeof prisma) => unknown) => fn(prisma));
  prisma.$queryRaw.mockResolvedValue([{ id: 'masa' }]); // lockActiveRoom: masa ACTIVE
});

describe('anlatıcı uç noktaları oturum ister', () => {
  test.each([
    ['scores', scoresPOST, { roomId: ROOM, winningSide: 'DEFENDERS' }],
    ['eliminate', eliminatePOST, { roomId: ROOM, playerId: PLAYER }],
    ['alert', alertPOST, { message: 'yardım' }],
  ])('%s: çerez yoksa 401', async (_n, handler, body) => {
    const res = await handler(req('/api/narrator/x', { body }));
    expect(res.status).toBe(401);
    expect(prisma.scoreEvent.createMany).not.toHaveBeenCalled();
    expect(prisma.scoreEvent.create).not.toHaveBeenCalled();
  });

  test('uydurma çerez değeriyle giriş yapılamaz (eski rol sızıntısı)', async () => {
    const res = await scoresPOST(req('/api/narrator/scores', { body: { roomId: ROOM, winningSide: 'DEFENDERS' }, cookie: 'narrator_session=x' }));
    expect(res.status).toBe(401);
  });

  test('admin iptal ettiği PIN ile imzalı token da reddedilir', async () => {
    prisma.narratorPIN.findUnique.mockResolvedValue({
      id: PIN, eventId: EVENT, isActive: false, usedAt: new Date(), createdAt: new Date(), event: { status: 'IN_PROGRESS' },
    });
    const res = await scoresPOST(req('/api/narrator/scores', { body: { roomId: ROOM, winningSide: 'DEFENDERS' }, cookie: await narratorCookie() }));
    expect(res.status).toBe(401);
  });

  test('başka sitenin gönderdiği istek 403', async () => {
    validPin();
    const res = await scoresPOST(
      req('/api/narrator/scores', { body: { roomId: ROOM, winningSide: 'DEFENDERS' }, cookie: await narratorCookie(), origin: 'https://evil.example' })
    );
    expect(res.status).toBe(403);
  });
});

describe('puan girme', () => {
  test('başka anlatıcının masası bulunamadı sayılır (IDOR)', async () => {
    validPin();
    prisma.room.findFirst.mockResolvedValue(null);
    const res = await scoresPOST(req('/api/narrator/scores', { body: { roomId: ROOM, winningSide: 'DEFENDERS' }, cookie: await narratorCookie() }));
    expect(res.status).toBe(404);
    expect(prisma.room.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: ROOM, narratorPinId: PIN, round: { eventId: EVENT } }) })
    );
  });

  test('ikinci kez puan girilemez (409) ve hiç puan yazılmaz', async () => {
    validPin();
    prisma.room.findFirst.mockResolvedValue({ id: ROOM, roundId: 'r1' });
    prisma.room.updateMany.mockResolvedValue({ count: 0 });
    const res = await scoresPOST(req('/api/narrator/scores', { body: { roomId: ROOM, winningSide: 'DEFENDERS' }, cookie: await narratorCookie() }));
    expect(res.status).toBe(409);
    expect(prisma.scoreEvent.createMany).not.toHaveBeenCalled();
  });

  test('ilk girişte puanlar yazılır; tur ancak tüm masalar bitince kapanır', async () => {
    validPin();
    prisma.room.findFirst.mockResolvedValue({ id: ROOM, roundId: 'r1' });
    prisma.room.updateMany.mockResolvedValue({ count: 1 });
    prisma.roomAssignment.findMany.mockResolvedValue([{ playerId: PLAYER, role: 'USER', isAlive: true }]);
    prisma.room.count.mockResolvedValue(1); // bir masa daha sürüyor
    const res = await scoresPOST(req('/api/narrator/scores', { body: { roomId: ROOM, winningSide: 'DEFENDERS' }, cookie: await narratorCookie() }));
    expect(res.status).toBe(200);
    expect(prisma.scoreEvent.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.round.update).not.toHaveBeenCalled();
  });
});

describe('eleme', () => {
  test('eleme olayı yalnızca anlatıcıya ve adminlere gider, rol bilgisi taşımaz', async () => {
    validPin();
    prisma.room.findFirst.mockResolvedValue({ id: ROOM, roundId: 'r1', status: 'ACTIVE', round: { eventId: EVENT } });
    prisma.roomAssignment.findUnique.mockResolvedValue({ role: 'ATTACKER' });
    prisma.roomAssignment.updateMany.mockResolvedValue({ count: 1 });
    const res = await eliminatePOST(req('/api/narrator/eliminate', { body: { roomId: ROOM, playerId: PLAYER }, cookie: await narratorCookie() }));
    expect(res.status).toBe(200);
    const targets = io.to.mock.calls.map((c) => c[0]);
    const eliminated = emit.mock.calls.map((c, i) => ({ event: c[0], payload: c[1], room: targets[i] })).filter((e) => e.event === 'player_eliminated');
    expect(new Set(eliminated.map((e) => e.room))).toEqual(new Set([`narrator:${PIN}`, 'admins']));
    for (const e of eliminated) expect(JSON.stringify(e.payload)).not.toMatch(/role|ATTACKER/);
  });

  test('masa kilitlenince bittiği görülürse eleme yazılmaz (sonuç girişiyle yarış)', async () => {
    validPin();
    prisma.room.findFirst.mockResolvedValue({ id: ROOM, roundId: 'r1', status: 'ACTIVE', round: { eventId: EVENT } });
    prisma.roomAssignment.findUnique.mockResolvedValue({ role: 'USER' });
    prisma.$queryRaw.mockResolvedValue([]); // kilit alındığında masa artık COMPLETED
    const res = await eliminatePOST(req('/api/narrator/eliminate', { body: { roomId: ROOM, playerId: PLAYER }, cookie: await narratorCookie() }));
    expect(res.status).toBe(409);
    expect(prisma.roomAssignment.updateMany).not.toHaveBeenCalled();
  });
});

describe('anlatıcı girişi', () => {
  test('kullanılmış / süresi dolmuş PIN 401 döner', async () => {
    prisma.narratorPIN.updateMany.mockResolvedValue({ count: 0 });
    const res = await narratorLoginPOST(req('/api/narrator/login', { body: { pin: 'A7X2K9' } }));
    expect(res.status).toBe(401);
    expect(res.headers.get('set-cookie')).toBeNull();
  });
});

describe('oyuncu', () => {
  test('katılım token’ı JSON’da dönmez, HttpOnly çerezde taşınır ve DB’de özeti saklanır', async () => {
    prisma.event.findUnique.mockResolvedValue({ id: EVENT, status: 'IN_PROGRESS', registrationOpen: true });
    prisma.player.create.mockImplementation(async ({ data }: { data: { sessionTokenHash: string } }) => {
      expect(data.sessionTokenHash).toMatch(/^[0-9a-f]{64}$/);
      return { id: PLAYER, username: 'Efe' };
    });
    const res = await joinPOST(req('/api/player/join', { body: { eventPin: '123456', username: 'Efe' } }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(JSON.stringify(json)).not.toMatch(/sessionToken/);
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toMatch(/player_session=[0-9a-f]{64}/);
    expect(cookie.toLowerCase()).toContain('httponly');
    const token = cookie.match(/player_session=([0-9a-f]{64})/)![1];
    const stored = prisma.player.create.mock.calls[0][0].data.sessionTokenHash;
    expect(stored).not.toBe(token);
  });

  test('geri bildirim oturumsuz gönderilemez', async () => {
    const res = await feedbackPOST(req('/api/player/feedback', { body: { narratorId: PIN, rating: 5 } }));
    expect(res.status).toBe(401);
  });
});

describe('admin uç noktaları', () => {
  test('geri bildirim listesi admin oturumu ister', async () => {
    const res = await adminFeedbackGET(req(`/api/admin/feedback?eventId=${EVENT}`, { method: 'GET' }));
    expect(res.status).toBe(401);
  });

  test('anlatıcı token’ı ile admin puan düzeltmesi yapılamaz', async () => {
    const res = await adjustPOST(
      req('/api/admin/scores/adjust', { body: { eventId: EVENT, playerId: PLAYER, delta: 3, reason: 'deneme' }, cookie: `admin_session=${(await narratorCookie()).split('=')[1]}` })
    );
    expect(res.status).toBe(401);
  });

  test('admin düzeltmesi yeni ADJUSTMENT kaydı ekler, eskisini değiştirmez', async () => {
    const token = await signAdminToken('admin-1', 'a@b.c');
    prisma.player.findFirst.mockResolvedValue({ id: PLAYER });
    prisma.scoreEvent.create.mockResolvedValue({ id: 'se1' });
    const res = await adjustPOST(
      req('/api/admin/scores/adjust', { body: { eventId: EVENT, playerId: PLAYER, delta: -3, reason: 'Yanlış masa' }, cookie: `admin_session=${token}` })
    );
    expect(res.status).toBe(200);
    expect(prisma.scoreEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ kind: 'ADJUSTMENT', score: -3, createdBy: 'ADMIN:admin-1' }),
    });
  });
});
