#!/usr/bin/env bash
# Ana sitenin (omusiber.org) kurulum boyunca etkilenmediğini kanıtlar. HİÇBİR ŞEYİ DEĞİŞTİRMEZ.
#   bash deploy/vps/ana-site.sh kaydet  [alan-adi ...]   # kurulumdan ÖNCE: durum fotoğrafı
#   bash deploy/vps/ana-site.sh karsilastir              # her adımdan SONRA: aynı mı?
# Varsayılan alan adları: omusiber.org www.omusiber.org
# Ölçülenler: HTTP durum kodu, yönlendirme hedefi, sertifika parmak izi ve bitişi, sayfa başlığı (<title>).
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
SNAP="$DIR/.ana-site-onceki.txt"

probe() {
  local host="$1" code loc fp exp title
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "https://$host/" || echo HATA)
  loc=$(curl -s -o /dev/null -w '%{redirect_url}' --max-time 10 "https://$host/" || true)
  fp=$(echo | timeout 10 openssl s_client -servername "$host" -connect "$host:443" 2>/dev/null | openssl x509 -noout -fingerprint -sha256 2>/dev/null | cut -d= -f2)
  exp=$(echo | timeout 10 openssl s_client -servername "$host" -connect "$host:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
  title=$(curl -sL --max-time 10 "https://$host/" | tr -d '\n' | grep -oiE '<title[^>]*>[^<]*' | head -1 | sed 's/<title[^>]*>//I')
  printf '%s|kod=%s|yonlendirme=%s|sertifika=%s|bitis=%s|baslik=%s\n' "$host" "$code" "$loc" "${fp:-yok}" "${exp:-yok}" "${title:-yok}"
}

case "${1:-}" in
  kaydet)
    shift
    hosts=("$@"); ((${#hosts[@]})) || hosts=(omusiber.org www.omusiber.org)
    : > "$SNAP"
    for h in "${hosts[@]}"; do probe "$h" | tee -a "$SNAP"; done
    echo "✔ Kaydedildi: $SNAP"
    ;;
  karsilastir)
    [[ -f "$SNAP" ]] || { echo "Önce: $0 kaydet" >&2; exit 1; }
    fail=0
    while IFS= read -r line; do
      host="${line%%|*}"
      now=$(probe "$host")
      if [[ "$now" == "$line" ]]; then echo "✔ $host aynı"; else
        echo "✖ $host DEĞİŞTİ"; echo "   önce:  $line"; echo "   şimdi: $now"; fail=1; fi
    done < "$SNAP"
    if ((fail)); then echo "✖ DUR: son adımı geri al ve kullanıcıya bildir (KURULUM.md · Geri alma)."; exit 2; fi
    ;;
  *) echo "Kullanım: $0 kaydet [alan-adi ...] | karsilastir" >&2; exit 1 ;;
esac
