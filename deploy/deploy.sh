#!/usr/bin/env bash
# Deploiement continu FabriCS : appele par le timer systemd fabrics-cd.timer.
# Verifie si la branche suivie a de nouveaux commits sur origin ; si oui, met a
# jour le code (et les dependances si besoin) puis redemarre le service. Sinon
# ne fait rien.
#
# Lance en root par systemd. Les operations git/npm sont executees en tant que
# proprietaire du depot (pour utiliser son token en cache et conserver les bons
# droits sur les fichiers) ; seul le redemarrage du service se fait en root.
set -euo pipefail

SERVICE_NAME="fabrics-app"

if [ "$(id -u)" -ne 0 ]; then
  echo "Ce script doit etre lance en root (il est declenche par fabrics-cd.timer)." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"

OWNER="$(stat -c '%U' "$APP_DIR")"
OWNER_HOME="$(getent passwd "$OWNER" | cut -d: -f6)"

# Execute une commande en tant que proprietaire du depot, avec son HOME
# (necessaire pour ~/.git-credentials et le cache npm).
as_owner() { runuser -u "$OWNER" -- env "HOME=$OWNER_HOME" "$@"; }

cd "$APP_DIR"

BRANCH="$(as_owner git rev-parse --abbrev-ref HEAD)"
as_owner git fetch --quiet origin "$BRANCH"

LOCAL="$(as_owner git rev-parse HEAD)"
REMOTE="$(as_owner git rev-parse "origin/$BRANCH")"

if [ "$LOCAL" = "$REMOTE" ]; then
  exit 0   # rien de nouveau
fi

echo "Mise a jour de $BRANCH : ${LOCAL:0:8} -> ${REMOTE:0:8}"

# Les dependances ont-elles change entre les deux revisions ?
DEPS_CHANGED=0
if ! as_owner git diff --quiet "$LOCAL" "$REMOTE" -- package.json package-lock.json; then
  DEPS_CHANGED=1
fi

as_owner git reset --hard "origin/$BRANCH"

if [ "$DEPS_CHANGED" -eq 1 ]; then
  echo "Dependances modifiees -> npm ci --omit=dev"
  as_owner npm ci --omit=dev
fi

systemctl restart "$SERVICE_NAME"
echo "Service $SERVICE_NAME redemarre sur ${REMOTE:0:8}."
