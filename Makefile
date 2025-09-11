dev:
	docker compose -f /home/appointment-platform/infra/docker/compose.dev.yml down 
	docker compose -f /home/appointment-platform/infra/docker/compose.dev.yml up --build

prod:
	docker compose -f /home/appointment-platform/infra/docker/compose.prod.yml down 
	docker compose -f /home/appointment-platform/infra/docker/compose.prod.yml up -d --build

stop-dev:
	docker compose -f /home/appointment-platform/infra/docker/compose.dev.yml down -v

stop-prod:
	docker compose -f /home/appointment-platform/infra/docker/compose.prod.yml down -v

.PHONY: mongo-backup

mongo-backup:
	docker exec mongo_prod mongodump \
		--username pgaisse \
		--password Patoch-2202 \
		--authenticationDatabase admin \
		--db productionDB \
		--out /backup/$$(date +%F-%H%M)

mongo-backup-host:
	mongodump \
		--uri "mongodb://pgaisse:Patoch-2202@localhost:27017/productionDB?authSource=admin" \
		--out /home/appointment-platform/mongo-backup/$$(date +%F-%H%M)

mongo_dev:
	docker exec -it mongo_dev mongosh "mongodb://pgaisse:Patoch-2202@localhost:27017/productionDB?authSource=admin"
mongo_prod:
	docker exec -it mongo_prod mongosh "mongodb://pgaisse:Patoch-2202@mongo_prod:27017/productionDB?authSource=admin"
dev_api_logs:
	docker logs -f backend_dev
	