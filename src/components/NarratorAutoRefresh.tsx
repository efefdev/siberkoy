'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';

/** Masa atanmamış anlatıcı ekranı: tur başlayınca sayfayı yeniler. */
export default function NarratorAutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const socket = io();
    socket.on('round_started', () => router.refresh());
    return () => {
      socket.disconnect();
    };
  }, [router]);
  return null;
}
