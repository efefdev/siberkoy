import Brand from '@/components/ui/Brand';

export default function KurallarPage() {
  return (
    <div className="min-h-screen text-night-200">
      <div className="max-w-2xl mx-auto p-6 pb-20">

        {/* Başlık */}
        <div className="py-10">
          <Brand command="guest@siberkoy:~$ man kurallar" subtitle="Kurallar kitapçığı" size="xl" />
        </div>

        {/* ─── HİKAYE ─── */}
        <section className="mb-10">
          <h2 className="font-gothic text-3xl text-hex-violet border-b border-night-700 pb-2 mb-4">📖 Hikaye</h2>
          <div className="bg-gray-900 rounded-xl p-5 text-gray-300 leading-relaxed">
            <p>
              Yıl 2031, <span className="text-purple-300 font-semibold">OMÜ Siber Köyü</span>. Karadeniz kıyısındaki akıllı bir
              kampüsün tüm yaşamı tek bir ağda akar. Köyü <span className="text-blue-300 font-semibold">Siber Köy Savunma Ekibi</span> korur.
              Bir gece <span className="text-red-400 font-semibold">Gölge Kolektifi</span> adlı gizemli bir hacker grubu ağa sızar.
              Halk onlara <span className="text-red-300 font-semibold">Veri Vampirleri</span> der.
            </p>
            <p className="mt-3">
              Vampirler çalınmış hesaplarla köyün içine karışmıştır. Her gece bir hesabı ele geçirirler;
              her gün köy <span className="text-yellow-300 font-semibold">Olay Müdahale Toplantısı</span>’nda toplanıp
              birini ağdan izole etmek için oy kullanır.
            </p>
          </div>
        </section>

        {/* ─── TAKIMLAR VE KAZANMA ─── */}
        <section className="mb-10">
          <h2 className="font-gothic text-3xl text-hex-violet border-b border-night-700 pb-2 mb-4">🏆 Takımlar ve Kazanma Koşulları</h2>
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-blue-950 border border-blue-700 rounded-xl p-5">
              <h3 className="font-bold text-blue-300 text-lg mb-1">🔵 Savunucular (Mavi Takım)</h3>
              <p className="text-gray-300">Tüm Hacker’lar ağdan izole edilirse <span className="text-green-400 font-bold">Savunucular kazanır</span>.</p>
            </div>
            <div className="bg-red-950 border border-red-700 rounded-xl p-5">
              <h3 className="font-bold text-red-300 text-lg mb-1">🔴 Hacker’lar (Kırmızı Takım — Veri Vampirleri)</h3>
              <p className="text-gray-300">Hayattaki hacker sayısı, hayattaki savunucu sayısına <span className="text-red-400 font-bold">eşit veya fazla</span> olunca Hacker’lar kazanır.</p>
            </div>
          </div>
        </section>

        {/* ─── ROLLER ─── */}
        <section className="mb-10">
          <h2 className="font-gothic text-3xl text-hex-violet border-b border-night-700 pb-2 mb-4">🎭 Roller</h2>
          <div className="space-y-4">
            <div className="bg-red-950/60 border border-red-800 rounded-xl p-4">
              <h3 className="font-bold text-red-300">🧛 Hacker (Vampir) — Kırmızı · Veri Vampiri</h3>
              <p className="text-gray-300 text-sm mt-1">Her gece diğer Hacker’larla birlikte sessizce bir kişiyi hedef alır. Anlaşamazlarsa “bağlantı koptu”, o gece saldırı gerçekleşmez.</p>
            </div>
            <div className="bg-blue-950/60 border border-blue-800 rounded-xl p-4">
              <h3 className="font-bold text-blue-300">👤 Kullanıcı (Köylü) — Mavi</h3>
              <p className="text-gray-300 text-sm mt-1">Özel yeteneği yoktur. Gücü tartışma ve oylamadadır.</p>
            </div>
            <div className="bg-indigo-950/60 border border-indigo-800 rounded-xl p-4">
              <h3 className="font-bold text-indigo-300">🔍 SOC Analisti (Gözcü) — Mavi</h3>
              <p className="text-gray-300 text-sm mt-1">Her gece bir kişi seçer; anlatıcı gizlice <span className="text-green-400">Temiz (👍)</span> veya <span className="text-red-400">Şüpheli (👎)</span> işareti gösterir.</p>
            </div>
            <div className="bg-green-950/60 border border-green-800 rounded-xl p-4">
              <h3 className="font-bold text-green-300">🛡️ Yama Uzmanı (Doktor) — Mavi</h3>
              <p className="text-gray-300 text-sm mt-1">Her gece bir kişiyi yamalar; o gece saldırı o kişiye işlemez. Kendini de yamalayabilir. <span className="text-yellow-300">Aynı kişiyi art arda iki gece seçemez.</span></p>
            </div>
          </div>
        </section>

        {/* ─── ROL DAĞILIMI ─── */}
        <section className="mb-10">
          <h2 className="font-gothic text-3xl text-hex-violet border-b border-night-700 pb-2 mb-4">📊 Masa Başına Rol Dağılımı</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-center border-collapse">
              <thead>
                <tr className="bg-gray-800 text-gray-300">
                  <th className="p-3 border border-gray-700">Oyuncu</th>
                  <th className="p-3 border border-gray-700 text-red-400">🧛 Hacker<br /><span className="text-xs font-normal text-gray-400">(Vampir)</span></th>
                  <th className="p-3 border border-gray-700 text-indigo-400">🔍 Analist<br /><span className="text-xs font-normal text-gray-400">(Gözcü)</span></th>
                  <th className="p-3 border border-gray-700 text-green-400">🛡️ Yama<br /><span className="text-xs font-normal text-gray-400">(Doktor)</span></th>
                  <th className="p-3 border border-gray-700 text-blue-400">👤 Kullanıcı<br /><span className="text-xs font-normal text-gray-400">(Köylü)</span></th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                {[
                  [8,2,1,1,4],[9,2,1,1,5],[10,2,1,1,6],
                  [11,3,1,1,6],[12,3,1,1,7],[13,3,1,1,8],
                  [14,4,1,1,8],[15,4,1,1,9],[16,4,1,1,10],
                ].map(([n,s,a,p,u]) => (
                  <tr key={n} className="border-b border-gray-800 hover:bg-gray-900">
                    <td className="p-3 border border-gray-700 font-bold">{n}</td>
                    <td className="p-3 border border-gray-700 text-red-400">{s}</td>
                    <td className="p-3 border border-gray-700 text-indigo-400">{a}</td>
                    <td className="p-3 border border-gray-700 text-green-400">{p}</td>
                    <td className="p-3 border border-gray-700 text-blue-400">{u}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">İdeal masa 8-9 kişidir; sistem masaları buna göre kurar. Roller her turda aynı tabloya göre dağıtılır.</p>
        </section>

        {/* ─── OYUN AKIŞI ─── */}
        <section className="mb-10">
          <h2 className="font-gothic text-3xl text-hex-violet border-b border-night-700 pb-2 mb-4">🌙 Oyun Akışı</h2>
          <div className="space-y-4">
            <div className="bg-indigo-950/50 border border-indigo-800 rounded-xl p-4">
              <h3 className="font-bold text-indigo-300 mb-2">🌙 Gece</h3>
              <ol className="list-decimal list-inside space-y-1 text-gray-300 text-sm">
                <li>Herkes başını masaya koyar, gözler kapalı.</li>
                <li>Gece 1 tanışma gecesidir: yalnızca Hacker’lar uyanıp birbirini tanır; kimse rolünü kullanmaz, saldırı olmaz.</li>
                <li>Gece 2’den itibaren: Hacker’lar aynı kişiyi sessizce seçer (anlaşamazlarsa saldırı gerçekleşmez).</li>
                <li>Yama Uzmanı korunacak kişiyi seçer.</li>
                <li>SOC Analisti bir kişiyi sorgular (anlatıcıdan gizli bilgi alır).</li>
              </ol>
            </div>
            <div className="bg-yellow-950/50 border border-yellow-800 rounded-xl p-4">
              <h3 className="font-bold text-yellow-300 mb-2">☀️ Gündüz</h3>
              <ol className="list-decimal list-inside space-y-1 text-gray-300 text-sm">
                <li><span className="text-white font-semibold">Sabah raporu:</span> Saldırı ve yama hedefi aynıysa “saldırı engellendi” denir; değilse hedef elenir (rolü gizli kalır).</li>
                <li><span className="text-white font-semibold">Tartışma:</span> Tur 1’de 5 dk, sonrasında 3-4 dk. Rol iddia etmek ve yalan söylemek serbesttir, <span className="text-red-400">kart göstermek yasaktır.</span></li>
                <li><span className="text-white font-semibold">Oylama (ağdan izolasyon):</span> Geri sayımla herkes aynı anda bir kişiyi parmakla gösterir. En çok oyu alan elenir. Beraberlikte 30 sn savunma + ikinci oylama; yine eşitse kimse elenmez.</li>
                <li><span className="text-white font-semibold">Kazanma kontrolü:</span> Koşullar sağlandıysa oyun biter.</li>
              </ol>
            </div>
          </div>
        </section>

        {/* ─── KURALLAR ─── */}
        <section className="mb-10">
          <h2 className="font-gothic text-3xl text-hex-violet border-b border-night-700 pb-2 mb-4">📜 Kurallar</h2>
          <ul className="space-y-3 text-sm text-gray-300">
            {[
              "Elenen oyuncular konuşamaz, işaret veremez, bilgi paylaşamaz; anlatıcıya yardım edebilir (süre tutmak gibi).",
              "Anlatıcı oynamaz; kararı kesindir. Elenen oyuncuların rolleri tur bitene kadar gizli kalır, tur sonunda herkes rolünü açıklar.",
              "Kart göstermek, fotoğraflamak, kanıt göstermek yasaktır.",
              "Gece gözünü açan oyuncu o turdan diskalifiye olur.",
              "Yama Uzmanı aynı kişiyi art arda iki gece seçerse anlatıcı o hamleyi geçersiz sayar.",
            ].map((rule, i) => (
              <li key={i} className="flex gap-3 bg-gray-900 rounded-lg p-3">
                <span className="text-purple-400 font-bold shrink-0">#{i + 1}</span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ─── PUANLAMA ─── */}
        <section className="mb-10">
          <h2 className="font-gothic text-3xl text-hex-violet border-b border-night-700 pb-2 mb-4">⭐ Puanlama</h2>
          <div className="bg-gray-900 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800 text-gray-300">
                  <th className="p-4 text-left">Durum</th>
                  <th className="p-4 text-right">Puan</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                <tr className="border-t border-gray-800">
                  <td className="p-4">Takımın kazanması</td>
                  <td className="p-4 text-right font-bold text-green-400">+3</td>
                </tr>
                <tr className="border-t border-gray-800">
                  <td className="p-4">Oyun sonunda hayatta olmak</td>
                  <td className="p-4 text-right font-bold text-blue-400">+1</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">3 turun toplamında en çok puan toplayan <span className="text-yellow-400 font-semibold">Siber Köy Şampiyonu</span> olur.</p>
        </section>

        {/* ─── ETKİNLİK DÜZENİ ─── */}
        <section className="mb-10">
          <h2 className="font-gothic text-3xl text-hex-violet border-b border-night-700 pb-2 mb-4">🗓️ Etkinlik Zaman Çizelgesi (~1 saat 50 dk)</h2>
          <div className="space-y-2 text-sm">
            {[
              ["0-15 dk", "Karşılama ve kural anlatımı"],
              ["15-40 dk", "Tur 1 — Roller: Hacker (Vampir), Kullanıcı (Köylü), Analist (Gözcü), Yama Uzmanı (Doktor)"],
              ["40-45 dk", "Ara: Puan yazımı, masa değişimi"],
              ["45-70 dk", "Tur 2 — yeni masalar, yeni roller"],
              ["70-75 dk", "Ara: masa değişimi"],
              ["75-100 dk", "Tur 3 — Final"],
              ["100-110 dk", "Puan tablosu, ödül, mini siber güvenlik eğitimi"],
            ].map(([time, desc]) => (
              <div key={time} className="flex gap-4 bg-gray-900 rounded-lg p-3">
                <span className="text-purple-400 font-mono font-bold shrink-0 w-20">{time}</span>
                <span className="text-gray-300">{desc}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ─── PDF İNDİR ─── */}
        <div className="text-center mt-8">
          <a
            href="/kilavuz/oyuncu.pdf"
            download
            className="inline-flex items-center gap-2 bg-purple-700 hover:bg-purple-600 px-6 py-3 rounded-xl font-semibold transition-colors"
          >
            📥 PDF Olarak İndir
          </a>
          <p className="text-xs text-gray-600 mt-2">Oyuncu kılavuzu: kurallar, roller ve oyun akışı</p>
        </div>

      </div>
    </div>
  );
}
