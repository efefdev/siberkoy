/** Oyun akışı API testleri (veritabanı taklit edilir). */
process.env.JWT_SECRET = 'test-secret-0123456789abcdef0123456789abcdef';

import { NextRequest } from 'next/server';

const prisma = {
  event: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  round: { findFirst: jest.fn(), create: jest.fn() },
  room: { create: jest.fn(), updateMany: jest.fn() },
  player: { findMany: jest.fn(), updateMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
  narratorPIN: { findMany: jest.fn(), updateMany: jest.fn(), create: jest.fn() },
  roomAssignment: { findFirst: jest.fn(), findMany: jest.fn() },
  narratorFeedback: { findMany: jest.fn() },
  auditLog: { create: jest.fn() },
  $transaction: jest.fn(),
  $executeRaw: jest.fn(),
  $queryRaw: jest.fn(),
};
jest.mock('@/lib/prisma', () => ({ prisma }));
jest.mock('next/headers', () => ({ cookies: jest.fn() }));

import { signAdminToken } from '../src/lib/tokens';
import { hashToken } from '../src/lib/crypto';
import { POST as startRound } from '../src/app/api/admin/events/[id]/rounds/route';
import { POST as playerAdmin } from '../src/app/api/admin/players/[id]/route';
import { POST as createPin } from '../src/app/api/admin/events/[id]/narrator-pins/route';
import { POST as join } from '../src/app/api/player/join/route';
import { GET as me } from '../src/app/api/player/me/route';

const EVENT = '11111111-1111-4111-8111-111111111111';
const PLAYER = '44444444-4444-4444-8444-444444444444';

function req(url: string, init: { method?: string; body?: unknown; cookie?: string } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'x-real-ip': '10.0.0.1' };
  if (init.cookie) headers.cookie = init.cookie;
  return new NextRequest(`http://localhost:3000${url}`, {
    method: init.method ?? 'POST',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const adminCookie = async () => `admin_session=${await signAdminToken('admin-1', 'a@b.c')}`;

const emit = jest.fn();
const io = { to: jest.fn(() => ({ emit })), in: jest.fn(() => ({ disconnectSockets: jest.fn() })) };

beforeEach(() => {
  jest.clearAllMocks();
  globalThis.io = io as unknown as typeof globalThis.io;
  prisma.$transaction.mockImplementation((fn: (tx: typeof prisma) => unknown) => fn(prisma));
  prisma.$queryRaw.mockResolvedValue([{ id: 'masa' }]); // lockActiveRoom: masa ACTIVE
});

describe('tur başlatma', () => {
  const players = Array.from({ length: 24 }, (_, i) => ({ id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}` }));

  test('admin oturumu olmadan başlatılamaz', async () => {
    const res = await startRound(req(`/api/admin/events/${EVENT}/rounds`), params(EVENT));
    expect(res.status).toBe(401);
  });

  test('gereken masanın anlatıcısı yoksa tur başlamaz (409) ve hiçbir şey yazılmaz', async () => {
    prisma.event.findUnique.mockResolvedValue({ id: EVENT, status: 'WAITING', allowLess8: false });
    prisma.round.findFirst.mockResolvedValue(null);
    prisma.player.findMany.mockResolvedValue(players); // 24 kişi → 2 masa
    prisma.narratorPIN.findMany.mockResolvedValue([{ id: 'pin-1', tableNumber: 1 }]);
    const res = await startRound(req(`/api/admin/events/${EVENT}/rounds`, { cookie: await adminCookie() }), params(EVENT));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/2/);
    expect(prisma.round.create).not.toHaveBeenCalled();
  });

  test('önceki tur bitmeden yeni tur başlamaz', async () => {
    prisma.event.findUnique.mockResolvedValue({ id: EVENT, status: 'IN_PROGRESS', allowLess8: false });
    prisma.round.findFirst.mockResolvedValue({ roundNumber: 1, status: 'ACTIVE', rooms: [] });
    const res = await startRound(req(`/api/admin/events/${EVENT}/rounds`, { cookie: await adminCookie() }), params(EVENT));
    expect(res.status).toBe(409);
  });

  test('başarılı başlatmada masalar anlatıcılara bağlanır; oyunculara rol YAYINLANMAZ', async () => {
    prisma.event.findUnique.mockResolvedValue({ id: EVENT, status: 'WAITING', allowLess8: false });
    prisma.round.findFirst.mockResolvedValue(null);
    prisma.player.findMany.mockResolvedValue(players);
    prisma.narratorPIN.findMany.mockResolvedValue([
      { id: 'pin-1', tableNumber: 1 },
      { id: 'pin-2', tableNumber: 2 },
      { id: 'pin-3', tableNumber: 3 },
    ]);
    prisma.round.create.mockResolvedValue({ id: 'round-1' });
    const res = await startRound(req(`/api/admin/events/${EVENT}/rounds`, { cookie: await adminCookie() }), params(EVENT));
    expect(res.status).toBe(200);
    expect(prisma.$executeRaw).toHaveBeenCalled(); // okumalar etkinlik kilidinden sonra
    expect(prisma.player.updateMany.mock.calls[0][0].where.status).toEqual({ in: ['LOBBY', 'PLAYING'] });
    // 24 kişi → ideal 8-9 kişilik 3 masa (8+8+8)
    expect(prisma.room.create).toHaveBeenCalledTimes(3);
    const narratorIds = prisma.room.create.mock.calls.map((c) => c[0].data.narratorPinId).sort();
    expect(narratorIds).toEqual(['pin-1', 'pin-2', 'pin-3']);
    // Hiçbir yayın rol içermez
    for (const call of emit.mock.calls) expect(JSON.stringify(call[1])).not.toMatch(/ATTACKER|ANALYST|PATCHER|HONEYPOT|role/);
  });
});

describe('oyuncu yönetimi', () => {
  test('kick: oturum geçersiz kılınır, ad serbest kalır, socket kapatılır', async () => {
    prisma.player.findUnique.mockResolvedValue({ id: PLAYER, eventId: EVENT, status: 'LOBBY', usernameKey: 'efe' });
    prisma.player.updateMany.mockResolvedValue({ count: 1 });
    const res = await playerAdmin(req(`/api/admin/players/${PLAYER}`, { body: { action: 'kick' }, cookie: await adminCookie() }), params(PLAYER));
    expect(res.status).toBe(200);
    expect(prisma.$executeRaw).toHaveBeenCalled(); // etkinlik kilidi
    const call = prisma.player.updateMany.mock.calls[0][0];
    expect(call.where.status).toEqual({ in: ['LOBBY', 'PLAYING'] });
    const data = call.data;
    expect(data.status).toBe('KICKED');
    expect(data.sessionTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(data.usernameKey).not.toBe('efe');
    expect(io.in).toHaveBeenCalledWith(`player:${PLAYER}`);
  });

  test('çıkarılmış oyuncu yeniden adlandırılamaz / tekrar çıkarılamaz', async () => {
    prisma.player.findUnique.mockResolvedValue({ id: PLAYER, eventId: EVENT, status: 'KICKED', usernameKey: 'x' });
    const res = await playerAdmin(req(`/api/admin/players/${PLAYER}`, { body: { action: 'rename', username: 'Yeni' }, cookie: await adminCookie() }), params(PLAYER));
    expect(res.status).toBe(409);
  });

  test('ban: ad ayrılmış kalır', async () => {
    prisma.player.findUnique.mockResolvedValue({ id: PLAYER, eventId: EVENT, status: 'PLAYING', usernameKey: 'efe' });
    prisma.player.updateMany.mockResolvedValue({ count: 1 });
    await playerAdmin(req(`/api/admin/players/${PLAYER}`, { body: { action: 'ban' }, cookie: await adminCookie() }), params(PLAYER));
    const data = prisma.player.updateMany.mock.calls[0][0].data;
    expect(data.status).toBe('BANNED');
    expect(data.usernameKey).toBeUndefined();
  });

  test('banlanan tarayıcı aynı etkinliğe tekrar katılamaz', async () => {
    const device = 'a'.repeat(64);
    prisma.event.findUnique.mockResolvedValue({ id: EVENT, status: 'IN_PROGRESS', registrationOpen: true });
    prisma.player.findFirst.mockResolvedValue({ id: PLAYER });
    const res = await join(req('/api/player/join', { body: { eventPin: '123456', username: 'YeniAd' }, cookie: `koy_device=${device}` }));
    expect(res.status).toBe(403);
    expect(prisma.player.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ deviceIdHash: hashToken(device), status: 'BANNED' }) }));
    expect(prisma.player.create).not.toHaveBeenCalled();
  });
});

describe('anlatıcı PIN devri', () => {
  test('aynı masaya yeni PIN: eski PIN pasif, süren masa yeni PIN’e devredilir, eski bağlantı kesilir', async () => {
    prisma.event.findUnique.mockResolvedValue({ status: 'IN_PROGRESS' });
    prisma.narratorPIN.findMany.mockResolvedValue([{ id: 'old-pin' }]);
    prisma.narratorPIN.create.mockResolvedValue({ id: 'new-pin', pin: 'ABC234', tableNumber: 2, createdAt: new Date() });
    prisma.room.updateMany.mockResolvedValue({ count: 1 });
    const res = await createPin(req(`/api/admin/events/${EVENT}/narrator-pins`, { body: { tableNumber: 2 }, cookie: await adminCookie() }), params(EVENT));
    expect(res.status).toBe(200);
    expect(prisma.narratorPIN.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['old-pin'] } }, data: { isActive: false } });
    expect(prisma.room.updateMany).toHaveBeenCalledWith({ where: { narratorPinId: { in: ['old-pin'] }, status: 'ACTIVE' }, data: { narratorPinId: 'new-pin' } });
    expect(io.in).toHaveBeenCalledWith('narrator:old-pin');
  });
});

describe('oyuncu durumu (/api/player/me)', () => {
  test('oturumsuz 401', async () => {
    const res = await me(req('/api/player/me', { method: 'GET' }));
    expect(res.status).toBe(401);
  });

  test('atılmış oyuncunun eski çerezi geçersizdir', async () => {
    const token = 'b'.repeat(64);
    prisma.player.findUnique.mockResolvedValue({ id: PLAYER, eventId: EVENT, username: 'Efe', createdAt: new Date(), status: 'KICKED' });
    const res = await me(req('/api/player/me', { method: 'GET', cookie: `player_session=${token}` }));
    expect(res.status).toBe(401);
  });
});
