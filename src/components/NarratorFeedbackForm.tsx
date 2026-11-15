'use client';

import { useState } from 'react';

// Oyuncu kimliği ve etkinlik sunucuda oturum çerezinden alınır; istemci yalnızca anlatıcıyı seçer.
interface FeedbackFormProps {
  narratorId: string;
  onDone: () => void;
}

export default function NarratorFeedbackForm({ narratorId, onDone }: FeedbackFormProps) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (rating === 0) return;
    setLoading(true);

    const res = await fetch('/api/player/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ narratorId, rating, message: message.trim() || undefined }),
    });

    setLoading(false);
    if (res.ok) {
      setDone(true);
      setTimeout(onDone, 2000);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Gönderilemedi, tekrar dene.');
    }
  };

  if (done) {
    return (
      <div className="text-center p-8">
        
        <p className="font-mono text-hex-cyan">geri bildirimin alındı, teşekkürler</p>
      </div>
    );
  }

  return (
    <div className="koy-panel p-6">
      <h2 className="font-gothic text-2xl text-hex-violet text-center mb-1">Anlatıcını puanla</h2>
      <p className="text-gray-400 text-sm text-center mb-6">Masayı ne kadar iyi yönetti?</p>

      {/* Yıldız Puanlama */}
      <div className="flex justify-center gap-2 mb-6">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            onClick={() => setRating(star)}
            aria-label={`${star} yıldız`}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            className="text-4xl transition-transform hover:scale-110"
          >
            <span className={star <= (hovered || rating) ? 'text-hex-gold' : 'text-night-600'}>★</span>
          </button>
        ))}
      </div>

      {rating > 0 && (
        <p className="text-center text-sm text-gray-400 mb-4">
          {['', 'Çok kötü', 'Kötü', 'İdare eder', 'İyi', 'Mükemmel'][rating]}
        </p>
      )}

      {/* Opsiyonel Yorum */}
      <textarea
        value={message}
        onChange={e => setMessage(e.target.value.substring(0, 500))}
        placeholder="Opsiyonel: Bir yorum bırakın... (max 500 karakter)"
        className="koy-input h-24 resize-none mb-4 text-sm"
      />

      {error && <p role="alert" className="mb-3 font-mono text-sm text-hex-blood">! {error}</p>}

      <div className="flex gap-3">
        <button
          onClick={onDone}
          className="flex-1 koy-btn-ghost"
        >
          Atla
        </button>
        <button
          onClick={handleSubmit}
          disabled={rating === 0 || loading}
          className="flex-1 koy-btn py-2"
        >
          {loading ? 'Gönderiliyor...' : 'Gönder'}
        </button>
      </div>
    </div>
  );
}
