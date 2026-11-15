import type { LocalStatus } from '../local';

/** Üst şerit: tünel / acil durum bağlantısı ve oturum. */
export default function StatusBar({ status, email, onLogout }: { status: LocalStatus | null; email: string | null; onLogout?: () => void }) {
  const emergency = status?.mode === 'emergency';
  const ok = status?.connected;
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 font-mono text-xs ${
        emergency
          ? 'border-hex-gold/60 bg-hex-gold/10 text-hex-gold'
          : ok
            ? 'border-night-700 bg-night-900 text-night-400'
            : 'border-hex-blood/60 bg-hex-blood/10 text-hex-blood'
      }`}
      role="status"
    >
      <span>
        <span className={ok ? 'text-hex-cyan' : 'text-hex-blood'}>●</span>{' '}
        {status ? `${emergency ? 'ACİL DURUM · ' : ''}${status.target} · ${ok ? 'bağlı' : status.message || 'bağlantı yok'}` : 'yerel sunucuya ulaşılamıyor'}
      </span>
      <span className="flex items-center gap-3">
        <a href="#/rehber" className="hover:text-hex-cyan">
          [ rehber ]
        </a>
        {email && (
          <span className="flex items-center gap-3">
            <span>{email}</span>
            {onLogout && (
              <button onClick={onLogout} className="hover:text-hex-cyan">
                [ çıkış ]
              </button>
            )}
          </span>
        )}
      </span>
    </div>
  );
}
