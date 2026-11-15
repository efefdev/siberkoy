# Güvenlik ve Tehdit Modeli (SECURITY.md)

Siber Köy platformu, OWASP Top 10 ve **OWASP ASVS Seviye 2** standartları gözetilerek tasarlanmıştır.

---

## 1. Varlıklar (Assets)

| Seviye | Varlık |
|---|---|
| **Kritik** | Admin parola hashleri, Anlatıcı PIN'leri, JWT imzalama anahtarı |
| **Yüksek** | Oyuncu rolleri (gizli kalmalı), Puan kayıtları, Audit log'lar, Oturum token'ları |
| **Orta** | Oyuncu takma adları, IP adresleri (7 gün tutulur) |

---

## 2. Saldırgan Profilleri

| Profil | Hedef | Beceri |
|---|---|---|
| Kötü Niyetli Ziyaretçi | PIN tahmin, DoS, scoreboard manipülasyonu | Orta |
| Hilekar Oyuncu | Başkasının rolünü görme, sahte puan | Düşük-Orta |
| Ağ Dinleyicisi | Token/cookie çalma (aynı Wi-Fi) | Orta |
| İç Tehdit (Admin) | Puan hilesi, log silme | Yüksek |

---

## 3. STRIDE Tehdit Modeli

### S — Spoofing (Kimlik Sahtekarlığı)
| Tehdit | Önlem | Nerede |
|---|---|---|
| Başka oyuncunun adını alma | `@@unique([eventId, username])` + atomik upsert | `schema.prisma` |
| Sahte admin oturumu | Argon2id parola hash, JWT (HS256, 12h TTL), HttpOnly cookie | `auth.ts`, `login/route.ts` |
| Sahte anlatıcı erişimi | Tek kullanımlık PIN (ilk girişte atomik kilit), 8 saat ömür, IP başına 10 hatada 15 dk kilit; oturum imzalı JWT + her istekte PIN'in hâlâ aktif olduğu DB kontrolü | `narrator/login/route.ts`, `lib/auth.ts` |

### T — Tampering (Veri Değiştirme)
| Tehdit | Önlem | Nerede |
|---|---|---|
| Puan manipülasyonu | Append-only `ScoreEvent`; masa sonucu atomik ACTIVE→COMPLETED geçişiyle bir kez girilir; düzeltme yalnızca admin, ters kayıtla | `scores/route.ts`, `admin/scores/adjust/route.ts` |
| Rol değiştirme | Rol ataması tamamen sunucu tarafında, CSPRNG ile | `role-allocator.ts` |
| API parametresi enjeksiyonu | Zod şema doğrulaması tüm uç noktalarda | Her `route.ts` |
| SQL Injection | Prisma ORM, parametreli sorgular | Tüm DB erişimleri |

### R — Repudiation (İnkâr Edilebilirlik)
| Tehdit | Önlem | Nerede |
|---|---|---|
| "Ben yapmadım" | Değiştirilemez `AuditLog` tablosu: actorId, actorType, ip, timestamp | Tüm kritik işlemler |
| Puan düzeltme inkârı | ScoreEvent'lerin tümü `createdBy` ve timestamp ile saklanır | `schema.prisma` |

### I — Information Disclosure (Bilgi İfşası)
| Tehdit | Önlem | Nerede |
|---|---|---|
| Rol sızdırma | Roller yalnızca oturumu doğrulanmış anlatıcının kendi masası için okunur; eleme olayı yalnızca anlatıcı/admin socket odasına yayınlanır ve rol taşımaz | `narrator/page.tsx`, `eliminate/route.ts` |
| Ağ dinleme | TLS 1.2/1.3 zorunlu, HTTP → HTTPS yönlendirme | `nginx/conf.d/siberkoy.conf` |
| Hata mesajlarından bilgi sızdırma | Kullanıcıya yalnızca genel hata mesajı; iç hata sadece sunucu log'unda | Tüm `catch` blokları |
| Admin içeriği ziyaretçiye sızma | Next.js Middleware ile route koruması, JWT doğrulama | `middleware.ts` |

### D — Denial of Service (Hizmet Aksatması)
| Tehdit | Önlem | Nerede |
|---|---|---|
| Parola/PIN kaba kuvvet | Admin: IP başına 5 hatada 5 dk + hesap başına 20 hatada 15 dk; anlatıcı: IP başına 10 hatada 15 dk (bellek içi). IP, Nginx'in yazdığı `X-Real-IP`'den alınır | `lib/rate-limit.ts` |
| API flood | Nginx: admin/anlatıcı girişi 10r/dk, oyuncu katılımı 120r/dk (ortak kampüs Wi-Fi), genel API 50r/s | `nginx/conf.d/siberkoy.conf` |
| Büyük payload | `client_max_body_size 1m` (Nginx) | `nginx.conf` |
| WebSocket flood / yetkisiz dinleme | Origin kontrolü, çerezle kimlik doğrulama, sunucunun atadığı odalar, 10 KB mesaj sınırı, IP başına 300 bağlantı, token süresi dolunca bağlantı kesilir | `server/socket.js`, Nginx |

