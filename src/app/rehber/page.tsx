import Link from 'next/link';
import { Download, Printer } from 'lucide-react';
import Brand from '@/components/ui/Brand';
import GuideView from '@/components/ui/GuideView';
import { GUIDES, type GuideKey } from '@/lib/guides';

export const metadata = { title: 'Rehber | Siber Köy' };

interface Props {
  searchParams: Promise<{ bolum?: string }>;
}

export default async function GuidePage({ searchParams }: Props) {
  const { bolum } = await searchParams;
  const key: GuideKey = bolum === 'anlatici' ? 'anlatici' : 'oyuncu';
  const guide = GUIDES[key];

  return (
    <main className="mx-auto max-w-3xl p-4 pb-16 md:p-8">
      <div className="mb-8">
        <Brand command={guide.command} subtitle="Kullanma kılavuzu" size="lg" />
      </div>

      <nav className="mb-6 flex gap-2" aria-label="Kılavuz seç">
        {(Object.keys(GUIDES) as GuideKey[]).map((k) => (
          <Link
            key={k}
            href={`/rehber?bolum=${k}`}
            aria-current={k === key ? 'page' : undefined}
            className={`rounded-lg border px-4 py-2 font-mono text-sm transition ${
              k === key ? 'border-hex-cyan bg-hex-cyan/10 text-hex-cyan' : 'border-night-700 text-night-400 hover:border-hex-violet hover:text-night-100'
            }`}
          >
            {k === 'oyuncu' ? 'oyuncu' : 'anlatıcı'}
          </Link>
        ))}
      </nav>

      <header className="koy-panel mb-8 flex flex-wrap items-end justify-between gap-4 p-6">
        <div>
          <h1 className="font-gothic text-4xl leading-none text-night-100">{guide.title}</h1>
          <p className="mt-2 text-sm text-night-400">{guide.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <a href={`/kilavuz/${key}.pdf`} download className="koy-btn-ghost py-2 text-sm">
            <Download size={14} aria-hidden="true" /> PDF (A5)
          </a>
          <Link href={`/rehber/yazdir/${key}`} className="koy-btn-ghost py-2 text-sm">
            <Printer size={14} aria-hidden="true" /> yazdır
          </Link>
        </div>
      </header>

      <GuideView guide={guide} />

      <div className="mt-12 flex justify-between font-mono text-xs text-night-500">
        <Link href="/" className="hover:text-hex-cyan">&gt; köye katıl</Link>
        <Link href="/kurallar" className="hover:text-hex-cyan">&gt; tüm kurallar</Link>
      </div>
    </main>
  );
}
