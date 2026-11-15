'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Brand from '@/components/ui/Brand';
import { TypedLine } from '@/components/ui/Terminal';

export default function Home() {
  const [pin, setPin] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  // Oturumu açık oyuncu (ör. geri tuşuyla buraya düştü) yeniden katılmak zorunda kalmasın.
  const [active, setActive] = useState<{ username: string; eventName: string } | null>(null);
  useEffect(() => {
    fetch('/api/player/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => {
        if (me && me.event?.status !== 'COMPLETED') setActive({ username: me.player.username, eventName: me.event.name });
      })
      .catch(() => {});
  }, []);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(pin)) return setError('PIN 6 haneli bir sayı olmalı.');
    if (username.trim().length < 3) return setError('Takma ad en az 3 karakter olmalı.');

    setLoading(true);
    try {
      const res = await fetch('/api/player/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventPin: pin, username }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Katılım başarısız oldu.');
      router.push('/lobby');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Katılım başarısız oldu.');
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <Brand size="xl" />
          <div className="mt-4 space-y-0.5">
            <TypedLine text="ağa sızma tespit edildi" delay={300} />
            <TypedLine text="köy toplanıyor..." delay={1300} />
          </div>
        </div>

        {active && (
          <div className="koy-panel mb-5 border-hex-cyan/60 p-5">
            <p className="font-mono text-xs text-hex-cyan">&gt; açık oturumun var</p>
            <p className="mt-2 text-sm text-night-300">
              <span className="font-semibold text-night-100">{active.username}</span> olarak <span className="font-semibold text-night-100">{active.eventName}</span> etkinliğindesin.
            </p>
            <button type="button" onClick={() => router.push('/lobby')} className="koy-btn mt-4 w-full">
              [ köyüne dön ]
            </button>
          </div>
        )}

        <form onSubmit={handleJoin} className="koy-panel space-y-5 p-6" noValidate>
          <div>
            <label htmlFor="pin" className="koy-label">Etkinlik PIN’i</label>
            <input
              id="pin"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="koy-input text-center font-mono text-3xl tracking-[0.5em]"
            />
          </div>
          <div>
            <label htmlFor="username" className="koy-label">Takma ad</label>
            <input
              id="username"
              autoComplete="nickname"
              maxLength={30}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="KaranlıkKöylü"
              className="koy-input"
            />
          </div>

          {error && (
            <p role="alert" className="font-mono text-sm text-hex-blood">
              ! {error}
            </p>
          )}

          <button type="submit" disabled={loading} className="koy-btn w-full text-base">
            {loading ? 'bağlanıyor...' : '[ köye katıl ]'}
          </button>
        </form>

        <TransferForm onDone={() => router.push('/lobby')} />

        <details className="mt-5 rounded-xl border border-night-700/70 px-4 py-3 text-xs text-night-400">
          <summary className="cursor-pointer font-mono text-night-400 hover:text-hex-cyan">kişisel veriler hakkında</summary>
          <p className="mt-2 leading-relaxed">
            Katılmak için yalnızca bir takma ad girersin; gerçek adın, telefon numaran ya da e-postan istenmez. Oyun boyunca takma
            adın, puanların ve bu tarayıcıya özel rastgele bir kimlik tutulur (bağlantın koparsa kaldığın yerden devam edebilmen ve
            kuralları ihlal edenlerin engellenebilmesi için). Takma adın skor tablosunda ve salondaki büyük ekranda görünebilir.
            Bu bilgiler yalnızca etkinliğin yürütülmesi için kullanılır; reklam ya da başka bir amaçla paylaşılmaz.
          </p>
        </details>

        <div className="mt-6 flex justify-between font-mono text-xs text-night-500">
          <Link href="/rehber" className="hover:text-hex-cyan">
            &gt; nasıl oynanır
          </Link>
          <Link href="/kurallar" className="hover:text-hex-cyan">
            &gt; kurallar
          </Link>
          <Link href="/narrator/login" className="hover:text-hex-cyan">
            &gt; anlatıcı girişi
          </Link>
        </div>
      </div>
    </main>
  );
}

/** Telefon değiştiren oyuncu: admin'in verdiği tek kullanımlık kodla aynı kayda (puan, masa, rol) bağlanır. */
function TransferForm({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const clean = code.replace(/[\s-]/g, '').toUpperCase();
    if (!/^[A-Z0-9]{8}$/.test(clean)) return setError('Kod 8 karakter olmalı.');
    setLoading(true);
    try {
      const res = await fetch('/api/player/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: clean }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Kod kabul edilmedi.');
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kod kabul edilmedi.');
      setLoading(false);
    }
  };

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-4 w-full text-center font-mono text-xs text-night-400 hover:text-hex-cyan">
        &gt; telefon değiştirdim, cihaz kodum var
      </button>
    );

  return (
    <form onSubmit={submit} className="koy-panel mt-4 space-y-3 p-5" noValidate>
      <label htmlFor="transfer-code" className="koy-label">Cihaz kodu</label>
      <p className="text-xs text-night-400">Admin’in sana verdiği 8 karakterlik kodu yaz. Puanın ve masan bu telefona taşınır.</p>
      <input
        id="transfer-code"
        autoComplete="one-time-code"
        autoCapitalize="characters"
        maxLength={10}
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="XXXXXXXX"
        className="koy-input text-center font-mono text-2xl tracking-[0.3em]"
      />
      {error && (
        <p role="alert" className="font-mono text-sm text-hex-blood">
          ! {error}
        </p>
      )}
      <button type="submit" disabled={loading} className="koy-btn-ghost w-full">
        {loading ? 'bağlanıyor...' : '[ oturumu bu telefona taşı ]'}
      </button>
    </form>
  );
}
