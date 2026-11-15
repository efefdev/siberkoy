'use client';

import { useRef, useState } from 'react';
import { Award, Download, Sparkles, Trophy } from 'lucide-react';
import { nodeToPng, shareOrDownload } from './exportImage';
import { BadgeArt, BADGE_H, BADGE_W, type BadgeSummary } from './PlayerBadge';

type Kind = 'thanks' | 'certificate' | 'badge';

const KINDS: Record<Kind, { w: number; h: number; tab: string; hint: string; button: string; file: string; Icon: typeof Award }> = {
  thanks: { w: 1080, h: 1920, tab: 'Oradaydım', hint: 'Hikâye boyutunda. Sıralama ve puan yok.', button: 'kartı kaydet / paylaş', file: 'oradaydim', Icon: Sparkles },
  certificate: { w: 1754, h: 1240, tab: 'Sertifika', hint: 'Yatay katılım sertifikası. Sıralama ve puan yok.', button: 'sertifikayı kaydet / paylaş', file: 'sertifika', Icon: Award },
  badge: { w: BADGE_W, h: BADGE_H, tab: 'Rozet', hint: 'Hikâye boyutunda. Sıran ve puanın görünür.', button: 'rozetimi kaydet / paylaş', file: 'rozet', Icon: Trophy },
};

interface Props {
  username: string;
  eventName: string;
  summary: BadgeSummary;
  halloween: boolean;
}

/**
 * Etkinlik sonu paylaşım kartları. Varsayılan "Oradaydım" kartıdır; sıralamasını paylaşmak istemeyen
 * oyuncu için sıra ve puan yalnızca isteğe bağlı rozette yer alır.
 */
