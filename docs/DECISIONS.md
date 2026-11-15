# OMÜ Siber - Siber Köy: Veri Vampirleri (Karar Kaydı)

Bu dosya, projenin geliştirilmesi süresince alınan tüm teknik ve iş mantığı kararlarını içerir. Tüm kararlar 2026-10-09 tarihinde kullanıcı ile mutabık kalınarak alınmıştır ve hiçbir varsayım yapılmamıştır.

## Altyapı ve Barındırma
- **Alan Adı:** `siberkoy.omusiber.org` (DNS yönetimi ve yönlendirme kullanıcı tarafından yapılacaktır).
- **Barındırma Modeli:** Proje tamamen Dockerize edilerek (docker-compose) teslim edilecek, sunucu kurulumu ve barındırma kullanıcı sorumluluğunda olacaktır.
- **TLS ve Proxy:** Nginx + Let's Encrypt (Certbot) kullanılacaktır.
- **Ölçek:** Etkinlik başına maksimum 100 eşzamanlı bağlantı ve ayda 1-2 etkinlik hedefiyle optimize edilecektir.

## Teknoloji Yığını (Stack)
- **Framework:** Next.js (Frontend) + Node.js Özel Sunucu (Backend)
- **Veritabanı:** PostgreSQL
- **Gerçek Zamanlı İletişim:** Socket.io
- **CI/CD ve Test:** GitHub Actions ile CI akışı, Jest ile kritik güvenlik ve mantık testleri.
- **Dil:** Arayüz yalnızca Türkçe olacaktır.
- **Tema:** Yalnızca Koyu (Dark) Tema kullanılacaktır.

