'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { io } from 'socket.io-client';
import Brand from '@/components/ui/Brand';
import RoleCard from '@/components/ui/RoleCard';
import { TypedLine } from '@/components/ui/Terminal';
import NarratorFeedbackForm from '@/components/NarratorFeedbackForm';
import EventTheme from '@/components/theme/EventTheme';
import LeaveGuard from '@/components/ui/LeaveGuard';
import PlayerCards from '@/components/share/PlayerCards';
import type { BadgeSummary } from '@/components/share/PlayerBadge';

interface Me {
  player: { id: string; username: string };
  event: { id: string; name: string; status: string; theme?: string };
  latestRoundNumber: number;
  seat: null | {
    roundNumber: number;
    roomNumber: number;
    role: string;
    isAlive: boolean;
    roomStatus: string;
    winningSide: string | null;
  };
  feedbackTargets: { narratorId: string; tableNumber: number }[];
  summary?: BadgeSummary | null;
}

type State = { kind: 'loading' } | { kind: 'no-session' } | { kind: 'removed'; banned: boolean; transferred?: boolean } | { kind: 'error' } | { kind: 'ok'; me: Me };

export default function LobbyClient() {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [doneFeedback, setDoneFeedback] = useState<string[]>([]);
  const [pulse, setPulse] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/player/me', { cache: 'no-store' });
      if (res.status === 401) return setState((s) => (s.kind === 'removed' ? s : { kind: 'no-session' }));
      if (!res.ok) return setState({ kind: 'error' });
      const me: Me = await res.json();
      setState((prev) => {
        if (prev.kind === 'ok' && me.seat && prev.me.seat?.roundNumber !== me.seat.roundNumber) setPulse(true);
        return { kind: 'ok', me };
      });
    } catch {
      setState({ kind: 'error' });
    }
  }, []);

  useEffect(() => {
    load();
    const socket = io();
    const refresh = () => load();
    socket.on('round_started', refresh);
    socket.on('event_updated', refresh);
    socket.on('profile_updated', refresh);
    socket.on('you_were_eliminated', refresh);
    socket.on('connect', refresh); // kopup geri gelince durumu eşitle
    socket.on('removed', ({ banned, transferred }: { banned: boolean; transferred?: boolean }) =>
      setState({ kind: 'removed', banned, transferred })
    );
    // Sunucu bağlantıyı kestiyse (örn. çıkarıldı) socket kendiliğinden yeniden bağlanmaz: durumu sunucudan doğrula.
    socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') load();
    });
    // Sunucu el sıkışmayı reddederse (örn. `busy`) socket.io kendiliğinden yeniden bağlanmaz: biraz bekleyip tekrar dene.
    let retry: ReturnType<typeof setTimeout> | undefined;
    socket.on('connect_error', () => {
      refresh();
      if (!socket.active) {
        clearTimeout(retry);
        retry = setTimeout(() => socket.connect(), 5000 + Math.random() * 5000);
      }
    });
    // Telefon uykudan uyanınca kaçırılan olaylar için eşitle
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearTimeout(retry);
      socket.disconnect();
    };
  }, [load]);

  useEffect(() => {
    if (!pulse) return;
    const t = setTimeout(() => setPulse(false), 2500);
    return () => clearTimeout(t);
  }, [pulse]);

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-md flex-col p-4 pb-10">
      {state.kind === 'ok' && <EventTheme theme={state.me.event.theme} />}
      {/* Geri tuşu masadan çıkarmasın; bağlantı anlık koptuğunda (error) da koruma sürer. */}
      <LeaveGuard active={(state.kind === 'ok' && state.me.event.status !== 'COMPLETED') || state.kind === 'error'} />
      <div className="relative z-10 mb-6 mt-2">
        <Brand size="md" command={state.kind === 'ok' ? `${state.me.player.username}@siberkoy:~$ durum` : 'guest@siberkoy:~$ durum'} subtitle="" />
      </div>
      <div className="relative z-10">
      <Body state={state} pulse={pulse} doneFeedback={doneFeedback} onFeedbackDone={(id) => setDoneFeedback((d) => [...d, id])} retry={load} />
      </div>
    </main>
  );
}

