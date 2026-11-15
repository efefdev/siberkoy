'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { io } from 'socket.io-client';
import { ArrowLeft, KeyRound, Play, RefreshCw, Siren, Square, Trophy, Users } from 'lucide-react';
import { calculateRoomAllocation } from '@/lib/room-allocator';

interface Player {
  id: string;
  username: string;
  status: string;
}
interface Pin {
  id: string;
  pin: string;
  tableNumber: number;
  isActive: boolean;
  usedAt: string | null;
  expired: boolean;
}
interface Room {
  id: string;
  roomNumber: number;
  status: string;
  winningSide: string | null;
  narratorPinId: string | null;
  assignments: { playerId: string; isAlive: boolean }[];
}
interface Round {
  id: string;
  roundNumber: number;
  status: string;
  rooms: Room[];
}
interface Alert {
  id: string;
  message: string;
  createdAt: string;
  room: { roomNumber: number } | null;
}
interface State {
  event: { id: string; name: string; eventPin: string; status: string; allowLess8: boolean };
  players: Player[];
  narratorPins: Pin[];
  rounds: Round[];
  alerts: Alert[];
}

const PLAYER_STATUS: Record<string, string> = { LOBBY: 'lobide', PLAYING: 'oyunda', KICKED: 'çıkarıldı', BANNED: 'banlandı' };

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'İşlem başarısız');
  return data;
}

