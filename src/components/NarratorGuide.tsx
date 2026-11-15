'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Moon, Sun, Sunrise, BookOpen, Trophy } from 'lucide-react';
import { INITIAL_STATE, advance, back, stepsFor, winner, type GuideState, type Phase, type StepId } from '@/lib/narrator-guide';

export interface GuidePlayerView {
  id: string;
  username: string;
  role: string;
  isAlive: boolean;
}

const DEFENSE_SECONDS = 30;

/** Bitiş zamanına göre geri sayım: sekme arka plana düşse de kaymaz. */
function useCountdown() {
  const [endAt, setEndAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (endAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [endAt]);
  const left = endAt === null ? 0 : Math.max(0, Math.ceil((endAt - now) / 1000));
  return {
    left,
    running: endAt !== null && left > 0,
    done: endAt !== null && left === 0,
    start: (seconds: number) => {
      setNow(Date.now());
      setEndAt(Date.now() + seconds * 1000);
    },
    reset: () => setEndAt(null),
  };
}

const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

export const OPENING_TEXT =
  'Sevgili Siber Köy halkı, bu gece ağımızda bir şeyler ters gidiyor. Gölge Kolektifi aranıza sızdı. ' +
  'Aranızda çalıntı hesaplarla dolaşan Veri Vampirleri var. Geceleri saldıracaklar, gündüz siz toplanıp ' +
  'şüphelileri ağdan izole edeceksiniz. Savunucular tüm hacker’ları bulursa köy kurtulur; ' +
  'hacker’lar sayıca üstün gelirse ağ ele geçirilir. Kartlarınıza gizlice bakın, kimseye göstermeyin. ' +
  'Başınızı masaya koyun... Köy uyuyor...';

export function phaseLabel(phase: Phase, night: number): string {
  switch (phase) {
    case 'intro':
      return 'açılış';
    case 'night':
      return `gece ${night}`;
    case 'morning':
      return `sabah ${night}`;
    case 'day':
      return `gündüz ${night}`;
    case 'over':
      return 'oyun bitti';
  }
}

/** Anlatıcının tarayıcısında saklanır: sayfa yenilense de rehber kaldığı yerden devam eder. Sunucuya gitmez. */
function storageKey(roomId: string) {
  return `siberkoy:anlatici-rehberi:${roomId}`;
}
function loadState(roomId: string): GuideState {
  try {
    const raw = sessionStorage.getItem(storageKey(roomId));
    if (raw) {
      const { phase, night, step } = { ...INITIAL_STATE, ...JSON.parse(raw) };
      return { phase, night, step };
    }
  } catch {
    /* gizli sekme vb.: baştan başla */
  }
  return INITIAL_STATE;
}

function Say({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border-l-4 border-hex-violet bg-night-950 px-3 py-2 font-mono text-sm leading-relaxed text-hex-cyan">
      <span className="mr-1 text-night-500">söyle:</span>“{children}”
    </p>
  );
}

function Do({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-relaxed text-night-300">{children}</p>;
}

export default function NarratorGuide({
  roomId,
  roundNumber,
  players,
  roundEnded,
  onPhaseChange,
}: {
  roomId: string;
  roundNumber: number;
  players: GuidePlayerView[];
  roundEnded: boolean;
  onPhaseChange: (label: string) => void;
}) {
  const [state, setState] = useState<GuideState>(INITIAL_STATE);
  const [loaded, setLoaded] = useState(false);
  const discussion = useCountdown();
  const defense = useCountdown();
  const discussionTime = roundNumber === 1 ? 300 : 180; // kitapçık: Tur 1'de 5 dk, sonrasında 3 dk

  useEffect(() => {
    setState(loadState(roomId));
    setLoaded(true);
  }, [roomId]);
  useEffect(() => {
    if (!loaded) return;
    try {
      sessionStorage.setItem(storageKey(roomId), JSON.stringify(state));
    } catch {
      /* saklanamazsa yalnızca bu oturumda tutulur */
    }
  }, [state, loaded, roomId]);

  const won = winner(players);
  const over = !!won && state.phase !== 'intro';
  const shownPhase: Phase = over ? 'over' : state.phase;
  useEffect(() => onPhaseChange(phaseLabel(shownPhase, state.night)), [shownPhase, state.night, onPhaseChange]);

  // Evre değişince sayaçlar sıfırlanır.
  useEffect(() => {
    discussion.reset();
    defense.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.night]);

  if (roundEnded) return null;

  const steps = stepsFor(state.phase, state.night);
  const step = steps[state.step] as StepId | undefined;


  const isLast = state.step === steps.length - 1;
  const nextLabel =
    state.phase === 'intro'
      ? 'Geceye geç (Gece 1)'
      : state.phase === 'night' && isLast
        ? 'Sabaha geç'
        : state.phase === 'morning'
          ? 'Gündüze geç'
          : state.phase === 'day' && isLast
            ? `Geceye geç (Gece ${state.night + 1})`
            : 'Sıradaki adım';
  const NextIcon = state.phase === 'intro' || (state.phase === 'day' && isLast) ? Moon : state.phase === 'night' && isLast ? Sunrise : state.phase === 'morning' ? Sun : ArrowRight;

  const body = (): React.ReactNode => {
    if (over) {
      return (
        <div className="space-y-3 text-center">
          <Trophy className="mx-auto text-hex-gold" size={28} aria-hidden="true" />
          <p className="font-gothic text-3xl text-hex-gold">{won === 'ATTACKERS' ? 'Hacker’lar (Vampirler) kazandı' : 'Savunucular (Köylüler) kazandı'}</p>
          <Do>
            {won === 'ATTACKERS'
              ? 'Hayattaki hacker sayısı savunuculara eşit ya da fazla.'
              : 'Masadaki tüm hacker’lar elendi.'}{' '}
            Sonucu herkese açıkla, sonra herkes rolünü göstersin. Aşağıdaki <strong>Masa sonucu</strong> bölümünde kazanan önceden seçildi: kontrol edip kaydet.
          </Do>
        </div>
      );
    }
    switch (step) {
      case 'acilis':
        return (
          <>
            <Do>Herkes rolüne telefonundan gizlice baksın; kimse kartını göstermesin. Sonra açılış metnini oku:</Do>
            <Say>{OPENING_TEXT}</Say>
          </>
        );
      case 'hacker-tanisma': {
        const hackers = players.filter((p) => p.role === 'ATTACKER');
        return (
          <>
            <Say>Hacker’lar uyansın. Gözlerinizi açın ve birbirinize bakın; bu turdaki ekibiniz bu. Bu gece kimseye saldırmıyorsunuz, yalnızca tanışıyorsunuz. ... Hacker’lar uyusun.</Say>
            <Do>
              Bu turun hacker’ları: <strong className="text-hex-blood">{hackers.map((h) => h.username).join(', ')}</strong>. Hepsinin gözünü açıp birbirini gördüğünden emin ol. İlk gece yalnızca tanışma gecesidir: saldırı, yama ve sorgu yok.
            </Do>
          </>
        );
      }
      case 'saldiri':
        return (
          <>
            <Say>Hacker’lar uyansın. Bu gece hangi hesabı ele geçiriyorsunuz? Aynı kişiyi sessizce işaret edin. ... Hacker’lar uyusun.</Say>
            <Do>Hedefi aklında tut. Anlaşamazlarsa o gece saldırı olmaz.</Do>
          </>
        );
      case 'yama':
        return (
          <>
            <Say>Yama Uzmanı uyansın. Bu gece hangi hesabı yamalıyorsun? ... Yama Uzmanı uyusun.</Say>
            <Do>Kendini de seçebilir; aynı kişiyi art arda iki gece seçemez. Elendiyse yine çağır, birkaç saniye bekle.</Do>
          </>
        );
      case 'analist':
        return (
          <>
            <Say>SOC Analisti uyansın. Hangi hesabın loglarını inceliyorsun? ... SOC Analisti uyusun.</Say>
            <Do>Hacker’sa başparmak aşağı (şüpheli), değilse yukarı (temiz) göster. Elendiyse yine çağır, birkaç saniye bekle.</Do>
          </>
        );
      case 'koy-uyaniyor':
        return <Say>Herkes uyusun... Sabah oldu. Köy uyanıyor, herkes gözlerini açsın.</Say>;
      case 'sabah-raporu':
        if (state.night === 1)
          return (
            <>
              <Say>İlk gece sessiz geçti: kimse ağdan düşmedi. Ama aranızda tanışmış birileri var...</Say>
              <Do>İlk gece saldırı olmadığı için kimse elenmez. Gündüze geç.</Do>
            </>
          );
        return (
          <>
            <Do>Hedef yamalandıysa ya da hacker’lar anlaşamadıysa: “Bu gece kimse ağdan düşmedi.” Değilse hedefi duyur ve aşağıdaki <strong>Masa</strong> listesinden “Ele” ile ele; rolünü açıklama.</Do>
            <Say>Bu gece ... hesabı ele geçirildi ve ağdan düştü.</Say>
          </>
        );
      case 'tartisma':
        return (
          <>
            <Say>Tartışma başlıyor: {roundNumber === 1 ? '5' : '3'} dakikanız var. Rol iddia etmek ve yalan söylemek serbest; kart göstermek yasak.</Say>
            <div className="flex items-center justify-between gap-3">
              <span className={`font-mono text-4xl ${discussion.done ? 'text-hex-blood' : discussion.running ? 'text-hex-cyan' : 'text-night-400'}`}>
                {formatTime(discussion.running ? discussion.left : discussion.done ? 0 : discussionTime)}
              </span>
              <button onClick={() => (discussion.running ? discussion.reset() : discussion.start(discussionTime))} className="koy-btn-ghost min-h-11">
                {discussion.running ? 'Durdur' : discussion.done ? 'Yeniden başlat' : 'Süreyi başlat'}
              </button>
            </div>
            {discussion.done && <p role="status" className="font-mono text-sm text-hex-blood">süre doldu: oylamaya geç</p>}
          </>
        );
      case 'oylama':
        return (
          <>
            <Say>Oylama zamanı. Üç, iki, bir... Herkes şüphelendiği kişiyi aynı anda parmağıyla göstersin.</Say>
            <Do>
              Oyları say. <strong>En çok oyu alan elenir.</strong> Beraberlik varsa berabere kalanlara {DEFENSE_SECONDS} sn savunma ver ve ikinci oylama yap; yine eşitse kimse elenmez.
            </Do>
            <div className="flex items-center justify-between gap-3 border-t border-night-700 pt-3">
              <span className="text-xs text-night-400">Beraberlikte savunma</span>
              <span className={`font-mono text-2xl ${defense.running || defense.done ? 'text-hex-blood' : 'text-night-500'}`}>
                {formatTime(defense.running ? defense.left : defense.done ? 0 : DEFENSE_SECONDS)}
              </span>
              <button onClick={() => (defense.running ? defense.reset() : defense.start(DEFENSE_SECONDS))} className="koy-btn-ghost min-h-11 border-hex-blood/60 text-hex-blood">
                {defense.running ? 'Durdur' : 'Başlat'}
              </button>
            </div>
          </>
        );
      case 'karar':
        return (
          <>
            <Do>Oylamada elenen kişiyi aşağıdaki <strong>Masa</strong> listesinden “Ele” ile ele; rolünü açıklama. Kimse elenmediyse (eşitlik) doğrudan geceye geç.</Do>
          </>
        );
      default:
        return null;
    }
  };

  const titles: Record<StepId, string> = {
    acilis: 'Açılış',
    'hacker-tanisma': 'Hacker’lar (Vampirler) tanışıyor',
    saldiri: 'Saldırı hedefi',
    yama: 'Yama Uzmanı (Doktor)',
    analist: 'SOC Analisti (Gözcü)',
    'koy-uyaniyor': 'Köy uyanıyor',
    'sabah-raporu': 'Sabah raporu',
    tartisma: 'Tartışma',
    oylama: 'Oylama',
    karar: 'Oylama sonucu',
  };
  const accent = state.phase === 'night' ? 'border-hex-violet' : state.phase === 'intro' ? 'border-night-600' : 'border-hex-gold/70';

  return (
    <section aria-label="Anlatıcı rehberi" className={`koy-panel mb-6 border-2 p-4 ${over ? 'border-hex-gold' : accent}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-gothic text-2xl text-hex-violet">
          <BookOpen size={18} aria-hidden="true" /> Anlatıcı rehberi
        </h2>
        <span className="font-mono text-xs uppercase tracking-widest text-night-400">{phaseLabel(shownPhase, state.night)}</span>
      </div>

      {!over && step && (
        <>
          <ol className="mb-3 flex flex-wrap gap-1.5" aria-label="Adımlar">
            {steps.map((s, i) => (
              <li
                key={s}
                aria-current={i === state.step ? 'step' : undefined}
                className={`rounded-full px-2 py-0.5 font-mono text-[11px] ${i === state.step ? 'bg-hex-violet text-night-950' : i < state.step ? 'bg-night-800 text-night-400 line-through' : 'border border-night-700 text-night-500'}`}
              >
                {i + 1}. {titles[s]}
              </li>
            ))}
          </ol>
          <h3 className="mb-2 font-semibold text-night-100">{titles[step]}</h3>
        </>
      )}

      <div className="space-y-3">{body()}</div>

      {!over && step && (
        <div className="mt-4 flex gap-2 border-t border-night-700 pt-3">
          <button onClick={() => setState(back)} disabled={state.step === 0} className="koy-btn-ghost min-h-11 px-3" aria-label="Önceki adım">
            <ArrowLeft size={16} aria-hidden="true" />
          </button>
          <button onClick={() => setState(advance)} className="koy-btn min-h-11 flex-1">
            <NextIcon size={16} aria-hidden="true" /> {nextLabel}
          </button>
        </div>
      )}
    </section>
  );
}
