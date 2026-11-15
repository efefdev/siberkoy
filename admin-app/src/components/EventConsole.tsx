import { useCallback, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { ArrowLeft, BarChart3, Monitor, DoorClosed, DoorOpen, KeyRound, Play, RefreshCw, Siren, Smartphone, Square, Trophy, Unlock, Users, Shuffle } from 'lucide-react';
import { calculateRoomAllocation } from '@/lib/room-allocator';
import { accusative } from '@/lib/text';
import { socketQuery } from '../local';

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
  event: { id: string; name: string; eventPin: string; status: string; allowLess8: boolean; registrationOpen: boolean; theme: string; isPractice: boolean };
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

export default function EventConsole({ eventId, publicUrl, onUnauthorized }: { eventId: string; publicUrl: string; onUnauthorized: () => void }) {
  const [state, setState] = useState<State | null>(null);
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/events/${eventId}`, { cache: 'no-store' });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Etkinlik yüklenemedi');
      setState(await res.json());
      setLoadError('');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Etkinlik yüklenemedi');
    }
  }, [eventId, onUnauthorized]);

  useEffect(() => {
    load();
    const socket = io({ query: socketQuery() });
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
      <a href="#/" className="mb-4 inline-flex items-center gap-1 font-mono text-xs text-night-400 hover:text-hex-cyan">
        <ArrowLeft size={14} aria-hidden="true" /> etkinlikler
      </a>

      <Header state={state} busy={busy} run={run} publicUrl={publicUrl} />

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
          <Tables state={state} busy={busy} run={run} />
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

function Header({ state, busy, run, publicUrl }: SectionProps & { publicUrl: string }) {
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmShuffle, setConfirmShuffle] = useState(false);
  const { event, rounds } = state;
  const current = rounds[rounds.length - 1];
  const canStart = event.status !== 'COMPLETED' && (!current || current.status === 'COMPLETED');
  const roundRunning = Boolean(current && current.status !== 'COMPLETED');
  const needed = neededTables(state);
  const readyNarrators = new Set(state.narratorPins.filter((p) => p.isActive && p.usedAt && !p.expired).map((p) => p.tableNumber));
  const missingTables = Array.from({ length: needed.tables }, (_, i) => i + 1).filter((t) => !readyNarrators.has(t));
  const nextRound = (current?.roundNumber ?? 0) + 1;

  return (
    <header className="koy-panel mb-6 grid gap-6 p-6 md:grid-cols-[1fr_auto]">
      <div>
        <p className="font-mono text-xs text-hex-cyan">admin@siberkoy:~$ etkinlik</p>
        <h1 className="mt-1 font-gothic text-4xl leading-tight text-night-100">
          {event.name}
          {event.isPractice && <span className="ml-3 align-middle rounded-full border border-hex-gold/60 px-2.5 py-0.5 font-mono text-xs text-hex-gold">PROVA</span>}
          {event.theme === 'halloween' && <span className="ml-2 align-middle rounded-full border border-[#fb923c]/60 px-2.5 py-0.5 font-mono text-xs text-[#fb923c]">🎃 halloween</span>}
        </h1>
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
              }, `Tur ${nextRound} başladı; oyuncular masa ve rollerini telefonlarında görüyor.`)}
              className="koy-btn"
            >
              <Play size={16} aria-hidden="true" /> Tur {accusative(nextRound)} başlat{nextRound > 1 ? ' (masalar aynı)' : ''}
            </button>
          )}
          {canStart && nextRound > 1 &&
            (confirmShuffle ? (
              <>
                <button
                  disabled={busy}
                  onClick={() => {
                    setConfirmShuffle(false);
                    run(
                      () => call(`/api/admin/events/${event.id}/rounds`, 'POST', { reshuffle: true }),
                      `Tur ${nextRound} başladı; herkes masalara yeniden rastgele dağıtıldı.`
                    );
                  }}
                  className="koy-btn-danger"
                >
                  Evet, herkesi yeniden dağıt
                </button>
                <button onClick={() => setConfirmShuffle(false)} className="koy-btn-ghost">vazgeç</button>
              </>
            ) : (
              <button disabled={busy} onClick={() => setConfirmShuffle(true)} className="koy-btn-ghost" title="Herkes masalara yeniden rastgele dağıtılır ve tur başlar">
                <Shuffle size={16} aria-hidden="true" /> Masaları yeniden dağıt
              </button>
            ))}
          {event.status !== 'COMPLETED' && (
            <button
              disabled={busy}
              onClick={() =>
                run(
                  () => call(`/api/admin/events/${event.id}`, 'PATCH', { registrationOpen: !event.registrationOpen }),
                  event.registrationOpen ? 'Katılım kapatıldı. Yeniden bağlanma ve cihaz kodu çalışmaya devam eder.' : 'Katılım açıldı.'
                )
              }
              className={`koy-btn-ghost ${event.registrationOpen ? '' : 'border-hex-gold/60 text-hex-gold'}`}
            >
              {event.registrationOpen ? <><DoorClosed size={16} aria-hidden="true" /> Katılımı kapat</> : <><DoorOpen size={16} aria-hidden="true" /> Katılımı aç</>}
            </button>
          )}
          <a href={`${publicUrl}/ekran?eventId=${event.id}`} target="_blank" rel="noopener noreferrer" className="koy-btn-ghost" title="Perdeye yansıt: katılım kodu, tur durumu, final podyumu">
            <Monitor size={16} aria-hidden="true" /> Büyük ekran
          </a>
          <a href={`${publicUrl}/scoreboard?eventId=${event.id}&projeksiyon=1`} target="_blank" rel="noopener noreferrer" className="koy-btn-ghost">
            <Trophy size={16} aria-hidden="true" /> Skor tablosu
          </a>
          <a href={`#/events/${event.id}/sonuc`} className="koy-btn-ghost">
            <BarChart3 size={16} aria-hidden="true" /> Rapor ve paylaşım
          </a>
          {event.status !== 'COMPLETED' &&
            (confirmEnd ? (
              <span className="inline-flex items-center gap-2">
                <button disabled={busy} onClick={() => run(() => call(`/api/admin/events/${event.id}`, 'PATCH', { status: 'COMPLETED' }), 'Etkinlik bitirildi.')} className="koy-btn-danger">
                  Evet, bitir
                </button>
                <button onClick={() => setConfirmEnd(false)} className="koy-btn-ghost">vazgeç</button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmEnd(true)}
                disabled={roundRunning}
                title={roundRunning ? 'Tüm masalar sonucu girince bitirilebilir' : undefined}
                className="koy-btn-danger"
              >
                <Square size={14} aria-hidden="true" /> Etkinliği bitir
              </button>
            ))}
        </div>
        {needed.error && event.status !== 'COMPLETED' && <p className="mt-3 font-mono text-xs text-hex-gold">! {needed.error}</p>}
        {canStart && !needed.error && missingTables.length > 0 && (
          <p className="mt-3 font-mono text-xs text-hex-gold">
            ! Tur {nextRound} için {needed.tables} masa gerekiyor; masa {missingTables.join(', ')} için giriş yapmış anlatıcı yok.
          </p>
        )}
        {!event.registrationOpen && event.status !== 'COMPLETED' && (
          <p className="mt-3 font-mono text-xs text-hex-gold">katılım kapalı: yeni oyuncu giremez</p>
        )}
      </div>
      <div className="rounded-xl border border-hex-violet-deep bg-night-950 px-6 py-4 text-center">
        <p className="koy-label mb-1">Katılım PIN’i</p>
        <p className="font-mono text-5xl tracking-[0.25em] text-hex-cyan">{event.eventPin}</p>
        <p className="mt-1 text-xs text-night-500">{publicUrl.replace(/^https?:\/\//, '')}</p>
      </div>
    </header>
  );
}

function Tables({ state, busy, run }: SectionProps) {
  const current = state.rounds[state.rounds.length - 1];
  const nameOf = new Map(state.players.map((p) => [p.id, p.username]));
  const [open, setOpen] = useState<string | null>(null);
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
              {state.event.status !== 'COMPLETED' && (
                <button onClick={() => setOpen(open === room.id ? null : room.id)} className="mt-2 font-mono text-xs text-night-400 hover:text-hex-cyan">
                  {open === room.id ? '− kapat' : done ? '+ sonucu düzelt' : '+ elenenler'}
                </button>
              )}
              {open === room.id && (done ? <Rescore room={room} nameOf={nameOf} busy={busy} run={run} /> : <Revive room={room} nameOf={nameOf} busy={busy} run={run} />)}
            </div>
          );
        })}
      </div>
    </section>
  );
}

