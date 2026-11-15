#!/usr/bin/env bash
# Siber Köy · VPS ön kontrolü. HİÇBİR ŞEYİ DEĞİŞTİRMEZ; yalnızca okur ve rapor yazar.
# Kullanım (sunucuda):  sudo bash deploy/vps/kontrol.sh <alt-alan-adi> [http-port] [tunel-port]
# Örn:                  sudo bash deploy/vps/kontrol.sh oyun.omusiber.org 8088 3000
set -uo pipefail

DOMAIN="${1:-}"
HTTP_PORT="${2:-8088}"
TUNNEL_PORT="${3:-3000}"
[[ -n "$DOMAIN" ]] || { echo "Kullanım: sudo bash $0 <alt-alan-adi> [http-port] [tunel-port]" >&2; exit 1; }

warn=0
ok()   { printf '  \033[32m✔\033[0m %s\n' "$*"; }
bad()  { printf '  \033[33m!\033[0m %s\n' "$*"; warn=$((warn + 1)); }
stop() { printf '  \033[31m✖\033[0m %s\n' "$*"; warn=$((warn + 100)); }
h()    { printf '\n\033[1m== %s\033[0m\n' "$*"; }
has()  { command -v "$1" >/dev/null 2>&1; }

h "Sistem"
. /etc/os-release 2>/dev/null && echo "  $PRETTY_NAME · çekirdek $(uname -r) · $(nproc) çekirdek"
mem_total=$(awk '/MemTotal/{print int($2/1024)}' /proc/meminfo)
mem_avail=$(awk '/MemAvailable/{print int($2/1024)}' /proc/meminfo)
swap_total=$(awk '/SwapTotal/{print int($2/1024)}' /proc/meminfo)
echo "  RAM: ${mem_total} MB toplam, ${mem_avail} MB boş · swap: ${swap_total} MB"
# Çalışırken: uygulama 768 + veritabanı 512 + nginx 128 MB üst sınır. Derleme (next build) anlık ~1.5-2 GB ister.
echo "  Mimari: $(uname -m) (başka makinede derlenen imaj bu mimariye göre derlenmeli)"
# Oyun çalışırken ~300 MB kullanır (ölçüm: 150 oyuncuda uygulama ~185 MB + veritabanı ~80 MB; Docker servisi ayrıca ~80 MB).
# Sınırlar: uygulama 448 + veritabanı 256 + nginx 128 MB. Derleme (next build) ise anlık 1.5-2 GB ister.
if (( mem_avail < 700 )); then stop "Boş RAM 700 MB'tan az: oyun çalışırken bile ana site sıkışabilir. Kullanıcıya sor."
elif (( mem_avail < 2600 )); then bad "Boş RAM ${mem_avail} MB: oyunu ÇALIŞTIRMAYA yeter, ama imaj bu sunucuda DERLENMEMELİ (KURULUM.md · Bellek)."
else ok "Bellek yeterli (derleme dahil)"; fi
(( swap_total == 0 )) && bad "Swap yok: bellek dolarsa çekirdek bir işlemi (ana site dahil) öldürebilir. Swap eklemeyi kullanıcıya öner (KURULUM.md · Bellek)."
disk_avail=$(df -Pm / | awk 'NR==2{print $4}')
echo "  Disk (/): ${disk_avail} MB boş"
(( disk_avail > 6000 )) && ok "Disk yeterli" || bad "Diskte 6 GB'tan az yer var (imajlar + veritabanı ~3-4 GB)"

h "Ana web sunucusu (80/443 kimde?)"
if has ss; then
  ss -Htlnp '( sport = :80 or sport = :443 )' 2>/dev/null | awk '{print "  " $4 "  " $6}' | sort -u
fi
for s in nginx apache2 caddy httpd lighttpd haproxy traefik; do
  st=$(systemctl is-active "$s" 2>/dev/null || true)
  [[ "$st" == "active" ]] && echo "  servis: $s (aktif)"
