import { useCallback, useEffect, useState } from 'react';
import Brand from '@/components/ui/Brand';
import EventConsole from './components/EventConsole';
import Login from './pages/Login';
import Events from './pages/Events';
import Guide from './pages/Guide';
import Results from './pages/Results';
import Backup from './pages/Backup';
import StatusBar from './components/StatusBar';
import { fetchLocalStatus, type LocalStatus } from './local';

type Route = { name: 'events' } | { name: 'event'; id: string } | { name: 'results'; id: string } | { name: 'guide' } | { name: 'backup' };

function parseRoute(): Route {
  if (window.location.hash.startsWith('#/rehber')) return { name: 'guide' };
  if (window.location.hash.startsWith('#/yedek')) return { name: 'backup' };
  const r = window.location.hash.match(/^#\/events\/([0-9a-f-]{36})\/sonuc$/i);
  if (r) return { name: 'results', id: r[1] };
  const m = window.location.hash.match(/^#\/events\/([0-9a-f-]{36})$/i);
  return m ? { name: 'event', id: m[1] } : { name: 'events' };
}

type Auth = { state: 'checking' } | { state: 'out' } | { state: 'in'; email: string } | { state: 'offline' };

export default function App() {
  const [route, setRoute] = useState<Route>(parseRoute);
  const [auth, setAuth] = useState<Auth>({ state: 'checking' });
  const [local, setLocal] = useState<LocalStatus | null>(null);

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/session', { cache: 'no-store' });
      if (res.ok) setAuth({ state: 'in', email: (await res.json()).email });
      else if (res.status === 401) setAuth({ state: 'out' });
      else setAuth({ state: 'offline' });
    } catch {
      setAuth({ state: 'offline' });
    }
  }, []);

  useEffect(() => {
    const onHash = () => setRoute(parseRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    checkSession();
    let alive = true;
    const poll = async () => {
      const s = await fetchLocalStatus();
      if (alive) setLocal(s);
    };
    poll();
    const t = setInterval(poll, 4000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [checkSession]);

  // Tünel geri gelince oturumu tekrar kontrol et
  const connected = local?.connected;
  useEffect(() => {
    if (connected && auth.state === 'offline') checkSession();
  }, [connected, auth.state, checkSession]);

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' }).catch(() => undefined);
    setAuth({ state: 'out' });
    window.location.hash = '#/';
  };

  const publicUrl = local?.publicUrl ?? 'https://siberkoy.omusiber.org';
  // Sabit referans: alt bileşenlerin veri yükleme efektleri her durum yoklamasında yeniden çalışmasın.
  const onUnauthorized = useCallback(() => setAuth({ state: 'out' }), []);

  return (
    <>
      <StatusBar status={local} email={auth.state === 'in' ? auth.email : null} onLogout={auth.state === 'in' ? logout : undefined} />
      {route.name === 'guide' ? (
        <Guide />
      ) : route.name === 'backup' ? (
        <Backup />
      ) : (
        <>
          {auth.state === 'checking' && <p className="p-8 font-mono text-sm text-hex-cyan">&gt; sunucuya bağlanılıyor...</p>}
          {auth.state === 'offline' && (
            <main className="mx-auto max-w-md p-8">
              <Brand command="admin@local:~$ ping sunucu" subtitle="Yönetim" size="md" />
              <div className="koy-panel mt-6 p-6">
                <p className="font-mono text-hex-blood">! sunucuya ulaşılamıyor</p>
                <p className="mt-2 text-sm text-night-400">{local?.message || 'Tünel kuruluyor olabilir. Terminal penceresini kontrol et.'}</p>
                <button onClick={checkSession} className="koy-btn-ghost mt-4">
                  tekrar dene
                </button>
              </div>
            </main>
          )}
          {auth.state === 'out' && <Login onLoggedIn={checkSession} />}
          {auth.state === 'in' &&
            (route.name === 'event' ? (
              <EventConsole eventId={route.id} publicUrl={publicUrl} onUnauthorized={onUnauthorized} />
            ) : route.name === 'results' ? (
              <Results eventId={route.id} onUnauthorized={onUnauthorized} />
            ) : (
              <Events email={auth.email} onUnauthorized={onUnauthorized} />
            ))}
        </>
      )}
    </>
  );
}
