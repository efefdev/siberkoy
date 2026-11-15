'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

export default function CreateEventForm() {
  const [name, setName] = useState('');
  const [allowLess8, setAllowLess8] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError('Etkinlik adı gir.');
    setLoading(true);
    const res = await fetch('/api/admin/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, allowLess8 }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) return setError(data.error || 'Etkinlik oluşturulamadı');
    router.push(`/admin/events/${data.event.id}`);
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <label htmlFor="ename" className="koy-label">Yeni etkinlik</label>
      <div className="flex gap-2">
        <input id="ename" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="OMÜ Siber Güz 2026" className="koy-input py-2" />
        <button type="submit" disabled={loading} className="koy-btn shrink-0 py-2">
          <Plus size={16} aria-hidden="true" /> Oluştur
        </button>
      </div>
      <label className="flex items-center gap-2 text-sm text-night-400">
        <input type="checkbox" checked={allowLess8} onChange={(e) => setAllowLess8(e.target.checked)} className="accent-hex-violet" />
        Test modu: 8 kişi kuralını yoksay
      </label>
      {error && <p role="alert" className="font-mono text-sm text-hex-blood">! {error}</p>}
    </form>
  );
}