done
if has docker && docker ps >/dev/null 2>&1; then
  docker ps --format '{{.Names}}\t{{.Image}}\t{{.Ports}}' 2>/dev/null | grep -E ':(80|443)->' | sed 's/^/  docker: /'
fi
if has nginx && pgrep -x nginx >/dev/null 2>&1; then
  docker ps --format "{{.Ports}}" 2>/dev/null | grep -qE ":(80|443)->" && bad "80/443 bir Docker konteynerine yayınlanmış: ana site Docker içindeki bir vekilde olabilir, kullanıcıya sor."
  ok "Nginx ana siteyi sunuyor gibi görünüyor → host-nginx-*.conf.template kullanılır"
  systemctl is-active nginx >/dev/null 2>&1 && echo "  systemd servisi: nginx (aktif)" || bad "Nginx systemd ile yönetilmiyor görünüyor: reload komutu farklı olabilir, sor."
  echo "  Nginx sürümü: $(nginx -v 2>&1 | sed 's/.*\///')"
  echo "  Tanımlı alan adları:"
  nginx -T 2>/dev/null | grep -E '^\s*server_name' | sed 's/^\s*/    /' | sort -u
  if nginx -T 2>/dev/null | grep -qE "server_name[^;]*\b${DOMAIN//./\\.}\b"; then stop "$DOMAIN için zaten bir server bloğu var. Dokunmadan kullanıcıya sor."; fi
  nginx -T 2>/dev/null | grep -q 'siberkoy_connection_upgrade' && bad "siberkoy_connection_upgrade adlı map zaten tanımlı (önceki deneme?)"
  echo "  include satırları (yeni dosyanın nereye konacağı):"
  nginx -T 2>/dev/null | grep -E '^\s*include\s+/etc/nginx/(sites-enabled|conf\.d)' | sed 's/^\s*/    /' | sort -u
  nginx -t >/dev/null 2>&1 && ok "Mevcut Nginx yapılandırması geçerli (nginx -t)" || stop "Mevcut Nginx yapılandırması ŞU AN geçersiz: hiçbir reload yapma, kullanıcıya bildir."
elif has apache2ctl && pgrep -x apache2 >/dev/null 2>&1; then
  ok "Apache ana siteyi sunuyor gibi görünüyor → host-apache.conf.template kullanılır"
  apache2ctl -S 2>/dev/null | grep -E 'namevhost|alias' | sed 's/^\s*/    /'
  echo "  Yüklü modüller (gerekenler: proxy proxy_http proxy_wstunnel headers ssl rewrite):"
  apache2ctl -M 2>/dev/null | grep -E 'proxy_module|proxy_http|proxy_wstunnel|headers|ssl|rewrite' | sed 's/^\s*/    /'
  apache2ctl configtest >/dev/null 2>&1 && ok "Mevcut Apache yapılandırması geçerli" || stop "Mevcut Apache yapılandırması ŞU AN geçersiz"
else
  bad "Ana web sunucusu otomatik tanınamadı (Caddy, Traefik ya da Docker içinde olabilir). Kullanıcıya sor."
fi

h "Portlar (oyun yalnızca 127.0.0.1'de dinleyecek)"
for p in "$HTTP_PORT" "$TUNNEL_PORT"; do
  if ss -Htln "( sport = :$p )" 2>/dev/null | grep -q .; then stop "$p portu dolu: başka bir port seç"; else ok "$p boş"; fi
done

h "Docker"
if has docker && ! docker info >/dev/null 2>&1; then
  bad "Docker CLI var ama servis çalışmıyor ya da yetki yok (sudo ile çalıştırıldı mı?)"
