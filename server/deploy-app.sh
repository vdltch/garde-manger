#!/usr/bin/env bash
# Publie (ou met à jour) l'app Garde-manger dans PocketBase : elle est alors servie
# à la racine du serveur (ex. https://stock.quipaie.com/), l'API restant sur /api et l'admin sur /_/.
# Usage (en root, depuis le dossier server/ du repo) :  bash deploy-app.sh
set -euo pipefail

PB_DIR=/opt/pocketbase
PUB="$PB_DIR/pb_public"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
UNIT=/etc/systemd/system/pocketbase.service

[ "$(id -u)" -eq 0 ] || { echo "Lancez ce script en root."; exit 1; }

echo "→ Récupération de la dernière version"
git -C "$REPO" pull --ff-only -q || echo "  (git pull impossible, on publie la version locale)"

echo "→ Copie des fichiers dans $PUB"
mkdir -p "$PUB/icons"
cp "$REPO/index.html" "$REPO/manifest.webmanifest" "$REPO/sw.js" "$PUB/"
cp "$REPO"/icons/*.png "$PUB/icons/"

echo "→ Bibliothèques hébergées avec l'app (vendor/)"
VENDOR="$PUB/vendor"; mkdir -p "$VENDOR"
fetch_pkg(){ # paquet npm, version, fichier dans le paquet, nom local
  local name="$1" ver="$2" path="$3" dest="$4" base="${1##*/}" tmp
  [ -s "$VENDOR/$dest" ] && grep -qx "$name@$ver $dest" "$VENDOR/VERSIONS" 2>/dev/null && return 0
  tmp=$(mktemp -d)
  if curl -fsSL "https://registry.npmjs.org/$name/-/$base-$ver.tgz" | tar xz -C "$tmp" "package/$path" 2>/dev/null && [ -s "$tmp/package/$path" ]; then
    cp "$tmp/package/$path" "$VENDOR/$dest"
    sed -i "\#^$name@.* $dest\$#d" "$VENDOR/VERSIONS" 2>/dev/null || true
    echo "$name@$ver $dest" >> "$VENDOR/VERSIONS"
    echo "  ✓ $dest"
  else
    echo "  ! $dest non téléchargé : l'app utilisera le CDN pour ce fichier"
  fi
  rm -rf "$tmp"
}
touch "$VENDOR/VERSIONS"
fetch_pkg react 18.3.1 umd/react.production.min.js react.production.min.js
fetch_pkg react-dom 18.3.1 umd/react-dom.production.min.js react-dom.production.min.js
fetch_pkg htm 3.1.1 dist/htm.umd.js htm.umd.js
fetch_pkg @zxing/library 0.21.3 umd/index.min.js zxing.min.js
fetch_pkg barcode-detector 3.1.3 dist/iife/ponyfill.min.js barcode-detector.iife.js
# le moteur WebAssembly doit être exactement la version attendue par barcode-detector
ZXW=$(grep -o 'zxing-wasm@[0-9][0-9.]*[0-9]' "$VENDOR/barcode-detector.iife.js" 2>/dev/null | head -n1 | cut -d@ -f2 || true)
if [ -n "$ZXW" ]; then fetch_pkg zxing-wasm "$ZXW" dist/reader/zxing_reader.wasm zxing_reader.wasm
else rm -f "$VENDOR/zxing_reader.wasm"; echo "  ! version de zxing-wasm introuvable : moteur chargé depuis le CDN"; fi

# chaque déploiement change le service worker : les téléphones voient « Nouvelle version »
BUILD=$(git -C "$REPO" rev-parse --short HEAD 2>/dev/null || date +%s)
sed -i "s/^const CACHE = \"garde-manger-[^\"]*\";/const CACHE = \"garde-manger-$BUILD\";/" "$PUB/sw.js"
chown -R pocketbase:pocketbase "$PUB"

# Ajoute --publicDir et --hooksDir au service s'ils n'y sont pas encore
if [ -f "$UNIT" ] && ! grep -q -- "--publicDir" "$UNIT"; then
  echo "→ Activation des fichiers publics dans le service"
  sed -i "s#--migrationsDir=$PB_DIR/pb_migrations#--migrationsDir=$PB_DIR/pb_migrations --publicDir=$PUB#" "$UNIT"
fi
if [ -f "$UNIT" ] && ! grep -q -- "--hooksDir" "$UNIT"; then
  echo "→ Activation des règles serveur (pb_hooks) dans le service"
  sed -i "s#--migrationsDir=$PB_DIR/pb_migrations#--migrationsDir=$PB_DIR/pb_migrations --hooksDir=$PB_DIR/pb_hooks#" "$UNIT"
fi
# Réglages propres à Garde-manger (notifications…) : fichier lu par le service
ENVF="$PB_DIR/garde-manger.env"
if [ ! -f "$ENVF" ]; then
  cat > "$ENVF" <<'ENV'
# Garde-manger : réglages du serveur. Après modification : systemctl restart pocketbase
#
# Notifications des produits à finir, via ntfy (appli ntfy sur iPhone / Android).
# Choisissez un nom de sujet difficile à deviner, ou votre propre serveur ntfy.
#GM_NTFY_URL=https://ntfy.sh/garde-manger-changez-moi
#GM_NTFY_TOKEN=
# Heure d'envoi (format cron, heure du serveur) et horizon en jours
#GM_DIGEST_CRON=0 7 * * *
#GM_DIGEST_DAYS=2
ENV
  chmod 600 "$ENVF"
fi
if [ -f "$UNIT" ] && ! grep -q "^EnvironmentFile=" "$UNIT"; then
  sed -i "s#^WorkingDirectory=.*#&\nEnvironmentFile=-$ENVF#" "$UNIT"
fi
systemctl daemon-reload

echo "→ Migrations et règles serveur"
mkdir -p "$PB_DIR/pb_migrations" "$PB_DIR/pb_hooks"
cp "$REPO"/server/pb_migrations/*.js "$PB_DIR/pb_migrations/"
cp "$REPO"/server/pb_hooks/*.js "$PB_DIR/pb_hooks/"
chown -R pocketbase:pocketbase "$PB_DIR/pb_migrations" "$PB_DIR/pb_hooks"
systemctl restart pocketbase
sleep 2
curl -fsS http://localhost:8090/ -o /dev/null && echo "✔ App publiée : ouvrez votre domaine (ex. https://stock.quipaie.com/)" || { echo "L'app ne répond pas, voir : journalctl -u pocketbase -n 30"; exit 1; }
