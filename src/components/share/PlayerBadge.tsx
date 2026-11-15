'use client';

export interface BadgeSummary {
  rank: number;
  playerCount: number;
  totalScore: number;
  roundsPlayed: number;
  title: string;
  line: string;
  /** Etkinlik tarihi (ISO). */
  date?: string;
}

export const BADGE_W = 1080;
export const BADGE_H = 1920;
const W = BADGE_W;
const H = BADGE_H;

/** Sıralama ve puanlı rozet (Instagram hikâyesi boyutunda). Seçici ve indirme PlayerCards içinde. */
export function BadgeArt({ refEl, username, eventName, summary, halloween }: { refEl: React.RefObject<HTMLDivElement | null>; username: string; eventName: string; summary: BadgeSummary; halloween: boolean }) {
  const accent = halloween ? '#fb923c' : '#8b5cf6';
  const accent2 = halloween ? '#a3e635' : '#22d3ee';
  const podium = summary.rank <= 3 && summary.totalScore > 0;
  return (
    <div
      ref={refEl}
      style={{
        width: W,
        height: H,
        position: 'relative',
        overflow: 'hidden',
        color: '#ece8ff',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        background: `radial-gradient(ellipse 900px 700px at 50% 22%, ${halloween ? 'rgba(234,88,12,.35)' : 'rgba(91,33,182,.55)'}, transparent 65%), radial-gradient(ellipse 800px 700px at 100% 100%, rgba(63,109,179,.35), transparent 60%), #08061a`,
      }}
    >
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,.04) 1px, transparent 1px)', backgroundSize: '6px 6px' }} />
      <div style={{ position: 'absolute', top: 120, left: 0, right: 0, textAlign: 'center' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/omusiber.png" alt="" style={{ display: 'block', margin: '0 auto', width: 230, filter: 'drop-shadow(0 24px 50px rgba(63,109,179,.55))' }} />
        <p style={{ fontFamily: '"Share Tech Mono","JetBrains Mono",monospace', fontSize: 30, color: accent2, marginTop: 34 }}>{eventName}</p>
        <p style={{ fontFamily: '"Pirata One",serif', fontSize: 120, lineHeight: 1, color: accent, marginTop: 14 }}>Siber Köy</p>
      </div>
      <div style={{ position: 'absolute', top: 760, left: 90, right: 90, textAlign: 'center' }}>
        <p style={{ fontFamily: '"Share Tech Mono","JetBrains Mono",monospace', fontSize: 28, letterSpacing: '.3em', color: '#a59cc9' }}>UNVANIN</p>
        <p style={{ fontFamily: '"Pirata One",serif', fontSize: 132, lineHeight: 1.02, marginTop: 16, textShadow: `0 0 60px ${accent}88` }}>{summary.title}</p>
        <p style={{ fontSize: 34, color: '#a59cc9', marginTop: 22 }}>{summary.line}</p>
      </div>
      <div style={{ position: 'absolute', top: 1220, left: 90, right: 90, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div style={{ border: `2px solid ${podium ? '#fbbf24' : 'rgba(139,92,246,.4)'}`, borderRadius: 32, padding: '34px 20px', textAlign: 'center', background: 'rgba(20,15,45,.8)' }}>
          <p style={{ fontFamily: '"Pirata One",serif', fontSize: 110, lineHeight: 1, color: podium ? '#fbbf24' : accent2 }}>{summary.rank}.</p>
          <p style={{ fontSize: 28, color: '#a59cc9', marginTop: 10 }}>{summary.playerCount} kişi arasında</p>
        </div>
        <div style={{ border: '2px solid rgba(139,92,246,.4)', borderRadius: 32, padding: '34px 20px', textAlign: 'center', background: 'rgba(20,15,45,.8)' }}>
          <p style={{ fontFamily: '"Pirata One",serif', fontSize: 110, lineHeight: 1, color: accent2 }}>{summary.totalScore}</p>
          <p style={{ fontSize: 28, color: '#a59cc9', marginTop: 10 }}>puan · {summary.roundsPlayed} tur</p>
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: 150, left: 0, right: 0, textAlign: 'center' }}>
        <p style={{ fontFamily: '"Share Tech Mono","JetBrains Mono",monospace', fontSize: 34, color: '#ece8ff' }}>{username}@siberkoy</p>
        <p style={{ fontFamily: '"Share Tech Mono","JetBrains Mono",monospace', fontSize: 30, color: accent2, marginTop: 18 }}>@omusiber</p>
      </div>
    </div>
  );
}
