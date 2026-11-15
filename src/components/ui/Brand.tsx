import { Caret } from './Terminal';

/** Sayfa başlığı: terminal komutu + OMÜ Siber logosu + gotik "Siber Köy" yazısı + topluluk adı. */
export default function Brand({
  command = 'root@siberkoy:~$ whoami',
  subtitle = 'Veri Vampirleri',
  size = 'lg',
}: {
  command?: string;
  subtitle?: string;
  size?: 'md' | 'lg' | 'xl';
}) {
  const titleSize = size === 'xl' ? 'text-6xl md:text-7xl' : size === 'lg' ? 'text-5xl' : 'text-3xl';
  const logoSize = size === 'xl' ? 'w-20 md:w-24' : size === 'lg' ? 'w-16' : 'w-11';
  return (
    <div>
      <p className="font-mono text-xs text-hex-cyan">
        {command}
        <Caret />
      </p>
      <div className="mt-2 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/omusiber-192.png" alt="OMÜ Siber Güvenlik Topluluğu logosu" className={`${logoSize} shrink-0 drop-shadow-[0_6px_18px_rgba(63,109,179,.45)]`} />
        <div className="min-w-0">
          <h1 className={`font-gothic leading-none text-hex-violet ${titleSize}`}>Siber Köy</h1>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[#6f9be0]">OMÜ Siber Güvenlik Topluluğu</p>
        </div>
      </div>
      {subtitle && <p className="mt-2 font-mono text-xs uppercase tracking-[0.3em] text-night-400">{subtitle}</p>}
    </div>
  );
}
