# Sistema de Validación de Sesión Automática

## Resumen

Se ha implementado un sistema robusto que verifica automáticamente la validez de la sesión y redirige al usuario al login cuando el backend rechaza la conexión por sesión inválida (errores 401/403).

## Componentes Implementados

### 1. **SessionValidator** (`/auth/SessionValidator.tsx`)
- Componente de monitoreo global que se ejecuta en el árbol principal de la app
- Suscribe al cache de React Query para detectar errores de autenticación
- Intercepta errores 401 (session expired) y 403 (access denied)
- Redirige automáticamente a `/login` con parámetro `reason`

### 2. **QueryClient Global Error Handler** (`/main.tsx`)
- Configurado en el QueryClient para interceptar errores antes del retry
- Maneja errores 401/403 en queries y mutations
- Previene reintentos innecesarios en errores de autenticación
- Llama a `handleGlobalQueryError` que redirige al login

### 3. **useAuthFetch Mejorado** (`/lib/authFetch.ts`)
- Verificación de autenticación antes de cada petición
- Sistema de retry inteligente con refresh de token
- Manejo específico de errores 401/403 con un solo reintento
- Detección de errores de Auth0 (login_required, invalid_grant, etc.)
- Redirección automática al login con razón específica

### 4. **authFetch API** (`/api/authFetch.ts`)
- Similar a useAuthFetch pero para uso en contextos no-hook
- Sistema de retry con refresh de token
- Manejo de errores 401/403 con redirección automática
- Incluye status code en los errores para mejor debugging

### 5. **Login Mejorado** (`/Routes/SignIn/index.tsx`)
- Manejo ampliado de parámetros `reason` en la URL
- Mensajes específicos según el tipo de error:
  - `session_timeout`: Sesión expirada por inactividad
  - `session_expired`/`token_expired`: Token caducado
  - `access_denied`: Sin permisos de acceso
  - `not_authenticated`: No autenticado
  - `auth_error`: Error de autenticación genérico
- Toast notifications con status apropiado (warning/error/info)

## Flujo de Validación

```
1. Usuario hace petición → useAuthFetch/authFetch
                           ↓
2. Verificar isAuthenticated
   - NO → Redirigir a /login?reason=not_authenticated
   - SI → Continuar
                           ↓
3. Obtener token de Auth0
   - Error → Redirigir según tipo de error
   - OK → Continuar
                           ↓
4. Hacer petición al backend
                           ↓
5. Backend responde
   - 401/403 (primer intento) → Refresh token y reintentar
   - 401/403 (segundo intento) → Redirigir a /login?reason=session_expired
   - Otro error → Lanzar error normal
   - OK → Retornar respuesta
                           ↓
6. Si error en React Query → SessionValidator detecta 401/403
                           → Redirigir a /login
```

## Características de Seguridad

### Prevención de Loops de Redirección
- Flag `reauth_in_progress` en sessionStorage
- Se verifica antes de cada redirección
- Se limpia al llegar al login

### Limpieza de Estado
- `localStorage.clear()` - tokens, preferencias
- `sessionStorage.clear()` - estado temporal
- Se ejecuta antes de redirección

### Retry Inteligente
- Máximo 1 reintento con token refrescado
- No reintentar 404 (not found)
- Máximo 1 reintento en errores 5xx (server errors)
- No reintentar 401/403 después del primer refresh fallido

## Códigos de Error Manejados

| Status | Descripción | Acción |
|--------|-------------|--------|
| 401 | Unauthorized - Token inválido/expirado | Refresh token → Retry → Login |
| 403 | Forbidden - Sin permisos | Refresh token → Retry → Login |
| 404 | Not Found | No reintentar |
| 5xx | Server Error | 1 reintento |

## Códigos de Reason

| Reason | Origen | Mensaje |
|--------|--------|---------|
| `session_timeout` | SessionTimeoutGuard | Sesión expirada por inactividad |
| `session_expired` | authFetch 401 | Token caducado |
| `token_expired` | authFetch 401 | Token caducado |
| `access_denied` | authFetch 403 | Sin permisos |
| `not_authenticated` | authFetch pre-check | No autenticado |
| `login_required` | Auth0 error | Login requerido |
| `consent_required` | Auth0 error | Consentimiento requerido |
| `missing_refresh_token` | Auth0 error | Refresh token faltante |
| `invalid_grant` | Auth0 error | Grant inválido |
| `auth_error` | Auth0 genérico | Error de autenticación |

## Testing

Para verificar el sistema:

1. **Expiración natural de sesión:**
   - Esperar el timeout configurado
   - Verificar redirección automática a `/login?reason=session_timeout`

2. **Token inválido:**
   - Manipular localStorage para invalidar token
   - Hacer cualquier petición
   - Verificar redirección a `/login?reason=session_expired`

3. **Backend rechaza conexión:**
   - Backend retorna 401/403
   - Verificar intento de refresh
   - Verificar redirección después del segundo fallo

4. **Error de Auth0:**
   - Forzar error de Auth0 (ej: invalid_grant)
   - Verificar detección y redirección

## Beneficios

✅ **Seguridad:** Detecta automáticamente sesiones inválidas
✅ **UX:** Mensajes claros según el tipo de error
✅ **Robustez:** Sistema de retry inteligente
✅ **Debugging:** Logs detallados en consola
✅ **Mantenibilidad:** Código centralizado y reutilizable
✅ **Sin loops:** Prevención de redirecciones infinitas

## Integración

El sistema está completamente integrado y funciona automáticamente:
- No requiere cambios en componentes existentes
- Hooks `useAuthFetch` mantienen la misma interfaz
- React Query funciona normalmente con la protección añadida
- Redirección transparente para el usuario
