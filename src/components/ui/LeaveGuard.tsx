'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Telefonun geri tuşu / geri kaydırma hareketi oyuncuyu masadan çıkarmasın: önce onay sorulur.
 * Geçmişe aynı adresle bir "tuzak" kaydı eklenir; geri basılınca o kayıt tüketilir, yeniden eklenir ve uyarı açılır.
 * `active` false olduğunda (ör. etkinlik bitti) geri tuşu sorgusuz çalışır.
 */
export default function LeaveGuard({ active }: { active: boolean }) {
  const [asking, setAsking] = useState(false);
  const activeRef = useRef(active);
  const armed = useRef(false);
  const leaving = useRef(false);

  useEffect(() => {
    activeRef.current = active;
    if (active && !armed.current) {
      armed.current = true;
      window.history.pushState(window.history.state, '', window.location.href);
    }
  }, [active]);

  useEffect(() => {
    const onPop = () => {
      if (!armed.current || leaving.current) return;
      if (!activeRef.current) {
        // Koruma kalktıysa tuzak kaydı zaten tüketildi: kullanıcının istediği gerçek geri adımı at.
        armed.current = false;
        leaving.current = true;
        window.history.back();
        return;
      }
      window.history.pushState(window.history.state, '', window.location.href);
      setAsking(true);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (!asking) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setAsking(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [asking]);

  if (!asking) return null;

  const leave = () => {
    leaving.current = true;
    setAsking(false);
    window.history.go(-2); // tuzak kaydı + bu sayfa
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="leave-title" className="fixed inset-0 z-50 flex items-center justify-center bg-night-950/80 p-4 backdrop-blur-sm">
      <div className="koy-panel w-full max-w-sm p-6">
        <p id="leave-title" className="font-mono text-sm text-hex-blood">! odadan çıkmak üzeresin</p>
        <p className="mt-3 text-sm leading-relaxed text-night-300">
          Emin misin? Bu sayfadan çıkarsan masandaki oyunu takip edemezsin. Yanlışlıkla bastıysan burada kal.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button autoFocus onClick={() => setAsking(false)} className="koy-btn w-full">
            [ odada kal ]
          </button>
          <button onClick={leave} className="koy-btn-danger w-full">
            evet, çık
          </button>
        </div>
      </div>
    </div>
  );
}
