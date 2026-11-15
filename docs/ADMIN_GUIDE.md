# Kullanma Kılavuzları

Kılavuzlar tema uyumlu sayfalar ve yazdırılabilir PDF'ler olarak hazırlandı. İçerik tek kaynaktan üretilir;
bir şeyi değiştirmek için aşağıdaki dosyayı düzenleyip PDF'leri yeniden üretin.

| Kılavuz | Nerede okunur | PDF | İçerik kaynağı |
|---|---|---|---|
| **Oyuncu** | Sitede `/rehber` (QR kart) | `public/kilavuz/oyuncu.pdf` (A5, 2 sayfa) | `src/lib/guides.ts` |
| **Anlatıcı** | Sitede `/rehber?bolum=anlatici` | `public/kilavuz/anlatici.pdf` (A5, 2 sayfa) | `src/lib/guides.ts` |
| **Admin** | Yerel panelde `[ rehber ]` (`#/rehber`) — tünel kapalıyken de açılır | `admin-app/public/kilavuz-admin.pdf` (A4, 4 sayfa) | `admin-app/src/guide.ts` |

> Admin kılavuzu tünel, sunucu ve acil durum ayrıntıları içerdiği için **herkese açık sitede yayınlanmaz**.

## PDF'leri yeniden üretmek

```bash
# 1) Siteyi çalıştır
docker compose -f docker-compose.test.yml up -d
# 2) Admin panelini tünelsiz geliştirme modunda çalıştır (ayrı terminal)
npm run admin -- --hedef http://127.0.0.1:3000
# 3) PDF'leri üret (ilk seferde: npx playwright install chromium)
npx -y -p playwright@1 node scripts/kilavuz-pdf.mjs
```

Yazdırma ipucu: PDF'ler koyu temalıdır; yazıcıda "arka plan grafikleri" seçeneği açık olmalı.
Mürekkep tasarrufu için kartları kalın kâğıda renkli basmanız önerilir.
