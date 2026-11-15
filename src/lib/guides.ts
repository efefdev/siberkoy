// Oyuncu ve anlatıcı kılavuzlarının içeriği. Hem /rehber sayfası hem yazdırılabilir A5 kartlar buradan üretilir.
// (Admin kılavuzu herkese açık sitede yayınlanmaz; admin-app/src/guide.ts içindedir.)
import { ROLES } from './roles';

export type GuideBlock =
  | { kind: 'steps'; items: { title: string; text: string }[] }
  | { kind: 'list'; items: string[] }
  | { kind: 'text'; text: string }
  | { kind: 'table'; head: string[]; rows: string[][] }
  | { kind: 'callout'; tone: 'info' | 'warn' | 'danger'; title: string; text: string }
  | { kind: 'roles' };

export interface GuideSection {
  id: string;
  title: string;
  blocks: GuideBlock[];
  /** Yazdırılan kartta yeni sayfadan başlasın mı */
  pageBreakBefore?: boolean;
}

export interface Guide {
  key: string;
  title: string;
  subtitle: string;
  command: string;
  sections: GuideSection[];
}

export const PLAYER_GUIDE: Guide = {
  key: 'oyuncu',
  title: 'Oyuncu Rehberi',
  subtitle: 'Köye katıl, rolünü gizle, hacker’ı bul',
  command: 'guest@siberkoy:~$ man oyuncu',
  sections: [
    {
      id: 'katil',
      title: 'Nasıl oynanır',
      blocks: [
        {
          kind: 'steps',
          items: [
            { title: 'Katıl', text: 'QR kodu okut ya da siteyi aç. Büyük ekrandaki 6 haneli PIN’i ve bir takma ad gir.' },
            { title: 'Lobide bekle', text: 'Admin turu başlatınca masa numaran ve gizli rolün telefonuna gelir.' },
            { title: 'Masana geç', text: 'Ekrandaki numaralı masaya otur; anlatıcın seni bekliyor.' },
            { title: 'Rolüne gizlice bak', text: 'Karta dokun, rolünü oku. Kart 8 saniye sonra kendiliğinden kapanır.' },
            { title: 'Oyna', text: 'Gece gözlerini kapat, anlatıcıyı dinle. Gündüz tartış, şüpheliyi oyla.' },
            { title: 'Oyun bitince', text: 'Final büyük ekranda açıklanır. Telefonundan bir hatıra kartı seçip kaydedebilir ya da paylaşabilirsin: sıra göstermeyen “Oradaydım” hikâye kartı, yatay katılım sertifikası ya da unvan, sıra ve puanlı rozet. Ayrıca son anlatıcına yıldız verebilirsin.' },
          ],
        },
      ],
    },
    {
      id: 'kurallar',
      title: 'Altın kurallar',
      blocks: [
        {
          kind: 'list',
          items: [
            'Rolünü ve ekranını kimseye gösterme. Kart göstermek yasaktır.',
            'Rol iddia etmek, blöf yapmak serbest.',
            'Elendiysen izleyicisin: konuşma, ipucu verme.',
            'Telefonu masaya ekranı aşağı bakacak şekilde bırak.',
          ],
        },
        {
          kind: 'callout',
          tone: 'info',
          title: 'Bağlantın mı koptu?',
          text: 'Aynı telefonda siteyi yeniden aç; kaldığın yerden devam edersin. Telefon değiştirdiysen admin’den 8 karakterlik cihaz kodu iste ve ana sayfada “telefon değiştirdim”e gir: puanın ve masan yeni telefona taşınır.',
        },
      ],
    },
    {
      id: 'roller',
      title: 'Roller',
      pageBreakBefore: true,
      blocks: [{ kind: 'roles' }],
    },
    {
      id: 'kazanma',
      title: 'Kazanma ve puan',
      blocks: [
        {
          kind: 'table',
          head: ['Takım', 'Kazanır, eğer…'],
          rows: [
            ['Savunucular', 'Tüm hacker’lar ağdan izole edilirse'],
            ['Hacker’lar', 'Hayattaki hacker sayısı savunuculara eşit ya da fazla olursa'],
          ],
        },
        {
          kind: 'table',
          head: ['Puan', 'Ne zaman'],
          rows: [
            ['+3', 'Takımın kazandı'],
            ['+1', 'Kazanan takımdasın ve oyun sonunda hayattasın'],
          ],
        },
        { kind: 'text', text: 'Eşitlikte daha çok tur oynayan, o da eşitse masalarını ortalamada daha hızlı bitiren üste çıkar. Her turda masalar ve roller yeniden dağıtılır.' },
      ],
    },
  ],
};

