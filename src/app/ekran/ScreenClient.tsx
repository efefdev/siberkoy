'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import QrCode from '@/components/ui/QrCode';
import EventTheme from '@/components/theme/EventTheme';

interface ScreenData {
  event: { name: string; status: string; theme: string; isPractice: boolean };
  join: { pin: string; url: string } | null;
  playerCount: number;
  round: null | {
    number: number;
    status: string;
    tables: { number: number; status: string; size: number; alive: number; winningSide: string | null }[];
  };
  stats: { rounds: number; tables: number; defenderWins: number; attackerWins: number };
  podium: { rank: number; username: string; totalScore: number }[];
}

/** Salondaki büyük ekran: katılım → tur durumu → final podyumu, etkinliğin durumuna göre kendiliğinden geçer. */
export default function ScreenClient({ eventId }: { eventId: string }) {
  const [data, setData] = useState<ScreenData | null>(null);
  const [error, setError] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/screen?eventId=${encodeURIComponent(eventId)}`, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      setData(await res.json());
      setError(false);
    } catch {
      setError(true);
    }
  }, [eventId]);

  useEffect(() => {
    load();
    const socket = io();
    // Aynı anda gelen çok sayıda sinyal tek yenilemeye indirgenir.
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(load, 400);
    };
    socket.on('connect', () => {
      socket.emit('scoreboard:join', eventId);
      load();
    });
    socket.on('screen_updated', refresh);
    const poll = setInterval(load, 15000);
    return () => {
      clearInterval(poll);
      socket.disconnect();
    };
  }, [eventId, load]);

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="font-mono text-2xl text-hex-cyan">{error ? '! ekran verisi alınamadı' : '> köy yükleniyor_'}</p>
      </main>
    );
  }

  const roundActive = data.round && data.round.status !== 'COMPLETED';
  const mode = data.event.status === 'COMPLETED' ? 'final' : roundActive ? 'round' : 'join';

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden px-[4vw] py-[3.5vh]" style={{ fontSize: 'clamp(14px, 1.05vw, 26px)' }}>
      <EventTheme theme={data.event.theme} />
      <Backdrop />
      <header className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-[1.4vw]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/omusiber.png" alt="OMÜ Siber" className="w-[5.2vw] drop-shadow-[0_10px_30px_rgba(63,109,179,.6)]" />
          <div>
            <p className="font-gothic text-[3.6vw] leading-none text-hex-violet">Siber Köy</p>
            <p className="mt-[.4vh] font-mono text-[1.1vw] text-night-400">{data.event.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-[1vw]">
          {data.event.isPractice && <span className="rounded-full border border-hex-gold/60 px-[1vw] py-[.5vh] font-mono text-[1vw] text-hex-gold">PROVA</span>}
          <span className="text-right font-mono text-[1.1vw] leading-tight text-night-300">OMÜ Siber Güvenlik Topluluğu<br /><span className="text-hex-cyan">@omusiber</span></span>
        </div>
      </header>

      <div className="relative z-10 flex flex-1 flex-col justify-center">
        {mode === 'join' && <JoinView data={data} />}
        {mode === 'round' && <RoundView data={data} />}
        {mode === 'final' && <FinalView data={data} />}
      </div>
    </main>
  );
}

function Backdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className="absolute left-1/2 top-[-20%] h-[90vh] w-[90vh] -translate-x-1/2 rounded-full bg-hex-violet/20 blur-[120px]" />
      <div className="absolute bottom-[-30%] right-[-10%] h-[80vh] w-[80vh] rounded-full bg-[#3f6db3]/20 blur-[120px]" />
      <div className="absolute inset-0 opacity-[.05]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '7px 7px' }} />
    </div>
  );
}

function JoinView({ data }: { data: ScreenData }) {
  const lastRound = data.round;
  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-[5vw]">
      {data.join ? (
        <div className="rounded-[2vw] bg-[#e4e2fb] p-[1.2vw] shadow-[0_0_120px_rgb(var(--hx-violet)/0.45)]">
          <QrCode value={data.join.url} size={420} className="h-[34vh] w-[34vh] min-h-[220px] min-w-[220px]" />
        </div>
      ) : (
        <div className="flex h-[36vh] w-[36vh] items-center justify-center rounded-[2vw] border-2 border-dashed border-night-600 text-center font-mono text-[1.2vw] text-night-500">
          katılım<br />kapalı
        </div>
      )}
      <div>
        <p className="font-mono text-[1.4vw] text-hex-cyan">{lastRound ? `> tur ${lastRound.number} bitti · sıradaki tur birazdan` : '> köy toplanıyor_'}</p>
        <h1 className="mt-[1vh] font-gothic text-[7.2vw] leading-[.95] text-night-100">
          Köye <span className="text-hex-violet">katıl</span>
        </h1>
        {data.join && (
          <>
            <p className="mt-[2vh] text-[1.6vw] text-night-300">
              QR’ı okut ya da <span className="font-mono text-hex-cyan">{data.join.url.replace(/^https?:\/\//, '')}</span> adresine gir
            </p>
            <div className="mt-[3vh] inline-flex items-center gap-[2vw] rounded-[1.6vw] border-2 border-hex-violet/50 bg-night-900/80 px-[2.4vw] py-[2vh]">
              <span className="font-mono text-[1.2vw] tracking-[.3em] text-night-400">KOD</span>
              <span className="font-mono text-[6vw] leading-none tracking-[.18em] text-hex-cyan">{data.join.pin}</span>
            </div>
          </>
        )}
        <div className="mt-[4vh] flex items-center gap-[1vw]">
          <span className="relative flex h-[1.2vw] w-[1.2vw]">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-hex-cyan opacity-60" />
            <span className="relative inline-flex h-full w-full rounded-full bg-hex-cyan" />
          </span>
          <p className="font-gothic text-[3.2vw] leading-none">
            {data.playerCount} <span className="text-night-400">kişi köyde</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function RoundView({ data }: { data: ScreenData }) {
  const round = data.round!;
  const done = round.tables.filter((t) => t.status === 'COMPLETED').length;
  const cols = round.tables.length <= 2 ? 2 : round.tables.length <= 4 ? round.tables.length : 3;
  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <p className="font-mono text-[1.4vw] text-hex-cyan">&gt; tur {round.number} sürüyor</p>
          <h1 className="mt-[.6vh] font-gothic text-[5.4vw] leading-none">
            Gece çöktü. <span className="text-hex-blood">Kimse güvende değil.</span>
          </h1>
        </div>
        <p className="font-gothic text-[3vw] leading-none text-night-300">
          {done}/{round.tables.length} <span className="text-[1.6vw] text-night-500">masa bitti</span>
        </p>
      </div>
      <div className="mt-[5vh] grid gap-[1.6vw]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {round.tables.map((t) => {
          const finished = t.status === 'COMPLETED';
          const pct = t.size ? (t.alive / t.size) * 100 : 0;
          return (
            <div
              key={t.number}
              className={`rounded-[1.4vw] border-2 p-[1.8vw] ${finished ? 'border-night-700 bg-night-950/80' : 'border-hex-violet/50 bg-night-900/80 shadow-[0_0_60px_rgb(var(--hx-violet)/0.18)]'}`}
            >
              <div className="flex items-baseline justify-between">
                <p className="font-gothic text-[3.4vw] leading-none">Masa {t.number}</p>
                <p className={`font-mono text-[1.1vw] ${finished ? 'text-night-500' : 'text-hex-cyan'}`}>{finished ? 'bitti' : 'oynuyor'}</p>
              </div>
              {finished ? (
                <p className={`mt-[2.4vh] font-gothic text-[2.2vw] ${t.winningSide === 'ATTACKERS' ? 'text-hex-blood' : 'text-hex-cyan'}`}>
                  {t.winningSide === 'ATTACKERS' ? 'Vampirler kazandı' : 'Köy kurtuldu'}
                </p>
              ) : (
                <>
                  <div className="mt-[2.6vh] h-[1.1vh] overflow-hidden rounded-full bg-night-800">
                    <div className="h-full rounded-full bg-hex-violet transition-all duration-700" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-[1.2vh] font-mono text-[1.2vw] text-night-400">
                    {t.alive}/{t.size} hayatta
                  </p>
                </>
              )}
            </div>
          );
        })}
      </div>
      {data.join && (
        <p className="mt-[4vh] text-center font-mono text-[1.2vw] text-night-500">
          geç kalan? {data.join.url.replace(/^https?:\/\//, '')} · kod <span className="text-hex-cyan">{data.join.pin}</span> · sonraki turda masaya alınırsın
        </p>
      )}
    </div>
  );
}

/** Eşitlikte bir basamakta gösterilecek en fazla isim; fazlası "+N kişi" olarak yazılır. */
const MAX_NAMES = 3;

function FinalView({ data }: { data: ScreenData }) {
  // İlk 3 sırayla açılır: önce 3., sonra 2., en son 1. Ekrana tıklayınca baştan oynatılır.
  const [step, setStep] = useState(0);
  const [run, setRun] = useState(0);
  useEffect(() => {
    setStep(0);
    const ts = [setTimeout(() => setStep(1), 1500), setTimeout(() => setStep(2), 4500), setTimeout(() => setStep(3), 8000)];
    return () => ts.forEach(clearTimeout);
  }, [run]);

  const byRank = (r: number) => data.podium.filter((p) => p.rank === r);
  const slots = [
    { place: 2, h: '20vh', show: step >= 2, color: 'text-night-200', ring: 'border-night-400/60' },
    { place: 1, h: '28vh', show: step >= 3, color: 'text-hex-gold', ring: 'border-hex-gold/70' },
    { place: 3, h: '14vh', show: step >= 1, color: 'text-[#d6a77a]', ring: 'border-[#d6a77a]/60' },
  ];

  return (
    <div className="cursor-pointer" onClick={() => setRun((r) => r + 1)} title="Tekrar oynat">
      <p className="text-center font-mono text-[1.4vw] text-hex-cyan">&gt; gece bitti · köyün efsaneleri</p>
      <h1 className="mt-[.6vh] text-center font-gothic text-[min(5.6vw,9vh)] leading-none">Final</h1>
      {/* Sabit yükseklik yok: isimler uzasa da kürsü alanı aşağı doğru büyür, başlığın üstüne binmez.
          Yazı boyutları vw ile birlikte vh ile de sınırlı; 4:3 projektörde de taşmaz. */}
      <div className="mt-[3vh] flex items-end justify-center gap-[1.6vw]">
        {slots.map((s) => {
          const winners = byRank(s.place);
          const shown = winners.slice(0, MAX_NAMES);
          return (
            <div key={s.place} className="flex w-[24vw] min-w-0 flex-col items-center">
              <div className={`mb-[1.5vh] w-full text-center transition-opacity duration-700 ${s.show ? 'opacity-100' : 'opacity-0'}`}>
                {shown.length ? (
                  shown.map((w) => (
                    <p
                      key={w.username}
                      className={`line-clamp-2 font-gothic leading-[1.05] [overflow-wrap:anywhere] ${w.username.length > 16 ? 'text-[min(1.9vw,3.4vh)]' : 'text-[min(2.6vw,4.6vh)]'} ${s.color} ${s.show ? 'animate-podium-rise' : ''}`}
                    >
                      {w.username}
                    </p>
                  ))
                ) : (
                  <p className="font-mono text-[min(1.2vw,2.2vh)] text-night-600">—</p>
                )}
                {winners.length > MAX_NAMES && (
                  <p className="font-mono text-[min(1.1vw,2vh)] text-night-400">+{winners.length - MAX_NAMES} kişi</p>
                )}
                {winners[0] && <p className="mt-[.4vh] font-mono text-[min(1.3vw,2.3vh)] text-night-400">{winners[0].totalScore} puan</p>}
              </div>
              <div
                className={`flex w-full items-start justify-center overflow-hidden rounded-t-[1.2vw] border-2 border-b-0 bg-night-900/90 pt-[2vh] transition-all duration-1000 ${s.ring}`}
                style={{ height: s.show ? s.h : '4vh' }}
              >
                <span className={`font-gothic text-[min(5vw,8vh)] leading-none transition-opacity duration-700 ${s.color} ${s.show ? 'opacity-100' : 'opacity-0'}`}>{s.place}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mx-auto mt-[3vh] flex max-w-[80vw] flex-wrap justify-center gap-x-[3vw] gap-y-[1vh] font-mono text-[min(1.3vw,2.3vh)] text-night-400">
        <span>{data.stats.rounds} tur</span>
        <span>·</span>
        <span>{data.stats.tables} masa</span>
        <span>·</span>
        <span className="text-hex-cyan">köy {data.stats.defenderWins} kez kurtuldu</span>
        <span>·</span>
        <span className="text-hex-blood">vampirler {data.stats.attackerWins} kez kazandı</span>
      </div>
    </div>
  );
}
