dev:
	docker compose -f /home/appointment-platform/infra/docker/compose.dev.yml down 
	docker compose -f /home/appointment-platform/infra/docker/compose.dev.yml up --build

prod:
	docker compose -f /home/appointment-platform/infra/docker/compose.prod.yml down 
	docker compose -f /home/appointment-platform/infra/docker/compose.prod.yml up -d --build

stop-dev:
	docker compose -f /home/appointment-platform/infra/docker/compose.dev.yml down 

stop-prod:
	docker compose -f /home/appointment-platform/infra/docker/compose.prod.yml down