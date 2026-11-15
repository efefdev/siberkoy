import { notFound } from 'next/navigation';
import Brand from '@/components/ui/Brand';
import GuideView from '@/components/ui/GuideView';
import QrCode from '@/components/ui/QrCode';
import PrintButton from './PrintButton';
import { GUIDES, type GuideKey } from '@/lib/guides';

// Yazdırılabilir A5 kart. PDF'ler bu sayfadan üretilir (scripts/kilavuz-pdf.mjs).
export default async function PrintableGuide({ params }: { params: Promise<{ bolum: string }> }) {
  const { bolum } = await params;
  // `in` prototip zincirine de bakar (ör. "toString"); yalnızca kendi anahtarları kabul edilir.
  if (!Object.hasOwn(GUIDES, bolum)) notFound();
  const guide = GUIDES[bolum as GuideKey];
  const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://siberkoy.omusiber.org').replace(/\/+$/, '');
  const siteHost = siteUrl.replace(/^https?:\/\//, '');

  return (
    <>
      <style>{`
        @page { size: A5; margin: 0; }
        html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @media print {
          .no-print { display: none !important; }
          .guide-break { break-before: page; padding-top: 8mm; }
          .guide-section { break-inside: avoid; }
          .a5 { margin: 0 !important; border: 0 !important; border-radius: 0 !important; }
        }
      `}</style>
      <div className="no-print mx-auto flex max-w-[148mm] items-center justify-between p-4 font-mono text-xs text-night-400">
        <a href={`/rehber?bolum=${bolum}`} className="hover:text-hex-cyan">&lt; rehbere dön</a>
        <PrintButton />
      </div>
      <article className="a5 mx-auto mb-8 w-[148mm] overflow-hidden border border-night-700 bg-night-950 px-[9mm] py-[8mm] sm:rounded-xl">
        <header className="mb-5 flex items-start justify-between gap-4 border-b border-night-700 pb-4">
          <div>
            <Brand command={guide.command} subtitle={guide.title} size="md" />
            <p className="mt-2 text-[11px] text-night-400">{guide.subtitle}</p>
          </div>
          {bolum === 'oyuncu' && (
            <div className="text-center">
              <QrCode value={siteUrl} size={92} className="rounded" />
              <p className="mt-1 font-mono text-[9px] text-hex-cyan">{siteHost}</p>
            </div>
          )}
        </header>
        <GuideView guide={guide} compact />
        <footer className="mt-5 flex justify-between border-t border-night-700 pt-3 font-mono text-[9px] text-night-500 print:hidden">
          <span>OMÜ Siber · Siber Köy: Veri Vampirleri</span>
          <span>{siteHost}/rehber</span>
        </footer>
      </article>
    </>
  );
}