function Body({
  state,
  pulse,
  doneFeedback,
  onFeedbackDone,
  retry,
}: {
  state: State;
  pulse: boolean;
  doneFeedback: string[];
  onFeedbackDone: (id: string) => void;
  retry: () => void;
}) {
  if (state.kind === 'loading') return <TypedLine text="bağlantı kuruluyor..." />;

  if (state.kind === 'error')
    return (
      <div className="koy-panel p-6">
        <p className="font-mono text-hex-blood">! sunucuya ulaşılamadı</p>
        <button onClick={retry} className="koy-btn-ghost mt-4">
          tekrar dene
        </button>
      </div>
    );

  if (state.kind === 'no-session' || state.kind === 'removed')
    return (
      <div className="koy-panel p-6">
        <p className="font-gothic text-3xl text-night-100">
          {state.kind === 'removed' ? (state.transferred ? 'Oturum taşındı' : 'Köyden çıkarıldın') : 'Oturum bulunamadı'}
        </p>
        <p className="mt-2 text-sm text-night-400">
          {state.kind === 'removed'
            ? state.transferred
              ? 'Oturumun cihaz koduyla başka bir telefona taşındı. Oyuna o telefondan devam et.'
              : state.banned
              ? 'Admin bu etkinliğe katılımını engelledi.'
              : 'Admin seni etkinlikten çıkardı. İstersen PIN ile yeniden katılabilirsin.'
            : 'Etkinliğe katılmak için PIN ve takma adını gir.'}
        </p>
        {!(state.kind === 'removed' && (state.banned || state.transferred)) && (
          <Link href="/" className="koy-btn mt-5 w-full">
            [ katılım ekranı ]
          </Link>
        )}
      </div>
    );

  const { me } = state;

  if (me.event.status === 'COMPLETED') {
    const targets = me.feedbackTargets.filter((t) => !doneFeedback.includes(t.narratorId));
    return (
      <div className="space-y-5">
        <div className="koy-panel p-6">
          <p className="font-gothic text-3xl text-hex-violet">Oyun bitti</p>
          <p className="mt-2 text-sm text-night-400">Katıldığın için teşekkürler, {me.player.username}. Sonuçlar büyük ekranda.</p>
          <Link href={`/scoreboard?eventId=${me.event.id}`} className="koy-btn-ghost mt-4">
            &gt; skor tablosu
          </Link>
        </div>
        {me.summary && (
          <PlayerCards username={me.player.username} eventName={me.event.name} summary={me.summary} halloween={me.event.theme === 'halloween'} />
        )}
        {targets.map((t) => (
          <div key={t.narratorId}>
            <p className="koy-label">Masa {t.tableNumber} anlatıcısı</p>
            <NarratorFeedbackForm narratorId={t.narratorId} onDone={() => onFeedbackDone(t.narratorId)} />
          </div>
        ))}
      </div>
    );
  }

  if (!me.seat) {
    const roundRunning = me.latestRoundNumber > 0;
    return (
      <div className="koy-panel p-6">
        <p className="font-mono text-xs uppercase tracking-widest text-night-400">{me.event.name}</p>
        <p className="mt-3 font-gothic text-3xl text-night-100">Lobidesin</p>
        <p className="mt-2 text-sm text-night-400">
          {roundRunning
            ? `Tur ${me.latestRoundNumber} masaları dağıtılmıştı. Sonraki turda bir masaya alınacaksın.`
            : 'Admin turu başlattığında masa numaran ve gizli rolün burada belirecek.'}
        </p>
        <div className="mt-5 space-y-0.5">
          <TypedLine text={`kimlik: ${me.player.username}`} delay={200} />
          <TypedLine text="tur bekleniyor..." delay={900} />
        </div>
        <Link href="/rehber" className="koy-btn-ghost mt-5 text-sm">
          &gt; nasıl oynanır
        </Link>
      </div>
    );
  }

  const seat = me.seat;
  const finished = seat.roomStatus === 'COMPLETED';
  return (
    <div className="space-y-5">
      <div className={`koy-panel flex items-center justify-between p-5 ${pulse ? 'animate-pulse-ring' : ''}`}>
        <div>
          <p className="koy-label mb-1">Tur {seat.roundNumber}</p>
          <p className="font-gothic text-4xl leading-none text-night-100">Masa {seat.roomNumber}</p>
        </div>
        <p className="max-w-[9rem] text-right text-xs text-night-400">Bu numaralı masaya geç ve anlatıcını bekle.</p>
      </div>

      {!seat.isAlive && !finished && (
        <div role="status" className="koy-panel border-hex-blood/50 p-4 text-center">
          <p className="font-gothic text-2xl text-hex-blood">Elendin</p>
          <p className="mt-1 text-xs text-night-400">Artık izleyicisin: masada konuşma, ipucu verme. Masa bitince puanın hesaplanır.</p>
        </div>
      )}

      <RoleCard role={seat.role} roomNumber={seat.roomNumber} roundNumber={seat.roundNumber} isAlive={seat.isAlive} />

      {finished && (
        <div className="koy-panel p-5 text-center">
          <p className="font-mono text-sm text-hex-cyan">
            masa kapandı · {seat.winningSide === 'ATTACKERS' ? 'Hacker’lar kazandı' : 'Savunucular kazandı'}
          </p>
          <p className="mt-1 text-xs text-night-400">Sonraki tur başlayınca yeni masan burada görünecek.</p>
        </div>
      )}
    </div>
  );
}
