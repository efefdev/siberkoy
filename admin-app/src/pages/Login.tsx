import { useState } from 'react';
import Brand from '@/components/ui/Brand';

export default function Login({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Giriş başarısız');
      setPassword('');
      onLoggedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giriş başarısız');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-[80vh] items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <Brand command="admin@local:~$ sudo login" subtitle="Yönetim" size="lg" />
        </div>
        <form onSubmit={submit} className="koy-panel space-y-4 p-6">
          <div>
            <label htmlFor="email" className="koy-label">E-posta</label>
            <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className="koy-input" required />
          </div>
          <div>
            <label htmlFor="password" className="koy-label">Şifre</label>
            <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="koy-input" required />
          </div>
          {error && <p role="alert" className="font-mono text-sm text-hex-blood">! {error}</p>}
          <button type="submit" disabled={loading} className="koy-btn w-full">
            {loading ? 'doğrulanıyor...' : '[ giriş ]'}
          </button>
        </form>
      </div>
    </main>
  );
}
