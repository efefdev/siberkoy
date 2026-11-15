'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Brand from '@/components/ui/Brand';

export default function NarratorLoginPage() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    let res: Response;
    try {
      res = await fetch('/api/narrator/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
    } catch {
      // Bağlantı koptu: PIN sunucuda kabul edilmiş olabilir (tek kullanımlık). Düğme takılı kalmasın.
      setLoading(false);
      setError('Bağlantı koptu. Tekrar dene; PIN kabul edilmezse admin’den yeni PIN iste.');
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoading(false);
      setError(data.error || 'Giriş başarısız');
      return;
    }
    router.push('/narrator');
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <Brand command="narrator@siberkoy:~$ login" subtitle="Anlatıcı girişi" size="lg" />
        </div>
        <form onSubmit={handleLogin} className="koy-panel space-y-4 p-6">
          <label htmlFor="npin" className="koy-label">Admin’in verdiği PIN</label>
          <input
            id="npin"
            value={pin}
            onChange={(e) => setPin(e.target.value.trim().toUpperCase())}
            placeholder="A7X2K9"
            maxLength={32}
            className="koy-input text-center font-mono text-2xl tracking-[0.4em]"
            autoComplete="off"
            autoCapitalize="characters"
          />
          <p className="text-xs text-night-500">
            PIN tek kullanımlıktır: girdiğin cihaz bu masanın anlatıcı cihazı olur.{' '}
            <a href="/rehber?bolum=anlatici" className="text-hex-cyan hover:underline">Anlatıcı rehberi</a>
          </p>
          {error && (
            <p role="alert" className="font-mono text-sm text-hex-blood">
              ! {error}
            </p>
          )}
          <button type="submit" disabled={loading || !pin} className="koy-btn w-full">
            {loading ? 'doğrulanıyor...' : '[ panele gir ]'}
          </button>
        </form>
      </div>
    </main>
  );
}
