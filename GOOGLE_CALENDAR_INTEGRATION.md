# Google Calendar Integration

Esta integración permite sincronizar automáticamente tus appointments con Google Calendar.

## 📋 Características

- ✅ Autenticación OAuth 2.0 con Google
- ✅ Sincronización de appointments a Google Calendar
- ✅ Soporte para múltiples slots por appointment
- ✅ Auto-sync opcional
- ✅ Selección de rango de fechas (hoy, semana, mes)
- ✅ Incluye información del paciente, tratamiento, y notas
- ✅ Timezone support (Australia/Sydney)
- ✅ Notificaciones y manejo de errores

## 🚀 Setup

### 1. Configurar Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita la **Google Calendar API**:
   - Ve a "APIs & Services" > "Library"
   - Busca "Google Calendar API"
   - Click en "Enable"

4. Crea credenciales OAuth 2.0:
   - Ve a "APIs & Services" > "Credentials"
   - Click en "Create Credentials" > "OAuth client ID"
   - Selecciona "Web application"
   - Agrega los **Authorized JavaScript origins** (IMPORTANTE: incluye el puerto):
     ```
     http://localhost:3004
     https://dev.letsmarter.com:8443
     https://yourdomain.com
     ```
   - **NO necesitas agregar Authorized redirect URIs** para esta integración
   - Guarda tu Client ID

