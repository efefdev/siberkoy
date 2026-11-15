import { useCallback, useEffect, useState } from 'react';
import Brand from '@/components/ui/Brand';
import CreateEventForm from '../components/CreateEventForm';

interface EventRow {
  id: string;
  name: string;
  eventPin: string;
  status: string;
  createdAt: string;
  playerCount: number;
  theme: string;
  isPractice: boolean;
  openAlerts: number;
}

const STATUS: Record<string, string> = { WAITING: 'lobi açık', IN_PROGRESS: 'oyunda', COMPLETED: 'bitti' };

export default function Events({ email, onUnauthorized }: { email: string; onUnauthorized: () => void }) {
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/events', { cache: 'no-store' });
      if (res.status === 401) return onUnauthorized();
      if (!res.ok) throw new Error('Etkinlikler yüklenemedi');
      setEvents((await res.json()).events);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Etkinlikler yüklenemedi');
    }
  }, [onUnauthorized]);

  useEffect(() => {
    load();
  }, [load]);

  const openAlerts = events?.filter((e) => e.status !== 'COMPLETED').reduce((n, e) => n + e.openAlerts, 0) ?? 0;

  return (
    <main className="mx-auto max-w-5xl p-4 md:p-8">
      <header className="mb-10">
        <Brand command={`admin@local:~$ ${email}`} subtitle="Yönetim paneli" size="md" />
      </header>

      {openAlerts > 0 && (
        <p role="status" className="mb-6 rounded-lg border border-hex-blood/60 bg-hex-blood/10 p-3 font-mono text-sm text-hex-blood">
          ! {openAlerts} çözülmemiş yardım bildirimi var — ilgili etkinliği aç.
        </p>
      )}

      <section className="koy-panel mb-8 p-6">
        <CreateEventForm onCreated={(id) => (window.location.hash = `#/events/${id}`)} />
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-gothic text-3xl text-hex-violet">Etkinlikler</h2>
          <a href="#/yedek" className="font-mono text-xs text-night-400 hover:text-hex-cyan">yedek kağıt kart seti &gt;</a>
        </div>
        {error && <p className="font-mono text-sm text-hex-blood">! {error}</p>}
        {!events && !error && <p className="font-mono text-sm text-hex-cyan">&gt; yükleniyor...</p>}
        {events && events.length === 0 && <p className="text-night-400">Henüz etkinlik yok. Yukarıdan ilkini oluştur.</p>}
        {events && events.length > 0 && (
          <ul className="divide-y divide-night-700 overflow-hidden rounded-2xl border border-night-700">
            {events.map((e) => (
              <li key={e.id}>
                <a href={`#/events/${e.id}`} className="flex items-center justify-between gap-4 bg-night-900 p-4 transition hover:bg-night-800">
                  <div>
                    <p className="font-semibold text-night-100">
                      {e.name}
                      {e.isPractice && <span className="ml-2 font-mono text-xs text-hex-gold">PROVA</span>}
                      {e.theme === 'halloween' && <span className="ml-2 text-xs">🎃</span>}
                    </p>
                    <p className="font-mono text-xs text-night-400">
                      PIN {e.eventPin} · {e.playerCount} oyuncu · {new Date(e.createdAt).toLocaleDateString('tr-TR')}
                      {e.openAlerts > 0 && e.status !== 'COMPLETED' && <span className="text-hex-blood"> · {e.openAlerts} yardım</span>}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 font-mono text-xs ${
                      e.status === 'COMPLETED' ? 'border-night-600 text-night-500' : e.status === 'IN_PROGRESS' ? 'border-hex-cyan text-hex-cyan' : 'border-hex-violet text-hex-violet'
                    }`}
                  >
                    {STATUS[e.status] ?? e.status}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
