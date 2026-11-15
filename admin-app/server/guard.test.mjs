import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CookieJar, forwardHeaders, hasLocalToken, isAllowedHost, isAllowedOrigin, isProxiedPath, takeLocalTokenParam } from './guard.mjs';

test('yalnızca localhost Host başlığı kabul edilir (DNS rebinding)', () => {
  assert.equal(isAllowedHost('localhost:4400', 4400), true);
  assert.equal(isAllowedHost('127.0.0.1:4400', 4400), true);
  assert.equal(isAllowedHost('evil.example:4400', 4400), false);
  assert.equal(isAllowedHost(undefined, 4400), false);
});

test('POST için yerel Origin zorunlu (CSRF)', () => {
  assert.equal(isAllowedOrigin('POST', 'http://localhost:4400', 4400), true);
  assert.equal(isAllowedOrigin('POST', undefined, 4400), false);
  assert.equal(isAllowedOrigin('POST', 'https://evil.example', 4400), false);
  assert.equal(isAllowedOrigin('GET', undefined, 4400), true);
  assert.equal(isAllowedOrigin('GET', 'https://evil.example', 4400), false);
});

test('yalnızca admin API ve socket.io aktarılır', () => {
  assert.equal(isProxiedPath('/api/admin/events'), true);
  assert.equal(isProxiedPath('/socket.io/?EIO=4'), true);
  assert.equal(isProxiedPath('/api/player/join'), false);
  assert.equal(isProxiedPath('/api/adminx'), false);
});

test('kimlik başlıkları ve tarayıcı çerezi temizlenir, yerine yerel çerez kavanozu gönderilir', () => {
  const h = forwardHeaders(
    { host: 'localhost:4400', origin: 'http://localhost:4400', 'x-siberkoy-via': 'admin-emergency', 'x-forwarded-for': '1.2.3.4', cookie: 'tarayici=x', 'x-local-token': 'gizli' },
    '127.0.0.1:43000',
    { tunnel: true, cookie: '__Host-admin_session=jwt' }
  );
  assert.equal(h.host, '127.0.0.1:43000');
  assert.equal(h.origin, undefined);
  assert.equal(h['x-siberkoy-via'], undefined);
  assert.equal(h['x-forwarded-for'], undefined);
  assert.equal(h['x-local-token'], undefined);
  assert.equal(h['x-real-ip'], 'tunnel');
  assert.equal(h.cookie, '__Host-admin_session=jwt');
  assert.equal(forwardHeaders({ cookie: 'tarayici=x' }, 'h', { tunnel: false }).cookie, undefined);
});

test('yerel anahtar sabit zamanlı karşılaştırılır', () => {
  assert.equal(hasLocalToken('abc123', 'abc123'), true);
  assert.equal(hasLocalToken('abc124', 'abc123'), false);
  assert.equal(hasLocalToken(undefined, 'abc123'), false);
  assert.equal(hasLocalToken('abc', 'abc123'), false);
});

test('WebSocket adresindeki lt parametresi alınır ve sunucuya iletilmez', () => {
  const r = takeLocalTokenParam('/socket.io/?EIO=4&transport=websocket&lt=gizli');
  assert.equal(r.token, 'gizli');
  assert.equal(r.url, '/socket.io/?EIO=4&transport=websocket');
});

test('çerez kavanozu: saklar, süresi dolanı ve Max-Age=0 olanı siler', () => {
  let now = 1_000_000;
  const jar = new CookieJar(() => now);
  jar.store(['__Host-admin_session=abc; Path=/; Max-Age=60; Secure; HttpOnly; SameSite=lax', 'diger=1; Path=/']);
  assert.equal(jar.header(), '__Host-admin_session=abc; diger=1');
  now += 61_000;
  assert.equal(jar.header(), 'diger=1');
  jar.store('diger=; Path=/; Max-Age=0');
  assert.equal(jar.header(), undefined);
});
