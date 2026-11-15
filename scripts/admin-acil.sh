#!/usr/bin/env bash
# Acil durum admin erişimi.
#
# Normalde admin API'si internete kapalıdır; yerel admin uygulaması SSH tüneliyle bağlanır.
# Etkinlik günü tünel kurulamazsa (kampüs ağı SSH'yi engeller vb.) bu betik admin API'sini
# YALNIZCA verilen tek IP'ye, verilen süre boyunca HTTPS üzerinden açar. Süre dolunca kendiliğinden kapanır.
#
# Kullanım (sunucuda, repo klasöründe):
#   ./scripts/admin-acil.sh ac <IP> <DAKIKA>   # örn. ./scripts/admin-acil.sh ac 193.140.10.25 120  (en fazla 240 dk)
#   ./scripts/admin-acil.sh kapat
#   ./scripts/admin-acil.sh durum
#
# Kendi IP'nizi öğrenmek için admin bilgisayarından: curl -s https://api.ipify.org
# Ardından yerel uygulamayı acil modda açın: npm run admin -- --acil
set -euo pipefail

# Betiğin mutlak yolu: otomatik kapatma zamanlayıcısı hangi klasörden çağrılırsa çağrılsın bunu çalıştırır.
SELF="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
cd "$(dirname "$SELF")/.."
ALLOW="nginx/emergency/allow.conf"
# allow.conf'u Nginx konteyneri her başlangıçta (root olarak) yeniden oluşturur; sunucudaki kullanıcı bu dosyaya
# doğrudan yazamayabilir. Bu yüzden dosya konteynerin içinden yazılır (docker grubundaki kullanıcı yeterli).
write_allow() { docker compose exec -T nginx sh -c 'cat > /etc/nginx/emergency/allow.conf'; }
LOG="nginx/emergency/acil.log"
HEADER="# scripts/admin-acil.sh yonetir"
ACTOR="${SUDO_USER:-${USER:-bilinmiyor}}"

log() { echo "$(date -Is) $ACTOR $*" >> "$LOG"; }

nginx_apply() {
  if ! docker compose exec -T nginx nginx -t >/dev/null 2>&1; then
    echo "✖ Nginx yapılandırması geçersiz; değişiklik geri alınıyor." >&2
    printf '%s\n' "$HEADER" | write_allow
    docker compose exec -T nginx nginx -s reload >/dev/null 2>&1 || true
    exit 1
  fi
  docker compose exec -T nginx nginx -s reload >/dev/null
  sleep 1 # eski Nginx işçileri bağlantılarını bitirirken kısa bir geçiş süresi
}

valid_ip() {
  local ip="$1"
  if [[ "$ip" =~ ^([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})$ ]]; then
    for o in "${BASH_REMATCH[@]:1}"; do ((o <= 255)) || return 1; done
    return 0
  fi
  # IPv6 (kaba kontrol: yalnızca onaltılık ve iki nokta, en az iki ':')
  [[ "$ip" =~ ^[0-9A-Fa-f:]+$ && "$ip" == *:*:* ]]
}

cmd="${1:-durum}"
case "$cmd" in
  ac)
    ip="${2:-}"; minutes="${3:-}"
    valid_ip "$ip" || { echo "✖ Geçerli bir IP verin. Örn: $0 ac 193.140.10.25 120" >&2; exit 1; }
    [[ "$minutes" =~ ^[0-9]+$ ]] && ((minutes >= 1 && minutes <= 240)) || { echo "✖ Süre 1-240 dakika olmalı." >&2; exit 1; }

    token="$(head -c 8 /dev/urandom | od -An -tx1 | tr -d ' \n')"
    until_epoch=$(( $(date +%s) + minutes * 60 ))
    {
      printf '%s\n' "$HEADER"
      printf '# token: %s\n' "$token"
      printf '# bitis: %s (%s)\n' "$until_epoch" "$(date -d "@$until_epoch" -Is 2>/dev/null || date -r "$until_epoch")"
      printf '%s 1;\n' "$ip"
    } | write_allow
    nginx_apply
    log "AC ip=$ip dakika=$minutes token=$token"

    # Süre dolunca kapat. Token kontrolü: arada yeniden açıldıysa eski zamanlayıcı yeni izni kapatmaz.
    nohup bash -c "sleep $((minutes * 60)); bash '$SELF' kapat --token '$token'" >/dev/null 2>&1 &

    echo "⚠ Admin API'si $minutes dakika boyunca YALNIZCA $ip adresine açıldı."
    echo "  Bitiş: $(date -d "@$until_epoch" '+%H:%M' 2>/dev/null || date -r "$until_epoch" '+%H:%M')  ·  Erken kapatmak için: $0 kapat"
    echo "  Not: sunucu/Nginx yeniden başlarsa izin otomatik kalkar."
    ;;
  kapat)
    if [[ "${2:-}" == "--token" ]]; then
      grep -q "# token: ${3:-yok}$" "$ALLOW" 2>/dev/null || exit 0
    fi
    printf '%s\n' "$HEADER" | write_allow
    nginx_apply
    log "KAPAT ${2:-elle}"
    echo "✔ Acil admin erişimi kapatıldı. Admin API'si yeniden yalnızca SSH tüneliyle erişilebilir."
    ;;
  durum)
    if grep -qE '^[0-9A-Fa-f.:]+ 1;' "$ALLOW" 2>/dev/null; then
      ip=$(grep -E '^[0-9A-Fa-f.:]+ 1;' "$ALLOW" | awk '{print $1}')
      until_epoch=$(grep '^# bitis:' "$ALLOW" | awk '{print $3}')
      left=$(( (until_epoch - $(date +%s)) / 60 ))
      echo "⚠ AÇIK: $ip  (yaklaşık $left dk kaldı)"
    else
      echo "✔ Kapalı: admin API'si yalnızca SSH tüneliyle erişilebilir."
    fi
    ;;
  *)
    echo "Kullanım: $0 ac <IP> <DAKIKA> | kapat | durum" >&2
    exit 1
    ;;
esac