### E — Elevation of Privilege (Yetki Yükseltme)
| Tehdit | Önlem | Nerede |
|---|---|---|
| IDOR: Başka odaya erişim | Her uç noktada nesne bazlı yetki kontrolü — anlatıcı yalnızca kendi odasına erişir | `eliminate/route.ts`, `scores/route.ts` |
| Admin paneline dışarıdan erişim | Admin API'si internete kapalı: Nginx 404 döner, uygulama Nginx'ten `public` işaretiyle gelen admin isteklerini ayrıca reddeder. Erişim yalnızca port knocking + SSH tüneli (ya da süreli, tek IP'lik acil izin) ile | `nginx/conf.d/siberkoy.conf`, `src/middleware.ts`, `scripts/admin-acil.sh` |
| Yerel paneli kötüye kullanma (CSRF / DNS rebinding) | Yerel sunucu yalnızca 127.0.0.1'i dinler; Host yalnızca localhost; POST ve WebSocket'te yerel Origin zorunlu; yalnızca admin API ve socket.io aktarılır | `admin-app/server/guard.mjs` |
| Oyuncu → Admin yetki atlama | Middleware + her API'de ayrı yetki kontrolü; token'larda tür/audience ayrımı (anlatıcı token'ı admin yerine geçmez); Next.js 15.5.27 (CVE-2025-29927 kapalı) | `middleware.ts`, `lib/tokens.ts` |

---

## 4. OWASP ASVS Seviye 2 Kontrol Listesi

### V2 — Kimlik Doğrulama
- [x] V2.1 — Parolalar Argon2id ile hashlenip saklanıyor (`argon2` kütüphanesi)
- [x] V2.4 — Zamanlama saldırısı önlemi: hatalı e-postada sahte hash doğrulaması yapılıyor
- [x] V2.6 — Rate limiting: 5 başarısız denemede 5 dk kilitleme
- [x] V2.7 — Hesap numaralandırma önlemi: tüm hatalara aynı mesaj döndürülüyor ("E-posta veya şifre hatalı")

### V3 — Oturum Yönetimi
- [x] V3.2 — Oturum token'ları yeterli entropi ile üretiliyor (`crypto.randomBytes(32)`); oyuncu token'ı DB'de yalnızca SHA-256 özeti olarak saklanıyor
- [x] V3.4 — Çerezler HttpOnly, Secure, SameSite=Lax olarak ayarlandı
- [x] V3.5 — Çıkışta çerez tamamen geçersiz kılınıyor (maxAge=0)
- [x] V3.7 — Oturum sabitleme koruması: giriş sonrası yeni token üretiliyor

### V4 — Erişim Denetimi
- [x] V4.1 — Her uç noktada sunucu tarafı RBAC kontrolü mevcut
- [x] V4.2 — IDOR koruması: anlatıcı yalnızca `narratorPinId` ile eşleşen odasına erişebilir
- [x] V4.3 — Admin rotaları Middleware ile korunuyor; istemci tarafı gizleme güvenlik sayılmıyor

### V5 — Doğrulama, Sanitizasyon ve Kodlama
- [x] V5.1 — Tüm girdiler Zod şemasıyla tip, uzunluk ve biçim olarak doğrulanıyor
- [x] V5.2 — Parametreli sorgular (Prisma ORM); SQL injection imkânsız
- [x] V5.3 — Kullanıcı adı normalize ediliyor (trim, length limit)
- [x] V5.4 — XSS koruması: React/Next.js güvenli render (dangerouslySetInnerHTML kullanılmıyor)

### V7 — Hata İşleme ve Loglama
- [x] V7.1 — Hata mesajları kullanıcıya iç detay sızdırmıyor
- [x] V7.2 — Tüm kritik işlemler AuditLog tablosuna yazılıyor
- [x] V7.4 — Loglar kişisel veri içermiyor (yalnızca actorId, action, ip); IP 7 gün sonra silinecek

### V8 — Veri Koruma
- [x] V8.1 — Kişisel veri toplanmıyor (yalnızca takma ad)
- [x] V8.2 — Gizli veriler (roller, admin içeriği) API yanıtlarına asla eklenmez
- [x] V8.3 — Ortam değişkenleri `.env` ile yönetiliyor, `.gitignore`'a eklendi

### V9 — İletişim
- [x] V9.1 — TLS 1.2/1.3 zorunlu; zayıf cipher'lar devre dışı
- [x] V9.2 — HSTS başlığı etkin (`max-age=63072000; includeSubDomains; preload`)
- [x] V9.3 — HTTP → HTTPS yönlendirme Nginx'te yapılandırıldı

### V14 — Yapılandırma
- [x] V14.1 — Güvenlik başlıkları: CSP, X-Frame-Options (DENY), X-Content-Type-Options (nosniff), Referrer-Policy, Permissions-Policy
- [x] V14.2 — Docker imajı root olmayan kullanıcıyla çalışıyor (`nextjs` kullanıcısı)
- [x] V14.2a — Konteyner izolasyonu: salt okunur dosya sistemi, `cap_drop: ALL` (yalnızca gereken yetkiler geri eklenir), `no-new-privileges`, CPU/RAM/PID sınırları
- [x] V14.2b — Ağ ayrımı: uygulama ve veritabanı internete çıkışı olmayan iç ağlarda (`internal: true`); internete yalnızca Nginx ve Certbot çıkar
- [x] V14.3 — Nginx versiyon bilgisi gizleniyor (`server_tokens off`)
- [x] V14.4 — Veritabanı ve uygulama portları dışarıya açılmıyor; tek iç giriş Nginx'in yalnızca `127.0.0.1:3000`'e yayınlanan tünel portu

---

## 4b. Denetim Sonrası Ek Kontroller (2026-10-12)

| Kontrol | Uygulama |
|---|---|
| Admin kapısı fail-closed | Üretimde `X-Siberkoy-Via` yalnızca `tunnel`/`admin-emergency` (src/lib/admin-via.ts, server/socket.js) |
| Acil durumda hesap kilitleme saldırısı | Hesap kilidi yalnızca acil yolu etkiler; tünel her zaman açık |
| Çerez ezme (alt alan adı / HTTP) | Üretimde `__Host-` önekli çerezler |
| Yerel admin çerezinin localhost'taki başka uygulamaya sızması | Çerez yerel sunucu belleğinde; tarayıcı yalnızca açılışa özel anahtar taşır |
| Cihaz değiştirme kodu tahmini | 31^8 alan, 10 dk ömür, tek kullanım, DB'de SHA-256 özeti, IP başına 40 hata |
| Lobi taşkını | Admin katılımı kapatabilir |
| Socket kimlik sorgusu seli | IP başına dakikada 300 başarısız sorgudan sonra 1 dk DB sorgusu yok |

## 5. Bilinen Sınırlamalar ve Önerilen Sonraki Adımlar

| Sınırlama | Risk | Öneri |
|---|---|---|
| Başarısız deneme sayaçları bellek içi | Birden fazla uygulama örneği çalışırsa paylaşılmaz; yeniden başlatmada sıfırlanır | Ölçeklenirse Redis'e taşıyın |
| Ortak Wi-Fi'de IP bazlı kilit | Aynı ağdaki bir saldırgan yanlış PIN denemeleriyle o ağdaki anlatıcıları 15 dk kilitleyebilir | Anlatıcılar gerekirse mobil veriyle girsin; admin yeni PIN üretebilir |
| Oturumlar sunucudan iptal edilemiyor | Admin çıkış yapsa da JWT 12 saat geçerli; açık socket bağlantısı kimliği yalnızca bağlanırken kontrol eder | DB'de oturum sürümü tutun; PIN iptalinde `disconnectSockets()` çağırın (2. aşama) |
| 2FA yok, ama admin erişimi SSH (şifre + port knocking) arkasında | SSH şifresi ve admin şifresi birlikte çalınırsa tam erişim | SSH'de anahtarla girişe geçin; ileride TOTP eklenebilir |
| SSH şifreyle kullanılıyor (karar: kullanıcı tercihi) | Şifre tahmini knock arkasında ama mümkün | Anahtar + parola, `PasswordAuthentication no`, fail2ban |
| Acil durum izni açıkken admin API'si o IP'ye açık | Kampüs NAT'ında aynı IP'yi paylaşan herkes giriş sayfasına ulaşabilir (şifre + kilit korur) | Süreyi kısa tutun, işiniz bitince `admin-acil.sh kapat` |
| CSP `unsafe-inline` içeriyor | XSS riskini tam kapatmıyor | Nonce tabanlı CSP'ye geçin |
| Loglarda IP adresi düz metin, 7 günlük silme işi henüz yok | Gizlilik | Zamanlanmış temizleme işi ekleyin |
| AuditLog DB seviyesinde değiştirilemez değil | DB erişimi olan biri kayıt silebilir | Ayrı DB rolü + UPDATE/DELETE yasaklayan trigger |
| Geliştirme bağımlılıklarında (jest, tailwind) `npm audit` bulguları | Kullanıcıya ulaşan koda girmez | Üst sürümler çıktıkça güncelleyin; CI yalnızca üretim bağımlılıklarını engeller |

## 6. Bağımlılık Güvenliği

```bash
# Bilinen güvenlik açıklarını tara
npm audit

# CI'da otomatik çalışır (.github/workflows/ci.yml) — yalnızca üretim bağımlılıkları
npm audit --omit=dev --audit-level=high
```

Tüm bağımlılıklar `package-lock.json` ile sürüm sabitlenmiştir.
