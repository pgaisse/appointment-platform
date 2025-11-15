# 📋 Guía de Acceso a Logs en Docker

## 🐳 Comandos para Logs de Contenedores

### Backend (API)
```bash
# Desarrollo
make dev_api_logs
# O directamente:
docker logs -f backend_dev

# Producción
make dev_api_logsprod
# O directamente:
docker logs -f api_prod
```

### Frontend
```bash
# Desarrollo
docker logs -f frontend_dev

# No hay comando make específico para frontend
```

### MongoDB
```bash
# Desarrollo
docker logs -f mongo_dev

# Producción
docker logs -f mongo_prod
```

### Nginx
```bash
# Desarrollo
docker logs -f nginx_dev

# Producción
docker logs -f nginx_prod
```

## 📝 Comandos Make Disponibles (desde Makefile)

### Logs específicos:
- `make dev_api_logs` - Logs del backend de desarrollo
- `make dev_api_logsprod` - Logs del API de producción

### Acceso a MongoDB:
- `make mongo_dev` - Conectar a MongoDB desarrollo
- `make mongo_prod` - Conectar a MongoDB producción

### Otros comandos útiles:
- `make prod-logs` - Logs de api_prod y nginx_prod
- `make prod-space` - Información de espacio en disco

## 🔍 Comandos Docker Directos

### Listar contenedores activos:
```bash
docker ps
# Con formato personalizado:
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"
```

### Ver logs de cualquier contenedor:
```bash
# Seguir logs en tiempo real (-f)
docker logs -f <nombre_contenedor>

# Ver últimas 100 líneas
docker logs --tail=100 <nombre_contenedor>

# Ver logs con timestamps
docker logs -t <nombre_contenedor>

# Combinar opciones
docker logs -f --tail=200 <nombre_contenedor>
```

### Ejemplos prácticos:
```bash
# Frontend logs en tiempo real
docker logs -f frontend_dev

# Backend logs últimas 50 líneas
docker logs --tail=50 backend_dev

# Nginx logs con timestamps
docker logs -t nginx_dev
```

## 🏗️ Estructura de Contenedores

### Desarrollo (dev):
- `frontend_dev` - Frontend React/Vite (puerto 3004)
- `backend_dev` - API Node.js (puerto 3003) 
- `mongo_dev` - MongoDB desarrollo
- `nginx_dev` - Proxy reverso desarrollo

### Producción (prod):
- `api_prod` - API Node.js producción
- `mongo_prod` - MongoDB producción
- `nginx_prod` - Proxy reverso producción

## 🚀 Comandos de Desarrollo Rápido

### Reiniciar desarrollo completo:
```bash
make dev
```

### Solo reiniciar sin rebuild:
```bash
make dev-fast
```

### Ver todos los logs de desarrollo al mismo tiempo:
```bash
# En terminales separadas:
docker logs -f frontend_dev
docker logs -f backend_dev
docker logs -f nginx_dev
```

## 🔧 Troubleshooting

### Si un contenedor no responde:
```bash
# Ver estado de todos los contenedores
docker ps -a

# Inspeccionar un contenedor específico
docker inspect <nombre_contenedor>

# Entrar al contenedor (si está corriendo)
docker exec -it <nombre_contenedor> /bin/sh
# o
docker exec -it <nombre_contenedor> /bin/bash
```

### Limpiar logs pesados:
```bash
# Ver tamaño de logs
docker system df

# Los logs se limpian automáticamente con:
make dev  # (trunca logs automáticamente)
```

## 📍 URLs de Acceso

### Desarrollo:
- Frontend: `https://dev.letsmarter.com:8443`
- Backend API: `https://dev.letsmarter.com:8443/api`

### Producción:
- Frontend: `https://letsmarter.com`
- Backend API: `https://letsmarter.com/api`

---
*Última actualización: $(date)*
*Ubicación: /home/appointment-platform/DOCKER_LOGS_GUIDE.md*