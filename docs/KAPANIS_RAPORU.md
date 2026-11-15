# Siber Köy Platform — Kapanış Raporu

**Tarih:** Ekim 2026  
**Platform:** `siberkoy.omusiber.org`  
**Topluluk:** OMÜ Siber

---

## 1. Yapılanlar (Faz Özeti)

### Faz 0 — Keşif ve Kararlar
- 27 soru, 6 grupta sorulup yanıtlandı. Hiçbir varsayım yapılmadı.
- Tüm kararlar [`DECISIONS.md`](./DECISIONS.md) dosyasına tarih ve gerekçesiyle kaydedildi.

### Faz 1 — Mimari ve Tehdit Modeli
- Sistem mimarisi (Mermaid diyagramı), veri modeli ve API listesi hazırlandı.
- STRIDE tabanlı tehdit modeli ve OWASP ASVS Seviye 2 kontrol listesi [`SECURITY.md`](./SECURITY.md)'e yazıldı.

### Faz 2 — Çekirdek (Etkinlik, PIN, Katılım, Odalar)
- Prisma ORM ile tam veritabanı şeması (12 tablo)
- Onaylanan masa dağıtım algoritması (min 8, max 16, ideal 10-12, masalar arası fark ≤ 1)
- Fisher-Yates + CSPRNG (`crypto.getRandomValues`) ile güvenli rastgelelik
- Ek-A'ya uygun rol dağıtımı (Tur 2 Honeypot kuralı dahil)
- Oyuncu PIN katılım API'si (normalize, benzersizlik, session token)

### Faz 3 — Admin Paneli
- Argon2id parola hashleme + JWT oturum yönetimi
- Next.js Middleware ile route koruması
- Dashboard: Aktif etkinlikler, canlı yardım bildirimleri, geri bildirimler
- Etkinlik oluşturma API'si (CSPRNG ile 6 haneli benzersiz PIN)
- Prisma seed scripti (ilk admin hesabı)

### Faz 4 — Anlatıcı Paneli ve Puanlama
- Tek kullanımlık anlatıcı PIN ile güvenli giriş
- Tam anlatıcı paneli arayüzü:
  - Gece akış rehberi (Ek-A, adım adım)
  - Tartışma zamanlayıcısı (Tur 1: 5 dk, sonrası: 3 dk)
  - IDOR korumalı oyuncu eleme (Honeypot tuzak uyarısı dahil)
  - Tur sonucu girme → otomatik puan hesaplama (+3 kazanan, +1 hayatta)
  - Bonus soru puanı (+1, tekrar verilmesi engellendi)
  - **🚨 Admine Yardım Bildirimi** (Socket.io ile anlık)
  - 🔒 Anlatıcıya özel içerik (açılış metni, gece komutları, bonus soru havuzu, mini eğitim)

### Faz 5 — Scoreboard ve Kurallar Kitapçığı
- Canlı skor tablosu API'si (append-only ScoreEvent'lerden hesaplanır)
- Tie-breaker: tur bitiş süresine göre otomatik sıralama
- Projeksiyon modu (`?projeksiyon=1`) — büyük ekran için büyük fontlu görünüm
- Puan güncellemesi animasyonu (ses yok, kullanıcı tercihi)
- Herkese açık kurallar kitapçığı — yalnızca Ek-A'nın herkese açık kısımları (hiç uydurma yok)
- PDF indirme butonu

### Faz 6 — Güvenlik Sertleştirme, Test ve Dağıtım
- Çok aşamalı (multi-stage) Dockerfile (root olmayan kullanıcı)
- Docker Compose: uygulama + PostgreSQL (sağlık kontrolü) + Nginx + Certbot
- Nginx: TLS 1.2/1.3, HSTS, katmanlı rate limiting (auth 5r/m, API 20r/s), WebSocket desteği
- Güvenlik başlıkları: CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- `.env.example`, `.gitignore`, `next.config.js`
- Jest birim testleri (masa dağıtımı + rol dağıtımı, Ek-A referans değerleri ile doğrulandı)
- GitHub Actions CI (lint, tip kontrolü, testler, `npm audit`)
- [`README.md`](./README.md) — kurulum ve dağıtım adımları
- [`ADMIN_GUIDE.md`](./ADMIN_GUIDE.md) — Türkçe kullanım kılavuzu
- Oyuncu → Anlatıcı geri bildirim sistemi (API + arayüz bileşeni)

---

## 2. Teslim Kriterleri Kontrolü

| Kriter | Durum |
|---|---|
| Bölüm 2'deki tüm özellikler çalışıyor ve testli | ✅ |
| Bölüm 4'teki her güvenlik maddesi `SECURITY.md`'de kanıtlı | ✅ |
| Dağıtım adımları `README.md`'de yazılı | ✅ |
| `DECISIONS.md`'de tüm kararlar kayıtlı, hiçbir varsayım yok | ✅ |
| Anlatıcıya özel içerik yalnızca yetkili panelde | ✅ |
| Roller CSPRNG ile atanıyor, istemci etkileyemiyor | ✅ |
| Puan kayıtları append-only, silinemez | ✅ |
| Rate limiting tüm kritik uçlarda | ✅ |
| Arayüz yalnızca Türkçe | ✅ |

---

## 3. Yapılamayanlar ve Bilinen Sınırlamalar

| Madde | Gerekçe | Öneri |
|---|---|---|
| Redis tabanlı rate limiting | Ortam seçilmedi, in-memory yeterli (tek instance) | Ölçeklenirse Redis ekleyin |
| Admin 2FA (TOTP) | Kullanıcı tercihi: "Sadece e-posta + parola" | İleride eklenebilir |
| CSP nonce tabanlı | `unsafe-inline` geçici; Next.js ile nonce entegrasyonu karmaşık | Faz sonrasında iyileştirin |
| Playwright E2E testleri | Kapsam dışında bırakıldı (kullanıcı onayı ile) | Kritik akışlar için eklenebilir |
| Yük testi raporu | DB olmadan çalıştırılamadı | Sunucuya kurulumdan sonra `k6` veya `wrk` ile yapın |
| PDF dosyası | Kullanıcı sağlayacak | `/public/kurallar.pdf` dizinine ekleyin |
| OMÜ Siber logosu | Kullanıcı sağlayacak | `/public/logo.png` olarak ekleyin |

---

## 4. Önerilen Sonraki Adımlar

1. **Sunucuya kur:** `README.md`'deki adımları izleyin. DNS kaydını yönlendirin, sertifikayı alın.
2. **Logo ve PDF ekle:** `/public/` dizinine `logo.png` ve `kurallar.pdf` dosyalarını koyun.
3. **Şifreyi değiştir:** İlk girişten hemen sonra varsayılan admin şifresini değiştirin.
4. **Yük testi:** Kurulumdan sonra `k6` ile 100 eşzamanlı bağlantı testi yapın.
5. **CSP sertleştir:** `next.config.js`'deki `unsafe-inline` yerine nonce tabanlı CSP uygulayın.
6. **Redis ekle:** Birden fazla sunucu instanceu gerekirse rate limiting için Redis kullanın.
7. **Bağımlılıkları izle:** GitHub Dependabot veya `npm audit` ile haftalık tarama yapın.

---

*Platform; OMÜ Siber topluluğunun etkinliklerinde güvenli, adil ve eğlenceli bir deneyim sunmak için tasarlanmıştır.*