export default function PlayerCards(props: Props) {
  const [kind, setKind] = useState<Kind>('thanks');
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const k = KINDS[kind];
  const scale = 300 / k.w;

  const save = async () => {
    if (!ref.current) return;
    setBusy(true);
    setMsg('');
    try {
      const blob = await nodeToPng(ref.current, k.w, k.h);
      const r = await shareOrDownload(blob, `siberkoy-${k.file}-${props.username}.png`);
      setMsg(r === 'downloaded' ? 'görsel indirildi' : '');
    } catch {
      setMsg('görsel oluşturulamadı, tekrar dene');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="koy-panel p-5">
      <p className="koy-label mb-3">Gecenin hatırası</p>
      <div role="tablist" aria-label="Kart türü" className="grid grid-cols-3 gap-1.5 rounded-xl border border-night-700 bg-night-900/60 p-1">
        {(Object.keys(KINDS) as Kind[]).map((key) => {
          const { tab, Icon } = KINDS[key];
          const active = key === kind;
          return (
            <button
              key={key}
              role="tab"
              aria-selected={active}
              onClick={() => {
                setKind(key);
                setMsg('');
              }}
              className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 font-mono text-xs transition ${active ? 'bg-hex-violet/25 text-night-100 shadow-inner' : 'text-night-400 hover:text-night-200'}`}
            >
              <Icon size={14} aria-hidden="true" /> {tab}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-center font-mono text-[11px] text-night-400">{k.hint}</p>
      <div className="mx-auto mt-3 overflow-hidden rounded-xl border border-night-700" style={{ width: k.w * scale, height: k.h * scale }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: k.w, height: k.h }}>
          {kind === 'thanks' && <ThanksArt refEl={ref} {...props} />}
          {kind === 'certificate' && <CertificateArt refEl={ref} {...props} />}
          {kind === 'badge' && <BadgeArt refEl={ref} {...props} />}
        </div>
      </div>
      <button onClick={save} disabled={busy} className="koy-btn mt-4 w-full">
        <Download size={16} aria-hidden="true" /> {busy ? 'hazırlanıyor…' : k.button}
      </button>
      {msg && <p className="mt-2 text-center font-mono text-xs text-night-400">{msg}</p>}
    </div>
  );
}

const mono = '"Share Tech Mono","JetBrains Mono",ui-monospace,monospace';
const gothic = '"Pirata One",Georgia,serif';

function palette(halloween: boolean) {
  return {
    accent: halloween ? '#fb923c' : '#8b5cf6',
    accent2: halloween ? '#a3e635' : '#22d3ee',
    glow: halloween ? 'rgba(234,88,12,.36)' : 'rgba(91,33,182,.55)',
  };
}

export function formatEventDate(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' }).format(d);
}

type ArtProps = Props & { refEl: React.RefObject<HTMLDivElement | null> };

/** 1080×1920 "Oradaydım" hikâye kartı: takma ad, etkinlik, tarih, tur sayısı ve unvan. Sıra/puan yok. */
function ThanksArt({ refEl, username, eventName, summary, halloween }: ArtProps) {
  const { accent, accent2, glow } = palette(halloween);
  const date = formatEventDate(summary.date);
  const lines: [string, string][] = [
    ['etkinlik', eventName],
    ...(date ? ([['tarih', date]] as [string, string][]) : []),
    ...(summary.roundsPlayed > 0 ? ([['oynanan', `${summary.roundsPlayed} tur`]] as [string, string][]) : []),
    ['unvan', summary.title],
  ];
  return (
    <div
      ref={refEl}
      style={{
        width: 1080,
        height: 1920,
        position: 'relative',
        overflow: 'hidden',
        color: '#ece8ff',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        background: `radial-gradient(ellipse 950px 760px at 50% 26%, ${glow}, transparent 66%), radial-gradient(ellipse 800px 700px at 0% 100%, rgba(63,109,179,.32), transparent 60%), #08061a`,
      }}
    >
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,.04) 1px, transparent 1px)', backgroundSize: '6px 6px' }} />
      {[18, 1032].map((x) => (
        <div key={x} style={{ position: 'absolute', top: 0, bottom: 0, left: x, fontFamily: mono, fontSize: 22, lineHeight: '30px', color: `${accent}1f`, writingMode: 'vertical-rl', letterSpacing: 6, whiteSpace: 'nowrap' }}>
          0110100101001110 0101101001 1101001010 0100101101 0110100110 1001011010
        </div>
      ))}

      <div style={{ position: 'absolute', top: 120, left: 0, right: 0, textAlign: 'center' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/omusiber.png" alt="" style={{ display: 'block', margin: '0 auto', width: 210, filter: 'drop-shadow(0 24px 50px rgba(63,109,179,.55))' }} />
        <p style={{ fontFamily: mono, fontSize: 30, color: accent2, marginTop: 40 }}>&gt; bağlantı kaydedildi_</p>
        <p
          style={{
            fontFamily: gothic,
            fontSize: 210,
            lineHeight: 0.95,
            marginTop: 18,
            color: '#ece8ff',
            textShadow: `-5px 0 0 ${accent}, 5px 0 0 ${accent2}66, 0 0 90px ${accent}aa`,
          }}
        >
          Oradaydım.
        </p>
        <p style={{ fontFamily: gothic, fontSize: 64, color: accent, marginTop: 18 }}>Siber Köy · Veri Vampirleri</p>
      </div>

      <div
        style={{
          position: 'absolute',
          top: 900,
          left: 90,
          right: 90,
          border: `2px solid ${accent}66`,
          borderRadius: 30,
          background: 'rgba(12,9,32,.86)',
          boxShadow: `0 30px 80px rgba(0,0,0,.45), inset 0 0 0 1px rgba(255,255,255,.04)`,
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', gap: 14, padding: '22px 30px', borderBottom: '1px solid rgba(139,92,246,.25)', background: 'rgba(30,22,64,.6)' }}>
          {['#f43f5e', '#fbbf24', accent2].map((c) => (
            <span key={c} style={{ width: 20, height: 20, borderRadius: 999, background: c, opacity: 0.85 }} />
          ))}
          <span style={{ marginLeft: 'auto', fontFamily: mono, fontSize: 24, color: '#6f6896' }}>gece.log</span>
        </div>
        <div style={{ padding: '34px 44px 40px', fontFamily: mono, fontSize: 36, lineHeight: 1.55 }}>
          <p style={{ color: '#6f6896' }}>$ whoami</p>
          <p style={{ color: accent2, fontSize: 58, lineHeight: 1.2, wordBreak: 'break-all' }}>{username}</p>
          <p style={{ color: '#6f6896', marginTop: 18 }}>$ cat gece.log</p>
          {lines.map(([k, v]) => (
            <p key={k} style={{ display: 'flex', gap: 20 }}>
              <span style={{ color: '#a59cc9', minWidth: 190 }}>{k}:</span>
              <span style={{ color: '#ece8ff', flex: 1 }}>{v}</span>
            </p>
          ))}
        </div>
      </div>

      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 120, textAlign: 'center' }}>
        <p style={{ fontSize: 36, color: '#a59cc9' }}>Köy o gece benimle birlikte uyanıktı.</p>
        <p style={{ fontFamily: gothic, fontSize: 84, lineHeight: 1, marginTop: 26, color: '#ece8ff' }}>Teşekkürler köy!</p>
        <p style={{ fontFamily: mono, fontSize: 32, color: accent2, marginTop: 22 }}>@omusiber</p>
      </div>
    </div>
  );
}

/** 1754×1240 (A4 yatay, 150 dpi) katılım sertifikası. Sıra/puan yok; mühürde unvan. */
function CertificateArt({ refEl, username, eventName, summary, halloween }: ArtProps) {
  const { accent, accent2, glow } = palette(halloween);
  const date = formatEventDate(summary.date);
  const nameSize = username.length > 16 ? 104 : username.length > 11 ? 130 : 156;
  const corner = (pos: React.CSSProperties, sides: string[]) => (
    <div
      style={{
        position: 'absolute',
        width: 70,
        height: 70,
        ...pos,
        ...Object.fromEntries(sides.map((s) => [`border${s}`, `4px solid ${accent2}`])),
      }}
    />
  );
  return (
    <div
      ref={refEl}
      style={{
        width: 1754,
        height: 1240,
        position: 'relative',
        overflow: 'hidden',
        color: '#ece8ff',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        background: `radial-gradient(ellipse 1100px 650px at 50% 30%, ${glow}, transparent 68%), radial-gradient(ellipse 700px 600px at 100% 100%, rgba(63,109,179,.3), transparent 60%), radial-gradient(ellipse 600px 500px at 0% 0%, rgba(63,109,179,.18), transparent 60%), #08061a`,
      }}
    >
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,.04) 1px, transparent 1px)', backgroundSize: '6px 6px' }} />
      {/* Çift çerçeve ve köşe süsleri */}
      <div style={{ position: 'absolute', inset: 40, border: `2px solid ${accent}88`, borderRadius: 18 }} />
      <div style={{ position: 'absolute', inset: 58, border: '1px solid rgba(165,156,201,.22)', borderRadius: 12 }} />
      {corner({ top: 28, left: 28 }, ['Top', 'Left'])}
      {corner({ top: 28, right: 28 }, ['Top', 'Right'])}
      {corner({ bottom: 28, left: 28 }, ['Bottom', 'Left'])}
      {corner({ bottom: 28, right: 28 }, ['Bottom', 'Right'])}
      <div style={{ position: 'absolute', top: 64, bottom: 64, left: 76, fontFamily: mono, fontSize: 18, lineHeight: '26px', color: `${accent}26`, writingMode: 'vertical-rl', letterSpacing: 6, whiteSpace: 'nowrap', overflow: 'hidden' }}>
        0110100101001110 0101101001 1101001010 0100101101 0110100110
      </div>
      <div style={{ position: 'absolute', top: 64, bottom: 64, right: 76, fontFamily: mono, fontSize: 18, lineHeight: '26px', color: `${accent}26`, writingMode: 'vertical-rl', letterSpacing: 6, whiteSpace: 'nowrap', overflow: 'hidden' }}>
        1001011010 0110100110 0100101101 1101001010 0101101001
      </div>

      <div style={{ position: 'absolute', top: 96, left: 160, right: 160, textAlign: 'center' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/omusiber.png" alt="" style={{ display: 'block', margin: '0 auto', width: 132, filter: 'drop-shadow(0 18px 40px rgba(63,109,179,.55))' }} />
        <p style={{ fontFamily: mono, fontSize: 30, letterSpacing: '.45em', color: accent2, marginTop: 26 }}>KATILIM SERTİFİKASI</p>
        <p style={{ fontFamily: gothic, fontSize: 52, color: accent, marginTop: 8 }}>Siber Köy · Veri Vampirleri</p>
        <p style={{ fontSize: 30, color: '#a59cc9', marginTop: 40 }}>Bu sertifika</p>
        <p style={{ fontFamily: gothic, fontSize: nameSize, lineHeight: 1.05, marginTop: 6, textShadow: `0 0 70px ${accent}aa`, wordBreak: 'break-all' }}>{username}</p>
        <div style={{ margin: '18px auto 0', width: 760, height: 3, background: `linear-gradient(90deg, transparent, ${accent}, ${accent2}, transparent)` }} />
        <p style={{ fontSize: 33, lineHeight: 1.5, color: '#d6d0f2', marginTop: 34, maxWidth: 1180, marginLeft: 'auto', marginRight: 'auto' }}>
          {date ? `${date} tarihinde ` : ''}düzenlenen <b style={{ color: '#ece8ff' }}>{eventName}</b> etkinliğinde Siber Köy gecesine katıldığı,
          veri vampirlerine karşı köyün bir parçası olduğu için teşekkürle verilmiştir.
        </p>
      </div>

      {/* Alt satır: tarih · mühür · düzenleyen */}
      <div style={{ position: 'absolute', left: 190, right: 190, bottom: 112, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div style={{ width: 420, textAlign: 'center' }}>
          <p style={{ fontFamily: mono, fontSize: 30, color: '#ece8ff' }}>{date || '—'}</p>
          <div style={{ height: 2, background: 'rgba(165,156,201,.45)', marginTop: 14 }} />
          <p style={{ fontFamily: mono, fontSize: 22, color: '#a59cc9', marginTop: 10, letterSpacing: '.2em' }}>TARİH</p>
        </div>
        <div
          style={{
            width: 210,
            height: 210,
            borderRadius: 999,
            border: `3px dashed ${accent}`,
            padding: 10,
            boxShadow: `0 0 50px ${accent}55`,
          }}
        >
          <div style={{ width: '100%', height: '100%', borderRadius: 999, border: `2px solid ${accent2}88`, background: 'rgba(12,9,32,.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 12 }}>
            <p style={{ fontFamily: mono, fontSize: 16, letterSpacing: '.3em', color: accent2 }}>UNVAN</p>
            <p style={{ fontFamily: gothic, fontSize: summary.title.length > 12 ? 30 : 36, lineHeight: 1.05, marginTop: 6 }}>{summary.title}</p>
            {summary.roundsPlayed > 0 && <p style={{ fontFamily: mono, fontSize: 16, color: '#a59cc9', marginTop: 8 }}>{summary.roundsPlayed} tur</p>}
          </div>
        </div>
        <div style={{ width: 420, textAlign: 'center' }}>
          <p style={{ fontFamily: mono, fontSize: 30, color: '#ece8ff' }}>@omusiber</p>
          <div style={{ height: 2, background: 'rgba(165,156,201,.45)', marginTop: 14 }} />
          <p style={{ fontFamily: mono, fontSize: 22, color: '#a59cc9', marginTop: 10, letterSpacing: '.2em' }}>DÜZENLEYEN</p>
        </div>
      </div>
    </div>
  );
}
