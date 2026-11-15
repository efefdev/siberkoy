'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import { Siren, Trophy, Lock, Undo2 } from 'lucide-react';
import RoleIcon from './ui/RoleIcon';
import { roleLabel } from '@/lib/roles';
import { winner } from '@/lib/narrator-guide';
import NarratorGuide, { OPENING_TEXT } from './NarratorGuide';

const UNDO_SECONDS = 10;

interface Player {
  id: string;
  username: string;
  role: string;
  isAlive: boolean;
}

interface NarratorPanelProps {
  roomId: string;
  roomNumber: number;
  roundNumber: number;
  roomCompleted: boolean;
  players: Player[];
  /** Prova etkinliği: oyuncular sahtedir, hiçbir şey gerçek skora yazılmaz. */
  practice?: boolean;
}

export default function NarratorPanel({ roomId, roomNumber, roundNumber, roomCompleted, players: initialPlayers, practice = false }: NarratorPanelProps) {
  const [players, setPlayers] = useState(initialPlayers);
  const [phaseText, setPhaseText] = useState('açılış');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertSent, setAlertSent] = useState(false);
  const [winningSide, setWinningSide] = useState<'DEFENDERS' | 'ATTACKERS' | null>(null);
  const [roundEnded, setRoundEnded] = useState(roomCompleted);
  const [actionError, setActionError] = useState('');
  // Eleme tek dokunuşla; yanlışlıkla basılırsa 10 sn içinde geri alınabilir.
  const [undo, setUndo] = useState<{ id: string; until: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  // Sunucudan yenilenen veri (admin diriltmesi, sayfa yenileme) yerel durumu ezer.
  useEffect(() => setPlayers(initialPlayers), [initialPlayers]);
  useEffect(() => setRoundEnded(roomCompleted), [roomCompleted]);

  const refresh = useCallback(() => routerRef.current.refresh(), []);

  // Admin yeni tur başlatınca, masa devredilince ya da bağlantı geri gelince panel sunucudan yenilenir.
  useEffect(() => {
    const socket = io();
    let connectedOnce = false;
    socket.on('connect', () => {
      if (connectedOnce) refresh(); // kopup geri gelince arada kaçanları al
      connectedOnce = true;
    });
    socket.on('round_started', refresh);
    socket.on('player_revived', ({ playerId }: { playerId: string }) =>
      setPlayers((prev) => prev.map((p) => (p.id === playerId ? { ...p, isAlive: true } : p)))
    );
    socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') refresh(); // PIN iptal edildi → giriş sayfasına düşer
    });
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      socket.disconnect();
    };
  }, [refresh]);

  // Geri alma penceresi kapanınca düğmeyi gizle.
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), Math.max(0, undo.until - Date.now()));
    return () => clearTimeout(t);
  }, [undo]);

  const post = async (url: string, body: unknown) => {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  };

  // Eleme: tek dokunuş; üstte 10 sn "Geri al" çıkar.
  const eliminate = async (playerId: string): Promise<boolean> => {
    setBusy(true);
    const { res, data } = await post('/api/narrator/eliminate', { playerId, roomId });
    setBusy(false);
    if (!res.ok) {
      setActionError(data.error || 'Eleme kaydedilemedi');
      return false;
    }
    setPlayers((prev) => prev.map((p) => (p.id === playerId ? { ...p, isAlive: false } : p)));
    setUndo({ id: playerId, until: Date.now() + UNDO_SECONDS * 1000 });
    return true;
  };

  // Kazanma koşulu sağlandıysa masa sonucunda kazanan önceden seçilir (anlatıcı yine onaylar).
  const autoWinner = winner(players);
  useEffect(() => {
    if (autoWinner && !roundEnded) setWinningSide((w) => w ?? autoWinner);
  }, [autoWinner, roundEnded]);

  const handleUndo = async () => {
    if (!undo) return;
    const playerId = undo.id;
    setUndo(null);
    const { res, data } = await post('/api/narrator/eliminate', { playerId, roomId, undo: true });
    if (!res.ok) return setActionError(data.error || 'Geri alınamadı');
    setPlayers((prev) => prev.map((p) => (p.id === playerId ? { ...p, isAlive: true } : p)));
  };

  const handleSubmitScores = async () => {
    if (!winningSide) return;
    setBusy(true);
    const { res, data } = await post('/api/narrator/scores', { roomId, winningSide });
    setBusy(false);
    if (res.ok || res.status === 409) {
      setRoundEnded(true);
      setUndo(null);
    }
    if (!res.ok) setActionError(data.error || 'Puanlar kaydedilemedi');
  };

  const handleAlertAdmin = async () => {
    if (!alertMessage.trim()) return;
    const { res } = await post('/api/narrator/alert', { roomId, message: alertMessage });
    if (res.ok) {
      setAlertSent(true);
      setAlertMessage('');
      setTimeout(() => setAlertSent(false), 3000);
    }
  };

  const alivePlayers = players.filter((p) => p.isAlive);
  const eliminatedPlayers = players.filter((p) => !p.isAlive);
  const undoPlayer = undo ? players.find((p) => p.id === undo.id) : null;

  return (
    <div className="relative z-10 min-h-screen text-night-200 p-4 max-w-2xl mx-auto">
      {practice && (
        <div className="mb-4 rounded-lg border border-hex-gold/60 bg-hex-gold/10 px-4 py-2 text-center font-mono text-sm text-hex-gold">
          PROVA MASASI · oyuncular sahte, rahatça dene
        </div>
      )}
      {/* Başlık */}
      <div className="flex justify-between items-end gap-3 mb-6">
        <div>
          <p className="font-mono text-xs text-hex-cyan">
            narrator@siberkoy:~$ masa {roomNumber} · tur {roundNumber} · {phaseText}
          </p>
          <h1 className="font-gothic text-4xl leading-none text-hex-violet mt-1">Anlatıcı</h1>
        </div>
      </div>

      {actionError && (
        <div role="alert" className="mb-4 flex justify-between items-start gap-3 rounded-lg border border-hex-blood/60 bg-hex-blood/10 p-3 text-sm text-hex-blood">
          <span>{actionError}</span>
          <button onClick={() => setActionError('')} aria-label="Kapat">✕</button>
        </div>
      )}

      {undoPlayer && (
        <div role="status" className="sticky top-2 z-10 mb-4 flex items-center justify-between gap-3 rounded-lg border border-hex-cyan/60 bg-night-900 p-3 text-sm">
          <span><strong>{undoPlayer.username}</strong> elendi.</span>
          <button onClick={handleUndo} className="koy-btn-ghost min-h-11 border-hex-cyan text-hex-cyan">
            <Undo2 size={16} aria-hidden="true" /> Geri al
          </button>
        </div>
      )}

      {/* ADIM ADIM ANLATICI REHBERİ: açılış → gece → sabah → gündüz → oylama → gece ... */}
      <NarratorGuide
        roomId={roomId}
        roundNumber={roundNumber}
        players={players}
        roundEnded={roundEnded}
        onPhaseChange={setPhaseText}
      />

      {/* OYUNCULAR VE ROLLER */}
      <div className="koy-panel p-4 mb-6">
        <h2 className="font-gothic text-2xl text-hex-violet mb-1">Masa {roomNumber} <span className="font-mono text-sm text-night-400">· {players.length} oyuncu</span></h2>
        <p className="mb-3 text-xs text-night-500">Buradan da elenebilir. Yanlışlıkla basarsan üstte 10 sn “Geri al” çıkar.</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {players.map(p => (
            <div
              key={p.id}
              className={`flex items-center justify-between gap-2 rounded p-2 text-sm ${p.isAlive ? 'bg-night-800' : 'bg-night-950 opacity-50'}`}
            >
              <span className={p.isAlive ? '' : 'line-through'}>
                <span className="font-semibold">{p.username}</span>
                <span className={`ml-1 inline-flex items-center gap-1 text-xs ${p.role === 'ATTACKER' ? 'text-hex-blood' : 'text-night-400'}`}>
                  <RoleIcon role={p.role} size={12} /> {roleLabel(p.role)}
                </span>
              </span>
              {p.isAlive && !roundEnded && (
                <button
                  onClick={() => eliminate(p.id)}
                  disabled={busy}
                  className="koy-btn-danger min-h-11 shrink-0 px-3 text-xs"
                >
                  Ele
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-night-500 mt-2">
          Hayatta: {alivePlayers.length} | Elendi: {eliminatedPlayers.length}
        </p>
      </div>

      {/* MASA SONUCU VE PUANLAMA */}
      {!roundEnded ? (
        <div className="koy-panel p-4 mb-6">
          <h2 className="font-gothic text-2xl text-hex-violet mb-3">Masa sonucu</h2>
          <div className="flex gap-3 mb-4">
            <button
              onClick={() => setWinningSide('DEFENDERS')}
              className={`flex-1 min-h-12 rounded font-bold ${winningSide === 'DEFENDERS' ? 'bg-hex-cyan text-night-950 border-2 border-hex-cyan' : 'border border-hex-cyan/50 text-hex-cyan hover:bg-hex-cyan/10'}`}
            >
              Savunucular kazandı
            </button>
            <button
              onClick={() => setWinningSide('ATTACKERS')}
              className={`flex-1 min-h-12 rounded font-bold ${winningSide === 'ATTACKERS' ? 'bg-hex-blood text-white border-2 border-hex-blood' : 'border border-hex-blood/50 text-hex-blood hover:bg-hex-blood/10'}`}
            >
              Hacker’lar kazandı
            </button>
          </div>
          {winningSide && (
            <button onClick={handleSubmitScores} disabled={busy} className="w-full koy-btn min-h-12">
              Sonucu kaydet ve masayı bitir
            </button>
          )}
        </div>
      ) : (
        <div className="koy-panel border-hex-cyan/60 p-4 mb-6 text-center">
          <p className="font-mono text-hex-cyan"><Trophy size={16} className="inline mr-1" aria-hidden="true" /> Masa sonucu kaydedildi. Yeni tur başlayınca panel kendiliğinden yenilenir.</p>
        </div>
      )}

      {/* ADMİNE YARDIM BİLDİRİMİ */}
      <div className="rounded-2xl border border-hex-blood/50 bg-[#1a0b16] p-4 mb-6">
        <h2 className="font-gothic text-xl text-hex-blood mb-3 flex items-center gap-2"><Siren size={18} aria-hidden="true" /> Admine yardım bildir</h2>
        <textarea
          value={alertMessage}
          onChange={e => setAlertMessage(e.target.value.substring(0, 250))}
          placeholder="Sorunu kısaca açıklayın... (Örn: Oyuncu kural ihlal ediyor, teknik sorun vb.)"
          className="koy-input h-20 resize-none mb-3 text-sm"
        />
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500">{alertMessage.length}/250</span>
          <button
            onClick={handleAlertAdmin}
            disabled={!alertMessage.trim()}
            className="koy-btn-danger px-5"
          >
            Gönder
          </button>
        </div>
        {alertSent && (
          <p className="font-mono text-hex-cyan text-sm mt-2 text-center">bildirim admine iletildi</p>
        )}
      </div>

      {/* ANLATICI ÖZEL İÇERİK (Ek-A, yalnızca bu panel) */}
      <details className="koy-panel border-hex-violet-deep p-4 mb-6">
        <summary className="cursor-pointer font-gothic text-xl text-hex-violet"><Lock size={16} className="inline mr-2" aria-hidden="true" />Anlatıcıya özel içerik</summary>
        <div className="mt-4 space-y-4 text-sm text-gray-300">
          <div>
            <h3 className="font-bold text-white mb-1">Açılış Metni</h3>
            <p className="italic border-l-4 border-purple-600 pl-3">“{OPENING_TEXT}”</p>
          </div>
          <div>
            <h3 className="font-bold text-white mb-1">Oyun Sonu Mini Eğitim (3 dk)</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-300">
              <li><span className="text-red-300 font-semibold">Hacker:</span> Çoğu zaman içeriden, çalınmış hesaplarla ilerler.</li>
              <li><span className="text-blue-300 font-semibold">SOC Analisti:</span> Loglar saldırıyı fark etmenin en önemli kaynağıdır.</li>
              <li><span className="text-green-300 font-semibold">Yama Uzmanı:</span> Güncellemeyi geciktirmek açığı açık bırakmaktır.</li>
              <li><span className="text-white font-semibold">Genel:</span> İnsan faktörü en zayıf ve en güçlü halkadır.</li>
            </ul>
          </div>
        </div>
      </details>
    </div>
  );
}
