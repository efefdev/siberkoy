import { Suspense } from 'react';
import Scoreboard from '@/components/Scoreboard';

interface Props {
  searchParams: Promise<{ eventId?: string; projeksiyon?: string }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ScoreboardPage({ searchParams }: Props) {
  const { eventId, projeksiyon } = await searchParams;
  const isProjection = projeksiyon === '1';

  if (!eventId || !UUID_RE.test(eventId)) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
        <div className="text-center">
          <p className="text-5xl mb-4">📊</p>
          <p className="text-gray-400">Skor tablosuna erişmek için geçerli bir etkinlik bağlantısı gerekli.</p>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">Yükleniyor...</div>}>
      <Scoreboard eventId={eventId} projectionMode={isProjection} />
    </Suspense>
  );
}
