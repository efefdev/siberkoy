import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getNarratorSession } from '@/lib/auth';
import NarratorPanel from '@/components/NarratorPanel';
import NarratorAutoRefresh from '@/components/NarratorAutoRefresh';
import EventTheme from '@/components/theme/EventTheme';
import Brand from '@/components/ui/Brand';
import { TypedLine } from '@/components/ui/Terminal';

export const dynamic = 'force-dynamic';

export default async function NarratorPage() {
  // Oturum doğrulanmadan (imza + PIN aktif + süresi dolmamış) hiçbir rol bilgisi okunmaz.
  const session = await getNarratorSession();
  if (!session) {
    redirect('/narrator/login');
  }

  const event = await prisma.event.findUnique({ where: { id: session.eventId }, select: { theme: true, isPractice: true } });
  const themeEl = <EventTheme theme={event?.theme} />;

  // Bu anlatıcıya bağlı en güncel turdaki masa
  const room = await prisma.room.findFirst({
    where: { narratorPinId: session.narratorPinId, round: { eventId: session.eventId } },
    orderBy: { round: { roundNumber: 'desc' } },
    include: {
      round: { select: { roundNumber: true } },
      assignments: { include: { player: { select: { username: true } } } },
    },
  });

  if (!room) {
    const pin = await prisma.narratorPIN.findUnique({ where: { id: session.narratorPinId }, select: { tableNumber: true } });
    return (
      <main className="relative flex min-h-screen items-center justify-center p-4">
        {themeEl}
        <div className="relative z-10 w-full max-w-sm">
          <Brand command={`narrator@siberkoy:~$ masa ${pin?.tableNumber ?? '?'}`} subtitle="Anlatıcı" size="lg" />
          <div className="koy-panel mt-6 p-6">
            <p className="font-gothic text-2xl text-night-100">Masa {pin?.tableNumber ?? '?'}</p>
            <p className="mt-2 text-sm text-night-400">Admin turu başlattığında oyuncular ve roller burada görünecek. Sayfa kendiliğinden yenilenir.</p>
            <TypedLine text="tur bekleniyor..." delay={200} className="mt-4" />
          </div>
          <NarratorAutoRefresh />
        </div>
      </main>
    );
  }

  const players = room.assignments.map((a) => ({
    id: a.playerId,
    username: a.player.username,
    role: a.role,
    isAlive: a.isAlive,
  }));

  return (
    <>
    {themeEl}
    <NarratorPanel
      practice={event?.isPractice ?? false}
      key={room.id}
      roomId={room.id}
      roomNumber={room.roomNumber}
      roundNumber={room.round.roundNumber}
      roomCompleted={room.status === 'COMPLETED'}
      players={players}
    />
    </>
  );
}
