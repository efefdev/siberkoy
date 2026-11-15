# Siber Köy — Ekran Görüntüleri

Tüm görüntüler gerçek: uygulama test ortamında üretim ayarlarıyla çalıştırıldı, 22 oyuncu ve 2 masa ile tam bir etkinlik (2 tur) baştan sona oynandı ve her ekran o anki gerçek durumuyla kaydedildi. Oyuncu ve anlatıcı ekranları telefon boyutunda (390×844), admin ekranları masaüstü boyutunda (1440×900), büyük ekran 1920×1080. Adı `tam-sayfa` olan ya da uzun görünenler sayfanın tamamıdır.

## 1-oyuncu — Oyuncunun telefonu

| Dosya | Ne görünüyor |
|---|---|
| 01-ana-sayfa-katilim | QR ile açılan ilk ekran: etkinlik PIN'i ve takma ad |
| 02-hatali-pin | Yanlış PIN girilince uyarı |
| 03-cihaz-kodu-formu | "Telefon değiştirdim" ile açılan cihaz kodu alanı |
| 04-lobi-bekleme | Katıldıktan sonra tur başlayana kadar lobi |
| 05-katilim-kapali-uyarisi | Admin katılımı kapatınca yeni gelen oyuncunun gördüğü |
| 06-masa-atandi-kart-kapali | Tur başlayınca: masa numarası ve mühürlü rol kartı |
| 07-rol-saldirgan | Rol kartı açık: Saldırgan |
| 08-rol-kullanici | Rol kartı açık: Kullanıcı |
| 09-rol-soc-analisti | Rol kartı açık: SOC Analisti |
| 10-rol-yama-uzmani | Rol kartı açık: Yama Uzmanı |
| 10b-rol-honeypot | Rol kartı açık: Honeypot (2. turdan itibaren, 10+ kişilik masada) |
| 11-elendin | Anlatıcı oyuncuyu eleyince telefonundaki durum |
| 12-elendin-kart-acik | Elenen oyuncu kartını açınca (izleyici modu) |
| 13-masa-bitti | Masa sonucu girildikten sonra oyuncunun ekranı |
| 14-yeni-telefonda-cihaz-kodu | Admin'in verdiği kodun yeni telefona girilmesi |
| 15-yeni-telefonda-devam | Kod sonrası aynı masa ve rolle devam |
| 16-eski-telefon-oturum-tasindi | Eski telefonda "Oturum taşındı" |
| 17-banlandi | Banlanan oyuncunun ekranı |
| 18-cikarildi | Etkinlikten çıkarılan oyuncunun ekranı |
| 19-skor-tablosu-telefonda | Skor tablosu (telefon) |
| 20-oyun-bitti-anlaticiyi-puanla | Etkinlik bitince: son anlatıcıyı puanlama kartı |
| 21-puan-ve-not | Yıldız ve isteğe bağlı not doldurulmuş hâli |
| 22-geri-bildirim-gonderildi | Gönderildi onayı |
| 23-rehber-oyuncu | Oyuncu rehberi (tam sayfa) |
| 24-kurallar | Kurallar sayfası (tam sayfa) |
| 25-yazdirilabilir-a5-kart | Masalara konacak QR'lı A5 oyuncu kartı |

## 2-anlatici — Anlatıcının telefonu

| Dosya | Ne görünüyor |
|---|---|
| 01-giris | Masaya özel PIN ile giriş |
| 02-tur-bekleniyor | Giriş sonrası, tur başlamadan |
| 03-panel-gunduz | Tur başlayınca panelin üstü: tartışma sayacı, savunma sayacı |
| 04-panel-tam-sayfa | Panelin tamamı: oyuncular ve rolleri, sonuç, bonus, yardım |
| 05-gece-1-akisi | "Geceye geç": 1. gece adımları (saldırganlar tanışır) |
| 06-gece-adim-secildi | Bir gece adımına dokununca okunacak metin |
| 07-tartisma-ve-savunma-sayaci | Tartışma ve 30 sn savunma sayacı çalışırken |
| 08-eleme-onayi | "Ele"ye ilk dokunuş: "Emin misin?" |
| 09-geri-al | Eleme sonrası 10 sn "Geri al" şeridi |
| 10-yardim-bildirimi-gonderildi | Admine yardım bildirimi gönderildi |
| 11-masa-sonucu-secildi | Kazanan taraf seçildi, kaydet düğmesi |
| 12-sonuc-kaydedildi-bonus-onayi | Sonuç kaydedildi; bonus için onay adımı |
| 13-bonus-verildi-ozel-icerik | Bonus verildi; anlatıcıya özel içerik açık (tam sayfa) |
| 14-honeypot-tetiklendi | 2. turda Honeypot elenince çıkan uyarı |
| 15-rehber-anlatici | Anlatıcı rehberi (tam sayfa) |
| 16-yazdirilabilir-a5-kart | Anlatıcıya verilecek A5 kart |

## 3-admin — Yerel admin uygulaması (localhost:4400)

| Dosya | Ne görünüyor |
|---|---|
| 01-giris | E-posta ve şifre ile giriş |
| 02-etkinlikler-ve-yeni-etkinlik | Etkinlik listesi ve yeni etkinlik formu |
| 03-konsol-bos-lobi | Yeni etkinliğin konsolu, büyük katılım PIN'i |
| 04-konsol-oyuncular-geldi | 22 oyuncu katıldı, kaç masa gerektiği (tam sayfa) |
| 05-anlatici-pinleri-uretildi | Masa 1 ve 2 için anlatıcı PIN'leri |
| 06-anlaticilar-hazir | Anlatıcılar giriş yaptı |
| 07-tur-1-basladi | Tur başladı: masalar, oyuncuların masaları |
| 08-katilim-kapali | Katılım kapatıldı |
| 09-yardim-bildirimi-geldi | Anlatıcıdan gelen yardım bildirimi |
| 10-elenenler-dirilt | Süren masada elenenler ve "dirilt" |
| 11-tur-1-tamamlandi | İki masa da sonucu girdi |
| 12-masa-sonucunu-duzelt | Bitmiş masanın sonucunu düzeltme formu |
| 13-cihaz-kodu-uretildi | Telefon değiştiren oyuncu için cihaz kodu |
| 14-ban-onayi | Ban onayı |
| 15-tur-2-basladi | 2. tur (masalar karıştırıldı) |
| 16-etkinligi-bitir-onayi | "Etkinliği bitir" onayı |
| 17-etkinlik-bitti | Etkinlik bitti |
| 18-admin-rehberi | Admin rehberi (tam sayfa) |
| 90-yerel-anahtar-yok-uyarisi | Panel terminaldeki bağlantı dışında açılırsa |

## 4-buyuk-ekran — Projeksiyon

| Dosya | Ne görünüyor |
|---|---|
| 01-projeksiyon-tur-1-sonrasi | 1. tur sonrası canlı skor tablosu |
| 02-projeksiyon-final | Etkinlik bitince final tablosu |
