# Twilio Multi-Tenant Configuration - Implementation Guide

## 🔐 Authentication & Authorization

**IMPORTANT:** All Twilio configuration endpoints require authentication and the "support" role.

### Access Control:
- **Authentication:** Auth0 JWT token required for all API calls
- **Authorization:** User must have the "support" role
- **Session:** Maximum 10 hours duration, enforced at backend
- **Multi-tenant:** org_id from JWT ensures data isolation

### Frontend:
- Uses `useAuthFetch` hook for automatic token injection
- Shows "Access Restricted" message for users without support role
- Automatic token refresh on 401/403 errors

### Backend:
- All routes use `requireAuth` and `requireSupport` middleware
- Returns 401 for invalid/expired tokens
- Returns 403 for users without support role

### Granting Access:
To allow a user to configure Twilio:
1. Navigate to Auth0 Dashboard → Users → Select User
2. Click "Roles" tab
3. Assign "support" role to user
4. User must log out and log back in for changes to take effect

---

## ✅ Completed Implementation

### Backend Components

#### 1. **TwilioSettings Model** (`apps/backend/src/models/TwilioSettings.js`)
- MongoDB schema para almacenar credenciales por organización
- Campos: `accountSid`, `authToken`, `fromNumber`, `messagingServiceSid`, `conversationsServiceSid`
- Webhook configuration: `webhookUrl`, `webhookEnabled`, `webhookConfigured`
- Security: Campos sensibles con `select: false`

#### 2. **TwilioService** (`apps/backend/src/services/TwilioService.js`)
- Servicio singleton con cache de clientes por `org_id`
- Métodos implementados:
  - `getClient(org_id)` - Obtiene cliente de Twilio (con fallback a .env)
  - `sendSMS(org_id, {to, body})` - Envía SMS usando config de la org
  - `validateCredentials(accountSid, authToken)` - Valida credenciales
  - `configureConversationsWebhook(org_id, webhookUrl)` - Configura webhook
  - `getWebhookConfiguration(org_id)` - Obtiene config actual del webhook
  - `invalidateCache(org_id)` - Limpia cache

#### 3. **API Routes** (`apps/backend/src/routes/twilio-settings.js`)
**All endpoints require authentication and support role.**
Endpoints implementados:
- `GET /api/twilio-config/settings` - Obtener configuración (sin exponer tokens)
- `POST /api/twilio-config/settings` - Guardar y validar credenciales
- `POST /api/twilio-config/webhook/configure` - Configurar webhook en Twilio
- `GET /api/twilio-config/webhook/status` - Estado del webhook
- `PUT /api/twilio-config/settings/toggle` - Habilitar/deshabilitar
- `DELETE /api/twilio-config/settings` - Deshabilitar configuración
- `POST /api/twilio-config/test/sms` - Enviar SMS de prueba

#### 4. **Updated Routes**
- `apps/backend/src/routes/twilio.js` - Actualizado para usar TwilioService
- `apps/backend/src/index.js` - Route registrado: `/api/twilio-config`

### Frontend Components

#### 1. **TwilioSettings Component** (`apps/frontend/src/Components/Settings/TwilioSettings.tsx`)
**Access restricted to users with "support" role.**
Características:
- Role-based access control (support role required)
- Formulario para credenciales de Twilio
- Validación de formato E.164 para números
- Toggle para habilitar/deshabilitar
- Sección de webhook configuration
- Test SMS functionality
- Visual feedback con badges (Validated, Configured)
- Hide/show sensitive fields (Auth Token)
- Authenticated API calls using useAuthFetch

#### 2. **Settings Integration** (`apps/frontend/src/Routes/Settings/index.tsx`)
- Nuevo tab "Twilio" agregado
- Tabs actuales: Priorities, Treatments, Providers, Users, Google Reviews, Twilio

## 🔧 Configuration Guide

### Para Administradores

1. **Acceder a Settings**
   - Navegar a `/settings` en la aplicación
   - Click en el tab "Twilio"

2. **Configurar Credenciales**
   ```
   Account SID: ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   Auth Token: ********************************
   From Number: +61412345678
   Messaging Service SID: MGxxxxxxxxxxxxxxxx (opcional)
   Conversations Service SID: ISxxxxxxxxxxxxxxxx (opcional)
   ```

3. **Validar Configuración**
   - Click "Save & Validate Credentials"
   - El sistema valida automáticamente con Twilio
   - Badge "Validated" aparece si exitoso

4. **Configurar Webhook (Opcional)**
   - Solo si tienes Conversations Service SID
   - URL se genera automáticamente: `{domain}/api/twilio/conversations-webhook`
   - Click "Configure Webhook in Twilio"
   - Eventos configurados:
     - onMessageAdded
     - onConversationAdded
     - onConversationRemoved
     - onParticipantAdded
     - onParticipantRemoved

5. **Probar Configuración**
   - Expandir sección "Test SMS"
   - Ingresar número de prueba y mensaje
   - Click "Send Test SMS"

### Formato de Números (E.164)

✅ **Correcto:**
```
+61412345678   (Australia)
+1234567890    (USA)
+442071234567  (UK)
```

❌ **Incorrecto:**
```
0412345678     (falta código de país)
61412345678    (falta +)
+61 412 345 678 (con espacios)
```

## 📋 Pending Migration Tasks

### High Priority

