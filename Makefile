# ========= CONFIG GLOBAL =========
SHELL := /bin/bash
.ONESHELL:

# Rutas compose
COMPOSE_DEV  ?= /home/appointment-platform/infra/docker/compose.dev.yml
COMPOSE_PROD ?= /home/appointment-platform/infra/docker/compose.prod.yml

# Project names
PROJECT_DEV  ?= dev
PROJECT_PROD ?= prod

# Protección de recursos críticos
PROTECT_CONT_REGEX ?= (^mongo_prod$$|^api_prod$$|^nginx_prod$$|^prod_.*)
PROTECT_VOL_REGEX  ?= (^prod_prod_mongo_data$$)

# Flags
DEEP      ?= 0   # 1 = limpiar volúmenes NO usados
NO_BUILD  ?= 0   # 1 = no reconstruir imágenes

# ========= HELP =========
.PHONY: help
help:
	@echo "Targets:"
	@echo "  make dev         -> Limpia basura y levanta DEV limpio"
	@echo "  make dev-deep    -> DEV + prune de volúmenes NO usados"
	@echo "  make dev-fast    -> DEV rápido (sin --build)"
	@echo "  make dev-down    -> Baja DEV (--remove-orphans)"
	@echo "  make dev-up      -> Sube DEV (build + --remove-orphans)"
	@echo "  make prod        -> Deploy seguro de PROD (api/nginx) SIN tocar Mongo"
	@echo "  make prod-rolling-> Recreate api/nginx en caliente"
	@echo "  make prod-clean  -> Limpieza prudente en PROD (no toca mongo_prod)"
	@echo "  make prod-jobs-once -> Ejecuta perfiles 'once' (certbot/init) y limpia"
	@echo "  make prod-certbot   -> Ejecuta certbot one-shot (profiles: once)"
	@echo "  make prod-init-replica -> Ejecuta init réplica one-shot"
	@echo "  make prod-space   -> Resumen de espacio en host"
	@echo "  make mongo-backup / mongo-backup-host / mongo_dev / mongo_prod / dev_api_logs / dev_api_logsprod"

# ========= DEV =========
.PHONY: dev dev-deep dev-fast dev-down dev-up
dev:
	@set -euo pipefail; \
	if [[ ! -f "$(COMPOSE_DEV)" ]]; then echo "No existe: $(COMPOSE_DEV)"; exit 1; fi; \
	echo ">> Truncando logs (excluye protegidos)…"; \
	for id in $$(docker ps -a -q); do \
	  name=$$(docker inspect -f '{{.Name}}' $$id | sed 's#^/##'); \
	  log=$$(docker inspect -f '{{.LogPath}}' $$id 2>/dev/null || true); \
	  if [[ -n "$$log" && -f "$$log" && ! "$$name" =~ $(PROTECT_CONT_REGEX) ]]; then : > "$$log" || true; fi; \
	done; \
	echo ">> Down DEV --remove-orphans"; \
	docker compose -p "$(PROJECT_DEV)" -f "$(COMPOSE_DEV)" down --remove-orphans; \
	echo ">> Limpieza residuos (Exited/Redes/Imágenes)…"; \
	docker ps -aq -f status=exited | xargs -r docker rm >/dev/null || true; \
	docker network prune -f >/dev/null || true; \
	docker image prune -f >/dev/null || true; \
	docker image prune -af >/dev/null || true; \
	echo ">> Prune caché build…"; \
	docker builder prune -a -f >/dev/null || true; \
	docker buildx prune -a -f >/dev/null || true; \
	if [[ "$(DEEP)" == "1" ]]; then \
	  echo ">> Prune volúmenes NO usados (protegiendo $(PROTECT_VOL_REGEX))…"; \
	  docker volume prune -f >/dev/null || true; \
	  for vol in $$(docker volume ls -q); do \
	    if ! echo "$$vol" | grep -Eq "$(PROTECT_VOL_REGEX)"; then \
	      inuse=$$(docker ps --filter volume="$$vol" -q); \
	      if [[ -z "$$inuse" ]]; then docker volume rm "$$vol" >/dev/null || true; fi; \
	    fi; \
	  done; \
	fi; \
	UP_FLAGS="--remove-orphans -d"; \
	[[ "$(NO_BUILD)" == "1" ]] || UP_FLAGS="$$UP_FLAGS --build"; \
	echo ">> Up DEV $$UP_FLAGS"; \
	docker compose -p "$(PROJECT_DEV)" -f "$(COMPOSE_DEV)" up $$UP_FLAGS; \
	echo ">> Resumen espacio"; \
	df -hT | sed -n '1,5p' || true; docker system df || true; \
	echo "✔ DEV listo"

dev-deep:
	@$(MAKE) dev DEEP=1

dev-fast:
	@$(MAKE) dev NO_BUILD=1

dev-down:
	@docker compose -p "$(PROJECT_DEV)" -f "$(COMPOSE_DEV)" down --remove-orphans

dev-up:
	@docker compose -p "$(PROJECT_DEV)" -f "$(COMPOSE_DEV)" up -d --build --remove-orphans

# ========= PROD (seguro: no toca mongo_prod) =========
.PHONY: prod prod-up prod-rolling prod-down-safe prod-clean prod-space prod-logs prod-jobs-once prod-certbot prod-init-replica
prod: ## Deploy seguro de prod (api/nginx) SIN tocar Mongo
	@$(MAKE) prod-up

