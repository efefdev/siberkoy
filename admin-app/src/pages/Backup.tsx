import { Printer } from 'lucide-react';
import RoleIcon from '@/components/ui/RoleIcon';
import { ROLES, type RoleKey } from '@/lib/roles';
import { getRoleDistribution } from '@/lib/role-allocator';

// Bir masa seti: 16 kişilik en büyük masaya yetecek kartlar. Daha küçük masada fazlası ayrılır (tablo).
const SET: { role: RoleKey; count: number }[] = [
  { role: 'ATTACKER', count: 4 },
  { role: 'ANALYST', count: 1 },
  { role: 'PATCHER', count: 1 },
  { role: 'USER', count: 10 },
];

const SIZES = [8, 9, 10, 11, 12, 13, 14, 15, 16];

/**
 * İnternet ya da sistem çökerse oyunu kağıtla sürdürmek için yedek set (A4):
 * 1. sayfa: nasıl kullanılır + rol dağılım tablosu, 2. sayfa: kesilecek 16 rol kartı, 3. sayfa: masa skor kağıdı.
 * Her masa için bir set basılır.
 */
export default function Backup() {
  const cards = SET.flatMap((s) => Array.from({ length: s.count }, (_, i) => ({ role: s.role, key: `${s.role}-${i}` })));
  return (
    <main className="backup mx-auto max-w-4xl p-4 pb-16 md:p-8">
      <div className="no-print mb-4 flex justify-between font-mono text-xs text-night-400">
        <a href="#/" className="hover:text-hex-cyan">&lt; panele dön</a>
        <button onClick={() => window.print()} className="koy-btn-ghost py-1.5 text-xs">
          <Printer size={14} aria-hidden="true" /> yazdır (her masa için 1 set)
        </button>
      </div>

      {/* Sayfa 1 */}
      <section className="sheet koy-panel p-8">
        <div className="flex items-center gap-4">
          <img src="/brand/omusiber.png" alt="" className="w-16" />
          <div>
            <p className="font-mono text-xs text-hex-cyan">yedek plan · kağıtla oyun</p>
            <h1 className="font-gothic text-4xl leading-none text-night-100">Siber Köy yedek kart seti</h1>
          </div>
        </div>
        <p className="mt-5 text-sm leading-relaxed text-night-300">
          İnternet ya da sistem çalışmazsa oyun bu setle aynı kurallarla sürer. Her masaya bir set ve bir skor kağıdı verilir; anlatıcı rolleri
          dağıtır, sonucu skor kağıdına yazar. Puanlar sonradan yönetim panelinden <b>puan düzeltme</b> ile sisteme işlenebilir.
        </p>
        <ol className="mt-5 list-decimal space-y-2 pl-5 text-sm text-night-200">
          <li>Masadaki oyuncu sayısını say. Aşağıdaki tablodan kaç kart kullanılacağına bak, fazlasını ayır.</li>
          <li>Kartları karıştır, yüzü kapalı dağıt. Herkes kartına gizlice bakıp önüne ters koyar.</li>
          <li>Anlatıcı rolleri skor kağıdına yazar (oyunculara göstermeden).</li>
          <li>Gece/gündüz akışı anlatıcı kartındaki gibidir. Elenen oyuncunun kartı açılmaz.</li>
          <li>Oyun bitince kazanan tarafı ve hayatta kalanları skor kağıdına işaretle; puanlar otomatik kuralla hesaplanır: kazanan +3, kazanıp hayatta kalan +1.</li>
        </ol>
        <h2 className="mt-7 font-gothic text-2xl text-hex-violet">Kaç kart?</h2>
        <table className="mt-2 w-full text-center text-sm">
          <thead>
            <tr className="border-b border-night-700 font-mono text-xs text-night-400">
              <th className="py-2 text-left">Oyuncu</th>
              {SIZES.map((n) => (
                <th key={n}>{n}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(['ATTACKER', 'ANALYST', 'PATCHER', 'USER'] as const).map((r) => (
              <tr key={r} className="border-b border-night-800">
                <td className="py-1.5 text-left">{ROLES[r].label} <span className="text-night-500">({ROLES[r].classic})</span></td>
                {SIZES.map((n) => {
                  const d = getRoleDistribution(n);
                  return <td key={n} className="font-mono">{d[r]}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 font-mono text-[11px] text-night-500">Roller her turda aynı kurala göre dağıtılır. İdeal masa 8-9 kişidir.</p>
      </section>

      {/* Sayfa 2: kartlar */}
      <section className="sheet page-break mt-8">
        <div className="card-grid grid grid-cols-4 gap-2">
          {cards.map((c) => {
            const info = ROLES[c.role];
            const attacker = c.role === 'ATTACKER';
            return (
              <div key={c.key} className={`role-card flex flex-col items-center justify-between rounded-xl border-2 p-3 text-center ${attacker ? 'border-hex-blood/70 bg-[#1a0b16]' : 'border-night-700 bg-night-900'}`}>
                <p className="font-mono text-[9px] tracking-widest text-night-500">SİBER KÖY</p>
                <RoleIcon role={c.role} size={34} className={attacker ? 'text-hex-blood' : 'text-hex-violet'} />
                <div>
                  <p className="font-gothic text-2xl leading-none text-night-100">{info.label}</p>
                  <p className="mt-0.5 font-mono text-[9px] text-night-400">({info.classic})</p>
                  <p className={`mt-1 font-mono text-[9px] uppercase tracking-widest ${attacker ? 'text-hex-blood' : 'text-hex-cyan'}`}>{info.team}</p>
                </div>
                <p className="text-[9.5px] leading-snug text-night-300">{info.description}</p>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-center font-mono text-[10px] text-night-500">kesik çizgilerden kes · kartı kimseye gösterme</p>
      </section>

      {/* Sayfa 3: skor kağıdı */}
      <section className="sheet page-break koy-panel mt-8 p-8">
        <div className="flex items-baseline justify-between">
          <h2 className="font-gothic text-3xl text-night-100">Masa skor kağıdı</h2>
          <p className="font-mono text-sm text-night-400">Tur ____ · Masa ____ · Anlatıcı ______________</p>
        </div>
        <table className="score-sheet mt-4 w-full text-sm">
          <thead>
            <tr className="border-b-2 border-night-600 font-mono text-[11px] text-night-400">
              <th className="w-8 py-2">#</th>
              <th className="text-left">Takma ad</th>
              <th className="w-28 text-left">Rol</th>
              <th className="w-16">Hayatta</th>
              <th className="w-16">Puan</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 16 }, (_, i) => (
              <tr key={i} className="border-b border-night-700">
                <td className="py-2.5 text-center font-mono text-night-500">{i + 1}</td>
                <td />
                <td />
                <td className="text-center text-night-600">☐</td>
                <td />
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-5 flex gap-8 text-sm text-night-300">
          <span>Kazanan: ☐ Savunucular &nbsp; ☐ Hacker’lar</span>
          <span>Başlangıç ____:____ &nbsp; Bitiş ____:____</span>
        </div>
      </section>
    </main>
  );
}
