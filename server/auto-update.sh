#!/usr/bin/env bash
# Garde-manger : met l'app à jour quand un nouveau commit de main a passé les tests GitHub Actions.
# Lancé toutes les 10 minutes par le timer garde-manger-update (voir enable-auto-update.sh).
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

git fetch -q origin main
LOCAL=$(git rev-parse HEAD); REMOTE=$(git rev-parse origin/main)
[ "$LOCAL" = "$REMOTE" ] && exit 0

SLUG=$(git remote get-url origin | sed -E 's#^.*github\.com[:/]##; s#\.git$##')
JSON=$(curl -fsSL -H "Accept: application/vnd.github+json" "https://api.github.com/repos/$SLUG/commits/$REMOTE/check-runs") \
  || { echo "GitHub injoignable, nouvel essai plus tard"; exit 0; }
TOTAL=$(printf '%s' "$JSON" | grep -o '"total_count": *[0-9]*' | grep -o '[0-9]*$' || echo 0)
if [ "${TOTAL:-0}" -eq 0 ]; then echo "${REMOTE:0:7} : tests pas encore lancés"; exit 0; fi
if printf '%s' "$JSON" | grep -Eq '"status": *"(queued|in_progress|waiting|pending)"'; then echo "${REMOTE:0:7} : tests en cours"; exit 0; fi
if printf '%s' "$JSON" | grep -Eq '"conclusion": *"(failure|cancelled|timed_out|action_required|startup_failure)"'; then
  echo "${REMOTE:0:7} : tests en échec, l'app n'est pas mise à jour"; exit 0
fi

echo "Mise à jour ${LOCAL:0:7} → ${REMOTE:0:7}"
git merge -q --ff-only origin/main
bash "$REPO/server/deploy-app.sh"
