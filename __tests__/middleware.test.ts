import { NextRequest } from 'next/server';
import { middleware } from '../src/middleware';
import { isAdminVia } from '../src/lib/admin-via';

const req = (headers: Record<string, string> = {}) => new NextRequest('http://localhost:3000/api/admin/session', { headers });

describe('admin API ağ kapısı (middleware, geliştirme)', () => {
  test('Nginx üzerinden gelen normal istek (via=public) 404 alır', () => {
    expect(middleware(req({ 'x-siberkoy-via': 'public' })).status).toBe(404);
  });
  test('geliştirmede başlıksız istek geçer', () => {
    expect(middleware(req()).headers.get('x-middleware-next')).toBe('1');
  });
  test('acil durum izniyle gelen istek geçer', () => {
    expect(middleware(req({ 'x-siberkoy-via': 'admin-emergency' })).headers.get('x-middleware-next')).toBe('1');
  });
});

describe('isAdminVia (üretimde fail-closed)', () => {
  test('üretimde yalnızca tunnel ve admin-emergency', () => {
    expect(isAdminVia('tunnel', true)).toBe(true);
    expect(isAdminVia('admin-emergency', true)).toBe(true);
    expect(isAdminVia(null, true)).toBe(false);
    expect(isAdminVia(undefined, true)).toBe(false);
    expect(isAdminVia('public', true)).toBe(false);
    expect(isAdminVia('TUNNEL', true)).toBe(false);
  });
  test('geliştirmede yalnızca public reddedilir', () => {
    expect(isAdminVia(null, false)).toBe(true);
    expect(isAdminVia('public', false)).toBe(false);
  });
});