5. **CRÍTICO**: Si ves el error "Not a valid origin for the client":
   - Verifica que agregaste EXACTAMENTE el origen que muestra tu navegador
   - Incluye el protocolo (http:// o https://)
   - Incluye el puerto si lo usas (:8443, :3004, etc.)
   - Puede tardar unos minutos en propagarse después de agregarlo

### 2. Instalar Dependencias

Las dependencias ya están instaladas:
```bash
npm install @react-oauth/google gapi-script
```

### 3. Configurar la Aplicación

Tu Google Client ID ya está configurado:
```
481917862024-4e86cicdql6e3qmepigdlmrkfdcpu6e3.apps.googleusercontent.com
```

## 📁 Archivos Creados

```
apps/frontend/src/
├── Hooks/
│   └── useGoogleCalendar.ts          # Hook principal de integración
├── Components/
│   └── GoogleCalendarSync.tsx        # Componente UI de sincronización
├── Routes/
│   └── GoogleCalendar/
│       └── GoogleCalendarPage.tsx    # Página de ejemplo
└── types/
    └── gapi.d.ts                     # Tipos TypeScript para Google API
```

## 🔧 Uso

### Opción 1: Usar el Componente Completo

```tsx
import GoogleCalendarSync from '@/Components/GoogleCalendarSync';

function MyPage() {
  return (
    <GoogleCalendarSync 
      clientId="481917862024-4e86cicdql6e3qmepigdlmrkfdcpu6e3.apps.googleusercontent.com"
      defaultView="month"
    />
  );
}
```

### Opción 2: Usar el Hook Directamente

```tsx
import { useGoogleCalendar } from '@/Hooks/useGoogleCalendar';

function MyComponent() {
  const {
    isAuthenticated,
    isLoading,
    signIn,
    signOut,
    syncSingleAppointment,
    syncAppointments,
  } = useGoogleCalendar('YOUR_CLIENT_ID');

  // Sincronizar un appointment
  const handleSync = async (appointment) => {
    await syncSingleAppointment(appointment);
  };

  return (
    <div>
      {!isAuthenticated ? (
        <button onClick={signIn}>Sign in with Google</button>
      ) : (
        <button onClick={signOut}>Sign out</button>
      )}
    </div>
  );
}
```

### Opción 3: Agregar a la Página de Appointments Existente

Puedes agregar un botón en `AssignedAppointments.tsx`:

```tsx
import { useGoogleCalendar } from '@/Hooks/useGoogleCalendar';

// En tu componente AssignedAppointments
const {
  isAuthenticated,
  signIn,
  syncSingleAppointment,
} = useGoogleCalendar('YOUR_CLIENT_ID');

// Agregar botón en el UI
<Button
  leftIcon={<FcGoogle />}
  onClick={() => syncSingleAppointment(selectedAppointment)}
  isDisabled={!isAuthenticated}
>
  Sync to Google Calendar
</Button>
```

## 🗺️ Agregar Ruta (Opcional)

Si quieres usar la página de ejemplo, agrega la ruta en tu router:

```tsx
// En tu archivo de rutas
import GoogleCalendarPage from '@/Routes/GoogleCalendar/GoogleCalendarPage';

{
  path: '/google-calendar',
  element: <GoogleCalendarPage />,
}
```

## 📊 Formato de Eventos en Google Calendar

Los eventos se crean con el siguiente formato:

**Título:** `[Tratamiento] - [Nombre Completo]`

**Descripción:**
```
Patient: John Doe
Phone: 0412345678
Email: john@example.com
Priority: High

Notes: Patient needs consultation for dental implants
```

**Horario:** Se usa la timezone `Australia/Sydney` automáticamente

**Asistentes:** Si el appointment tiene email, se agrega como asistente

**Recordatorios:** Se usan los recordatorios por defecto de Google Calendar

## 🔄 Funcionalidad Auto-sync

Cuando está habilitado:
- Detecta cambios en el rango de fechas seleccionado
- Sincroniza automáticamente cuando hay nuevos appointments
- Ideal para mantener Google Calendar actualizado en tiempo real

## 🎨 Personalización

### Cambiar Timezone

En `useGoogleCalendar.ts`, línea con `timeZone`:
```tsx
timeZone: 'America/New_York', // Cambia según tu zona
```

### Agregar Campos Personalizados

En el método `convertToGoogleEvent`:
```tsx
if (appointment.customField) {
  description += `\nCustom: ${appointment.customField}`;
}
```

### Cambiar Colores de Calendario

Los eventos se crean en el calendario primario. Para cambiar el calendario:
```tsx
await gapi.client.calendar.events.insert({
  calendarId: 'your-calendar-id@group.calendar.google.com', // Cambia esto
  resource: googleEvent,
});
```

## ⚠️ Troubleshooting

### Error: "Not authenticated"
- Asegúrate de hacer click en "Sign in with Google"
- Verifica que el Client ID sea correcto
- Revisa que los redirect URIs estén configurados en Google Cloud Console

### Error: "Failed to load Google API"
- Verifica tu conexión a internet
- Revisa la consola del navegador para errores
- Asegúrate que Google Calendar API esté habilitada

### Error: "Daily Limit Exceeded"
- Google Calendar API tiene límites de uso
- Verifica tu cuota en Google Cloud Console
- Considera implementar rate limiting si sincronizas muchos eventos

### Los eventos no aparecen
- Verifica que las fechas sean correctas
- Revisa el calendario correcto en Google Calendar
- Espera unos segundos, puede haber delay de sincronización

## 🔐 Seguridad

- El token de autenticación se maneja automáticamente por Google
- No se almacenan credenciales en el cliente
- Solo se solicitan permisos para Google Calendar
- Usa HTTPS en producción

## 📝 Notas Importantes

1. **Duplicados**: El código actual NO verifica duplicados. Si sincronizas dos veces, creará eventos duplicados.

2. **Actualizaciones**: La versión actual solo CREA eventos, no actualiza eventos existentes.

3. **Eliminaciones**: Si eliminas un appointment en tu sistema, NO se elimina de Google Calendar automáticamente.

4. **Rate Limits**: Google Calendar API tiene límites:
   - 1,000,000 queries por día
   - 10 queries por segundo

## 🚀 Próximas Mejoras Sugeridas

- [ ] Verificación de duplicados antes de crear eventos
- [ ] Sincronización bidireccional (Google → Sistema)
- [ ] Actualizar eventos existentes en lugar de crear nuevos
- [ ] Eliminar eventos cuando se elimina el appointment
- [ ] Soporte para múltiples calendarios
- [ ] Sincronización en background con Service Worker
- [ ] Historial de sincronizaciones
- [ ] Filtros avanzados (por tratamiento, prioridad, etc.)

## 📞 Soporte

Si encuentras problemas:
1. Revisa la consola del navegador para errores
2. Verifica que todas las configuraciones en Google Cloud Console sean correctas
3. Asegúrate que las dependencias estén instaladas
4. Revisa los tipos de datos que se están enviando

## 📄 Licencia

Este código es parte del sistema de appointments y puede ser modificado según las necesidades del proyecto.
