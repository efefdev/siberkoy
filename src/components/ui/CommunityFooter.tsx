'use client';

import { usePathname } from 'next/navigation';

// Salon ekranı, skor tablosu (projeksiyon) ve yazdırılabilir kılavuz kendi düzenini kullanır.
const HIDDEN = ['/ekran', '/scoreboard', '/rehber/yazdir'];

/** Her sayfanın altında: oyunun OMÜ Siber Güvenlik Topluluğu etkinliği olduğunu belirtir. */
export default function CommunityFooter() {
  const pathname = usePathname() || '/';
  if (HIDDEN.some((p) => pathname.startsWith(p))) return null;
  return (
    <footer className="mx-auto flex w-full max-w-md items-center justify-center gap-3 px-4 pb-8 pt-2 text-night-500">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/omusiber-192.png" alt="" className="w-8 opacity-90" />
      <p className="font-mono text-[11px] leading-snug">
        Siber Köy, <span className="text-night-300">OMÜ Siber Güvenlik Topluluğu</span>’nun
        <br />
        etkinliğidir · <span className="text-hex-cyan">@omusiber</span>
      </p>
    </footer>
  );
}