export const NARRATOR_GUIDE: Guide = {
  key: 'anlatici',
  title: 'Anlatıcı Rehberi',
  subtitle: 'Masanın sesi, gecenin yöneticisi',
  command: 'narrator@siberkoy:~$ man anlatici',
  sections: [
    {
      id: 'giris',
      title: 'Giriş',
      blocks: [
        {
          kind: 'steps',
          items: [
            { title: 'PIN’i al', text: 'Admin sana masa numaran için 6 karakterlik bir PIN verir (örn. HX4M7Q).' },
            { title: 'Panele gir', text: 'Sitede “anlatıcı girişi”ne PIN’i yaz. Giriş yaptığın cihaz bu masanın cihazı olur.' },
            { title: 'Turu bekle', text: 'Admin turu başlatınca oyuncular ve rolleri paneline gelir; sayfa kendiliğinden yenilenir.' },
          ],
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'PIN tek kullanımlık',
          text: 'Aynı PIN ikinci bir cihazda çalışmaz. Telefonun kapanırsa admine söyle; masana yeni bir PIN üretir, oyun kaldığı yerden devam eder.',
        },
        {
          kind: 'text',
          text: 'Sabit masadasın: tüm turlarda aynı masa numarasını yönetirsin, oyuncular masalar arasında karışır.',
        },
      ],
    },
    {
      id: 'gece',
      title: 'Gece akışı',
      blocks: [
        { kind: 'text', text: 'Panelin üstündeki “Anlatıcı rehberi” oyunu adım adım yürütür: her adımda yüksek sesle okuyacağın metni (“söyle:”) gösterir. Herkesin rolünü ekranda gördüğün için seçim istemez; “Sıradaki adım” ile ilerlersin. Gece sırası:' },
        {
          kind: 'steps',
          items: [
            { title: 'Gece 1: Hacker’lar (Vampirler) tanışıyor', text: 'Her turun ilk gecesi yalnızca tanışma gecesidir: hacker’lar birbirini tanır, kimse rolünü kullanmaz. Rehber bu turun hacker’larını adıyla gösterir. Sabah “kimse düşmedi” denir.' },
            { title: 'Gece 2’den itibaren: saldırı hedefi', text: 'Hacker’lar aynı kişiyi sessizce işaret eder; hedefi aklında tut. Anlaşamazlarsa o gece saldırı olmaz.' },
            { title: 'Yama Uzmanı (Doktor)', text: 'Korunacak kişiyi seçer; kendini de seçebilir. Aynı kişiyi art arda iki gece seçemez.' },
            { title: 'SOC Analisti (Gözcü)', text: 'Bir kişiyi sorgular; hacker’sa başparmak aşağı (şüpheli), değilse yukarı (temiz) göster.' },
            { title: 'Köy uyanıyor ve sabah raporu', text: 'Hedef yamalandıysa ya da saldırı olmadıysa “kimse düşmedi” de; değilse hedefi duyur ve Masa listesinden “Ele” ile ele (rolü gizli kalır).' },
          ],
        },
      ],
    },
    {
      id: 'gunduz',
      title: 'Gündüz ve eleme',
      pageBreakBefore: true,
      blocks: [
        {
          kind: 'list',
          items: [
            'Gündüz rehberde üç adımdır: tartışma (sayaç: 1. turda 5 dk, sonra 3 dk), oylama, oylama sonucu. Ardından “Geceye geç”.',
            'Oylamada en çok oyu alan elenir. Beraberlikte berabere kalanlara 30 sn savunma ver ve ikinci oylama yap; yine eşitse kimse elenmez.',
            'Elenen oyuncuyu Masa listesinde “Ele” ile tek dokunuşla ele.',
            'Yanlış kişiyi elediysen 10 sn içinde üstte beliren “Geri al”a bas; süre geçtiyse admine söyle, o geri getirir.',
            'Elenen oyuncular izleyicidir; konuşmamalarını sağla.',
          ],
        },
        {
          kind: 'table',
          head: ['Sonuç', 'Ne zaman'],
          rows: [
            ['Savunucular kazandı', 'Masadaki tüm hacker’lar elendi'],
            ['Hacker’lar kazandı', 'Hayattaki hacker sayısı ≥ hayattaki savunucu sayısı'],
          ],
        },
      ],
    },
    {
      id: 'sonuc',
      title: 'Masa sonucu ve yardım',
      blocks: [
        {
          kind: 'steps',
          items: [
            { title: 'Sonucu gir', text: 'Kazanan tarafı seç, “Sonucu kaydet ve masayı bitir”e bas. Puanlar otomatik hesaplanır.' },
            { title: 'Yardım iste', text: 'Bir sorun olursa “Admine yardım bildir” kutusuna kısaca yaz; bildirim anında admine düşer.' },
          ],
        },
        {
          kind: 'callout',
          tone: 'danger',
          title: 'Sonuç bir kez girilir',
          text: 'Yanlış girdiysen admine söyle; masa sonucunu o düzeltir, kendin tekrar giremezsin. Göndermeden önce bir kez daha kontrol et.',
        },
        {
          kind: 'list',
          items: [
            'Panel ekranını oyunculara çevirme: tüm roller görünür.',
            'Anlatıcıya özel içerik (açılış metni, soru havuzu, mini eğitim) panelin en altındadır.',
            'Masan bitince yeni tur başlayana kadar bekle; panel kendiliğinden yenilenir.',
            'Etkinlikten önce admin bir prova etkinliği açarsa sahte oyuncularla paneli rahatça deneyebilirsin (üstte “PROVA MASASI” yazar).',
          ],
        },
      ],
    },
  ],
};

export const GUIDES = { oyuncu: PLAYER_GUIDE, anlatici: NARRATOR_GUIDE } as const;
export type GuideKey = keyof typeof GUIDES;

export const ROLE_ROWS = Object.values(ROLES);
