# Siber Köy · paylaşımlı VPS'e izole kurulum

Bu sunucuda **omusiber.org ana sitesi çalışıyor ve kesinlikle etkilenmemeli.** Bu belge kurulumu yapan kişi
içindir. Adımlar sırayla yapılır; her adımın sonunda ana site kontrol edilir.

## Değişmez kurallar

1. **Ana sitenin hiçbir dosyasına dokunulmaz.** Var olan Nginx/Apache site dosyaları, `nginx.conf`, sertifikaları,
   Docker konteynerleri, ağları ve birimleri düzenlenmez, yeniden başlatılmaz, silinmez. Yalnızca **yeni** dosya eklenir:
   `/etc/nginx/sites-available/siberkoy.conf` (+ `sites-enabled` bağlantısı), `/var/www/siberkoy-acme/`, `/opt/siberkoy/`.
2. **Web sunucusu yalnızca `reload` edilir, asla `restart`/`stop` edilmez,** ve her reload'dan önce `nginx -t`
   (Apache'de `apache2ctl configtest`) başarılı olmalıdır. Test başarısızsa reload yapılmaz, yeni dosya geri alınır.
3. **SSH, güvenlik duvarı (ufw/iptables/nftables), port knocking, kullanıcılar ve sudo ayarları değiştirilmez.**
4. **Oyun hiçbir portu internete açmaz.** Yalnızca `127.0.0.1:<SIBERKOY_HTTP_PORT>` ve `127.0.0.1:<SIBERKOY_TUNNEL_PORT>`.
5. Bilinmeyen ya da beklenmeyen her durumda **dur ve kullanıcıya sor.** Varsayım yapılmaz.
6. Sırlar (veritabanı şifresi, JWT anahtarı, admin şifresi) sohbete, günlüğe ya da komut satırına yazılmaz.
   Admin şifresini **kullanıcı kendisi** yazar (adım 8).
7. `docker compose down -v`, `docker system prune`, `docker volume rm` **kullanılmaz** (veri ve başka projeler silinir).

## Mimari

```
internet ──443──▶ ana web sunucusu (omusiber.org'u da sunar, TLS burada)
                    └─ yalnızca <alt-alan-adi> ──▶ 127.0.0.1:8088 ─▶ [siberkoy] nginx ─▶ app ─▶ db
admin (SSH tüneli) ─────────────────────────────▶ 127.0.0.1:3000 ─▶ [siberkoy] nginx ─▶ app (yalnızca admin API)
```

`siberkoy` Docker projesinin kendi ağları vardır; `app` ve `db` internete çıkamaz (iç ağ). Tüm konteynerler salt okunur
dosya sistemi, sıfır yetki, bellek/CPU/işlem sınırı ve 10 MB × 3 günlük sınırıyla çalışır. Ayrıntı: `docker-compose.yml`,
`docker-compose.vps.yml`.

## 0 · Başlamadan kullanıcıya sorulacaklar

- Alt alan adı tam olarak ne? (Örn. `siberkoy.omusiber.org`.) DNS kaydı (A/AAAA) bu sunucuya yönlendi mi?
  Cloudflare vekili (turuncu bulut) açık mı?
- Kod sunucuya nasıl gelecek? (GitHub'dan `git clone` ise depo adresi ve erişim; değilse `scp` ile.)
  Bilgisayardaki en güncel klasör: masaüstündeki `omusiberkoyu`.
- Sertifika e-postası (Let's Encrypt bildirimleri için) ve ilk admin hesabının e-postası.
- Oyun hangi iç portları kullansın? Varsayılan öneri `8088` (web) ve `3000` (admin tüneli); kontrol betiği boş olup
  olmadığını söyler.

## 1 · Ana sitenin fotoğrafını çek (hiçbir şeyi değiştirmez)

```bash
cd /tmp && git clone <depo> siberkoy-onizleme   # ya da kodu herhangi bir geçici klasöre kopyala
cd siberkoy-onizleme
bash deploy/vps/ana-site.sh kaydet omusiber.org www.omusiber.org
```

Kullanıcı ana sitenin başka alan adlarını da söylerse onları da ekle. Bundan sonra **her adımın sonunda**:

```bash
bash deploy/vps/ana-site.sh karsilastir
```

`✖ DEĞİŞTİ` çıkarsa son adımı **Geri alma** bölümüne göre geri al ve kullanıcıya bildir.

## 2 · Ön kontrol (hiçbir şeyi değiştirmez)

```bash
sudo bash deploy/vps/kontrol.sh <alt-alan-adi> 8088 3000
```

Çıktının tamamını kullanıcıya özetle. Kırmızı (✖) madde varsa **devam etme**. Özellikle:

- **Ana web sunucusu**: Nginx ise `host-nginx-*`, Apache ise `host-apache` şablonu. Caddy/Traefik/Docker içinde bir
  vekil ise şablon yok: kullanıcıyla birlikte o sunucuya ayrı bir site bloğu eklenir.
- **Bellek**: bkz. aşağıdaki *Bellek* bölümü.
- **Docker yoksa**: adım 3'e geçmeden kullanıcıdan açık onay al (aşağıdaki açıklamayla).

### Bellek

Ölçüm (yük testi, 70 ve 150 eşzamanlı oyuncu, açık soketler, tur sürerken): uygulama en çok ~185 MB, veritabanı ~80 MB
kullandı; Docker servisiyle birlikte oyunun toplam payı ~350 MB'tır. VPS katmanı sınırları: uygulama 448 MB,
veritabanı 256 MB, nginx 128 MB. Bu yüzden **2 GB RAM'li sunucuda oyunu çalıştırmak sorun değildir**, yeter ki ana
site boşta en az ~700 MB bırakıyor olsun (kontrol betiği "boş RAM" olarak gösterir).

Sorun **derlemedir**: `next build` anlık 1.5–2 GB ister ve 2 GB'lık sunucuda ana siteyi sıkıştırır. Boş RAM
2.6 GB'tan azsa imaj sunucuda **derlenmez**, aşağıdaki gibi başka makinede derlenip taşınır. Swap yoksa kullanıcıya
1–2 GB swap dosyası eklemeyi öner (sistem değişikliğidir, onay gerekir); bellek taşmasında çekirdeğin ana siteyi
öldürmesine karşı sigortadır.

**İmajı başka makinede derleme** (Docker kurulu bir bilgisayarda, depo klasöründe; mimari kontrol betiğinde yazar,
genelde `x86_64` → `linux/amd64`):

```bash
docker buildx build --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_APP_URL=https://<alt-alan-adi> \
  -t siberkoy-app:latest --output type=docker,dest=siberkoy-app.tar .
scp siberkoy-app.tar <kullanici>@<sunucu>:/tmp/
```

Sunucuda (`/opt/siberkoy`, adım 4'ten sonra):

```bash
sudo docker load -i /tmp/siberkoy-app.tar && rm /tmp/siberkoy-app.tar
sudo docker compose up -d --no-build        # "siberkoy-app" imajını kullanır, derlemez
```

`NEXT_PUBLIC_APP_URL` derlemeye gömülür: alan adı değişirse imaj yeniden derlenir.

## 3 · Docker (yalnızca kurulu değilse ve kullanıcı onay verdiyse)

Kullanıcıya söylenecek: Docker kendi ağ kurallarını (iptables) ekler ve yönlendirme (FORWARD) politikasını DROP yapar.
Sunucu başka trafik yönlendirmiyorsa (kontrol betiği söyler) ana siteye etkisi yoktur; Docker hiçbir web sunucusunu
yeniden başlatmaz. Resmî depodan kurulum (https://docs.docker.com/engine/install/ubuntu/):

```bash
sudo apt-get update && sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo docker run --rm hello-world
bash deploy/vps/ana-site.sh karsilastir
```

Kullanıcıyı `docker` grubuna eklemek root yetkisine eşdeğerdir; yapma, komutlar `sudo` ile çalıştırılır.

## 4 · Kodu yerleştir ve .env üret

```bash
sudo mkdir -p /opt/siberkoy && sudo chown "$USER": /opt/siberkoy
git clone <depo> /opt/siberkoy        # ya da kopyala
cd /opt/siberkoy
bash deploy/vps/env-olustur.sh <alt-alan-adi> 8088 3000
```

`.env` rastgele sırlarla, yalnızca sahibinin okuyabileceği şekilde oluşur; içeriği ekrana basılmaz.
`COMPOSE_PROJECT_NAME=siberkoy` ve `COMPOSE_FILE=docker-compose.yml:docker-compose.vps.yml` satırları sayesinde bu
klasördeki her `docker compose` komutu otomatik olarak izole VPS kurulumunu kullanır.

## 5 · Oyunu başlat (henüz internete açık değil)

```bash
cd /opt/siberkoy
sudo docker compose config --services          # beklenen: db, app, nginx (certbot YOK)
# Boş RAM 2.6 GB'tan azsa bu iki satırın yerine *Bellek* bölümündeki taşıma yöntemi (up -d --no-build)
sudo docker compose build
sudo docker compose up -d
sudo docker compose ps                          # üçü de "running"/"healthy"
sudo docker compose exec app npx prisma migrate deploy
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8088/                    # 200
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8088/api/admin/session   # 404 (admin dışarıya kapalı)
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/api/admin/session   # 401 (tünel kapısı)
sudo ss -tlnp | grep -E ':(8088|3000)\b'        # yalnızca 127.0.0.1 görünmeli
bash deploy/vps/ana-site.sh karsilastir
```

## 6 · Sertifika (yalnızca DNS bu sunucuyu gösterdikten sonra)

**Nginx** için önce yalnızca doğrulama bloğu:

```bash
sudo mkdir -p /var/www/siberkoy-acme
sed 's/__DOMAIN__/<alt-alan-adi>/g' deploy/vps/host-nginx-1-sertifika.conf.template | sudo tee /etc/nginx/sites-available/siberkoy.conf >/dev/null
sudo ln -s /etc/nginx/sites-available/siberkoy.conf /etc/nginx/sites-enabled/siberkoy.conf
sudo nginx -t && sudo systemctl reload nginx
bash deploy/vps/ana-site.sh karsilastir
```

Ana sitenin Nginx'i `sites-enabled` yerine `conf.d` klasörünü içeriyorsa (kontrol betiği "include satırları"nda
gösterir) dosya `/etc/nginx/conf.d/siberkoy.conf` olarak konur. Ana site `listen [::]:…` kullanmıyorsa şablondaki
`[::]` satırları silinir.

Sertifika, ana sitenin sertifikasına dokunmadan ayrı alınır (certbot yoksa önce kullanıcıya sor: `sudo apt-get install -y certbot`):

```bash
sudo certbot certonly --webroot -w /var/www/siberkoy-acme -d <alt-alan-adi> \
  --email <eposta> --agree-tos --no-eff-email \
  --deploy-hook "systemctl reload nginx"
```

`certonly` hiçbir web sunucusu dosyasını değiştirmez. Yenileme, sistemin certbot zamanlayıcısıyla otomatik olur.

## 7 · Yayına al

```bash
sed -e 's/__DOMAIN__/<alt-alan-adi>/g' -e 's/__HTTP_PORT__/8088/g' deploy/vps/host-nginx-2-yayin.conf.template | sudo tee /etc/nginx/sites-available/siberkoy.conf >/dev/null
sudo nginx -t && sudo systemctl reload nginx
curl -s -o /dev/null -w '%{http_code}\n' https://<alt-alan-adi>/                    # 200
curl -s -o /dev/null -w '%{http_code}\n' https://<alt-alan-adi>/api/admin/session   # 404
bash deploy/vps/ana-site.sh karsilastir
```

`nginx -t` "duplicate map" ya da "http2" hatası verirse dosyayı geri al (aşağıda) ve kullanıcıya göster; ana
yapılandırmayı düzeltmeye çalışma.

**Apache** ise `host-apache.conf.template` aynı iki adımla kullanılır (önce yalnızca `:80`, sertifikadan sonra
`:443` bloğunun yorumu kaldırılır). Eksik modül varsa `a2enmod` çalıştırmadan önce kullanıcıya sor.

## 6b · Cloudflare Tunnel ile yayın (6–7 yerine)

Ana site Docker içindeki bir vekilde (Caddy/Traefik) çalışıyorsa ve alan adı Cloudflare'deyse, ana sitenin
yapılandırmasına, ağına ve güvenlik duvarına **hiç dokunmadan** yayın yapılır: `cloudflared` konteyneri Cloudflare'e
kendisi dışarıdan bağlanır, hiçbir port açmaz. TLS'i Cloudflare sonlandırır; certbot ve web sunucusu adımları atlanır.

1. `.env` adım 4'te `cloudflare` yöntemiyle üretilir: `bash deploy/vps/env-olustur.sh <alt-alan-adi> 8088 <tunel-port> cloudflare`
2. Kullanıcı Cloudflare panelinde (Zero Trust → Networks → Tunnels) bir tünel oluşturur, **Public hostname**:
   `<alt-alan-adi>` → `HTTP` · `nginx:8080`. Alan adının eski A kaydı varsa panel uyarır; kullanıcı onu siler.
   **Asla `nginx:3000` yazılmaz** (admin tünelidir; `tunnel.conf` Cloudflare'den gelen istekleri ayrıca reddeder).
3. Kullanıcı token'ı sunucudaki `.env` içindeki `CLOUDFLARE_TUNNEL_TOKEN=` satırına **kendisi** yazar (`nano .env`).
4. Başlat ve doğrula:

```bash
sudo docker compose up -d --no-build
sudo docker compose ps                          # db, app, nginx, cloudflared
sudo docker compose logs --tail 20 cloudflared  # "Registered tunnel connection"
curl -s -o /dev/null -w '%{http_code}\n' https://<alt-alan-adi>/                    # 200
curl -s -o /dev/null -w '%{http_code}\n' https://<alt-alan-adi>/api/admin/session   # 404
bash deploy/vps/ana-site.sh karsilastir
```

Geri alma: `sudo docker compose rm -sf cloudflared` ve `.env`'deki `COMPOSE_PROFILES` satırı silinir; tünel
Cloudflare panelinden silinir.

## 8 · İlk admin hesabı (kullanıcı kendisi çalıştırır)

Şifre sohbete yazılmaz. Kullanıcı sunucuya kendi terminalinden bağlanıp şunu çalıştırır:

```bash
cd /opt/siberkoy
read -rs -p "Admin şifresi (en az 12 karakter): " ADMIN_PW; echo
ADMIN_INITIAL_PASSWORD="$ADMIN_PW" sudo --preserve-env=ADMIN_INITIAL_PASSWORD docker compose exec -e ADMIN_EMAIL=<admin-eposta> -e ADMIN_INITIAL_PASSWORD app node prisma/seed.js
unset ADMIN_PW
```

## 9 · Yerel admin uygulaması

Kullanıcının bilgisayarındaki `admin-app/admin.config.json`:

- `publicUrl`: `https://<alt-alan-adi>`
- `ssh.host`, `ssh.port`, `ssh.user`: sunucuya bugün nasıl bağlanıyorsa (değişmez)
- `ssh.remoteAppPort`: `SIBERKOY_TUNNEL_PORT` (varsayılan `3000`)
- `knock.enabled`: sunucuda knockd kurulu değilse `false`. Port knocking kurmak SSH güvenlik duvarını değiştirir;
  ayrı bir iş olarak, kullanıcıyla birlikte ve oturum kilitlenmesine karşı önlem alınarak yapılır.

## Günlük işler

```bash
cd /opt/siberkoy
sudo docker compose ps
sudo docker compose logs --tail 100 app
git pull && sudo docker compose up -d --no-build && sudo docker compose exec app npx prisma migrate deploy   # yeni imajı önce Bellek bölümündeki gibi yükle
sudo ./scripts/admin-acil.sh durum
# Yedek (veritabanı dökümü, sunucuda kalır):
sudo docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > ~/siberkoy-$(date +%F).sql.gz
```

## Geri alma

Her adım yalnızca kendi eklediğini geri alır; ana siteye ait hiçbir şeye dokunulmaz.

| Adım | Geri alma |
|---|---|
| 6–7 (web sunucusu) | `sudo rm /etc/nginx/sites-enabled/siberkoy.conf && sudo nginx -t && sudo systemctl reload nginx` |
| 5 (konteynerler) | `cd /opt/siberkoy && sudo docker compose down` (**`-v` yok**: veri korunur) |
| 6 (sertifika) | Gerekmez. İstenirse: `sudo certbot delete --cert-name <alt-alan-adi>` |
| 3 (Docker) | Gerekmez; kaldırmak ana siteyi etkileyebileceği için kullanıcı karar verir |
