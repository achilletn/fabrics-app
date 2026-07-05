NODE ?= node
SERVICE_NAME := fabrics-app
SERVICE_USER := $(shell whoami)
APP_DIR := $(shell pwd)
NODE_MIN_MAJOR := 22

.PHONY: all install check-node deps env seed staff service status logs restart

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

status:
	sudo systemctl status $(SERVICE_NAME) --no-pager

logs:
	sudo journalctl -u $(SERVICE_NAME) -f

restart:
	sudo systemctl restart $(SERVICE_NAME)
