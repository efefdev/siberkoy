'use client';

import { useEffect } from 'react';

export type EventThemeName = 'default' | 'halloween';

/**
 * Etkinliğin görünümünü sayfaya uygular: <html data-theme="…"> renk değişkenlerini değiştirir,
 * Halloween'de süsleri ekler. Süsler yalnızca dekordur; tıklamayı engellemez, ekran okuyucudan gizlidir.
 */
export default function EventTheme({ theme, decor = true }: { theme?: string | null; decor?: boolean }) {
  const active = theme === 'halloween' ? 'halloween' : 'default';
  useEffect(() => {
    const root = document.documentElement;
    if (active === 'halloween') root.dataset.theme = 'halloween';
    else delete root.dataset.theme;
    return () => {
      delete root.dataset.theme;
    };
  }, [active]);

  if (active !== 'halloween' || !decor) return null;
  return <HalloweenDecor />;
}

export function HalloweenDecor({ scale = 1 }: { scale?: number }) {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Örümcek ağı: sağ üst köşe */}
      <svg viewBox="0 0 200 200" style={{ width: 190 * scale, height: 190 * scale }} className="absolute -right-1 -top-1 opacity-25">
        <g fill="none" stroke="#e4e2fb" strokeWidth="1.1">
          {[0, 15, 30, 45, 60, 75, 90].map((a) => {
            const r = (a * Math.PI) / 180;
            return <line key={a} x1="200" y1="0" x2={200 - Math.cos(r) * 200} y2={Math.sin(r) * 200} />;
          })}
          {[40, 75, 110, 145, 180].map((d) => (
            <path
              key={d}
              d={[0, 15, 30, 45, 60, 75, 90]
                .map((a, i) => {
                  const r = (a * Math.PI) / 180;
                  const x = 200 - Math.cos(r) * d;
                  const y = Math.sin(r) * d;
                  return `${i === 0 ? 'M' : 'Q'}${i === 0 ? '' : `${200 - Math.cos(r - 0.13) * d * 0.9},${Math.sin(r - 0.13) * d * 0.9} `}${x},${y}`;
                })
                .join(' ')}
            />
          ))}
        </g>
        <line x1="150" y1="0" x2="150" y2="96" stroke="#e4e2fb" strokeWidth="1" opacity=".6" />
        <g transform="translate(150 104)" fill="#e4e2fb" opacity=".8">
          <ellipse rx="6" ry="8" />
          <circle cy="-9" r="4" />
          {[-1, 1].map((s) => (
            <g key={s} stroke="#e4e2fb" strokeWidth="1.4" fill="none">
              <path d={`M0,-2 q${s * 9},-8 ${s * 14},-2`} />
              <path d={`M0,1 q${s * 10},-3 ${s * 15},3`} />
              <path d={`M0,4 q${s * 9},2 ${s * 13},9`} />
            </g>
          ))}
        </g>
      </svg>
      {/* Yarasalar */}
      {[
        { left: '8%', top: '12%', w: 34, r: -12, d: '0s' },
        { left: '78%', top: '34%', w: 24, r: 10, d: '1.5s' },
        { left: '18%', top: '58%', w: 20, r: -6, d: '3s' },
      ].map((b, i) => (
        <svg
          key={i}
          viewBox="0 0 64 28"
          className="absolute animate-float-slow opacity-30"
          style={{ left: b.left, top: b.top, width: b.w * scale, animationDelay: b.d, ['--r' as string]: `${b.r}deg` }}
        >
          <path
            fill="#0b0613"
            stroke="rgb(var(--hx-violet))"
            strokeWidth="1"
            d="M32 9c2-4 4-5 4-5l1 4c3-2 7-3 12-2 5 1 9 5 13 11-5-3-8-3-11-1 0-3-3-5-6-4-1 3-4 5-6 4-1 2-3 3-5 4-2-1-4-2-5-4-2 1-5-1-6-4-3-1-6 1-6 4-3-2-6-2-11 1 4-6 8-10 13-11 5-1 9 0 12 2l1-4s2 1 4 5z"
          />
        </svg>
      ))}
      {/* Balkabağı: sol alt köşe */}
      <svg viewBox="0 0 120 110" style={{ width: 120 * scale }} className="absolute -bottom-3 -left-3 opacity-25">
        <path d="M58 18c0-8 4-14 10-16" stroke="#65a30d" strokeWidth="5" fill="none" strokeLinecap="round" />
        <ellipse cx="60" cy="64" rx="56" ry="42" fill="rgb(var(--hx-violet))" />
        <path d="M60 22v84M34 26c-10 18-10 58 0 76M86 26c10 18 10 58 0 76" stroke="#7c2d12" strokeWidth="3" fill="none" opacity=".5" />
        <path d="M34 52l12-8 4 12zM86 52l-12-8-4 12z" fill="#1a0b05" />
        <path d="M32 78c10 8 20 6 28 2 8 4 18 6 28-2-4 12-16 18-28 18s-24-6-28-18z" fill="#1a0b05" />
      </svg>
    </div>
  );
}
