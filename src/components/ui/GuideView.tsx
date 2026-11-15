import { AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import type { Guide, GuideBlock } from '@/lib/guides';
import { ROLES } from '@/lib/roles';
import RoleIcon from './RoleIcon';

/**
 * Kılavuz görünümü. `compact` yazdırılan A5 kartlar için daha sıkı aralık ve küçük yazı kullanır.
 * Hem Next.js sitesinde hem yerel admin uygulamasında kullanılır (hook yok).
 */
export default function GuideView({ guide, compact = false }: { guide: Guide; compact?: boolean }) {
  const gap = compact ? 'space-y-4' : 'space-y-8';
  return (
    <div className={gap}>
      {guide.sections.map((section, i) => (
        <section key={section.id} className={`guide-section ${section.pageBreakBefore ? 'guide-break' : ''}`}>
          <h2 className={`mb-3 flex items-baseline gap-3 font-gothic leading-none text-hex-violet ${compact ? 'text-2xl' : 'text-3xl'}`}>
            <span className="font-mono text-xs text-hex-cyan">{String(i + 1).padStart(2, '0')}</span>
            {section.title}
          </h2>
          <div className={compact ? 'space-y-2.5' : 'space-y-4'}>
            {section.blocks.map((block, j) => (
              <Block key={j} block={block} compact={compact} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/** `ters tırnak` içindeki parçaları komut olarak gösterir. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/`([^`]+)`/);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <code key={i} className="rounded bg-night-800 px-1 font-mono text-[0.92em] text-hex-cyan">
            {part}
          </code>
        ) : (
          part
        )
      )}
    </>
  );
}

function Block({ block, compact }: { block: GuideBlock; compact: boolean }) {
  const text = compact ? 'text-[11.5px] leading-snug' : 'text-sm leading-relaxed';
  switch (block.kind) {
    case 'text':
      return <p className={`${text} text-night-300`}>
          <Rich text={block.text} />
        </p>;

    case 'list':
      return (
        <ul className={`${text} space-y-1 text-night-300`}>
          {block.items.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="font-mono text-hex-cyan" aria-hidden="true">&gt;</span>
              <span>
                <Rich text={item} />
              </span>
            </li>
          ))}
        </ul>
      );

    case 'steps':
      return (
        <ol className={compact ? 'space-y-1.5' : 'space-y-3'}>
          {block.items.map((step, k) => (
            <li key={step.title} className="flex gap-3">
              <span
                className={`grid shrink-0 place-items-center rounded-full border border-hex-violet-deep bg-night-950 font-mono text-hex-cyan ${
                  compact ? 'h-6 w-6 text-[11px]' : 'h-8 w-8 text-sm'
                }`}
                aria-hidden="true"
              >
                {k + 1}
              </span>
              <div className={text}>
                <p className="font-semibold text-night-100">{step.title}</p>
                <p className="text-night-300">
                  <Rich text={step.text} />
                </p>
              </div>
            </li>
          ))}
        </ol>
      );

    case 'table':
      return (
        <div className="overflow-hidden rounded-lg border border-night-700">
          <table className={`w-full ${text}`}>
            <thead className="bg-night-800">
              <tr>
                {block.head.map((h) => (
                  <th key={h} className="px-3 py-1.5 text-left font-mono text-[10px] font-normal uppercase tracking-widest text-night-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-night-700">
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c} className={`px-3 py-1.5 align-top ${c === 0 ? 'whitespace-nowrap font-semibold text-night-100' : 'text-night-300'}`}>
                      <Rich text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'callout': {
      const tone = {
        info: { box: 'border-hex-cyan/50 bg-hex-cyan/5', title: 'text-hex-cyan', Icon: Info },
        warn: { box: 'border-hex-gold/60 bg-hex-gold/5', title: 'text-hex-gold', Icon: AlertTriangle },
        danger: { box: 'border-hex-blood/60 bg-hex-blood/5', title: 'text-hex-blood', Icon: ShieldAlert },
      }[block.tone];
      return (
        <div className={`flex gap-3 rounded-lg border p-3 ${tone.box}`}>
          <tone.Icon size={compact ? 16 : 18} className={`mt-0.5 shrink-0 ${tone.title}`} aria-hidden="true" />
          <div className={text}>
            <p className={`font-semibold ${tone.title}`}>{block.title}</p>
            <p className="text-night-300">
              <Rich text={block.text} />
            </p>
          </div>
        </div>
      );
    }

    case 'roles':
      return (
        <ul className={`grid gap-2 ${compact ? '' : 'sm:grid-cols-2'}`}>
          {Object.values(ROLES).map((r) => {
            const attacker = r.key === 'ATTACKER';
            return (
              <li key={r.key} className={`flex gap-3 rounded-lg border p-2.5 ${attacker ? 'border-hex-blood/50 bg-[#1a0b16]' : 'border-night-700 bg-night-900'}`}>
                <RoleIcon role={r.key} size={compact ? 18 : 22} className={`mt-0.5 shrink-0 ${attacker ? 'text-hex-blood' : 'text-hex-violet'}`} />
                <div className={text}>
                  <p className="font-semibold text-night-100">
                    {r.label} <span className="font-normal text-night-400">({r.classic})</span>{' '}
                    <span className={`font-mono text-[10px] uppercase tracking-widest ${attacker ? 'text-hex-blood' : 'text-night-500'}`}>{r.team}</span>
                  </p>
                  <p className="text-night-300">{r.description}</p>
                </div>
              </li>
            );
          })}
        </ul>
      );
  }
}
