process.env.JWT_SECRET = 'test-secret-0123456789abcdef0123456789abcdef';

import { signAdminToken, signNarratorToken, verifyAdminToken, verifyNarratorToken } from '../src/lib/tokens';

describe('oturum token türleri birbirine karışmaz', () => {
  test('admin token admin olarak doğrulanır', async () => {
    const t = await signAdminToken('admin-1', 'a@b.c');
    expect(await verifyAdminToken(t)).toEqual({ type: 'admin', adminId: 'admin-1', email: 'a@b.c' });
  });
  test('anlatıcı token ile admin olunamaz', async () => {
    const t = await signNarratorToken('pin-1', 'event-1', new Date(Date.now() + 60_000));
    expect(await verifyAdminToken(t)).toBeNull();
    expect(await verifyNarratorToken(t)).toEqual({ type: 'narrator', narratorPinId: 'pin-1', eventId: 'event-1' });
  });
  test('süresi dolmuş anlatıcı token reddedilir', async () => {
    const t = await signNarratorToken('pin-1', 'event-1', new Date(Date.now() - 1000));
    expect(await verifyNarratorToken(t)).toBeNull();
  });
  test('değiştirilmiş / uydurma token reddedilir', async () => {
    const t = await signAdminToken('admin-1', 'a@b.c');
    expect(await verifyAdminToken(t.slice(0, -2) + 'xx')).toBeNull();
    expect(await verifyAdminToken('herhangi-bir-deger')).toBeNull();
    expect(await verifyNarratorToken(undefined)).toBeNull();
  });
});