interface RoomToolProps {
  room: Room;
  nameOf: Map<string, string>;
  busy: boolean;
  run: Runner;
}

/** Süren masada yanlışlıkla elenen oyuncuyu geri getir. */
function Revive({ room, nameOf, busy, run }: RoomToolProps) {
  const dead = room.assignments.filter((a) => !a.isAlive);
  if (dead.length === 0) return <p className="mt-2 text-xs text-night-500">Elenen yok.</p>;
  return (
    <ul className="mt-2 space-y-1">
      {dead.map((a) => (
        <li key={a.playerId} className="flex items-center justify-between gap-2 text-xs">
          <span className="text-night-300 line-through">{nameOf.get(a.playerId) ?? '?'}</span>
          <button
            disabled={busy}
            onClick={() => run(() => call(`/api/admin/rooms/${room.id}`, 'POST', { action: 'revive', playerId: a.playerId }), `${nameOf.get(a.playerId)} masaya geri döndü.`)}
            className="koy-btn-ghost px-2 py-1 text-xs"
          >
            dirilt
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Bitmiş masanın sonucunu düzelt: kazanan taraf + hayatta olanlar. Puan farkı ADJUSTMENT kaydı olarak yazılır. */
function Rescore({ room, nameOf, busy, run }: RoomToolProps) {
  const [side, setSide] = useState<'DEFENDERS' | 'ATTACKERS'>(room.winningSide === 'ATTACKERS' ? 'DEFENDERS' : 'ATTACKERS');
  const [alive, setAlive] = useState<Set<string>>(() => new Set(room.assignments.filter((a) => a.isAlive).map((a) => a.playerId)));
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const toggle = (id: string) =>
    setAlive((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 3) return setError('Gerekçe yaz (en az 3 karakter).');
    setError('');
    run(
      () => call(`/api/admin/rooms/${room.id}`, 'POST', { action: 'rescore', winningSide: side, aliveIds: Array.from(alive), reason }),
      `Masa ${room.roomNumber} sonucu düzeltildi; puan farkları düzeltme kaydı olarak eklendi.`
    );
  };
  return (
    <form onSubmit={submit} className="mt-3 space-y-2 border-t border-night-700 pt-3">
      <div className="flex gap-2">
        {(['DEFENDERS', 'ATTACKERS'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setSide(v)}
            className={`flex-1 rounded border px-2 py-1.5 text-xs ${side === v ? (v === 'ATTACKERS' ? 'border-hex-blood bg-hex-blood/20 text-hex-blood' : 'border-hex-cyan bg-hex-cyan/20 text-hex-cyan') : 'border-night-700 text-night-400'}`}
          >
            {v === 'ATTACKERS' ? 'Hacker’lar' : 'Savunucular'}
          </button>
        ))}
      </div>
      <p className="koy-label">Oyun sonunda hayatta</p>
      <ul className="max-h-40 space-y-1 overflow-auto">
        {room.assignments.map((a) => (
          <li key={a.playerId}>
            <label className="flex items-center gap-2 text-xs text-night-200">
              <input type="checkbox" checked={alive.has(a.playerId)} onChange={() => toggle(a.playerId)} className="accent-hex-violet" />
              {nameOf.get(a.playerId) ?? '?'}
            </label>
          </li>
        ))}
      </ul>
      <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="Anlatıcı yanlış tarafı seçti" className="koy-input py-1.5 text-xs" aria-label="Gerekçe" />
      {error && <p role="alert" className="font-mono text-xs text-hex-blood">! {error}</p>}
      <button disabled={busy} className="koy-btn-ghost w-full py-1.5 text-xs">düzeltmeyi kaydet</button>
    </form>
  );
}

function Players({ state, busy, run }: SectionProps) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [confirm, setConfirm] = useState<{ id: string; action: 'kick' | 'ban' } | null>(null);
  const [showRemoved, setShowRemoved] = useState(false);
  const [codes, setCodes] = useState<Record<string, { code: string; until: number }>>({});
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
                          <button
                            disabled={busy || state.event.status === 'COMPLETED'}
                            title="Telefon değiştiren oyuncu için tek kullanımlık kod"
                            onClick={() =>
                              run(async () => {
                                const r = await call(`/api/admin/players/${p.id}`, 'POST', { action: 'transfer-code' });
                                setCodes((c) => ({ ...c, [p.id]: { code: r.code, until: Date.now() + r.expiresInMinutes * 60000 } }));
                              })
                            }
                            className="koy-btn-ghost px-2 py-1 text-xs"
                          >
                            <Smartphone size={12} aria-hidden="true" /> kod
                          </button>
                          <button onClick={() => { setRenaming(p.id); setNewName(p.username); }} className="koy-btn-ghost px-2 py-1 text-xs">ad</button>
                          <button onClick={() => setConfirm({ id: p.id, action: 'kick' })} className="koy-btn-ghost px-2 py-1 text-xs">çıkar</button>
                          <button onClick={() => setConfirm({ id: p.id, action: 'ban' })} className="koy-btn-danger px-2 py-1 text-xs">ban</button>
                        </span>
                      ))}
                    {codes[p.id] && codes[p.id].until > Date.now() && !removed && (
                      <p className="w-full font-mono text-xs text-night-400">
                        cihaz kodu: <span className="text-lg tracking-[0.2em] text-hex-cyan">{codes[p.id].code}</span> · 10 dk geçerli, tek kullanımlık. Oyuncu ana sayfada “telefon değiştirdim”e girer.
                      </p>
                    )}
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
      <div className="mt-3 flex items-center justify-between gap-2">
        <button disabled={disabled} onClick={() => setExtra((e) => e + 1)} className="font-mono text-xs text-night-400 hover:text-hex-cyan">
          + masa ekle
        </button>
        <button
          disabled={busy}
          title="Ortak Wi-Fi'da birkaç yanlış PIN herkesi kilitleyebilir"
          onClick={() => run(() => call('/api/admin/rate-limits/reset', 'POST'), 'Anlatıcı PIN ve cihaz kodu deneme kilitleri temizlendi.')}
          className="inline-flex items-center gap-1 font-mono text-xs text-night-400 hover:text-hex-cyan"
        >
          <Unlock size={12} aria-hidden="true" /> giriş kilitlerini temizle
        </button>
      </div>
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
