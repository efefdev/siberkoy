import { useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { nodeToPng, shareOrDownload } from '@/components/share/exportImage';

export interface ShareStats {
  players: number;
  rounds: number;
  tables: number;
  eliminations: number;
  defenderWins: number;
  attackerWins: number;
  bonuses: number;
  avgRating: number | null;
  durationMinutes: number | null;
}

interface Props {
  eventName: string;
  dateLabel: string;
  status: string;
  halloween: boolean;
  stats: ShareStats;
}

type Format = 'story' | 'post';
const SIZE: Record<Format, { w: number; h: number; label: string }> = {
  story: { w: 1080, h: 1920, label: 'Story (1080×1920)' },
  post: { w: 1080, h: 1350, label: 'Post (1080×1350)' },
};

/** Etkinlik sonu (ya da sürerken) Instagram için hazır tasarımlar. İsim içermez, yalnızca sayılar. */
export default function ShareDesigns(props: Props) {
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <ShareCard format="story" {...props} />
      <ShareCard format="post" {...props} />
    </div>
  );
}

function ShareCard({ format, ...p }: Props & { format: Format }) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const { w, h, label } = SIZE[format];
  const previewW = format === 'story' ? 270 : 360;
  const scale = previewW / w;

  const save = async () => {
    if (!ref.current) return;
    setBusy(true);
    setErr('');
    try {
      const blob = await nodeToPng(ref.current, w, h);
      await shareOrDownload(blob, `siberkoy-${format}.png`, false);
    } catch {
      setErr('Görsel oluşturulamadı.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <p className="koy-label mb-3">{label}</p>
      <div className="overflow-hidden rounded-xl border border-night-700 shadow-2xl" style={{ width: w * scale, height: h * scale }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: w, height: h }}>
          <Design refEl={ref} format={format} {...p} />
        </div>
      </div>
      <button onClick={save} disabled={busy} className="koy-btn mt-4">
        <Download size={16} aria-hidden="true" /> {busy ? 'hazırlanıyor…' : 'PNG indir'}
      </button>
      {err && <p className="mt-2 font-mono text-xs text-hex-blood">! {err}</p>}
    </div>
  );
}

const mono = '"Share Tech Mono","JetBrains Mono",ui-monospace,monospace';
const gothic = '"Pirata One",Georgia,serif';

function Design({ refEl, format, eventName, dateLabel, status, halloween, stats }: Props & { format: Format; refEl: React.RefObject<HTMLDivElement | null> }) {
  const { w, h } = SIZE[format];
  const story = format === 'story';
  const accent = halloween ? '#fb923c' : '#8b5cf6';
  const accent2 = halloween ? '#a3e635' : '#22d3ee';
  const done = status === 'COMPLETED';
  const totalWins = stats.defenderWins + stats.attackerWins;
  const defPct = totalWins ? Math.round((stats.defenderWins / totalWins) * 100) : 50;

  const tiles: { n: string; l: string; c?: string }[] = [
    { n: String(stats.players), l: 'oyuncu' },
    { n: String(stats.rounds), l: 'tur' },
    { n: String(stats.tables), l: 'masa' },
    { n: String(stats.eliminations), l: 'eleme', c: '#f43f5e' },
  ];

  return (
    <div
      ref={refEl}
      style={{
        width: w,
        height: h,
        position: 'relative',
        overflow: 'hidden',
        color: '#ece8ff',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        background: `radial-gradient(ellipse 900px 700px at 50% ${story ? 18 : 12}%, ${halloween ? 'rgba(234,88,12,.38)' : 'rgba(91,33,182,.55)'}, transparent 65%), radial-gradient(ellipse 800px 700px at 100% 100%, rgba(63,109,179,.32), transparent 60%), #08061a`,
      }}
    >
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,.04) 1px, transparent 1px)', backgroundSize: '6px 6px' }} />
      {/* Kenarlarda ikili kod yağmuru */}
      {[18, w - 48].map((x) => (
        <div key={x} style={{ position: 'absolute', top: 0, bottom: 0, left: x, fontFamily: mono, fontSize: 22, lineHeight: '30px', color: `${accent}1f`, writingMode: 'vertical-rl', letterSpacing: 6, whiteSpace: 'nowrap' }}>
          0110100101001110 0101101001 1101001010 0100101101 0110100110 1001011010
        </div>
      ))}

      <div style={{ position: 'absolute', top: story ? 110 : 64, left: 0, right: 0, textAlign: 'center' }}>
        <img src="/brand/omusiber.png" alt="" style={{ display: 'block', margin: '0 auto', width: story ? 230 : 150, filter: 'drop-shadow(0 24px 50px rgba(63,109,179,.55))' }} />
        <p style={{ fontFamily: mono, fontSize: story ? 30 : 26, color: accent2, marginTop: story ? 30 : 18 }}>
          {done ? '> gece tamamlandı' : '> köy şu an uyanık'}
        </p>
        <p style={{ fontFamily: gothic, fontSize: story ? 150 : 118, lineHeight: 0.95, color: accent, marginTop: 10, textShadow: `0 0 70px ${accent}99` }}>Siber Köy</p>
        <p style={{ fontSize: story ? 34 : 30, color: '#a59cc9', marginTop: story ? 18 : 10 }}>
          {eventName} · {dateLabel}
        </p>
      </div>

      <div style={{ position: 'absolute', left: 80, right: 80, top: story ? 820 : 600, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: story ? 26 : 20 }}>
        {tiles.map((t) => (
          <div key={t.l} style={{ border: '2px solid rgba(139,92,246,.35)', borderRadius: 32, padding: story ? '40px 20px' : '26px 20px', textAlign: 'center', background: 'rgba(20,15,45,.8)' }}>
            <p style={{ fontFamily: gothic, fontSize: story ? 120 : 92, lineHeight: 1, color: t.c ?? accent2 }}>{t.n}</p>
            <p style={{ fontFamily: mono, fontSize: story ? 30 : 26, color: '#a59cc9', marginTop: 8 }}>{t.l}</p>
          </div>
        ))}
      </div>

      <div style={{ position: 'absolute', left: 80, right: 80, top: story ? 1430 : 1060 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: mono, fontSize: story ? 28 : 24 }}>
          <span style={{ color: accent2 }}>köy kurtuldu · {stats.defenderWins}</span>
          <span style={{ color: '#f43f5e' }}>{stats.attackerWins} · vampirler kazandı</span>
        </div>
        <div style={{ marginTop: 14, height: 22, borderRadius: 999, overflow: 'hidden', display: 'flex', background: '#1b1738' }}>
          <div style={{ width: `${defPct}%`, background: accent2 }} />
          <div style={{ flex: 1, background: '#f43f5e' }} />
        </div>
        {story && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 50, marginTop: 56, fontFamily: mono, fontSize: 30, color: '#ece8ff' }}>
            {stats.avgRating !== null && <span>anlatıcılar {stats.avgRating.toFixed(1)}/5 ★</span>}
            {stats.durationMinutes !== null && stats.durationMinutes > 0 && <span>{stats.durationMinutes} dk oyun</span>}
          </div>
        )}
      </div>

      <div style={{ position: 'absolute', left: 0, right: 0, bottom: story ? 110 : 56, textAlign: 'center' }}>
        <p style={{ fontFamily: gothic, fontSize: story ? 64 : 48, lineHeight: 1 }}>{done ? 'Teşekkürler köy!' : 'Gece devam ediyor…'}</p>
        <p style={{ fontFamily: mono, fontSize: story ? 32 : 28, color: accent2, marginTop: 16 }}>@omusiber</p>
      </div>
    </div>
  );
}