export default function EventConsole({ eventId }: { eventId: string }) {
  const [state, setState] = useState<State | null>(null);
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/events/${eventId}`, { cache: 'no-store' });
      if (res.status === 401) {
        window.location.href = '/admin/login';
        return;
      }
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Etkinlik yüklenemedi');
      setState(await res.json());
      setLoadError('');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Etkinlik yüklenemedi');
    }
  }, [eventId]);

  useEffect(() => {
    load();
    const socket = io();
    const refresh = () => load();
    for (const ev of ['event_updated', 'new_admin_alert', 'room_completed', 'player_eliminated', 'connect']) socket.on(ev, refresh);
    // Socket kopsa bile 15 sn'de bir eşitle
    const timer = setInterval(load, 15000);
    return () => {
      clearInterval(timer);
      socket.disconnect();
    };
  }, [load]);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      if (ok) setMessage({ kind: 'ok', text: ok });
      await load();
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'İşlem başarısız' });
    } finally {
      setBusy(false);
    }
  };

  if (!state) {
    return (
      <main className="mx-auto max-w-6xl p-4 md:p-8">
        <p className="font-mono text-sm text-hex-cyan">{loadError ? `! ${loadError}` : '> etkinlik yükleniyor...'}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-4 md:p-8">
      <Link href="/admin" className="mb-4 inline-flex items-center gap-1 font-mono text-xs text-night-400 hover:text-hex-cyan">
        <ArrowLeft size={14} aria-hidden="true" /> etkinlikler
      </Link>

      <Header state={state} busy={busy} run={run} />

      {message && (
        <div
          role={message.kind === 'error' ? 'alert' : 'status'}
          className={`mb-6 flex items-start justify-between gap-3 rounded-lg border p-3 font-mono text-sm ${
            message.kind === 'error' ? 'border-hex-blood/60 bg-hex-blood/10 text-hex-blood' : 'border-hex-cyan/50 bg-hex-cyan/10 text-hex-cyan'
          }`}
        >
          <span>{message.kind === 'error' ? '! ' : '> '}{message.text}</span>
          <button onClick={() => setMessage(null)} aria-label="Kapat">✕</button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Tables state={state} />
          <Players state={state} busy={busy} run={run} />
        </div>
        <div className="space-y-6">
          <Alerts state={state} busy={busy} run={run} />
          <Narrators state={state} busy={busy} run={run} />
          <ScoreAdjust state={state} busy={busy} run={run} />
        </div>
      </div>
    </main>
  );
}

type Runner = (fn: () => Promise<unknown>, ok?: string) => Promise<void>;
interface SectionProps {
  state: State;
  busy: boolean;
  run: Runner;
}

function activePlayers(state: State) {
  return state.players.filter((p) => p.status === 'LOBBY' || p.status === 'PLAYING');
}

function neededTables(state: State): { tables: number; error?: string } {
  const n = activePlayers(state).length;
  try {
    return { tables: calculateRoomAllocation(n, state.event.allowLess8).roomCount };
  } catch (err) {
    return { tables: 0, error: err instanceof Error ? err.message : 'Masa dağılımı yapılamıyor' };
  }
}

function Header({ state, busy, run }: SectionProps) {
  const [confirmEnd, setConfirmEnd] = useState(false);
  const { event, rounds } = state;
  const current = rounds[rounds.length - 1];
  const canStart = event.status !== 'COMPLETED' && (!current || current.status === 'COMPLETED');
  const needed = neededTables(state);

  return (
    <header className="koy-panel mb-6 grid gap-6 p-6 md:grid-cols-[1fr_auto]">
      <div>
        <p className="font-mono text-xs text-hex-cyan">admin@siberkoy:~$ etkinlik</p>
        <h1 className="mt-1 font-gothic text-4xl leading-tight text-night-100">{event.name}</h1>
        <p className="mt-2 font-mono text-sm text-night-400">
          {event.status === 'COMPLETED' ? 'etkinlik bitti' : current ? `tur ${current.roundNumber} · ${current.status === 'COMPLETED' ? 'bitti' : 'sürüyor'}` : 'lobi açık'}
          {' · '}
          {activePlayers(state).length} aktif oyuncu
          {needed.tables > 0 && ` · ${needed.tables} masa gerekiyor`}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {canStart && (
            <button
              disabled={busy}
              onClick={() => run(async () => {
                const r = await call(`/api/admin/events/${event.id}/rounds`, 'POST');
                return r;
              }, `Tur ${(current?.roundNumber ?? 0) + 1} başladı; oyuncular masa ve rollerini telefonlarında görüyor.`)}
              className="koy-btn"
            >
              <Play size={16} aria-hidden="true" /> Tur {(current?.roundNumber ?? 0) + 1}’i başlat
            </button>
          )}
          <Link href={`/scoreboard?eventId=${event.id}&projeksiyon=1`} target="_blank" className="koy-btn-ghost">
            <Trophy size={16} aria-hidden="true" /> Projeksiyon
          </Link>
          {event.status !== 'COMPLETED' &&
            (confirmEnd ? (
              <span className="inline-flex items-center gap-2">
                <button disabled={busy} onClick={() => run(() => call(`/api/admin/events/${event.id}`, 'PATCH', { status: 'COMPLETED' }), 'Etkinlik bitirildi.')} className="koy-btn-danger">
                  Evet, bitir
                </button>
                <button onClick={() => setConfirmEnd(false)} className="koy-btn-ghost">vazgeç</button>
              </span>
            ) : (
              <button onClick={() => setConfirmEnd(true)} className="koy-btn-danger">
                <Square size={14} aria-hidden="true" /> Etkinliği bitir
              </button>
            ))}
        </div>
        {needed.error && event.status !== 'COMPLETED' && <p className="mt-3 font-mono text-xs text-hex-gold">! {needed.error}</p>}
      </div>
      <div className="rounded-xl border border-hex-violet-deep bg-night-950 px-6 py-4 text-center">
        <p className="koy-label mb-1">Katılım PIN’i</p>
        <p className="font-mono text-5xl tracking-[0.25em] text-hex-cyan">{event.eventPin}</p>
        <p className="mt-1 text-xs text-night-500">siberkoy.omusiber.org</p>
      </div>
    </header>
  );
}

function Tables({ state }: { state: State }) {
  const current = state.rounds[state.rounds.length - 1];
  const tableOf = new Map(state.narratorPins.map((p) => [p.id, p.tableNumber]));
  if (!current) {
    return (
      <section className="koy-panel p-6">
        <h2 className="font-gothic text-2xl text-hex-violet">Masalar</h2>
        <p className="mt-2 text-sm text-night-400">Tur başlayınca masalar burada görünecek. Önce her masa için anlatıcı PIN’i üret.</p>
      </section>
    );
  }
  return (
    <section className="koy-panel p-6">
      <h2 className="font-gothic text-2xl text-hex-violet">Tur {current.roundNumber} masaları</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {current.rooms.map((room) => {
          const alive = room.assignments.filter((a) => a.isAlive).length;
          const done = room.status === 'COMPLETED';
          return (
            <div key={room.id} className={`rounded-xl border p-4 ${done ? 'border-night-700 bg-night-950' : 'border-hex-cyan/50 bg-night-800'}`}>
              <div className="flex items-baseline justify-between">
                <p className="font-gothic text-3xl text-night-100">Masa {room.roomNumber}</p>
                <span className={`font-mono text-xs ${done ? 'text-night-500' : 'text-hex-cyan'}`}>{done ? 'bitti' : 'sürüyor'}</span>
              </div>
              <p className="mt-1 font-mono text-xs text-night-400">
                {alive}/{room.assignments.length} hayatta · anlatıcı {room.narratorPinId ? `masa ${tableOf.get(room.narratorPinId) ?? '?'}` : 'yok'}
              </p>
              {done && (
                <p className={`mt-2 font-mono text-xs ${room.winningSide === 'ATTACKERS' ? 'text-hex-blood' : 'text-hex-cyan'}`}>
                  {room.winningSide === 'ATTACKERS' ? 'Hacker’lar kazandı' : 'Savunucular kazandı'}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Players({ state, busy, run }: SectionProps) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [confirm, setConfirm] = useState<{ id: string; action: 'kick' | 'ban' } | null>(null);
  const [showRemoved, setShowRemoved] = useState(false);
  const current = state.rounds[state.rounds.length - 1];
  const tableOf = useMemo(() => {
    const m = new Map<string, number>();
    current?.rooms.forEach((r) => r.assignments.forEach((a) => m.set(a.playerId, r.roomNumber)));
    return m;
  }, [current]);

  const list = state.players.filter((p) => showRemoved || p.status === 'LOBBY' || p.status === 'PLAYING');

  return (
    <section className="koy-panel p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-gothic text-2xl text-hex-violet">
          <Users size={20} aria-hidden="true" /> Oyuncular <span className="font-mono text-sm text-night-400">({activePlayers(state).length})</span>
        </h2>
        <label className="flex items-center gap-2 text-xs text-night-400">
          <input type="checkbox" checked={showRemoved} onChange={(e) => setShowRemoved(e.target.checked)} className="accent-hex-violet" />
          çıkarılanları göster
        </label>
      </div>
      {list.length === 0 ? (
        <p className="mt-3 text-sm text-night-400">Henüz katılan yok. PIN’i duyur.</p>
      ) : (
        <ul className="mt-4 divide-y divide-night-700">
          {list.map((p) => {
            const removed = p.status === 'KICKED' || p.status === 'BANNED';
            return (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                {renaming === p.id ? (
                  <form
                    className="flex flex-1 gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      run(() => call(`/api/admin/players/${p.id}`, 'POST', { action: 'rename', username: newName }), 'Takma ad değiştirildi.').then(() => setRenaming(null));
                    }}
                  >
                    <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={30} className="koy-input py-1.5 text-sm" aria-label="Yeni takma ad" />
                    <button disabled={busy} className="koy-btn py-1.5 text-sm">kaydet</button>
                    <button type="button" onClick={() => setRenaming(null)} className="koy-btn-ghost py-1.5 text-sm">vazgeç</button>
                  </form>
                ) : (
                  <>
                    <div className={removed ? 'opacity-50' : ''}>
                      <span className="font-semibold text-night-100">{p.username}</span>
                      <span className="ml-2 font-mono text-xs text-night-400">
                        {PLAYER_STATUS[p.status] ?? p.status}
                        {tableOf.has(p.id) && !removed && ` · masa ${tableOf.get(p.id)}`}
                      </span>
                    </div>
                    {!removed &&
                      (confirm?.id === p.id ? (
                        <span className="flex items-center gap-2 text-xs">
                          <span className="text-night-400">{confirm.action === 'ban' ? 'Banlansın mı?' : 'Çıkarılsın mı?'}</span>
                          <button
                            disabled={busy}
                            onClick={() =>
                              run(() => call(`/api/admin/players/${p.id}`, 'POST', { action: confirm.action }), confirm.action === 'ban' ? `${p.username} banlandı.` : `${p.username} çıkarıldı.`).then(() =>
                                setConfirm(null)
                              )
                            }
                            className="koy-btn-danger px-2 py-1 text-xs"
                          >
                            evet
                          </button>
                          <button onClick={() => setConfirm(null)} className="koy-btn-ghost px-2 py-1 text-xs">hayır</button>
                        </span>
                      ) : (
                        <span className="flex gap-1">
                          <button onClick={() => { setRenaming(p.id); setNewName(p.username); }} className="koy-btn-ghost px-2 py-1 text-xs">ad</button>
                          <button onClick={() => setConfirm({ id: p.id, action: 'kick' })} className="koy-btn-ghost px-2 py-1 text-xs">çıkar</button>
                          <button onClick={() => setConfirm({ id: p.id, action: 'ban' })} className="koy-btn-danger px-2 py-1 text-xs">ban</button>
                        </span>
                      ))}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Narrators({ state, busy, run }: SectionProps) {
  const needed = neededTables(state).tables;
  const activeByTable = new Map<number, Pin>();
  for (const p of state.narratorPins) if (p.isActive && !activeByTable.has(p.tableNumber)) activeByTable.set(p.tableNumber, p);
  const maxTable = Math.max(needed, 1, ...Array.from(activeByTable.keys()));
  const [extra, setExtra] = useState(0);
  const tables = Array.from({ length: maxTable + extra }, (_, i) => i + 1);
  const [revealed, setRevealed] = useState<Record<number, string>>({});
  const disabled = busy || state.event.status === 'COMPLETED';

  const create = (tableNumber: number, replacing: boolean) =>
    run(async () => {
      const r = await call(`/api/admin/events/${state.event.id}/narrator-pins`, 'POST', { tableNumber });
      setRevealed((v) => ({ ...v, [tableNumber]: r.pin.pin }));
    }, replacing ? `Masa ${tableNumber} için yeni PIN üretildi; eski PIN iptal edildi ve masa devredildi.` : `Masa ${tableNumber} için PIN üretildi.`);

  return (
    <section className="koy-panel p-6">
      <h2 className="flex items-center gap-2 font-gothic text-2xl text-hex-violet">
        <KeyRound size={20} aria-hidden="true" /> Anlatıcılar
      </h2>
      <p className="mt-1 text-xs text-night-400">Her masa için bir PIN. Anlatıcı tüm turlarda aynı masada kalır. PIN ilk girişte kilitlenir.</p>
      <ul className="mt-4 space-y-2">
        {tables.map((t) => {
          const pin = activeByTable.get(t);
          const status = !pin ? 'PIN yok' : pin.expired ? 'süresi doldu' : pin.usedAt ? 'giriş yaptı' : 'giriş bekleniyor';
          const ok = pin && pin.usedAt && !pin.expired;
          return (
            <li key={t} className={`rounded-lg border p-3 ${t <= needed && !ok ? 'border-hex-gold/50' : 'border-night-700'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-gothic text-xl text-night-100">Masa {t}</span>
                <span className={`font-mono text-xs ${ok ? 'text-hex-cyan' : t <= needed ? 'text-hex-gold' : 'text-night-500'}`}>{status}</span>
              </div>
              {pin && !pin.usedAt && !pin.expired && <p className="mt-1 font-mono text-2xl tracking-[0.3em] text-hex-cyan">{revealed[t] ?? pin.pin}</p>}
              <button disabled={disabled} onClick={() => create(t, Boolean(pin))} className="koy-btn-ghost mt-2 w-full py-1.5 text-xs">
                {pin ? <><RefreshCw size={12} aria-hidden="true" /> yeni PIN (devret)</> : 'PIN üret'}
              </button>
            </li>
          );
        })}
      </ul>
      <button disabled={disabled} onClick={() => setExtra((e) => e + 1)} className="mt-3 font-mono text-xs text-night-400 hover:text-hex-cyan">
        + masa ekle
      </button>
    </section>
  );
}

