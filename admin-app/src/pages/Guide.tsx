import { Download, Printer } from 'lucide-react';
import Brand from '@/components/ui/Brand';
import GuideView from '@/components/ui/GuideView';
import { ADMIN_GUIDE } from '../guide';

// Admin kılavuzu: tünel kopuk ya da oturum kapalıyken de okunabilir. Yazdırınca A4 olur.
export default function Guide() {
  return (
    <main className="admin-guide mx-auto max-w-3xl p-4 pb-16 md:p-8">
      <div className="no-print mb-4 flex justify-between font-mono text-xs text-night-400">
        <a href="#/" className="hover:text-hex-cyan">&lt; panele dön</a>
        <span className="flex gap-2">
          <a href="/kilavuz-admin.pdf" download className="koy-btn-ghost py-1.5 text-xs">
            <Download size={14} aria-hidden="true" /> PDF (A4)
          </a>
          <button onClick={() => window.print()} className="koy-btn-ghost py-1.5 text-xs">
            <Printer size={14} aria-hidden="true" /> yazdır
          </button>
        </span>
      </div>
      <article className="a4">
        <header className="mb-8 border-b border-night-700 pb-6">
          <Brand command={ADMIN_GUIDE.command} subtitle="Kullanma kılavuzu" size="lg" />
          <h1 className="mt-4 font-gothic text-4xl leading-none text-night-100">{ADMIN_GUIDE.title}</h1>
          <p className="mt-2 text-sm text-night-400">{ADMIN_GUIDE.subtitle}</p>
        </header>
        <GuideView guide={ADMIN_GUIDE} />
        <footer className="mt-10 border-t border-night-700 pt-3 font-mono text-[10px] text-night-500 print:hidden">
          OMÜ Siber · Siber Köy: Veri Vampirleri · Gizli: yalnızca adminler için
        </footer>
      </article>
    </main>
  );
}