prod-up:
	@if [[ ! -f "$(COMPOSE_PROD)" ]]; then echo "No existe: $(COMPOSE_PROD)"; exit 1; fi
	echo ">> PROD up (api, nginx) --build --remove-orphans"
	docker compose -p "$(PROJECT_PROD)" -f "$(COMPOSE_PROD)" up -d --build --remove-orphans api nginx
	echo "✔ PROD actualizado (Mongo PROD intacto)"

prod-rolling:
	@if [[ ! -f "$(COMPOSE_PROD)" ]]; then echo "No existe: $(COMPOSE_PROD)"; exit 1; fi
	echo ">> Rolling recreate api/nginx"
	docker compose -p "$(PROJECT_PROD)" -f "$(COMPOSE_PROD)" up -d --no-deps --build api nginx
	echo "✔ Rolling listo"

prod-down-safe:
	@if [[ ! -f "$(COMPOSE_PROD)" ]]; then echo "No existe: $(COMPOSE_PROD)"; exit 1; fi
	echo ">> Down sólo api/nginx (Mongo PROD intacto)"
	docker compose -p "$(PROJECT_PROD)" -f "$(COMPOSE_PROD)" down --remove-orphans api nginx || true

prod-clean:
	@set -euo pipefail; \
	echo ">> Truncando logs (excluye protegidos)…"; \
	for id in $$(docker ps -a -q); do \
	  name=$$(docker inspect -f '{{.Name}}' $$id | sed 's#^/##'); \
	  log=$$(docker inspect -f '{{.LogPath}}' $$id 2>/dev/null || true); \
	  if [[ -n "$$log" && -f "$$log" && ! "$$name" =~ $(PROTECT_CONT_REGEX) ]]; then : > "$$log" || true; fi; \
	done; \
	echo ">> Eliminando contenedores TERMINADOS"; \
	docker ps -aq -f status=exited | xargs -r docker rm >/dev/null || true; \
	echo ">> Prune redes sin uso"; docker network prune -f >/dev/null || true; \
	echo ">> Prune imágenes"; docker image prune -f >/dev/null || true; docker image prune -af >/dev/null || true; \
	echo ">> Prune volúmenes NO usados (protegiendo $(PROTECT_VOL_REGEX))"; \
	docker volume prune -f >/dev/null || true; \
	for vol in $$(docker volume ls -q); do \
	  if ! echo "$$vol" | grep -Eq "$(PROTECT_VOL_REGEX)"; then \
	    inuse=$$(docker ps --filter volume="$$vol" -q); \
	    if [[ -z "$$inuse" ]]; then docker volume rm "$$vol" >/dev/null || true; fi; \
	  fi; \
	done; \
	echo "✔ Limpieza PROD completada (mongo_prod intacto)"

prod-jobs-once:
	@if [[ ! -f "$(COMPOSE_PROD)" ]]; then echo "No existe: $(COMPOSE_PROD)"; exit 1; fi
	echo ">> Ejecutando perfiles once (certbot/init/etc.)"
	COMPOSE_PROFILES=once docker compose -p "$(PROJECT_PROD)" -f "$(COMPOSE_PROD)" up --abort-on-container-exit
	echo ">> Limpiando contenedores de jobs once"
	docker compose -p "$(PROJECT_PROD)" -f "$(COMPOSE_PROD)" rm -f
	echo "✔ Jobs once ejecutados y limpiados"

prod-certbot:
	@COMPOSE_PROFILES=once docker compose -p "$(PROJECT_PROD)" -f "$(COMPOSE_PROD)" run --rm certbot

prod-init-replica:
	@COMPOSE_PROFILES=once docker compose -p "$(PROJECT_PROD)" -f "$(COMPOSE_PROD)" up --abort-on-container-exit mongo-init-replica
	@docker compose -p "$(PROJECT_PROD)" -f "$(COMPOSE_PROD)" rm -f mongo-init-replica

prod-space:
	@df -hT | sed -n '1,5p'; echo; docker system df; echo; sudo du -sh /var/lib/docker || true

prod-logs:
	@echo "== api_prod =="; docker logs --tail=200 -f api_prod
	@echo "== nginx_prod =="; docker logs --tail=200 -f nginx_prod

# ========= BACKUPS / UTIL =========
.PHONY: mongo-backup mongo-backup-host mongo_dev mongo_prod dev_api_logs dev_api_logsprod
# Usa variables de entorno: MONGO_USER, MONGO_PASS, MONGO_URI, MONGO_URI_DEV
mongo-backup:
	docker exec mongo_prod mongodump \
		--username "$$MONGO_USER" \
		--password "$$MONGO_PASS" \
		--authenticationDatabase admin \
		--db productionDB \
		--out /backup/$$(date +%F-%H%M)

mongo-backup-host:
	mongodump \
		--uri "$$MONGO_URI" \
		--out /home/appointment-platform/mongo-backup/$$(date +%F-%H%M)

mongo_dev:
	docker exec -it mongo_dev mongosh "mongodb://pgaisse:Patoch-2202@mongo_dev:27017/productionDB?authSource=admin"

mongo_prod:
	docker exec -it mongo_prod mongosh "mongodb://pgaisse:Patoch-2202@mongo_prod:27017/productionDB?authSource=admin"

dev_api_logs:
	docker logs -f backend_dev

dev_api_logsprod:
	docker logs -f api_prod
