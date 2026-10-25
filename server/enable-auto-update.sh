#!/usr/bin/env bash
# Active la mise à jour automatique de Garde-manger (toutes les 10 minutes, seulement si les tests sont verts).
# Usage (en root, depuis le dossier server/ du repo) : bash enable-auto-update.sh
# Désactiver : systemctl disable --now garde-manger-update.timer      Journal : journalctl -u garde-manger-update
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Lancez ce script en root."; exit 1; }
REPO="$(cd "$(dirname "$0")/.." && pwd)"

cat > /etc/systemd/system/garde-manger-update.service <<UNIT
[Unit]
Description=Garde-manger : mise à jour automatique
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/bin/bash $REPO/server/auto-update.sh
UNIT

cat > /etc/systemd/system/garde-manger-update.timer <<UNIT
[Unit]
Description=Garde-manger : vérifier les mises à jour toutes les 10 minutes

[Timer]
OnBootSec=5min
OnUnitActiveSec=10min
RandomizedDelaySec=60

[Install]
WantedBy=timers.target
UNIT

systemctl daemon-reload
systemctl enable --now garde-manger-update.timer
echo "✔ Mise à jour automatique activée. Prochaine vérification :"
systemctl list-timers garde-manger-update.timer --no-pager | head -3
