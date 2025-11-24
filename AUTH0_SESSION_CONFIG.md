# Configuración de Sesión Auth0 - 10 Horas

## 🎯 Resumen
El sistema ahora implementa sesiones con duración máxima de **10 horas**. Después de este tiempo, los usuarios son redirigidos automáticamente al login.

## 🔧 Configuración en Auth0 Dashboard

### 1. Token Expiration Settings

Ve a: **Applications → [Tu Aplicación] → Settings → Advanced Settings**

#### ID Token Expiration
```
Valor: 36000 segundos (10 horas)
```

#### Access Token Expiration  
```
Valor: 36000 segundos (10 horas)
```

### 2. Refresh Token Settings

Ve a: **Applications → [Tu Aplicación] → Settings → Advanced Settings → Grant Types**

Asegúrate de tener habilitado:
- ✅ **Refresh Token**
- ✅ **Offline Access** (en scopes)

#### Refresh Token Rotation
```
Rotation: Enabled
Reuse Interval: 0 seconds
Absolute Lifetime: 36000 seconds (10 horas)
Inactivity Lifetime: 36000 seconds (10 horas)
```

### 3. Session Lifetime

Ve a: **Tenant Settings → Advanced**

```
Inactivity timeout: 36000 seconds (10 horas)
Require login after: 36000 seconds (10 horas)
```

## 🚀 Características Implementadas

### Frontend (`apps/frontend`)

#### 1. SessionTimeoutGuard
- **Ubicación**: `src/auth/SessionTimeoutGuard.tsx`
- **Función**: Rastrea el tiempo de sesión desde el login
- **Características**:
  - ⏰ Cuenta regresiva de 10 horas desde el login
  - ⚠️ Alerta 5 minutos antes de expirar
  - 🔒 Cierre automático y redirección al login al expirar
  - 💾 Persistencia del timestamp en localStorage

#### 2. AuthAutoLogoutGuard (Mejorado)
- **Ubicación**: `src/auth/AuthAutoLogoutGuard.tsx`
- **Mejoras**:
  - 🔄 Verificación cada 2 minutos (antes 4)
  - 🎯 Detección más rápida de tokens expirados

#### 3. useAuthFetch (Mejorado)
- **Ubicación**: `src/api/authFetch.ts`
- **Nuevas características**:
  - 🔄 Retry automático con refresh token en 401
  - 🚫 Redirección automática si el refresh falla
  - ⚡ Manejo inteligente de errores de Auth0
  - 📊 Logging detallado de fallos

### Backend (`apps/backend`)

#### 1. validateSessionDuration Middleware
- **Ubicación**: `src/middleware/auth.js`
- **Función**: Valida que los tokens no excedan 10 horas
- **Características**:
  - ⏱️ Calcula edad del token desde `iat` (issued at)
  - 🚫 Rechaza requests con tokens > 10 horas
  - ⚠️ Header `X-Session-Warning` si quedan < 30 min
  - 📝 Respuesta 401 con código `SESSION_TIMEOUT`

## 📊 Flujo de Expiración

```
1. Usuario hace login
   ↓
2. SessionTimeoutGuard guarda timestamp en localStorage
   ↓
3. Cada 2 minutos: AuthAutoLogoutGuard valida token
   ↓
4. A las 9h 55min: Alerta "Session expiring in 5 minutes"
   ↓
5. A las 10 horas EXACTAS:
   - Frontend: SessionTimeoutGuard cierra sesión
   - Backend: validateSessionDuration rechaza requests
   ↓
6. Usuario redirigido a /login
```

## 🧪 Testing

### Probar Expiración Manual

```javascript
// En la consola del navegador:
// Simular que ya pasaron 10 horas
localStorage.setItem('auth_session_start', Date.now() - (10 * 60 * 60 * 1000 + 1000));
// Recargar la página - debería cerrar sesión inmediatamente
```

### Probar Warning de 5 Minutos

```javascript
// Simular que faltan 4 minutos
localStorage.setItem('auth_session_start', Date.now() - (9 * 60 * 60 * 1000 + 56 * 60 * 1000));
// Recargar - debería mostrar warning
```

## ⚙️ Variables de Entorno

### Frontend (`.env`)
```bash
VITE_AUTH0_DOMAIN=your-tenant.auth0.com
VITE_AUTH0_CLIENT_ID=your_client_id
VITE_AUTH0_AUDIENCE=https://api.dev.iconicsmiles
```

### Backend (`.env`)
```bash
AUTH0_AUDIENCE=https://api.dev.iconicsmiles
AUTH0_ISSUER_BASE_URL=https://your-tenant.auth0.com/
JWT_CLAIMS_NAMESPACE=https://letsmarter.com/
```

## 🔍 Debugging

### Frontend Logs
```javascript
// Ver timestamp de sesión
console.log('Session start:', localStorage.getItem('auth_session_start'));

// Calcular tiempo restante
const start = parseInt(localStorage.getItem('auth_session_start'));
const remaining = (10 * 60 * 60 * 1000) - (Date.now() - start);
console.log('Remaining:', Math.floor(remaining / 1000 / 60), 'minutes');
```

### Backend Logs
```bash
# En consola del servidor, buscar:
[validateSessionDuration] Session exceeded 10 hours
[authFetch] Received 401, attempting token refresh...
```

## 📝 Checklist de Implementación

- [x] SessionTimeoutGuard creado
- [x] AuthAutoLogoutGuard mejorado (2 min)
- [x] useAuthFetch con retry y manejo 401
- [x] validateSessionDuration middleware backend
- [x] Integración en main.tsx
- [x] Alertas visuales (Chakra Toast)
- [ ] Configuración Auth0 Dashboard (MANUAL)
- [ ] Testing en dev
- [ ] Testing en producción

## 🚨 Importante

**DEBES configurar manualmente en Auth0 Dashboard:**
1. Token expirations (10 horas)
2. Refresh token settings
3. Session lifetime

Sin esta configuración, Auth0 seguirá emitiendo tokens con su expiración por defecto (24 horas típicamente).

## 📧 Soporte

Si tienes problemas:
1. Verifica logs del navegador (F12)
2. Verifica logs del servidor
3. Confirma configuración Auth0
4. Revisa que las variables de entorno estén correctas
