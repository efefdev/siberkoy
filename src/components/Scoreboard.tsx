'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import EventTheme from '@/components/theme/EventTheme';

interface ScoreEntry {
  rank: number;
  id: string;
  username: string;
  totalScore: number;
  roundsPlayed: number;
}

interface ScoreboardProps {
  eventId: string;
  /** API'den gelen etkinlik adı yüklenene kadar gösterilir */
  eventName?: string;
  projectionMode?: boolean; // Büyük ekrana yansıtma modu
}


export default function Scoreboard({ eventId, eventName: fallbackName = 'Siber Köy', projectionMode = false }: ScoreboardProps) {
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [eventName, setEventName] = useState(fallbackName);
  const [isFinal, setIsFinal] = useState(false);
  const [theme, setTheme] = useState<string | undefined>();
  const [updatedId, setUpdatedId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const prevScores = useRef<ScoreEntry[]>([]);

  const fetchScores = useCallback(async () => {
    const res = await fetch(`/api/scoreboard?eventId=${encodeURIComponent(eventId)}`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    setEventName(data.eventName);
    setIsFinal(data.eventStatus === 'COMPLETED');
    setTheme(data.theme);

    // Hangi oyuncunun puanı değişti? (animasyon için)
    const changed = data.scoreboard.find((s: ScoreEntry) => {
      const prev = prevScores.current.find(p => p.id === s.id);
      return !prev || prev.totalScore !== s.totalScore;
    });
    if (changed) {
      setUpdatedId(changed.id);
      setTimeout(() => setUpdatedId(null), 1500);
    }

    prevScores.current = data.scoreboard;
    setScores(data.scoreboard);
  }, [eventId]);

  useEffect(() => {
    fetchScores();

    // Socket.io ile canlı güncelleme
    const socket = io();
    socketRef.current = socket;

    // Herkese açık skor tablosu odası: yalnızca "yenile" sinyali alır, gizli bilgi taşımaz.
    // Her (yeniden) bağlantıda odaya tekrar katıl; sunucu bağlantı kopunca odaları unutur.
    // Yeniden bağlanınca arada kaçan güncellemeler için tabloyu da tazele.
    socket.on('connect', () => {
      socket.emit('scoreboard:join', eventId);
      fetchScores();
    });

    // Puan değişince `scoreboard_updated`; katılım, isim değişikliği ve ban gibi olaylarda yalnızca
    // `screen_updated` gelir. İkisi çoğu zaman birlikte geldiği için kısa bir bekleme ile tek istek atılır.
    let pending: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(pending);
      pending = setTimeout(fetchScores, 150);
    };
    socket.on('scoreboard_updated', refresh);
    socket.on('screen_updated', refresh);

    return () => {
      clearTimeout(pending);
      socket.disconnect();
    };
  }, [eventId, fetchScores]);

  const textSizes = projectionMode
    ? { title: 'text-7xl', subtitle: 'text-xl', row: 'text-3xl py-5', rank: 'text-5xl', score: 'text-4xl' }
    : { title: 'text-5xl', subtitle: 'text-xs', row: 'text-base py-3', rank: 'text-3xl', score: 'text-xl' };

  return (
    <div className={`relative min-h-screen text-night-200 flex flex-col items-center ${projectionMode ? 'p-12 projection-mode' : 'p-4'}`}>
      <EventTheme theme={theme} />
      {/* Başlık */}
      <div className="relative z-10 text-center mb-8">
        <p className={`font-mono text-hex-cyan ${textSizes.subtitle}`}>root@siberkoy:~$ skor --canlı</p>
        <h1 className={`font-gothic leading-none text-hex-violet mt-2 ${textSizes.title}`}>{eventName}</h1>
        {isFinal && (
          <div className="mt-3 inline-flex items-center gap-2 border border-hex-gold/70 px-4 py-1.5 rounded-full font-mono text-sm text-hex-gold">
            [ final ] etkinlik tamamlandı
          </div>
        )}
      </div>

      {/* Skor Tablosu */}
      <div className={`relative z-10 w-full ${projectionMode ? 'max-w-4xl' : 'max-w-lg'}`}>
        {scores.length === 0 ? (
          <div className="text-center text-night-500 mt-20">
            <p className="font-mono text-hex-cyan">&gt; oyuncular bekleniyor_</p>
          </div>
        ) : (
          <div className="space-y-2">
            {scores.map((entry, idx) => {
              const isUpdated = entry.id === updatedId;
              // Henüz hiç masa bitirmemiş ve puanı olmayan: sıralamaya girmez (herkes "1." görünmesin).
              const unranked = entry.totalScore === 0 && entry.roundsPlayed === 0;
              const podium = !unranked && entry.totalScore > 0;

              return (
                <div
                  key={entry.id}
                  className={`
                    flex items-center justify-between rounded-xl px-5 transition-all duration-500
                    ${textSizes.row}
                    ${isUpdated ? 'ring-2 ring-hex-cyan scale-[1.02]' : ''}
                    ${podium && entry.rank === 1 ? 'bg-night-800 border border-hex-gold/70' : podium && entry.rank <= 3 ? 'bg-night-800 border border-hex-violet' : 'bg-night-900 border border-night-700'}
                  `}
                >
                  {/* Sıra */}
                  <div className={`w-14 text-center font-gothic ${textSizes.rank} ${podium && entry.rank === 1 ? 'text-hex-gold' : podium && entry.rank <= 3 ? 'text-hex-violet' : 'text-night-500'}`}>
                    {unranked ? '–' : entry.rank}
                  </div>

                  {/* Kullanıcı adı */}
                  <div className="flex-1 ml-4 font-semibold">
                    {entry.username}
                    {isUpdated && <span className="ml-2 font-mono text-hex-cyan text-sm">▲ puan</span>}
                  </div>

                  {/* Puan */}
                  <div className={`font-mono ${textSizes.score} text-hex-cyan`}>
                    {entry.totalScore} <span className="text-xs text-night-500">puan</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Alt bilgi */}
      <div className="mt-8 text-night-500 text-xs text-center space-y-1">
        <p className="font-mono">eşitlikte: daha çok tur oynayan, sonra ortalama masa süresi kısa olan üstte</p>
        {!isFinal && <p className="font-mono"><span className="text-hex-blood">●</span> canlı · her masa sonucunda güncellenir</p>}
      </div>
    </div>
  );
}
