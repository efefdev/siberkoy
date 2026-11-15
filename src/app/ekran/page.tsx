import ScreenClient from './ScreenClient';

export const metadata = { title: 'Büyük ekran | Siber Köy' };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Projeksiyon ekranı. Bağlantı yönetim panelindeki "Büyük ekran" düğmesinden açılır. */
export default async function ScreenPage({ searchParams }: { searchParams: Promise<{ eventId?: string }> }) {
  const { eventId } = await searchParams;
  if (!eventId || !UUID_RE.test(eventId)) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8 text-center">
        <p className="font-mono text-night-400">Büyük ekranı yönetim panelindeki bağlantıdan açın.</p>
      </main>
    );
  }
  return <ScreenClient eventId={eventId} />;
}