elif has docker; then
  echo "  $(docker --version)"
  if docker compose version >/dev/null 2>&1; then
    v=$(docker compose version --short 2>/dev/null | sed 's/^v//')
    echo "  Compose $v"
    if printf '%s\n2.24.4\n' "$v" | sort -V | head -1 | grep -qx '2.24.4'; then ok "Compose sürümü yeterli (≥ 2.24.4)"; else stop "Compose 2.24.4'ten eski: güncellenmeli (kullanıcıya sor)"; fi
  else stop "docker compose eklentisi yok"; fi
  echo "  Çalışan konteynerler:"; docker ps --format '    {{.Names}}  ({{.Image}})' 2>/dev/null
  echo "  Ağlar:"; docker network ls --format '    {{.Name}}' 2>/dev/null
  docker ps -a --format '{{.Names}}' 2>/dev/null | grep -q '^siberkoy-' && bad "siberkoy- adlı konteynerler zaten var (önceki kurulum?)"
  docker volume ls --format '{{.Name}}' 2>/dev/null | grep -q '^siberkoy_' && bad "siberkoy_ birimleri zaten var: içinde veri olabilir, SİLME"
  echo "  Günlük ayarı: $(docker info --format '{{.LoggingDriver}}' 2>/dev/null) (oyun kendi servislerinde 10 MB x 3 ile sınırlı)"
else
  bad "Docker kurulu değil. Kurulum ağ ayarlarına (iptables) kural ekler; aşağıdaki güvenlik duvarı bilgisine bak."
fi

h "Ağ ve güvenlik duvarı"
echo "  ip_forward: $(sysctl -n net.ipv4.ip_forward 2>/dev/null)"
has ufw && echo "  ufw: $(ufw status 2>/dev/null | head -1)"
if has iptables; then
  echo "  iptables FORWARD politikası: $(iptables -S FORWARD 2>/dev/null | head -1)"
  fwd_rules=$(iptables -S FORWARD 2>/dev/null | grep -vc '^-P' || true)
  echo "  FORWARD kural sayısı: $fwd_rules"
  if ! has docker && [[ "$(sysctl -n net.ipv4.ip_forward 2>/dev/null)" == "1" ]] && (( fwd_rules > 0 )); then
    stop "Sunucu zaten trafik yönlendiriyor (VPN/konteyner?). Docker kurulumu FORWARD politikasını DROP yapar: kullanıcıya sor."
  fi
fi
has nft && echo "  nftables tablo sayısı: $(nft list tables 2>/dev/null | wc -l)"
has knockd && echo "  knockd: $(systemctl is-active knockd 2>/dev/null)"
echo "  SSH: $(ss -Htlnp 2>/dev/null | grep -m1 sshd | awk '{print $4}') (DOKUNULMAYACAK)"

h "Alan adı ve sertifika"
pub4=$(curl -4 -s --max-time 5 https://api.ipify.org || true)
dns4=$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk 'NR==1{print $1}')
echo "  Sunucunun genel IP'si: ${pub4:-?} · $DOMAIN → ${dns4:-çözülemedi}"
if [[ -n "$dns4" && "$dns4" == "$pub4" ]]; then ok "DNS bu sunucuyu gösteriyor"; else bad "DNS henüz bu sunucuyu göstermiyor (sertifika adımı beklemeli). Cloudflare vekili açıksa IP farklı görünebilir: kullanıcıya sor."; fi
if has certbot; then
  ok "certbot kurulu ($(certbot --version 2>&1))"
  certbot certificates 2>/dev/null | grep -E 'Certificate Name|Domains|Expiry' | sed 's/^\s*/    /'
  systemctl list-timers 2>/dev/null | grep -q certbot && ok "certbot yenileme zamanlayıcısı aktif" || bad "certbot zamanlayıcısı görünmüyor (yenileme nasıl yapılıyor? sor)"
else
  bad "certbot yok (ana site sertifikasını başka bir yolla alıyor olabilir: sor)"
fi

h "Sonuç"
if (( warn >= 100 )); then echo "  ✖ DUR: kırmızı maddeler çözülmeden kuruluma geçme. Kullanıcıya rapor et."; exit 2
elif (( warn > 0 )); then echo "  ! Uyarılar var: kullanıcıyla değerlendir."; exit 1
else echo "  ✔ Kuruluma uygun."; fi