## Oyun Mantığı
- **Rol Kartları:** Tamamen dijital olacaktır. Sistem rolleri rastgele atayacak, her oyuncu kendi rolünü telefonundan (arayüzden) gizlice görecektir.
- **Tur Yönetimi:** Tur sayısı esnek olacak; admin etkinlik sırasında manuel olarak tur ekleyip çıkarabilecektir.
- **Masa Dağıtımı:** Katılımcı sayısına göre otomatik hesaplanacaktır (Kural kitapçığındaki referans tabloya uygun).
- **Yeniden Karıştırma (Shuffle):** Turlar arası dağıtımda eski masa arkadaşlarını ayırmak için best-effort (elinden geleni yap) algoritması çalışacak, ancak tıkanıklığı önlemek için kesin bir kısıt olmayacaktır.
- **Kural Kısıtlamaları:** Sistem oyun kurallarını katı bir şekilde kısıtlayacaktır (Örn: Tur 2'den önce Honeypot rolü eklenemez).
- **Tie-Breaker (Eşitlik Bozma):** Scoreboard'da puan eşitliği olması durumunda sistem arka planda turların süresini (başlama ve bitirme/saldırganı bulma) takip edecektir. Görevini/turu daha hızlı tamamlayan takım-oyuncu sıralamada üste çıkacaktır. Anlatıcının kronometre tutmasına gerek kalmayacaktır.

## Kimlik Doğrulama ve Güvenlik
- **Yeniden Bağlanma:** Oyuncu düşerse, tarayıcısındaki güvenli çerez/token (JWT veya session id) ile otomatik tanınarak oyuna kaldığı yerden devam edecektir.
- **Admin Girişi:** Sadece E-posta + Güçlü Parola ile sağlanacaktır (2FA kullanılmayacaktır).
- **Anlatıcı Girişi:** Hesap açılmayacaktır. Etkinliğe özel, tek kullanımlık/geçici "Anlatıcı PIN'i" üretilip bu PIN ile giriş yapılacaktır.
- **Etkinlik PIN'i:** Oyuncuların katılımı için 6 haneli, sadece rakamlardan oluşan bir PIN kullanılacaktır.
- **Kişisel Veriler:** Oyunculardan yalnızca "Kullanıcı Adı" (Takma ad) alınacaktır. KVKK aydınlatma metnine ihtiyaç duyulmayacaktır.
- **Veri Saklama:** Etkinlik bittikten 30 gün sonra oyuncu verileri anonimleştirilecek veya tamamen silinecektir.
- **Bot/Spam Koruması:** CAPTCHA kullanılmayacaktır. IP/Cihaz bazlı katı Rate Limiting uygulanacaktır.
- **Küfür Filtresi:** Otomatik bir filtre uygulanmayacaktır. Anlatıcı/Admin manuel olarak uygunsuz isimleri görüp "Kick/Ban" işlemi yapacaktır.
- **Loglama:** Denetim ve güvenlik günlüklerinde IP adresleri tutulacak, ancak gizlilik gereği 7 gün sonra otomatik olarak silinecektir.

## Arayüz ve Sunum
- **Scoreboard:** Tur sonuçlandığında veya puan eklendiğinde ses olmadan ufak görsel animasyonlar (kupa, parlama vb.) gösterilecektir.
- **Kurallar Kitapçığı:** Metinler mobil uyumlu HTML olarak okunabilir şekilde sunulacak, ayrıca sayfanın altına "PDF İndir" butonu eklenecektir (PDF dosyası repoya sonradan yüklenecektir).
- **Erişilebilirlik:** Temel kontrast, okunabilirlik ve mobil uyum sağlanacak; sıkı WCAG 2.1 AA sertifikasyonuna yönelik ekstra işlem yapılmayacaktır.

## 2026-10-12 — Kurulum ve Güvenlik Düzeltmeleri

Proje incelemesinin ardından kullanıcı ile mutabık kalınan kararlar:

- **Next.js sürümü:** 14 serisi artık yama almadığı için 15.5.27'ye geçildi (React 19.2). Kullanılmayan `lucide-react` kaldırıldı.
- **Anlatıcı oturumu:** Admin ile aynı desende imzalı JWT çerezi (8 saat). Her istekte PIN'in aktif, süresinin dolmamış ve etkinliğin bitmemiş olduğu veritabanından kontrol edilir.
- **Anlatıcı PIN'i:** İlk başarılı girişte kilitlenir; başka cihazdan tekrar kullanılamaz. Cihaz kapanırsa admin yeni PIN üretip masayı devreder.
- **Puan düzeltme:** Anlatıcı masa sonucunu bir kez girer. Düzeltmeyi yalnızca admin yapar; eski kayıt silinmez, gerekçeli ters işaretli `ADJUSTMENT` kaydı eklenir. Bu aşamada yalnızca API var, panel butonu 2. aşamada.
- **İlk admin:** `ADMIN_EMAIL` ve `ADMIN_INITIAL_PASSWORD` (en az 12 karakter) seed komutuna ortam değişkeni olarak anlık verilir, kalıcı olarak saklanmaz; koddaki varsayılan şifre kaldırıldı.
- **Şema:** Masa bazında durum/başlangıç/bitiş/kazanan/bonus alanları; PIN'e `usedAt`; oyuncu adı için büyük/küçük harf duyarsız eşsizlik (`usernameKey`); oyuncu oturum token'ı yalnızca SHA-256 özeti olarak saklanır.
- **Migration:** Prisma motor sunucusuna erişilemediği için ilk migration SQL'i elle yazıldı ve gerçek PostgreSQL üzerinde doğrulandı; kullanıcı kendi bilgisayarında `prisma migrate diff` ile kontrol edecek.
- **Alan adı:** `siberkoy.omusiber.org`; CSP, Socket.io CORS ve Origin kontrolü bu adrese kilitli.
- **Geç katılım:** Etkinlik başladıktan sonra da katılım açık; yeni oyuncu lobide bekler, sonraki turda dağıtılır.
- **Ağ:** Oyuncular ortak kampüs Wi-Fi'sinden (tek IP) bağlanacak. Oyuncu katılım limiti IP başına 120/dk; admin/anlatıcı girişi sıkı.
- **Kilit:** Admin için IP + hesap bazlı (5 hata/5 dk ve 20 hata/15 dk), anlatıcı PIN için IP bazlı (10 hata/15 dk).

## 2026-10-12 — Oyun Akışı ve Tema

- **Tema:** "Kanlı terminal" düzeninin **Gece moru (D)** renk varyasyonu: lacivert-mor zemin (`#0a0a16`), mor gotik başlıklar (Pirata One, `#8b5cf6`), camgöbeği terminal yazısı (Share Tech Mono, `#22d3ee`), kan kırmızısı yalnızca saldırgan/tehlike için (`#f43f5e`). Fontlar sunucudan servis edilir (harici CDN yok).
- **Animasyon:** Ölçülü — rol kartı çevrilmesi, yazılan terminal satırları, kısa vurgular. "Hareketi azalt" tercihine uyulur.
- **Anlatıcı–masa:** Sabit masa. Admin her PIN'i bir masa numarasına üretir; anlatıcı tüm turlarda aynı masada kalır.
- **Eksik anlatıcı:** Gereken her masanın giriş yapmış anlatıcısı yoksa tur başlamaz; admin eksik masaları görür.
- **Anlatıcı devri:** Aynı masaya yeni PIN üretmek eski PIN'i iptal eder, eski cihazın bağlantısını keser ve süren masayı yeni PIN'e devreder.
- **Saldırganlar:** Telefonda yalnızca kendi rollerini görür; birbirlerini Gece 1'de fiziksel olarak tanırlar.
- **Rol kartı:** Varsayılan kapalı, dokununca açılır, 8 saniye sonra kendiliğinden kapanır.
- **Oyuncu yönetimi:** Çıkar (oturum kapanır, yeniden katılabilir), ban (aynı tarayıcıdan bu etkinliğe katılamaz), ad değiştir.
- **Gece 1 adımı:** "Saldırganlar birbirini tanısın" adımı her turun ilk gecesinde gösterilir (önceden yalnızca 1. turda gösteriliyordu; roller her turda değiştiği için hataydı).
- **Masa ayırma:** Önceki turun masa arkadaşları 300 rastgele denemeden en az tekrar içerenle ayrılır (best-effort, kesin kısıt değil).

## 2026-10-12 — Yerel Admin Paneli

- **Mimari:** Admin paneli sunucudan kaldırıldı; repodaki `admin-app/` klasöründe, admin bilgisayarında tarayıcıda açılan yerel bir web uygulaması (Vite + React). Sunucu imajına girmez.
- **Bağlantı:** Uygulama SSH tüneliyle sunucunun `127.0.0.1:3000` portuna bağlanır. Admin API'si internete kapalı (Nginx 404 + uygulama içi ikinci kontrol).
- **SSH:** Şifreyle giriş (kullanıcı tercihi); şifre terminalde sorulur, uygulama görmez/saklamaz. Tünel koparsa yeniden bağlanır ve şifreyi tekrar sorar.
- **Port knocking:** Uygulama yapar; dizi yalnızca admin bilgisayarındaki `admin-app/admin.config.json` dosyasında (Git'e girmez).
- **Giriş:** Tünele ek olarak e-posta + şifre (iki katman).
- **Eski /admin:** Tamamen kaldırıldı; dışarıdan 404.
- **Yedek plan:** `scripts/admin-acil.sh ac <IP> <dakika>` admin API'sini yalnızca tek IP'ye, en fazla 240 dk açar; süre dolunca veya Nginx yeniden başlayınca kapanır; her işlem loglanır.
- **Platform:** Yalnızca macOS için belgelenip test edilecek.

## 2026-10-12 — Docker İzolasyonu

- Tüm servisler `no-new-privileges` ve `cap_drop: ALL` ile çalışır; yalnızca gerekenler geri eklenir (Postgres ve Nginx'in kullanıcı değiştirme yetkileri, Nginx'in 80/443 dinleme yetkisi).
- Uygulama, veritabanı ve Nginx salt okunur dosya sistemiyle çalışır; yazılması gereken yerler bellek içi (`tmpfs`).
- Ağlar: `public` (Nginx, Certbot) — `edge` iç ağ (Nginx ↔ uygulama) — `data` iç ağ (uygulama ↔ DB). Uygulama ve DB internete çıkamaz.
- SSH tüneli artık doğrudan uygulamaya değil, Nginx'in yalnızca sunucu içine (`127.0.0.1:3000`) yayınlanan tünel girişine bağlanır (`nginx/conf.d/tunnel.conf`); bu girişten yalnızca admin API'si ve socket.io geçer.
- Kaynak sınırları: uygulama 768 MB / 1,5 CPU, DB 512 MB / 1 CPU, Nginx 256 MB / 0,5 CPU.

## 2026-10-12 — Tam Sistem Denetimi Kararları

Gerçek PostgreSQL + üretim modundaki sunucu üzerinde uçtan uca testlerle (63 senaryo + socket testleri) bulunan sorunlar ve kullanıcı kararları:

**Oyun akışı**
- Masası süren bir tur varken etkinlik bitirilemez (409 + bekleyen masa numaraları).
- Skor tablosu: banlananlar gizli, atılanlar puanlarıyla görünür, hiç puanı olmayanlar da listede. Başlık ve durum API'den gelir (sabit başlık ve ölü "donduruldu" kodu kaldırıldı).
- Eşitlik: önce daha çok masa bitiren (tur), sonra ortalama masa süresi kısa olan üstte (toplam süre yerine).
- Test modu: en az 4 kişi; 7 kişiye kadar 1 saldırgan. 0 oyuncuyla tur başlayabiliyordu (hata) — her durumda engellendi.
- Bonus: masa başına 1, oyun sırasında ya da sonuç girildikten sonra; tüm masa oyuncuları seçilebilir, onay adımı var.
- Anlatıcı geri bildirimi: oyuncu yalnızca EN SON oynadığı masanın anlatıcısını puanlar (yıldız + isteğe bağlı not), tek kart. Sunucu da yalnızca bu hedefi ve etkinlik bittikten sonra kabul eder.

**Yeni araçlar**
- Cihaz değiştirme kodu: admin oyuncu için 8 karakterlik, 10 dk geçerli, tek kullanımlık kod üretir (DB'de özeti). Oyuncu ana sayfada girer; aynı kayda (puan/masa/rol) bağlanır, eski telefonun oturumu düşer. Hatalı denemeler IP başına sınırlı.
- Masa sonucunu düzelt: admin bitmiş masada doğru tarafı ve hayatta kalanları seçer; sistem her oyuncu için mevcut sonuç puanı ile olması gereken arasındaki farkı ADJUSTMENT kaydı olarak yazar (append-only, bonus korunur, tekrar çalıştırmak fark üretmez).
- Eleme: iki aşamalı düğme + 10 sn "geri al" (sunucu 15 sn tolere eder). Sonrası için admin "dirilt" (yalnızca süren masada).
- Savunma (son söz) için 30 sn sayaç; sayaçlar bitiş zamanına göre çalışır (sekme arka plana düşse de kaymaz).
- Katılımı kapat/aç: kapalıyken yeni oyuncu giremez; yeniden bağlanma ve cihaz kodu çalışır.

**Güvenlik**
- Admin kapısı üretimde fail-closed: `X-Siberkoy-Via` yalnızca `tunnel` / `admin-emergency` ise geçer (middleware + socket). Nginx'siz yanlış yayında admin API'si 404 döner.
- Admin hesap kilidi yalnızca acil (açık IP) yolundan gelen denemeleri sayar ve yalnızca o yolu kilitler; SSH tünelinden giriş her zaman mümkün.
- Anlatıcı PIN kilidi IP başına 40 hataya çıkarıldı (ortak Wi-Fi); admin "giriş kilitlerini temizle" ile sıfırlayabilir. Sınırlayıcılar süreç genelinde tek örnek (globalThis).
- Çerezler üretimde `__Host-` önekli (Secure, Domain'siz, Path=/).
- Socket.io: aynı IP'den dakikada 300 başarısız kimlik sorgusundan sonra o IP'nin çerezleri bir dakika DB'ye sorulmaz.
- Yerel admin uygulaması: admin oturum çerezi tarayıcıya verilmez, yerel sunucunun belleğinde tutulur (tarayıcılar çerezleri porta göre ayırmaz). Tarayıcı her açılışta üretilen yerel anahtarı `X-Local-Token` başlığıyla (socket.io'da sorgu parametresiyle) gönderir.

**Altyapı**
- Node 24 LTS (Node 20 desteği Nisan 2026'da bitti). Nginx `1.28-alpine`, Certbot `v4.0.0` sabitlendi; Certbot `cap_drop: ALL`.
- Nginx `app` adını her istekte Docker DNS'inden çözer (değişkenli proxy_pass + resolver); uygulama konteyneri yeniden oluşturulunca 502 kalmaz.
- `admin-acil.sh`: otomatik kapatma betiğin mutlak yolunu kullanır; `allow.conf` konteyner içinden yazılır (root sahipliği sorunu yok).
- Seed şifresi komut satırında görünmez (`-e ADMIN_INITIAL_PASSWORD` değersiz geçilir).
- CI: Node 24, gerçek PostgreSQL'de migration + şema farkı kontrolü, Docker imajı derleme ve compose doğrulama.

## 2026-10-19 — Masa büyüklüğü 8-9 kişi, Honeypot (Avcı) kaldırıldı

- **İdeal masa 8-9 kişi** (önceden 10-12). Daha küçük masada herkes daha çok konuşur, oyun daha hızlı döner.
  Sınırlar değişmedi: en az 8, en fazla 16, masalar arası fark en fazla 1. Algoritma önce 9'u aşan masa
  olmayan dağılımı, sonra ortalaması 8,5'e en yakın olanı seçer. Örnek: 50 kişi → 6 masa (9, 9, 8, 8, 8, 8),
  yani 6 anlatıcı gerekir. 8-9'luk masaların kurulamadığı sayılarda (ör. 30 kişi → 3 × 10) büyük masa kalır.
- **Honeypot (Avcı) rolü kaldırıldı.** Roller artık her turda aynı tabloya göre dağıtılır: Hacker (Vampir),
  SOC Analisti (Gözcü), Yama Uzmanı (Doktor), Kullanıcı (Köylü). Eleme API'si "tuzak tetiklendi" bilgisini
  artık döndürmez. Eski turlarda kayıtlı `HONEYPOT` rolü raporlarda Kullanıcı olarak gösterilir.

