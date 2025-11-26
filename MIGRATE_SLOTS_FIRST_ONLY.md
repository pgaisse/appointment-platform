# Migración de Slots: Poblar Primer Slot con Datos del Root

## 🎯 Objetivo

Copiar los campos `treatment`, `priority`, `providers` y `duration` del **root** del appointment al **primer slot** en `selectedAppDates`.

## ⚠️ Importante

Esta migración solo afecta al **primer slot** de cada appointment, no a todos los slots. Esto es intencional ya que típicamente el primer slot hereda la configuración original del appointment.

## 🚀 Cómo Ejecutar

### 1. Verificar Estado Actual

```bash
curl -X GET "https://dev.letsmarter.com:8443/api/appointment-migration/status" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 2. Simular Migración (DRY RUN)

```bash
curl -X POST "https://dev.letsmarter.com:8443/api/appointment-migration/migrate-to-slot-fields?dryRun=true" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

### 3. Ejecutar Migración Real

```bash
curl -X POST "https://dev.letsmarter.com:8443/api/appointment-migration/migrate-to-slot-fields?dryRun=false" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

## 📋 Qué Hace la Migración

Para cada appointment con `selectedAppDates`:

1. **Treatment**: Copia `appointment.treatment` → `selectedAppDates[0].treatment`
2. **Priority**: Copia `appointment.priority` → `selectedAppDates[0].priority`
3. **Providers**: Copia `appointment.providers` → `selectedAppDates[0].providers`
4. **Duration**: 
   - Si el treatment está poblado y tiene duration, usa ese valor
   - Si no, usa 60 minutos por defecto

## 🔍 Ejemplo de Transformación

### Antes (Legacy)
```json
{
  "_id": "...",
  "treatment": "64a1b2c3d4e5f6...",
  "priority": "64a1b2c3d4e5f7...",
  "providers": ["64a1b2c3d4e5f8...", "64a1b2c3d4e5f9..."],
  "selectedAppDates": [
    {
      "_id": "slot1",
      "startDate": "2025-11-25T09:00:00Z",
      "endDate": "2025-11-25T10:00:00Z"
      // ❌ Sin treatment, priority, providers, duration
    },
    {
      "_id": "slot2",
      "startDate": "2025-11-26T09:00:00Z",
      "endDate": "2025-11-26T10:00:00Z"
      // ❌ Sin treatment, priority, providers, duration
    }
  ]
}
```

### Después (Migrado)
```json
{
  "_id": "...",
  "treatment": "64a1b2c3d4e5f6...",  // ⚠️ DEPRECATED (mantener por compatibilidad)
  "priority": "64a1b2c3d4e5f7...",   // ⚠️ DEPRECATED
  "providers": ["64a1b2c3d4e5f8...", "64a1b2c3d4e5f9..."],  // ⚠️ DEPRECATED
  "selectedAppDates": [
    {
      "_id": "slot1",
      "startDate": "2025-11-25T09:00:00Z",
      "endDate": "2025-11-25T10:00:00Z",
      "treatment": "64a1b2c3d4e5f6...",  // ✅ COPIADO
      "priority": "64a1b2c3d4e5f7...",   // ✅ COPIADO
      "providers": ["64a1b2c3d4e5f8...", "64a1b2c3d4e5f9..."],  // ✅ COPIADO
      "duration": 60  // ✅ NUEVO
    },
    {
      "_id": "slot2",
      "startDate": "2025-11-26T09:00:00Z",
      "endDate": "2025-11-26T10:00:00Z"
      // ⚠️ Este slot NO se modifica (solo el primero)
    }
  ]
}
```

## 💡 Frontend: Visualización en AppointmentModal

El componente `AppointmentModal.tsx` ahora muestra:

### Sección "Treatment (Root - Deprecated)"
- Muestra los datos del root para referencia
- Marcado como "Deprecated" en el título

### Sección "Selected Appointment Dates"
- **Cada slot** muestra sus propios campos:
  - Treatment (nombre + badge de activo/inactivo)
  - Priority (tag con color)
  - Duration (en minutos)
  - Providers (botones clicables que abren modal de provider)

### Populate Actualizado
```typescript
const populateFields = [
  // Root (deprecated)
  { path: "priority", select: "..." },
  { path: "treatment", select: "..." },
  { path: "providers" },
  
  // ✨ NUEVO: Slots individuales
  { path: "selectedAppDates.treatment", select: "..." },
  { path: "selectedAppDates.priority", select: "..." },
  { path: "selectedAppDates.providers", select: "..." },
  // ... otros campos
]
```

## 🔄 Slots Subsiguientes

Si necesitas configurar **slots adicionales** después de la migración:

### Opción 1: Desde el Frontend
```typescript
// Al crear un nuevo slot, especifica sus campos
const newSlot = {
  startDate: new Date(),
  endDate: new Date(),
  treatment: selectedTreatment._id,
  priority: selectedPriority._id,
  providers: [selectedProvider._id],
  duration: 90, // o el que corresponda
};
```

### Opción 2: Desde el Backend
```javascript
appointment.selectedAppDates.push({
  startDate: newDate,
  endDate: newEndDate,
  treatment: mongoose.Types.ObjectId('...'),
  priority: mongoose.Types.ObjectId('...'),
  providers: [mongoose.Types.ObjectId('...')],
  duration: 90,
  status: 'Pending',
});
await appointment.save();
```

## 📊 Verificación Post-Migración

```bash
# Ver cuántos slots tienen datos
curl -X GET "https://dev.letsmarter.com:8443/api/appointment-migration/status" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Deberías ver:
- `current.treatmentInSlots`: Mayor que antes
- `current.priorityInSlots`: Mayor que antes
- `current.providersInSlots`: Mayor que antes

## 🐛 Troubleshooting

### Los slots no se ven en el modal
1. Verifica que el populate incluya los nuevos campos
2. Revisa la consola del navegador para ver los datos cargados
3. Confirma que la migración se ejecutó correctamente en el backend

### Error "Cannot read property 'name' of undefined"
- El treatment/priority no se está poblando correctamente
- Verifica que el populate esté configurado en el hook useGetCollection

### Los providers no son clicables
- Verifica que el componente tenga acceso a la función `openProvider`
- Confirma que los providers estén poblados con firstName y lastName

## 📚 Referencias

- **Modelo**: `apps/backend/src/models/Appointments.js`
- **Ruta de migración**: `apps/backend/src/routes/appointment-migration.js`
- **Frontend Modal**: `apps/frontend/src/Components/Modal/AppointmentModal.tsx`
- **Documentación completa**: `SCHEMA_MIGRATION_SLOTS.md`
