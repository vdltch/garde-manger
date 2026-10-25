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
systemctl daemon-reload

echo "→ Migrations et règles serveur"
mkdir -p "$PB_DIR/pb_migrations" "$PB_DIR/pb_hooks"
cp "$REPO"/server/pb_migrations/*.js "$PB_DIR/pb_migrations/"
cp "$REPO"/server/pb_hooks/*.pb.js "$PB_DIR/pb_hooks/"
chown -R pocketbase:pocketbase "$PB_DIR/pb_migrations" "$PB_DIR/pb_hooks"
systemctl restart pocketbase
sleep 2
curl -fsS http://localhost:8090/ -o /dev/null && echo "✔ App publiée : ouvrez votre domaine (ex. https://stock.quipaie.com/)" || { echo "L'app ne répond pas, voir : journalctl -u pocketbase -n 30"; exit 1; }
