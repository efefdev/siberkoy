'use client';

import { useEffect, useState } from 'react';

/** Tek satırlık "yazılıyor" efektli terminal satırı. Hareket azaltma tercihinde anında görünür. */
export function TypedLine({ text, prompt = '>', delay = 0, className = '' }: { text: string; prompt?: string; delay?: number; className?: string }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setShown(text.length);
      return;
    }
    setShown(0);
    let i = 0;
    let interval: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      interval = setInterval(() => {
        i += 1;
        setShown(i);
        if (i >= text.length && interval) clearInterval(interval);
      }, 28);
    }, delay);
    return () => {
      clearTimeout(start);
      if (interval) clearInterval(interval);
    };
  }, [text, delay]);

  return (
    <div className={`font-mono text-sm text-hex-cyan ${className}`}>
      <span className="text-night-500">{prompt} </span>
      {text.slice(0, shown)}
    </div>
  );
}

export function Caret() {
  return <span className="ml-0.5 inline-block h-4 w-2 translate-y-0.5 bg-hex-cyan animate-caret-blink" aria-hidden="true" />;
}
