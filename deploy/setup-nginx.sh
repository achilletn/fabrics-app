#!/usr/bin/env bash
# Met l'application derriere nginx en reverse proxy + HTTPS (Let's Encrypt),
# puis bascule l'app en mode "derriere proxy HTTPS" et la redemarre.
#
# Usage :  sudo ./setup-nginx.sh <domaine> [email]
#   ou via le Makefile :  make nginx DOMAIN=ton-domaine.fr [EMAIL=toi@ex.fr]
#
# Le domaine est le SEUL argument obligatoire (certbot doit savoir pour quel
# nom demander le certificat ; la VM ne peut pas le deviner - voir README).
# L'email est optionnel mais recommande (avis d'expiration Let's Encrypt).
#
# Idempotent : peut etre relance sans danger.
set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"
SERVICE_NAME="fabrics-app"

if [ -z "$DOMAIN" ]; then
  echo "Erreur : domaine manquant." >&2
  echo "Usage : sudo $0 <domaine> [email]" >&2
  exit 1
fi

if [ "$(id -u)" -ne 0 ]; then
  echo "Ce script doit etre lance en root (sudo)." >&2
  exit 1
fi

# Racine de l'app = dossier parent de deploy/ (independant du cwd).
SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$APP_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Erreur : $ENV_FILE introuvable. Lancez 'make install' d'abord." >&2
  exit 1
fi

PORT="$(grep -E '^PORT=' "$ENV_FILE" | head -1 | cut -d= -f2 | tr -d '[:space:]')"
PORT="${PORT:-3000}"

echo "==> Domaine : $DOMAIN"
echo "==> App     : $APP_DIR (proxy vers 127.0.0.1:$PORT)"

# --- Verification DNS (avertissement seulement, pour ne pas bloquer un setup
# derriere Cloudflare/IPv6 ou l'A record ne pointe pas directement la VM) ---
PUBLIC_IP="$(curl -fsS --max-time 5 ifconfig.me 2>/dev/null || echo '')"
DOMAIN_IP="$(getent hosts "$DOMAIN" | awk '{print $1}' | head -1 || echo '')"
if [ -n "$PUBLIC_IP" ] && [ -n "$DOMAIN_IP" ] && [ "$PUBLIC_IP" != "$DOMAIN_IP" ]; then
  echo "AVERTISSEMENT : $DOMAIN pointe sur $DOMAIN_IP mais l'IP publique de la VM est $PUBLIC_IP."
  echo "                Si ce n'est pas voulu (proxy Cloudflare, etc.), certbot echouera."
fi

# --- 1. Paquets ---
echo "==> Installation de nginx, certbot, ufw..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx certbot python3-certbot-nginx ufw

# --- 2. Configuration nginx (reverse proxy) ---
echo "==> Ecriture de la configuration nginx..."
cat > "/etc/nginx/sites-available/$SERVICE_NAME" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOF

ln -sf "/etc/nginx/sites-available/$SERVICE_NAME" "/etc/nginx/sites-enabled/$SERVICE_NAME"
nginx -t
systemctl reload nginx

# --- 3. Pare-feu (avant certbot : le challenge HTTP-01 a besoin du port 80) ---
echo "==> Configuration du pare-feu ufw..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# --- 4. HTTPS via Let's Encrypt ---
echo "==> Obtention du certificat TLS pour $DOMAIN..."
CERTBOT_ARGS=(--nginx -d "$DOMAIN" --agree-tos --redirect --non-interactive)
if [ -n "$EMAIL" ]; then
  CERTBOT_ARGS+=(-m "$EMAIL")
else
  echo "AVERTISSEMENT : aucun email fourni, pas d'avis d'expiration Let's Encrypt."
  echo "                (relancez avec EMAIL=... pour les activer)"
  CERTBOT_ARGS+=(--register-unsafely-without-email)
fi
certbot "${CERTBOT_ARGS[@]}"

# --- 5. Basculer l'app en mode derriere proxy HTTPS ---
# (fait apres certbot : COOKIE_SECURE=true exige un HTTPS fonctionnel, sinon
# le cookie de session ne circule plus et la connexion admin devient impossible)
echo "==> Passage de l'app en mode HTTPS (TRUST_PROXY / COOKIE_SECURE)..."
OWNER="$(stat -c '%U:%G' "$ENV_FILE")"
sed -i 's/^TRUST_PROXY=.*/TRUST_PROXY=true/' "$ENV_FILE"
sed -i 's/^COOKIE_SECURE=.*/COOKIE_SECURE=true/' "$ENV_FILE"
# Preserve le proprietaire d'origine du .env (sed -i le reecrit en root sinon,
# ce qui empecherait l'utilisateur du service de le lire).
chown "$OWNER" "$ENV_FILE"

echo "==> Redemarrage du service $SERVICE_NAME..."
systemctl restart "$SERVICE_NAME"

echo ""
echo "========================================================"
echo " Termine. Site accessible sur :"
echo "   https://$DOMAIN"
echo "   https://$DOMAIN/admin   (connexion staff)"
echo "========================================================"