function Alerts({ state, busy, run }: SectionProps) {
  return (
    <section className={`rounded-2xl border p-6 ${state.alerts.length ? 'border-hex-blood/60 bg-[#1a0b16]' : 'border-night-700 bg-night-900'}`}>
      <h2 className="flex items-center gap-2 font-gothic text-2xl text-hex-blood">
        <Siren size={20} aria-hidden="true" /> Yardım <span className="font-mono text-sm">({state.alerts.length})</span>
      </h2>
      {state.alerts.length === 0 ? (
        <p className="mt-2 text-sm text-night-400">Tüm masalar sakin.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {state.alerts.map((a) => (
            <li key={a.id} className="border-l-2 border-hex-blood pl-3">
              <p className="font-mono text-xs text-hex-blood">masa {a.room?.roomNumber ?? '?'} · {new Date(a.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</p>
              <p className="text-sm text-night-200">{a.message}</p>
              <button disabled={busy} onClick={() => run(() => call(`/api/admin/alerts/${a.id}/resolve`, 'POST'))} className="koy-btn-ghost mt-2 px-2 py-1 text-xs">
                çözüldü
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ScoreAdjust({ state, busy, run }: SectionProps) {
  const [playerId, setPlayerId] = useState('');
  const [delta, setDelta] = useState('-3');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const players = state.players.filter((p) => p.status !== 'BANNED');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(delta);
    if (!playerId) return setError('Oyuncu seç.');
    if (!Number.isInteger(n) || n === 0 || n < -10 || n > 10) return setError('Puan -10 ile 10 arasında, sıfırdan farklı bir tam sayı olmalı.');
    if (reason.trim().length < 3) return setError('Gerekçe yaz (en az 3 karakter).');
    setError('');
    run(() => call('/api/admin/scores/adjust', 'POST', { eventId: state.event.id, playerId, delta: n, reason }), 'Puan düzeltmesi kaydedildi.').then(() => setReason(''));
  };

  return (
    <section className="koy-panel p-6">
      <h2 className="font-gothic text-2xl text-hex-violet">Puan düzeltme</h2>
      <p className="mt-1 text-xs text-night-400">Eski kayıt silinmez; gerekçesiyle yeni bir düzeltme kaydı eklenir.</p>
      <form onSubmit={submit} className="mt-3 space-y-2">
        <select value={playerId} onChange={(e) => setPlayerId(e.target.value)} className="koy-input py-2 text-sm" aria-label="Oyuncu">
          <option value="">oyuncu seç…</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>{p.username}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <input value={delta} onChange={(e) => setDelta(e.target.value)} inputMode="numeric" className="koy-input w-20 py-2 text-center font-mono text-sm" aria-label="Puan farkı" />
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="Yanlış masa puanlandı" className="koy-input py-2 text-sm" aria-label="Gerekçe" />
        </div>
        {error && <p role="alert" className="font-mono text-xs text-hex-blood">! {error}</p>}
        <button disabled={busy} className="koy-btn-ghost w-full py-2 text-sm">kaydet</button>
      </form>
    </section>
  );
}
