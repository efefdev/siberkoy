import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, FileSpreadsheet, Printer, RefreshCw } from 'lucide-react';
import writeExcelFile from 'write-excel-file/browser';
import { ROLES, roleLabel } from '@/lib/roles';
import ShareDesigns from '../components/ShareDesigns';

interface Report {
  event: { id: string; name: string; status: string; createdAt: string; closedAt: string | null; theme: string; isPractice: boolean };
  stats: {
    players: number;
    removed: number;
    rounds: number;
    tables: number;
    narrators: number;
    defenderWins: number;
    attackerWins: number;
    eliminations: number;
    bonuses: number;
    avgTableMinutes: number | null;
    durationMinutes: number | null;
    feedbackCount: number;
    avgRating: number | null;
  };
  scoreboard: { rank: number; username: string; totalScore: number; roundsPlayed: number }[];
  players: { username: string; status: string; joinedAt: string }[];
  tables: { round: number; table: number; narratorTable: number | null; status: string; winningSide: string | null; size: number; alive: number; minutes: number | null; bonus: boolean }[];
  roles: { round: number; table: number; username: string; role: string; alive: boolean }[];
  scores: { username: string; kind: string; score: number; reason: string; by: string; round: number | null; table: number | null; at: string }[];
  feedback: { table: number; rating: number; message: string | null; at: string }[];
}

const ROLE_TR: Record<string, string> = Object.fromEntries(Object.values(ROLES).map((r) => [r.key, roleLabel(r.key)]));
const SIDE_TR: Record<string, string> = { DEFENDERS: 'Savunucular', ATTACKERS: 'Hacker’lar' };
const STATUS_TR: Record<string, string> = { LOBBY: 'lobide', PLAYING: 'oyunda', KICKED: 'çıkarıldı', BANNED: 'banlandı', WAITING: 'bekliyor', IN_PROGRESS: 'sürüyor', COMPLETED: 'bitti' };
const KIND_TR: Record<string, string> = { WIN: 'Kazanma', SURVIVE: 'Hayatta kalma', BONUS: 'Bonus', ADJUSTMENT: 'Düzeltme' };

