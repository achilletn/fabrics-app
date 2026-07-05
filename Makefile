NODE ?= node
SERVICE_NAME := fabrics-app
SERVICE_USER := $(shell whoami)
APP_DIR := $(shell pwd)
NODE_MIN_MAJOR := 22

.PHONY: all install check-node deps env seed staff service nginx cd-install cd-status cd-logs cd-disable status logs restart

all: service

install: check-node deps env seed staff
	@echo "Installation terminee. Lancez 'make' pour demarrer le service."

check-node:
	@v=$$($(NODE) -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0); \
	if [ "$$v" -lt $(NODE_MIN_MAJOR) ]; then \
		echo "Node.js >= 22.5 requis (trouve: $$($(NODE) --version 2>/dev/null || echo absent))."; \
		echo "Voir README.md, section Prerequis systeme, pour l'installer via nodesource."; \
		exit 1; \
	fi

deps:
	npm ci --omit=dev

env: .env

.env: .env.example
	cp .env.example .env
	@SESSION_SECRET=$$($(NODE) -e "console.log(require('crypto').randomBytes(32).toString('hex'))"); \
	CSRF_SECRET=$$($(NODE) -e "console.log(require('crypto').randomBytes(32).toString('hex'))"); \
	sed -i "s/^SESSION_SECRET=.*/SESSION_SECRET=$$SESSION_SECRET/" .env; \
	sed -i "s/^CSRF_SECRET=.*/CSRF_SECRET=$$CSRF_SECRET/" .env
	@echo ".env cree avec des secrets generes automatiquement (SMTP a completer manuellement si besoin)."

seed:
	$(NODE) scripts/seed-actualites.js

staff:
	$(NODE) scripts/create-admin-auto.js

service:
	@if [ ! -f .env ]; then echo "Aucun .env : lancez 'make install' d'abord."; exit 1; fi
	sed -e "s#{{WORKDIR}}#$(APP_DIR)#g" -e "s#{{USER}}#$(SERVICE_USER)#g" \
		deploy/fabrics-app.service.tmpl | sudo tee /etc/systemd/system/$(SERVICE_NAME).service > /dev/null
	sudo systemctl daemon-reload
	sudo systemctl enable --now $(SERVICE_NAME)
	@echo ""
	@. ./.env 2>/dev/null; echo "Service $(SERVICE_NAME) demarre sur le port $${PORT:-3000}."
	sudo systemctl status $(SERVICE_NAME) --no-pager

nginx:
	@if [ -z "$(DOMAIN)" ]; then \
		echo "Usage : make nginx DOMAIN=ton-domaine.fr [EMAIL=toi@exemple.fr]"; \
		exit 1; \
	fi
	sudo bash deploy/setup-nginx.sh "$(DOMAIN)" "$(EMAIL)"

cd-install:
	@if [ ! -d .git ]; then echo "Pas un depot git ici : le CD a besoin de git."; exit 1; fi
	sed -e "s#{{WORKDIR}}#$(APP_DIR)#g" deploy/fabrics-cd.service.tmpl \
		| sudo tee /etc/systemd/system/fabrics-cd.service > /dev/null
	sudo cp deploy/fabrics-cd.timer /etc/systemd/system/fabrics-cd.timer
	sudo systemctl daemon-reload
	sudo systemctl enable --now fabrics-cd.timer
	@echo "CD active : le depot est verifie toutes les 60s (git pull + restart si nouveau commit)."
	@echo "Suivi : 'make cd-status' / 'make cd-logs'. Desactivation : 'make cd-disable'."

cd-status:
	systemctl list-timers fabrics-cd.timer --no-pager || true
	@echo "--- derniere execution du deploiement ---"
	systemctl status fabrics-cd.service --no-pager || true

cd-logs:
	sudo journalctl -u fabrics-cd.service -f

cd-disable:
	sudo systemctl disable --now fabrics-cd.timer
	@echo "CD desactive (le service continue de tourner sur la version deployee)."

status:
	sudo systemctl status $(SERVICE_NAME) --no-pager

logs:
	sudo journalctl -u $(SERVICE_NAME) -f

restart:
	sudo systemctl restart $(SERVICE_NAME)
