# Schema Migration: Treatment, Priority, Providers to Slots

## 📋 Resumen del Cambio

Anteriormente, los campos `treatment`, `priority` y `providers` estaban en el **root** del documento `Appointment`. Ahora estos campos se han movido a **cada slot individual** en el array `selectedAppDates`, junto con un nuevo campo `duration`.

### Estructura Anterior (DEPRECATED)
```javascript
{
  _id: "...",
  treatment: ObjectId("..."),        // ❌ EN ROOT
  priority: ObjectId("..."),         // ❌ EN ROOT
  providers: [ObjectId("...")],      // ❌ EN ROOT
  selectedAppDates: [
    {
      startDate: Date,
      endDate: Date,
      status: "...",
      // NO tenía treatment/priority/providers propios
    }
  ]
}
```

### Nueva Estructura (ACTUAL)
```javascript
{
  _id: "...",
  treatment: ObjectId("..."),        // ⚠️ DEPRECATED (mantener por compatibilidad temporal)
  priority: ObjectId("..."),         // ⚠️ DEPRECATED
  providers: [ObjectId("...")],      // ⚠️ DEPRECATED
  selectedAppDates: [
    {
      startDate: Date,
      endDate: Date,
      status: "...",
      treatment: ObjectId("..."),    // ✅ NUEVO: por slot
      priority: ObjectId("..."),     // ✅ NUEVO: por slot
      providers: [ObjectId("...")],  // ✅ NUEVO: por slot
      duration: 60,                  // ✅ NUEVO: duración en minutos
      providerNotes: ""              // ✅ NUEVO: notas específicas del slot
    }
  ]
}
```

## 🎯 Ventajas

1. **Flexibilidad**: Cada slot puede tener diferente treatment, priority, providers y duración
2. **Precisión**: Mejor tracking de providers por fecha específica
3. **Escalabilidad**: Permite appointments multi-tratamiento con diferentes prioridades

## 🔧 Cambios en el Backend

### Modelo Mongoose
- **Archivo**: `apps/backend/src/models/Appointments.js`
- Agregados campos a `SelectedAppDateSchema`: `treatment`, `priority`, `providers`, `duration`, `providerNotes`
- Campos en root marcados como deprecated pero mantenidos por compatibilidad

### Nuevos Métodos Virtuales

#### `effectiveTreatment`, `effectivePriority`, `effectiveProviders`
Retornan el valor del primer slot si existe, sino el del root (para compatibilidad):
```javascript
const appointment = await Appointment.findById(id);
console.log(appointment.effectiveTreatment); // prioriza slot[0].treatment
```

#### `migrateToSlotFields()` - Método de instancia
Copia treatment/priority/providers del root a todos los slots que no los tengan:
```javascript
const appointment = await Appointment.findById(id);
if (appointment.migrateToSlotFields()) {
  await appointment.save();
  console.log('Migrated successfully');
}
```

#### `migrateBulkToSlotFields(org_id, dryRun)` - Método estático
Migra todos los appointments de una organización:
```javascript
const results = await Appointment.migrateBulkToSlotFields('org_123', true);
console.log(`${results.modified}/${results.total} would be modified`);
```

### Rutas de Populate Actualizadas

Los siguientes endpoints ahora hacen `populate` de los campos en slots:

1. **`/api/appointment-manager`** (GET `/`, GET `/search`)
   - Popula `selectedAppDates.treatment`, `selectedAppDates.priority`, `selectedAppDates.providers`

2. **`/api/appointments/range`**
   - Acepta query param: `populate=selectedAppDates.treatment,selectedAppDates.priority,selectedAppDates.providers`

3. **`/api/appointments/:id`** (GET detalle)
   - Popula automáticamente todos los campos nested en slots

4. **`/api/helpers`** - funciones internas
   - Popula `selectedAppDates.treatment` y `selectedAppDates.providers` automáticamente

## 🚀 API de Migración

### Endpoint 1: Verificar Estado
```bash
GET /api/appointment-migration/status?org_id=YOUR_ORG_ID
```

**Respuesta:**
```json
{
  "org_id": "org_123",
  "totalAppointmentsWithSlots": 150,
  "legacy": {
    "treatmentInRoot": 120,
    "priorityInRoot": 115,
    "providersInRoot": 100
  },
  "current": {
    "treatmentInSlots": 30,
    "priorityInSlots": 35,
    "providersInSlots": 50
  },
  "recommendation": "Consider running migration with POST /migrate-to-slot-fields?dryRun=false"
}
```