const fmtDate = (s: string) => new Date(s).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
const fmtTime = (s: string) => new Date(s).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** Etkinlik sonuçları: özet (A4 yazdırılabilir), Excel dışa aktarma ve Instagram tasarımları. */
export default function Results({ eventId, onUnauthorized }: { eventId: string; onUnauthorized: () => void }) {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/events/${eventId}/report`, { cache: 'no-store' });
      if (res.status === 401) return onUnauthorized();
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Rapor yüklenemedi');
      setReport(await res.json());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rapor yüklenemedi');
    }
  }, [eventId, onUnauthorized]);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  if (!report) return <main className="p-8 font-mono text-sm text-hex-cyan">{error ? `! ${error}` : '> rapor hazırlanıyor...'}</main>;

  const { event, stats } = report;
  const dateLabel = fmtDate(event.createdAt);

  const exportExcel = async () => {
    setBusy(true);
    try {
      const head = (cells: string[]) => cells.map((value) => ({ value, fontWeight: 'bold' as const, backgroundColor: '#E8E3FB' }));
      const sheets = [
        {
          sheet: 'Özet',
          columns: [{ width: 34 }, { width: 22 }],
          data: [
            head(['Siber Köy etkinlik raporu', '']),
            ['Etkinlik', event.name],
            ['Tarih', dateLabel],
            ['Durum', STATUS_TR[event.status] ?? event.status],
            ['Prova etkinliği', event.isPractice ? 'Evet' : 'Hayır'],
            ['Oyuncu', stats.players],
            ['Çıkarılan / banlanan', stats.removed],
            ['Tur', stats.rounds],
            ['Masa (toplam)', stats.tables],
            ['Görev yapan anlatıcı cihazı', stats.narrators],
            ['Savunucuların kazandığı masa', stats.defenderWins],
            ['Hacker’ların kazandığı masa', stats.attackerWins],
            ['Toplam eleme', stats.eliminations],
            ['Ortalama masa süresi (dk)', stats.avgTableMinutes ?? ''],
            ['Toplam oyun süresi (dk)', stats.durationMinutes ?? ''],
            ['Anlatıcı geri bildirimi', stats.feedbackCount],
            ['Ortalama anlatıcı puanı (5 üzerinden)', stats.avgRating ?? ''],
          ],
        },
        {
          sheet: 'Skor tablosu',
          columns: [{ width: 8 }, { width: 24 }, { width: 10 }, { width: 10 }],
          data: [head(['Sıra', 'Takma ad', 'Puan', 'Tur']), ...report.scoreboard.map((r) => [r.rank, r.username, r.totalScore, r.roundsPlayed])],
        },
        {
          sheet: 'Masalar',
          columns: [{ width: 6 }, { width: 8 }, { width: 14 }, { width: 16 }, { width: 10 }, { width: 10 }, { width: 10 }],
          data: [
            head(['Tur', 'Masa', 'Durum', 'Kazanan', 'Oyuncu', 'Hayatta', 'Süre (dk)']),
            ...report.tables.map((t) => [t.round, t.table, STATUS_TR[t.status] ?? t.status, t.winningSide ? SIDE_TR[t.winningSide] : '', t.size, t.alive, t.minutes ?? '']),
          ],
        },
        {
          sheet: 'Roller',
          columns: [{ width: 6 }, { width: 8 }, { width: 24 }, { width: 16 }, { width: 10 }],
          data: [head(['Tur', 'Masa', 'Takma ad', 'Rol', 'Sonda']), ...report.roles.map((r) => [r.round, r.table, r.username, ROLE_TR[r.role] ?? r.role, r.alive ? 'hayatta' : 'elendi'])],
        },
        {
          sheet: 'Puan kayıtları',
          columns: [{ width: 24 }, { width: 14 }, { width: 8 }, { width: 40 }, { width: 10 }, { width: 6 }, { width: 8 }, { width: 16 }],
          data: [
            head(['Takma ad', 'Tür', 'Puan', 'Gerekçe', 'Giren', 'Tur', 'Masa', 'Zaman']),
            ...report.scores.map((s) => [s.username, KIND_TR[s.kind] ?? s.kind, s.score, s.reason, s.by === 'ADMIN' ? 'admin' : 'anlatıcı', s.round ?? '', s.table ?? '', fmtTime(s.at)]),
          ],
        },
        {
          sheet: 'Oyuncular',
          columns: [{ width: 24 }, { width: 14 }, { width: 16 }],
          data: [head(['Takma ad', 'Durum', 'Katılım']), ...report.players.map((p) => [p.username, STATUS_TR[p.status] ?? p.status, fmtTime(p.joinedAt)])],
        },
        {
          sheet: 'Anlatıcı puanları',
          columns: [{ width: 8 }, { width: 8 }, { width: 60 }, { width: 16 }],
          data: [head(['Masa', 'Puan', 'Not', 'Zaman']), ...report.feedback.map((f) => [f.table, f.rating, f.message ?? '', fmtTime(f.at)])],
        },
      ];
      const safe = event.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40) || 'etkinlik';
      await writeExcelFile(sheets).toFile(`siberkoy-rapor-${safe}.xlsx`);
    } finally {
      setBusy(false);
    }
  };

  const tiles = [
    { n: stats.players, l: 'oyuncu' },
    { n: stats.rounds, l: 'tur' },
    { n: stats.tables, l: 'masa' },
    { n: stats.eliminations, l: 'eleme' },
    { n: stats.defenderWins, l: 'köy kurtuldu' },
    { n: stats.attackerWins, l: 'vampirler kazandı' },
    { n: stats.avgRating !== null ? `${stats.avgRating}★` : '—', l: `anlatıcı puanı (${stats.feedbackCount})` },
  ];

  return (
    <main className="results mx-auto max-w-6xl p-4 pb-16 md:p-8">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <a href={`#/events/${event.id}`} className="inline-flex items-center gap-1 font-mono text-xs text-night-400 hover:text-hex-cyan">
          <ArrowLeft size={14} aria-hidden="true" /> konsola dön
        </a>
        <div className="flex flex-wrap gap-2">
          <button onClick={load} className="koy-btn-ghost py-1.5 text-xs">
            <RefreshCw size={14} aria-hidden="true" /> yenile
          </button>
          <button onClick={exportExcel} disabled={busy} className="koy-btn-ghost py-1.5 text-xs">
            <FileSpreadsheet size={14} aria-hidden="true" /> {busy ? 'hazırlanıyor…' : 'Excel indir'}
          </button>
          <button onClick={() => window.print()} className="koy-btn-ghost py-1.5 text-xs">
            <Printer size={14} aria-hidden="true" /> PDF özet (yazdır)
          </button>
        </div>
      </div>

      {/* Yazdırınca A4 özet rapor */}
      <section className="report-sheet koy-panel p-6 print:border-0 print:bg-transparent">
        <header className="flex items-center justify-between gap-4 border-b border-night-700 pb-5">
          <div className="flex items-center gap-4">
            <img src="/brand/omusiber.png" alt="OMÜ Siber" className="w-16" />
            <div>
              <p className="font-mono text-xs text-hex-cyan">admin@siberkoy:~$ rapor</p>
              <h1 className="mt-1 font-gothic text-3xl leading-none text-night-100">{event.name}</h1>
              <p className="mt-1 font-mono text-xs text-night-400">
                {dateLabel} · {STATUS_TR[event.status] ?? event.status}
                {event.isPractice && ' · PROVA'}
              </p>
            </div>
          </div>
          <p className="hidden font-mono text-[10px] text-night-500 print:block">OMÜ Siber Güvenlik Topluluğu · etkinlik raporu</p>
        </header>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.l} className="rounded-xl border border-night-700 bg-night-950/60 p-4 text-center">
              <p className="font-gothic text-4xl leading-none text-hex-cyan">{t.n}</p>
              <p className="mt-1 font-mono text-[11px] text-night-400">{t.l}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 font-mono text-xs text-night-500">
          {stats.durationMinutes !== null && `toplam oyun süresi ${stats.durationMinutes} dk · `}
          {stats.avgTableMinutes !== null && `ortalama masa ${stats.avgTableMinutes} dk · `}
          {stats.narrators} anlatıcı cihazı · {stats.removed} çıkarılan/banlanan
        </p>

        <div className="mt-6 grid gap-6 md:grid-cols-2 print:grid-cols-2">
          <div>
            <h2 className="font-gothic text-2xl text-hex-violet">İlk 10</h2>
            <table className="mt-2 w-full text-sm">
              <tbody>
                {report.scoreboard.slice(0, 10).map((r) => (
                  <tr key={r.username} className="border-b border-night-800">
                    <td className="w-10 py-1.5 font-mono text-night-500">{r.rank}</td>
                    <td className="py-1.5">{r.username}</td>
                    <td className="py-1.5 text-right font-mono text-hex-cyan">{r.totalScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h2 className="font-gothic text-2xl text-hex-violet">Masalar</h2>
            <table className="mt-2 w-full text-sm">
              <tbody>
                {report.tables.map((t) => (
                  <tr key={`${t.round}-${t.table}`} className="border-b border-night-800">
                    <td className="py-1.5 font-mono text-night-500">T{t.round} · M{t.table}</td>
                    <td className={`py-1.5 ${t.winningSide === 'ATTACKERS' ? 'text-hex-blood' : 'text-hex-cyan'}`}>{t.winningSide ? SIDE_TR[t.winningSide] : 'sürüyor'}</td>
                    <td className="py-1.5 text-right font-mono text-night-400">
                      {t.alive}/{t.size}
                      {t.minutes !== null && ` · ${t.minutes} dk`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {report.feedback.some((f) => f.message) && (
          <div className="mt-6">
            <h2 className="font-gothic text-2xl text-hex-violet">Anlatıcılara notlar</h2>
            <ul className="mt-2 space-y-1.5 text-sm">
              {report.feedback
                .filter((f) => f.message)
                .slice(0, 12)
                .map((f, i) => (
                  <li key={i} className="border-l-2 border-hex-violet/50 pl-3">
                    <span className="font-mono text-xs text-night-500">masa {f.table} · {'★'.repeat(f.rating)} </span>
                    {f.message}
                  </li>
                ))}
            </ul>
          </div>
        )}
      </section>

      <section className="no-print mt-10">
        <h2 className="font-gothic text-3xl text-hex-violet">Instagram tasarımları</h2>
        <p className="mt-1 text-sm text-night-400">
          İsim içermez; sayılar o anki verilerden gelir. {event.status !== 'COMPLETED' && 'Etkinlik bitince “Gece tamamlandı” olarak değişir.'}
        </p>
        <div className="mt-6">
          <ShareDesigns eventName={event.name} dateLabel={dateLabel} status={event.status} halloween={event.theme === 'halloween'} stats={stats} />
        </div>
      </section>
    </main>
  );
}
