// Admin kılavuzu. Yalnızca yerel admin uygulamasında yayınlanır (sunucu, tünel ve acil durum ayrıntıları içerir).
import type { Guide } from '@/lib/guides';

export const ADMIN_GUIDE: Guide = {
  key: 'admin',
  title: 'Admin Rehberi',
  subtitle: 'Kurulumdan final açıklamasına kadar etkinlik yönetimi',
  command: 'admin@local:~$ man admin',
  sections: [
    {
      id: 'mimari',
      title: 'Sistem nasıl çalışır',
      blocks: [
        {
          kind: 'text',
          text: 'Oyuncu ve anlatıcı ekranları herkese açık sitededir. Admin paneli ise web sitesinde yoktur: bu bilgisayarda çalışır ve sunucuya port knocking + SSH tüneli ile bağlanır. Admin API’si internete kapalıdır; dışarıdan bakan biri giriş sayfasını bile göremez.',
        },
        {
          kind: 'table',
          head: ['Kim', 'Nereden', 'Nasıl girer'],
          rows: [
            ['Oyuncu', 'Site ana sayfası (QR)', 'Etkinlik PIN’i + takma ad'],
            ['Anlatıcı', 'Site → anlatıcı girişi', 'Masaya özel, tek kullanımlık PIN'],
            ['Admin', 'Bu bilgisayar: npm run admin', 'SSH şifresi + e-posta/şifre'],
          ],
        },
      ],
    },
    {
      id: 'kurulum',
      title: 'Bir kerelik kurulum',
      blocks: [
        {
          kind: 'steps',
          items: [
            { title: 'Node.js 22+', text: 'Terminalde `node -v` ile kontrol et (22 ya da 24 olmalı). Yoksa nodejs.org’dan LTS sürümünü kur.' },
            { title: 'Bağımlılıklar', text: 'Repo klasöründe `npm install`.' },
            { title: 'Ayar dosyası', text: '`cp admin-app/admin.config.example.json admin-app/admin.config.json` ve dosyayı doldur. Bu dosya Git’e girmez; knock sırası yalnızca bu bilgisayarda durur.' },
            { title: 'İlk deneme', text: '`npm run admin` → SSH şifreni gir → tarayıcıda panel açılır → e-posta/şifre ile giriş yap.' },
          ],
        },
        {
          kind: 'table',
          head: ['Alan', 'Ne yazılır'],
          rows: [
            ['publicUrl', 'https://siberkoy.omusiber.org'],
            ['ssh.host / port / user', 'Sunucunun adresi, SSH portu, kullanıcı adın'],
            ['ssh.remoteAppPort', '3000 (sunucudaki tünel girişi)'],
            ['ssh.localTunnelPort', 'Bu bilgisayarda boş bir port, örn. 43000'],
            ['knock.sequence', 'Sırayla {"port": 7000, "protocol": "tcp"} / "udp"'],
          ],
        },
      ],
    },
    {
      id: 'acilis',
      title: 'Paneli açmak',
      pageBreakBefore: true,
      blocks: [
        {
          kind: 'steps',
          items: [
            { title: 'Başlat', text: 'Repo klasöründe `npm run admin`. Panel derlenir, kapı çalınır (port knocking).' },
            { title: 'SSH şifresi', text: 'Terminal şifreni sorar. Şifreyi uygulama görmez, saklamaz.' },
            { title: 'Giriş', text: 'Tarayıcı terminalde yazan bağlantıyla açılır. Admin e-postan ve şifrenle gir. Bağlantıdaki anahtar her açılışta değişir; paylaşma.' },
            { title: 'Kapat', text: 'İş bitince terminalde Ctrl+C. Tünel de kapanır.' },
          ],
        },
        {
          kind: 'text',
          text: 'Admin oturumu tarayıcıda değil, bu uygulamanın içinde tutulur. Sekmeyi kapatıp açarsan oturum sürer; uygulamayı (Ctrl+C) kapatınca oturum da biter.',
        },
        {
          kind: 'callout',
          tone: 'info',
          title: 'Üst şeridi izle',
          text: 'Camgöbeği nokta: bağlı. Kırmızı: tünel koptu; uygulama kapıyı yeniden çalıp bağlanır, terminalde şifreyi tekrar sorar.',
        },
      ],
    },
    {
      id: 'once',
      title: 'Etkinlikten önce',
      blocks: [
        {
          kind: 'list',
          items: [
            'Bir gün önce `npm run admin` ile bağlanıp giriş yap.',
            'Yedek admin bilgisayarında da admin.config.json hazır ve denenmiş olsun.',
            'Telefon hotspot’u ile tünelin kurulduğunu dene (kampüs ağı SSH’yi engelleyebilir).',
            'Acil durum için sunucuya telefondan SSH erişimini dene.',
            'Masa sayısı kadar anlatıcı belirle; her biri telefonunu şarj etsin.',
            'Oyuncu A5 kartlarını (QR’lı) masalara, anlatıcı kartlarını anlatıcılara dağıt.',
            'Anlatıcılarla prova yap: “Prova etkinliği” kutusunu işaretleyerek sahte oyunculu bir etkinlik aç, PIN ver, turu başlat.',
            'Yedek planı bas: Etkinlikler sayfasındaki “yedek kağıt kart seti”nden her masa için bir set (kartlar + skor kağıdı).',
          ],
        },
      ],
    },
    {
      id: 'akis',
      title: 'Etkinlik akışı',
      pageBreakBefore: true,
      blocks: [
        {
          kind: 'steps',
          items: [
            { title: 'Etkinliği oluştur', text: 'Ana sayfada ad yaz → Oluştur. İstersen “Halloween görünümü”nü işaretle. Konsoldaki “Büyük ekran”ı perdeye yansıt: QR, katılım kodu ve gelen kişi sayısı orada. Konsolun kendisini yansıtma.' },
            { title: 'Anlatıcı PIN’leri', text: 'Anlatıcılar bölümünde her masa için “PIN üret”. Konsol oyuncu sayısına göre kaç masa gerektiğini gösterir; hazır olmayan masalar sarı.' },
            { title: 'Oyuncuları topla', text: 'Oyuncular QR ile katılır. Uygunsuz adları “ad” ile düzelt. Herkes gelince “Katılımı kapat”: PIN’i bilen başkası giremez (yeniden bağlanma ve cihaz kodu çalışır).' },
            { title: 'Turu başlat', text: '“Tur 1’i başlat”. Sistem masaları böler, rolleri gizlice dağıtır; oyuncular masalarını telefondan görür. Sonraki tur daha çok masa gerektiriyorsa konsol hangi masaya anlatıcı lazım olduğunu sarıyla yazar.' },
            { title: 'Masaları izle', text: 'Her masanın kaç kişinin hayatta olduğu ve bitip bitmediği konsolda. Yardım bildirimleri sağ üstte kırmızı.' },
            { title: 'Sonraki tur', text: 'Tüm masalar sonucu girince yeni tur başlatılabilir. Masalar karışır, eski masa arkadaşları mümkün olduğunca ayrılır.' },
            { title: 'Final', text: 'Son turda tüm masalar sonucu girince “Etkinliği bitir”. Büyük ekran kendiliğinden final podyumuna geçer (ekrana tıklayınca baştan oynar); oyuncular hatıra kartlarını (Oradaydım kartı, katılım sertifikası, sıralı rozet) ve anlatıcı puanlama ekranını görür.' },
          ],
        },
        {
          kind: 'table',
          head: ['Masa sayısı', 'Aktif oyuncu'],
          rows: [
            ['1', '8–15'],
            ['2', '16–24'],
            ['3', '25–36'],
            ['4', '37–48'],
            ['5', '49–60'],
            ['6', '61–72'],
          ],
        },
      ],
    },
    {
      id: 'sonra',
      title: 'Etkinlikten sonra',
      blocks: [
        {
          kind: 'list',
          items: [
            'Konsoldaki “Rapor ve paylaşım”: tüm sayılar, ilk 10, masalar ve anlatıcılara bırakılan notlar.',
            '“Excel indir”: skorlar, masalar, roller, puan kayıtları, oyuncular ve anlatıcı puanları ayrı sayfalarda.',
            '“PDF özet (yazdır)”: tek sayfalık logolu özet; yazdır penceresinde “PDF olarak kaydet”i seç.',
            'Instagram tasarımları: story ve post, isim içermez; oyuncu, tur, masa, eleme sayıları anlık veriden gelir.',
          ],
        },
      ],
    },
    {
      id: 'sorun',
      title: 'Sorun giderme',
      pageBreakBefore: true,
      blocks: [
        {
          kind: 'table',
          head: ['Durum', 'Ne yap'],
          rows: [
            ['Tur başlamıyor: “anlatıcısı yok”', 'O masalar için PIN üret, anlatıcı giriş yapınca tekrar dene.'],
            ['Tur başlamıyor: “henüz bitmedi”', 'Sonucu girmeyen masayı konsolda bul, anlatıcısına sor.'],
            ['Tur başlamıyor: “en az 8 kişi”', 'Oyuncu bekle ya da etkinliği test modunda oluştur (test modunda da en az 4 kişi gerekir).'],
            ['Anlatıcının telefonu kapandı', 'O masa için “yeni PIN (devret)”. Eski PIN iptal olur, masa yeni cihaza geçer.'],
            ['Masa sonucu yanlış girildi', 'Masa kartında “sonucu düzelt”: doğru tarafı ve hayatta kalanları seç, gerekçe yaz. Puan farkları kendiliğinden düzeltilir.'],
            ['Oyuncu yanlışlıkla elendi', 'Masa sürüyorsa kartta “elenenler” → “dirilt”.'],
            ['Oyuncu telefonu değiştirdi', 'Oyuncular listesinde “kod”: 10 dk geçerli 8 karakterlik kodu oyuncuya söyle. Ana sayfada “telefon değiştirdim”e girer; puanı ve masası taşınır.'],
            ['Anlatıcılar “çok fazla deneme” görüyor', 'Anlatıcılar bölümünde “giriş kilitlerini temizle”. Ortak Wi-Fi’da herkes aynı IP’den çıkar.'],
            ['“Etkinliği bitir” çalışmıyor', 'Sonucu girilmemiş masa var; konsolda “sürüyor” olan masayı bul.'],
            ['Panel “yerel oturum anahtarı geçersiz” diyor', 'Paneli terminalde yazan bağlantıdan aç (uygulama her açılışta yeni anahtar üretir).'],
            ['Tünel kurulmuyor', 'Telefon hotspot’u dene. Olmazsa acil durum adımları.'],
            ['İnternet tamamen gitti', 'Yedek kağıt kart setiyle oyna; skor kağıtlarındaki puanları sonra “puan düzeltme” ile işle.'],
          ],
        },
      ],
    },
    {
      id: 'acil',
      title: 'Acil durum erişimi',
      blocks: [
        { kind: 'text', text: 'Tünel hiçbir şekilde kurulamazsa admin API’si tek bir IP’ye, süreli olarak açılabilir:' },
        {
          kind: 'steps',
          items: [
            { title: 'IP’ni öğren', text: 'Bu bilgisayardan: `curl -s https://api.ipify.org`' },
            { title: 'Sunucuda aç', text: 'Telefondan SSH ile, repo klasöründe: `./scripts/admin-acil.sh ac <IP> 120` (en fazla 240 dk).' },
            { title: 'Paneli acil modda aç', text: 'Bu bilgisayarda: `npm run admin -- --acil`. Üst şerit sarıya döner.' },
            { title: 'Kapat', text: 'İş bitince sunucuda `./scripts/admin-acil.sh kapat`. Süre dolunca kendiliğinden de kapanır.' },
          ],
        },
        {
          kind: 'callout',
          tone: 'danger',
          title: 'Açıkken dikkat',
          text: 'Kampüs ağında aynı dış IP’yi paylaşan herkes admin giriş sayfasına ulaşabilir; yalnızca şifre ve deneme kilidi korur. Biri hesabı yanlış şifreyle kilitlerse kilit yalnızca acil yolu etkiler, SSH tünelinden giriş çalışır. Süreyi kısa tut.',
        },
      ],
    },
    {
      id: 'guvenlik',
      title: 'Güvenlik alışkanlıkları',
      blocks: [
        {
          kind: 'list',
          items: [
            'Konsol ekranını oyunculara yansıtma; projeksiyon için yalnızca “Projeksiyon” sekmesini kullan.',
            'Anlatıcı PIN’lerini yalnızca ilgili anlatıcıya, yüz yüze ver.',
            'Bilgisayardan kalkarken çıkış yap ya da ekranı kilitle.',
            'admin.config.json dosyasını kimseyle paylaşma; knock sırası içinde.',
            'Etkinlikten sonra acil iznin kapalı olduğunu kontrol et: `./scripts/admin-acil.sh durum`.',
          ],
        },
      ],
    },
  ],
};
