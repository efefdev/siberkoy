'use client';

import { useEffect, useState } from 'react';
import { roleInfo } from '@/lib/roles';
import RoleIcon from './RoleIcon';
import { TypedLine } from './Terminal';

/**
 * Gizli rol kartı. Varsayılan olarak kapalıdır; dokununca çevrilir, tekrar dokununca kapanır.
 * Yanındaki kişi ekranı görmesin diye kart açık kalmaz: 8 saniye sonra kendiliğinden kapanır.
 */
export default function RoleCard({ role, roomNumber, roundNumber, isAlive }: { role: string; roomNumber: number; roundNumber: number; isAlive: boolean }) {
  const [open, setOpen] = useState(false);
  const info = roleInfo(role);
  const attacker = info.key === 'ATTACKER';

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setOpen(false), 8000);
    return () => clearTimeout(t);
  }, [open]);

  const toggle = () => setOpen((o) => !o);

  return (
    <button
      type="button"
      onClick={toggle}
      className="flip-card block w-full text-left"
      data-flipped={open}
      aria-pressed={open}
      aria-label={open ? 'Rolü gizle' : 'Rolünü görmek için dokun'}
    >
      <div className="flip-inner h-[22rem]">
        {/* Ön yüz (kapalı) */}
        <div className="flip-face koy-panel flex flex-col items-center justify-center gap-4 p-6">
          <p className="font-mono text-xs uppercase tracking-widest text-night-400">
            Tur {roundNumber} · Masa {roomNumber}
          </p>
          <div className="grid h-24 w-24 place-items-center rounded-full border border-hex-violet-deep bg-night-950 text-hex-violet">
            <span className="font-gothic text-5xl">?</span>
          </div>
          <p className="font-gothic text-2xl text-night-200">Rolün mühürlü</p>
          <p className="font-mono text-sm text-hex-cyan">[ görmek için dokun ]</p>
          <p className="text-center text-xs text-night-500">Ekranı kimseye gösterme. Kart 8 saniye sonra kendiliğinden kapanır.</p>
        </div>

        {/* Arka yüz (rol) */}
        <div
          className={`flip-face flip-back flex flex-col items-center justify-center gap-3 rounded-2xl border p-6 text-center ${
            attacker ? 'border-hex-blood/70 bg-[#1a0b16]' : 'border-hex-violet-deep bg-night-900'
          }`}
        >
          <RoleIcon role={info.key} className={attacker ? 'text-hex-blood' : 'text-hex-violet'} size={52} strokeWidth={1.5} />
          <p className="font-gothic text-4xl text-night-100">
            {info.label} <span className="text-2xl text-night-400">({info.classic})</span>
          </p>
          <p className={`font-mono text-xs uppercase tracking-widest ${attacker ? 'text-hex-blood' : 'text-hex-cyan'}`}>{info.team}</p>
          <p className="text-sm leading-relaxed text-night-300">{info.description}</p>
          {open && (
            <div className="mt-1 space-y-0.5 text-left">
              {info.terminal.map((t, i) => (
                <TypedLine key={t} text={t} delay={250 + i * 600} />
              ))}
            </div>
          )}
          {!isAlive && <p className="mt-1 font-mono text-xs text-hex-blood">bağlantın kesildi — izleyici modundasın</p>}
          <p className="mt-auto font-mono text-xs text-night-500">[ gizlemek için dokun ]</p>
        </div>
      </div>
    </button>
  );
}