### Endpoint 2: Ejecutar Migración (DRY RUN)
```bash
POST /api/appointment-migration/migrate-to-slot-fields?dryRun=true
Content-Type: application/json

{
  "org_id": "YOUR_ORG_ID"  # opcional, usa el del token si se omite
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Dry run completed. 120/150 appointments would be modified.",
  "total": 150,
  "modified": 120,
  "errors": [],
  "dryRun": true
}
```

### Endpoint 3: Ejecutar Migración (REAL)
```bash
POST /api/appointment-migration/migrate-to-slot-fields?dryRun=false
Content-Type: application/json

{
  "org_id": "YOUR_ORG_ID"
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Migration completed. 120/150 appointments were modified.",
  "total": 150,
  "modified": 120,
  "errors": [],
  "dryRun": false
}
```

## 📝 Pasos de Migración Recomendados

### 1. Verificar estado actual
```bash
curl -X GET "https://dev.letsmarter.com:8443/api/appointment-migration/status" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 2. Ejecutar DRY RUN (simulación)
```bash
curl -X POST "https://dev.letsmarter.com:8443/api/appointment-migration/migrate-to-slot-fields?dryRun=true" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

### 3. Revisar resultados del dry run
- Verificar `modified` vs `total`
- Revisar `errors` array (debe estar vacío)

### 4. Ejecutar migración real
```bash
curl -X POST "https://dev.letsmarter.com:8443/api/appointment-migration/migrate-to-slot-fields?dryRun=false" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

### 5. Verificar nuevamente el estado
```bash
curl -X GET "https://dev.letsmarter.com:8443/api/appointment-migration/status" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Deberías ver que `current.treatmentInSlots`, `current.priorityInSlots` y `current.providersInSlots` aumentaron.

## ⚠️ Consideraciones Importantes

1. **Compatibilidad Temporal**: Los campos en root (`treatment`, `priority`, `providers`) se mantienen por compatibilidad pero están marcados como deprecated.

2. **Populate en Frontend**: El frontend debe actualizar sus queries para pedir:
   ```javascript
   populate: 'selectedAppDates.treatment,selectedAppDates.priority,selectedAppDates.providers'
   ```

3. **No hay rollback automático**: Respalda la base de datos antes de ejecutar `dryRun=false`

4. **Idempotencia**: La migración es idempotente - puede ejecutarse múltiples veces sin duplicar datos.

5. **Performance**: Para organizaciones con muchos appointments (>10000), considera ejecutar la migración en horarios de bajo tráfico.

## 🔄 Actualizaciones Necesarias en Frontend

Las queries del frontend que actualmente usan:
```javascript
populate: 'treatment,priority,providers'
```

Deberían actualizarse a:
```javascript
populate: 'selectedAppDates.treatment,selectedAppDates.priority,selectedAppDates.providers'
```

O usar ambas durante el período de transición:
```javascript
populate: 'treatment,priority,providers,selectedAppDates.treatment,selectedAppDates.priority,selectedAppDates.providers'
```

## 📊 Monitoreo

Después de la migración, puedes consultar el endpoint de status periódicamente para asegurar que los nuevos appointments usen la estructura correcta:

```bash
# Programar un check semanal
0 9 * * 1 curl -X GET "https://dev.letsmarter.com:8443/api/appointment-migration/status" \
  -H "Authorization: Bearer $TOKEN" >> /var/log/appointment-migration-status.log
```

## 🐛 Troubleshooting

### Error: "Missing org_id"
- Verifica que el token JWT tenga el claim `org_id`
- O pasa `org_id` en el body del POST

### Error: "Migration failed"
- Revisa el array `errors` en la respuesta
- Verifica permisos de escritura en MongoDB
- Chequea logs del backend: `docker logs backend -f`

### Appointments no se actualizan
- Verifica que tengan `selectedAppDates` no vacío
- Confirma que el `org_id` coincida con el del token

## 📚 Referencias

- **Modelo**: `apps/backend/src/models/Appointments.js`
- **Ruta de migración**: `apps/backend/src/routes/appointment-migration.js`
- **Rutas actualizadas**: 
  - `apps/backend/src/routes/appointment-manager.js`
  - `apps/backend/src/routes/appointments-range.js`
  - `apps/backend/src/routes/index.js`
  - `apps/backend/src/helpers/index.js`
