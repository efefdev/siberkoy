#!/usr/bin/env bash
# Paylaşımlı VPS için .env dosyasını rastgele, güçlü sırlarla üretir. Sırlar ekrana yazılmaz.
# Kullanım (repo kök klasöründe):  bash deploy/vps/env-olustur.sh <alt-alan-adi> [http-port] [tunel-port] [host|cloudflare]
#   host (varsayılan): ana web sunucusu 127.0.0.1:<http-port>'a iletir (KURULUM.md 6–7)
#   cloudflare: Cloudflare Tunnel ile yayın (KURULUM.md 6b); token .env'e elle yazılır
# Var olan .env'nin üzerine YAZMAZ (veritabanı şifresi değişirse mevcut veriye erişilemez).
set -euo pipefail
cd "$(dirname "$0")/../.."

DOMAIN="${1:-}"; HTTP_PORT="${2:-8088}"; TUNNEL_PORT="${3:-3000}"; YAYIN="${4:-host}"
[[ "$DOMAIN" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$ ]] || { echo "✖ Geçerli bir alan adı verin (küçük harf)." >&2; exit 1; }
[[ "$HTTP_PORT" =~ ^[0-9]+$ && "$TUNNEL_PORT" =~ ^[0-9]+$ && "$HTTP_PORT" != "$TUNNEL_PORT" ]] || { echo "✖ Portlar sayı ve farklı olmalı." >&2; exit 1; }
[[ "$YAYIN" == host || "$YAYIN" == cloudflare ]] || { echo "✖ Yayın yöntemi: host ya da cloudflare." >&2; exit 1; }
[[ -e .env ]] && { echo "✖ .env zaten var; üzerine yazılmadı." >&2; exit 1; }
command -v openssl >/dev/null || { echo "✖ openssl gerekli." >&2; exit 1; }

DB_PASS="$(openssl rand -hex 24)"
umask 077
cat > .env <<EOF
# Siber Köy · paylaşımlı VPS kurulumu ($(date -I) tarihinde deploy/vps/env-olustur.sh üretti)
# Bu dosya gizlidir: Git'e gönderilmez, kimseyle paylaşılmaz.

# Tüm docker compose komutları bu proje adını ve VPS katmanını kullanır (ana sitenin konteynerlerinden ayrı).
COMPOSE_PROJECT_NAME=siberkoy
COMPOSE_FILE=docker-compose.yml:docker-compose.vps.yml

# Oyun yalnızca sunucunun içinde dinler. Ana web sunucusu alan adını 127.0.0.1:\${SIBERKOY_HTTP_PORT}'a iletir.
SIBERKOY_HTTP_PORT=$HTTP_PORT
# Yerel admin uygulamasının SSH tüneli bu porta bağlanır (admin.config.json → ssh.remoteAppPort).
SIBERKOY_TUNNEL_PORT=$TUNNEL_PORT

POSTGRES_DB=siberkoy
POSTGRES_USER=siberkoy_user
POSTGRES_PASSWORD=$DB_PASS
DATABASE_URL=postgresql://siberkoy_user:$DB_PASS@db:5432/siberkoy

JWT_SECRET=$(openssl rand -hex 64)

NODE_ENV=production
PORT=3000
NEXT_PUBLIC_APP_URL=https://$DOMAIN
EOF
if [[ "$YAYIN" == cloudflare ]]; then
  cat >> .env <<EOF

# Cloudflare Tunnel ile yayın (KURULUM.md · 6b). Token'ı Cloudflare panelinden alıp aşağıya KENDİNİZ yazın
# (sohbete, komut satırına yazmayın). Paneldeki yayın adresi: http://nginx:8080
COMPOSE_PROFILES=cloudflare
SIBERKOY_REALIP=cloudflare-tunnel
CLOUDFLARE_TUNNEL_TOKEN=
EOF
fi
chmod 600 .env
echo "✔ .env oluşturuldu (yalnızca sahibi okuyabilir). Alan adı: https://$DOMAIN · iç portlar: $HTTP_PORT, $TUNNEL_PORT · yayın: $YAYIN"
