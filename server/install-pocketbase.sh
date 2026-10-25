#!/usr/bin/env bash
# Installe PocketBase pour Garde-manger dans un conteneur LXC Debian/Ubuntu (Proxmox).
# Usage (en root, depuis le dossier server/ du repo) :
#   ADMIN_EMAIL=moi@exemple.fr ADMIN_PASSWORD='motdepasse-solide' bash install-pocketbase.sh
# Variables facultatives : PB_VERSION (ex. 0.30.0, sinon la dernière), PB_PORT (8090 par défaut).
set -euo pipefail

PB_DIR=/opt/pocketbase
PB_PORT=${PB_PORT:-8090}
HERE="$(cd "$(dirname "$0")" && pwd)"

[ "$(id -u)" -eq 0 ] || { echo "Lancez ce script en root."; exit 1; }
[ -n "${ADMIN_EMAIL:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ] || { echo "Définissez ADMIN_EMAIL et ADMIN_PASSWORD (10 caractères minimum)."; exit 1; }

case "$(dpkg --print-architecture)" in
  amd64) ARCH=amd64 ;; arm64) ARCH=arm64 ;;
  *) echo "Architecture non prise en charge : $(dpkg --print-architecture)"; exit 1 ;;
esac

echo "→ Paquets nécessaires"
apt-get update -qq
apt-get install -y -qq curl unzip ca-certificates >/dev/null

if [ -z "${PB_VERSION:-}" ]; then
  RELEASE_JSON=$(curl -fsSL https://api.github.com/repos/pocketbase/pocketbase/releases/latest)
  PB_VERSION=$(printf '%s\n' "$RELEASE_JSON" | sed -nE 's/.*"tag_name": *"v([^"]+)".*/\1/p' | head -n1 || true)
fi
[ -n "$PB_VERSION" ] || { echo "Impossible de trouver la dernière version. Relancez avec PB_VERSION=0.28.4 par exemple."; exit 1; }
echo "→ PocketBase v${PB_VERSION} (${ARCH})"

id pocketbase >/dev/null 2>&1 || useradd --system --home-dir "$PB_DIR" --shell /usr/sbin/nologin pocketbase
mkdir -p "$PB_DIR/pb_migrations" "$PB_DIR/pb_data"
curl -fsSL -o /tmp/pocketbase.zip "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${ARCH}.zip"
unzip -o -q /tmp/pocketbase.zip pocketbase -d "$PB_DIR"
rm -f /tmp/pocketbase.zip
cp "$HERE"/pb_migrations/*.js "$PB_DIR/pb_migrations/"
chown -R pocketbase:pocketbase "$PB_DIR"

echo "→ Service systemd"
cat > /etc/systemd/system/pocketbase.service <<UNIT
[Unit]
Description=PocketBase (Garde-manger)
After=network-online.target
Wants=network-online.target

[Service]
User=pocketbase
Group=pocketbase
WorkingDirectory=$PB_DIR
ExecStart=$PB_DIR/pocketbase serve --http=0.0.0.0:$PB_PORT --dir=$PB_DIR/pb_data --migrationsDir=$PB_DIR/pb_migrations --hooksDir=$PB_DIR/pb_hooks --publicDir=$PB_DIR/pb_public
Restart=on-failure
RestartSec=5
LimitNOFILE=4096
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=$PB_DIR

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now pocketbase
sleep 3

echo "→ Compte administrateur"
sudo -u pocketbase "$PB_DIR/pocketbase" superuser upsert "$ADMIN_EMAIL" "$ADMIN_PASSWORD" --dir="$PB_DIR/pb_data" 2>/dev/null \
  || runuser -u pocketbase -- "$PB_DIR/pocketbase" superuser upsert "$ADMIN_EMAIL" "$ADMIN_PASSWORD" --dir="$PB_DIR/pb_data"

echo "→ Publication de l'app"
bash "$HERE/deploy-app.sh"

IP=$(hostname -I | awk '{print $1}')
cat <<DONE

✔ PocketBase tourne sur http://$IP:$PB_PORT
  App :             http://$IP:$PB_PORT/
  Tableau de bord : http://$IP:$PB_PORT/_/  (réseau local uniquement, connexion avec ADMIN_EMAIL)

Étapes suivantes :
  1. Dans le tableau de bord → Collections → users → « New record » : créez un compte par personne du foyer.
  2. Exposez le serveur en HTTPS (Cloudflare Tunnel ou reverse proxy), voir le README.
  3. Ouvrez l'adresse HTTPS sur le téléphone, installez l'app, puis bouton nuage → e-mail/mot de passe.
  Mise à jour de l'app plus tard : bash deploy-app.sh
DONE
