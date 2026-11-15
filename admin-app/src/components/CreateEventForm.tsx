import { useState } from 'react';
import { Plus } from 'lucide-react';

export default function CreateEventForm({ onCreated }: { onCreated: (eventId: string) => void }) {
  const [name, setName] = useState('');
  const [allowLess8, setAllowLess8] = useState(false);
  const [halloween, setHalloween] = useState(false);
  const [practice, setPractice] = useState(false);
  const [bots, setBots] = useState(10);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError('Etkinlik adı gir.');
    setLoading(true);
    const res = await fetch('/api/admin/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, allowLess8, theme: halloween ? 'halloween' : 'default', ...(practice ? { practicePlayers: bots } : {}) }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) return setError(data.error || 'Etkinlik oluşturulamadı');
    onCreated(data.event.id);
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
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <label className="flex items-center gap-2 text-sm text-night-400">
          <input type="checkbox" checked={halloween} onChange={(e) => setHalloween(e.target.checked)} className="accent-hex-violet" />
          🎃 Halloween görünümü
        </label>
        <label className="flex items-center gap-2 text-sm text-night-400">
          <input type="checkbox" checked={allowLess8} onChange={(e) => setAllowLess8(e.target.checked)} className="accent-hex-violet" />
          Test modu: 8 kişi kuralını yoksay
        </label>
        <label className="flex items-center gap-2 text-sm text-night-400">
          <input type="checkbox" checked={practice} onChange={(e) => setPractice(e.target.checked)} className="accent-hex-violet" />
          Prova etkinliği: sahte oyuncu ekle
        </label>
        {practice && (
          <label className="flex items-center gap-2 text-sm text-night-400">
            <input
              type="number"
              min={4}
              max={48}
              value={bots}
              onChange={(e) => setBots(Math.max(4, Math.min(48, Number(e.target.value) || 4)))}
              className="koy-input w-20 py-1 text-center font-mono"
              aria-label="Sahte oyuncu sayısı"
            />
            sahte oyuncu
          </label>
        )}
      </div>
      {practice && (
        <p className="text-xs text-night-500">
          Prova etkinliğinde oyuncular “prova·” adıyla otomatik eklenir. Anlatıcılar normal PIN ile girip paneli gerçekmiş gibi dener; turu sen başlatırsın.
        </p>
      )}
      {error && <p role="alert" className="font-mono text-sm text-hex-blood">! {error}</p>}
    </form>
  );
}
