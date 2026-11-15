'use client';

import { Printer } from 'lucide-react';

export default function PrintButton() {
  return (
    <button onClick={() => window.print()} className="koy-btn-ghost py-1.5 text-xs">
      <Printer size={14} aria-hidden="true" /> yazdır / PDF kaydet
    </button>
  );
}
