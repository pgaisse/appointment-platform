#!/bin/bash
set -e

echo "⚠️  ADVERTENCIA: Esto copiará la BD de PROD a DEV"
read -p "¿Continuar? (yes/no): " confirm

if [[ "$confirm" == "yes" ]]; then
    echo ">> Creando backup temporal de PROD..."
    BACKUP_NAME=$(date +%F-%H%M)
    
    docker exec mongo_prod mongodump \
        --username "pgaisse" \
        --password "Patoch-2202" \
        --authenticationDatabase admin \
        --db productionDB \
        --out /backup/$BACKUP_NAME
    
    echo ">> Copiando backup al host..."
    docker cp mongo_prod:/backup/$BACKUP_NAME /tmp/
    
    echo ">> Copiando backup a DEV..."
    docker cp /tmp/$BACKUP_NAME mongo_dev:/tmp/restore/
    
    echo ">> Restaurando en DEV..."
    docker exec mongo_dev mongorestore \
        --username "pgaisse" \
        --password "Patoch-2202" \
        --authenticationDatabase admin \
        --db productionDB \
        --drop \
        /tmp/restore/$BACKUP_NAME/productionDB
    
    echo ">> Limpiando archivos temporales..."
    rm -rf /tmp/$BACKUP_NAME
    docker exec mongo_dev rm -rf /tmp/restore/$BACKUP_NAME
    docker exec mongo_prod rm -rf /backup/$BACKUP_NAME
    
    echo "✔ Copia de PROD a DEV completada"
else
    echo "Cancelado"
fi