1. **Update Message Sending Functions**
   - Archivo: `apps/backend/src/helpers/index.js` (línea 463)
   - Cambiar de:
     ```javascript
     const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
     ```
   - A:
     ```javascript
     const TwilioService = require('../services/TwilioService');
     const { client } = await TwilioService.getClient(org_id);
     ```

2. **Update Conversation Helpers**
   - `apps/backend/src/helpers/conversations.js`
   - `apps/backend/src/helpers/findConversationByPhoneSafely.js`
   - Reemplazar inicialización directa de cliente por TwilioService

3. **Update Routes with Twilio Client**
   - `apps/backend/src/routes/index.js` (línea 21)
   - Usar TwilioService.getClient() en lugar de inicialización directa

### Medium Priority

4. **Cleanup Scripts**
   - `apps/backend/src/helpers/cleanupOrphanconversations.js`
   - `apps/backend/src/helpers/deleteAllConversations.js`
   - `apps/backend/src/helpers/reassignConversations.js`
   - Actualizar para soportar multi-tenant si es necesario

5. **Health Check Utilities**
   - `apps/backend/src/helpers/twilioHealth.js`
   - Agregar soporte para verificar salud por organización

### Low Priority

6. **Utility Scripts**
   - `apps/backend/src/helpers/sidPopulate.js`
   - Considerar si necesitan multi-tenant o mantener como scripts administrativos

## 🔐 Security Best Practices

### ✅ DO:
- Almacenar credenciales por organización en MongoDB
- Usar `select: false` en campos sensibles
- Validar credenciales antes de guardar
- Implementar cache de clientes para performance
- Usar fallback a .env solo para desarrollo

### ❌ DON'T:
- NO exponer `accountSid` o `authToken` en respuestas API
- NO hardcodear credenciales en código
- NO compartir credenciales entre organizaciones
- NO omitir validación de formato de números

## 🚀 Deployment Checklist

### Before Deployment:
- [ ] Backup de base de datos
- [ ] Verificar variables de entorno de fallback configuradas
- [ ] Revisar que modelo TwilioSettings esté en índice de MongoDB
- [ ] Test de endpoints con Postman/Insomnia

### After Deployment:
- [ ] Migrar credenciales existentes de .env a MongoDB
- [ ] Notificar a administradores sobre nueva sección de Settings
- [ ] Monitorear logs por errores de migración
- [ ] Verificar cache de TwilioService funcionando correctamente

## 📊 Monitoring

### Key Metrics:
- Cache hits/misses en TwilioService
- Tiempo de respuesta de validación de credenciales
- Tasa de éxito de envío de SMS por organización
- Errores de configuración de webhook

### Logs to Monitor:
```
[TwilioService] Cache invalidated for org: ${org_id}
[TwilioService] Using fallback credentials for org: ${org_id}
[TwilioSettings] Settings saved for org: ${org_id}
[TwilioSettings] Webhook configured for org ${org_id}
```

## 🔄 Migration Strategy

### Phase 1: Configuration (✅ Completed)
- Backend models and services
- API routes
- Frontend UI
- Route integration

### Phase 2: Testing (Current)
1. Test credential validation
2. Test SMS sending with org credentials
3. Test webhook configuration
4. Test fallback to environment variables

### Phase 3: Migration (Next)
1. Migrate helper functions to use TwilioService
2. Update conversation management code
3. Test all SMS/conversation flows
4. Update documentation

### Phase 4: Cleanup (Future)
1. Remove direct twilio require() calls
2. Deprecate global .env credentials
3. Add migration script for existing data
4. Archive old implementation

## 💡 Usage Examples

### Backend - Sending SMS
```javascript
// Old way (deprecated)
const twilio = require('twilio');
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
await client.messages.create({
  from: process.env.TWILIO_FROM_MAIN,
  to: '+61412345678',
  body: 'Hello'
});

// New way (recommended)
const TwilioService = require('../services/TwilioService');
await TwilioService.sendSMS(org_id, {
  to: '+61412345678',
  body: 'Hello'
});
```

### Backend - Getting Client
```javascript
// Old way (deprecated)
const twilio = require('twilio');
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// New way (recommended)
const TwilioService = require('../services/TwilioService');
const { client, settings } = await TwilioService.getClient(org_id);
// Use client as needed
// settings contains fromNumber, messagingServiceSid, etc.
```

## 🐛 Troubleshooting

### "Twilio not configured for this organization"
- Verificar que la organización tenga credenciales guardadas en MongoDB
- Revisar que las credenciales estén habilitadas (`enabled: true`)
- Check fallback environment variables si es desarrollo

### "Invalid Twilio credentials"
- Verificar Account SID formato: `AC` + 32 caracteres
- Verificar Auth Token no esté expirado
- Test credentials directamente en Twilio Console

### "Invalid phone number format"
- Usar formato E.164: `+[country code][number]`
- Ejemplo: `+61412345678` (no espacios, guiones, o paréntesis)

### Webhook not working
- Verificar Conversations Service SID configurado
- Revisar que webhook URL sea accesible públicamente
- Check firewall/nginx configuration
- Verificar eventos configurados en Twilio Console

## 📚 References

- [Twilio API Documentation](https://www.twilio.com/docs/usage/api)
- [E.164 Phone Number Format](https://en.wikipedia.org/wiki/E.164)
- [Twilio Conversations API](https://www.twilio.com/docs/conversations)
- [Twilio Webhooks](https://www.twilio.com/docs/usage/webhooks)

---

**Status:** ✅ Core implementation complete | 🔄 Migration in progress
**Last Updated:** December 3, 2025
