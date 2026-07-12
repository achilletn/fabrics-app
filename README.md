# FabriCS — site + backend actualites

Application Node.js/Express qui sert le site FabriCS (fichiers statiques dans
`public/`) et ajoute une zone d'administration protegee (`/admin`) permettant
au staff de gerer les actualites, sans toucher au code.

Necessite **Node.js 22.5+** (utilise le module integre `node:sqlite`, pas de
base de donnees externe a installer ni de compilation native requise pour la
base de donnees).

## Deploiement rapide sur une VM (Makefile)

Une fois Node.js 22.5+ installe sur la VM (voir "Prerequis systeme" plus bas) :

```bash
git pull
make install                       # npm ci, genere .env avec des secrets
                                   # aleatoires, cree un compte admin
                                   # (identifiants affiches une seule fois
                                   # dans le terminal)
make                               # installe et demarre un service systemd
                                   # fabrics-app, actif au demarrage de la VM
make nginx DOMAIN=ton-domaine.fr   # nginx + HTTPS (Let's Encrypt) devant l'app,
                                   # et publie le site sur https://ton-domaine.fr
```

Ces trois cibles sont idempotentes : les relancer sur une VM deja installee
ne recree pas les secrets, le compte staff ni le certificat existants.
Commandes utiles ensuite : `make status`, `make logs`, `make restart`.

**Le serveur Node ecoute uniquement sur `127.0.0.1`** : il n'est jamais
expose directement a Internet. Tant que `make nginx` n'a pas ete lance, le
site n'est donc PAS joignable via le domaine - c'est normal. `make nginx`
place nginx + certbot devant, obtient le certificat TLS pour le domaine,
puis bascule l'app en mode HTTPS (`TRUST_PROXY`/`COOKIE_SECURE`) pour que la
connexion admin passe **obligatoirement par HTTPS**.

- Le **domaine** est le seul argument requis (certbot doit savoir pour quel
  nom demander le certificat ; la VM ne peut pas le deviner). Prerequis : un
  enregistrement DNS **A** du domaine vers l'IP publique de la VM.
- Email optionnel mais recommande (avis d'expiration Let's Encrypt) :
  `make nginx DOMAIN=ton-domaine.fr EMAIL=toi@exemple.fr`.

Pour une verification en local sur la VM avant `make nginx`, un tunnel SSH :
`ssh -L 8080:127.0.0.1:<PORT> user@ip-vm`, puis `http://localhost:8080`.

## Deploiement continu (mise a jour auto sur push)

Pour que chaque push sur `main` mette a jour le site tout seul, activer le
timer systemd de deploiement (une seule fois, sur la VM) :

```bash
make cd-install
```

A partir de la, un timer verifie le depot **toutes les 60 s** : des qu'un
nouveau commit apparait sur la branche suivie (`main`), il fait un
`git reset --hard` sur `origin/main`, relance `npm ci` **uniquement si les
dependances ont change**, puis redemarre le service. Sinon il ne fait rien.
Latence : jusqu'a ~1 min apres le push.

- Aucun secret ni port entrant : la VM tire les changements (elle utilise le
  token deja en cache cote depot), rien n'est pousse depuis l'exterieur.
- Le `git reset --hard` ecrase les modifications locales des fichiers
  **suivis** ; le `.env`, la base `data/` et `public/uploads/` sont ignores
  par git, donc jamais touches.
- Suivi : `make cd-status` (prochaine verif + resultat de la derniere) et
  `make cd-logs`. Desactivation : `make cd-disable`.

## Installation locale

```bash
cd fabrics-app
npm install
cp .env.example .env
# Editer .env : generer SESSION_SECRET et CSRF_SECRET avec :
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

npm run create-staff   # cree le premier compte staff (invite interactive)
npm run dev             # demarre sur http://127.0.0.1:3000
```

## Deploiement sur un VPS (Debian/Ubuntu)

### 1. Prerequis systeme

```bash
sudo apt update && sudo apt install -y nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt install -y nodejs
sudo apt install -y certbot python3-certbot-nginx ufw
```

### 2. Utilisateur dedie et code de l'application

```bash
sudo adduser --system --group --home /opt/fabrics-app fabrics
sudo -u fabrics git clone <votre-repo> /opt/fabrics-app
cd /opt/fabrics-app
sudo -u fabrics npm ci --omit=dev
sudo -u fabrics cp .env.example .env
sudo -u fabrics nano .env   # renseigner SESSION_SECRET, CSRF_SECRET, COOKIE_DOMAIN,
                            # PORT=3000, TRUST_PROXY=true, COOKIE_SECURE=true
sudo -u fabrics npm run create-staff
```

### 3. Service systemd

Creer `/etc/systemd/system/fabrics-app.service` :

```ini
[Unit]
Description=FabriCS app
After=network.target

[Service]
Type=simple
User=fabrics
Group=fabrics
WorkingDirectory=/opt/fabrics-app
ExecStart=/usr/bin/node src/server.js
Restart=on-failure
EnvironmentFile=/opt/fabrics-app/.env

# Durcissement
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/fabrics-app/data /opt/fabrics-app/public/uploads
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now fabrics-app
sudo systemctl status fabrics-app
```

### 4. nginx en reverse proxy (TLS)

Creer `/etc/nginx/sites-available/fabrics-app` :

```nginx
server {
    listen 80;
    server_name votre-domaine.fr;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/fabrics-app /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d votre-domaine.fr   # active HTTPS + redirection auto
```

Une fois HTTPS actif, verifier dans `.env` : `TRUST_PROXY=true` et
`COOKIE_SECURE=true`, puis `sudo systemctl restart fabrics-app`.

### 5. Pare-feu

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

Node n'ecoute que sur `127.0.0.1` : il n'est jamais expose directement a
Internet, seul nginx (80/443) l'est.

## Sauvegardes

Sauvegarder regulierement (cron) :
- `data/app.db` et `data/sessions.db` (base SQLite)
- `public/uploads/` (images des actualites)

```bash
0 3 * * * tar -czf /var/backups/fabrics-$(date +\%F).tar.gz -C /opt/fabrics-app data public/uploads
```

## Ajouter un compte staff supplementaire

```bash
cd /opt/fabrics-app
sudo -u fabrics npm run create-staff
```

Il n'existe volontairement aucun endpoint web d'inscription : la creation
d'un compte staff necessite un acces shell au serveur.

## Mise a jour des dependances

```bash
npm audit
npm outdated
```
