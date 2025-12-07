# Análisis Exhaustivo del Error "Critical failure while processing priority-list moves"

## 📋 Resumen Ejecutivo

Error 500 que ocurre al mover cards entre diferentes columnas de prioridad. El error se desata en el backend durante el procesamiento de transacciones MongoDB.

---

## 🔍 Puntos Críticos Identificados

### 1. **Flujo de Datos: Frontend → Backend**

#### Frontend (`DraggableCards.tsx`)
```typescript
// Al hacer drag & drop entre columnas:
const moves: PriorityMove[] = [];

// Para cada paciente en columna origen
updatedSource.patients.forEach((p, i) => {
  if (!p._id) return; // ✅ Validación presente
  
  const slotId = p.selectedAppDates?.[0]?._id;
  const move: PriorityMove = { 
    id: p._id,           // appointmentId
    position: i,         // nueva posición (0-based)
    priority: updatedSource._id ?? undefined  // priorityId
  };
  
  if (slotId) {
    move.slotId = slotId;  // _id del slot
  }
  
  moves.push(move);
});

// Similar para columna destino
```

**Datos enviados**:
```json
{
  "moves": [
    {
      "id": "507f1f77bcf86cd799439011",      // appointmentId (MongoDB ObjectId)
      "position": 0,                          // entero >= 0
      "priority": "6863c51892b5f1472d469ce0", // priorityId (MongoDB ObjectId)
      "slotId": "676f3e1f8b4c2d001a1b2c3d"    // slot._id (puede ser undefined)
    }
  ]
}
```

---

### 2. **Procesamiento Backend (`priority-list.js`)**

#### Fase 1: Validación y Filtrado (líneas 23-93)
```javascript
// ✅ Validaciones aplicadas:
1. id debe ser ObjectId válido (24 caracteres hexadecimales)
2. position debe ser número finito O priority debe existir
3. slotId debe ser ObjectId válido si existe
4. Se eliminan duplicados usando Map con key `${id}|${slotId}`

// ⚠️ POSIBLES FALLOS:
- Si todos los moves son filtrados → retorna 400 (no 500)
- Si slotId es inválido → se ignora ese move
```

#### Fase 2: Transacción MongoDB (líneas 95-217)
```javascript
await session.withTransaction(async () => {
  for (const m of moves) {
    // 🔍 LOG: Información del move
    console.log('🔍 [Processing Move]', {
      id: m.id,
      position: m.position,
      priority: m.priority,
      slotId: m.slotId
    });

    // ⚠️ PUNTO CRÍTICO 1: Búsqueda del Appointment
    const appointment = await Appointment.findOne(filter).session(session);
    
    if (!appointment) {
      // Marca como failed pero continúa
      results.push({
        status: 'failed',
        id: m.id,
        reason: 'Documento no encontrado o fuera de la organización',
      });
      continue;
    }

    // ⚠️ PUNTO CRÍTICO 2: Verificar selectedAppDates existe
    console.log('✅ [Move Processing] Appointment found:', {
      id: m.id,
      hasSelectedAppDates: !!appointment.selectedAppDates,
      slotsCount: appointment.selectedAppDates?.length,
      slotIds: appointment.selectedAppDates?.map(s => s._id.toString())
    });

    if (m.slotId) {
      // NUEVO SISTEMA: Actualizar slot específico
      
      // ⚠️ PUNTO CRÍTICO 3: Buscar slot por ID
      const slotIndex = appointment.selectedAppDates.findIndex(
        slot => slot._id.toString() === m.slotId
      );

      if (slotIndex === -1) {
        // ⚠️ POSIBLE CAUSA DE ERROR:
        // Si el slotId no existe, marca como failed
        console.error('❌ [Slot Not Found]', {
          appointmentId: m.id,
          requestedSlotId: m.slotId,
          availableSlots: appointment.selectedAppDates?.map(s => ({
            id: s._id.toString(),
            priority: s.priority?.toString(),
            position: s.position
          }))
        });
        
        results.push({
          status: 'failed',
          id: m.id,
          reason: `Slot ${m.slotId} no encontrado en appointment`,
        });
        continue; // ⚠️ CONTINÚA, no lanza error
      }

      // ⚠️ PUNTO CRÍTICO 4: Actualizar slot
      if (m.priority) {
        appointment.selectedAppDates[slotIndex].priority = new mongoose.Types.ObjectId(m.priority);
      }
      
      if (m.position !== undefined) {
        appointment.selectedAppDates[slotIndex].position = m.position;
      }

      appointment.unknown = false;
      if (org_id != null) appointment.org_id = org_id;

      // ⚠️ PUNTO CRÍTICO 5: Guardar con sesión
      await appointment.save({ session });

      results.push({ 
        status: 'success', 
        id: m.id,
        slotId: m.slotId,
        updatedSlot: true 
      });
      
    } else {
      // LEGACY SYSTEM: Actualizar root.priority y root.position
      // ... (código legacy)
    }
  }
});
```

---

## 🚨 Causas Potenciales del Error 500

### **Causa 1: Appointment sin `selectedAppDates`**
```javascript
// Si appointment.selectedAppDates es null/undefined:
appointment.selectedAppDates.findIndex(...) // ❌ TypeError: Cannot read property 'findIndex' of undefined
```

**Probabilidad**: MEDIA  
**Evidencia**: El schema define `selectedAppDates: { type: [SelectedAppDateSchema], default: [] }`  
**Mitigación**: Agregar validación `if (!Array.isArray(appointment.selectedAppDates))`

---

### **Causa 2: SlotId Válido pero Slot Eliminado**
```javascript
// Frontend envía slotId basado en datos cacheados
// Backend busca slot y no lo encuentra (race condition)
const slotIndex = appointment.selectedAppDates.findIndex(slot => slot._id.toString() === m.slotId);
// slotIndex === -1 → marca como failed, NO lanza error 500
```

**Probabilidad**: BAJA (causa failed, no error 500)

---

### **Causa 3: Error al Crear ObjectId Inválido**
```javascript
// Si m.priority pasa validación regex pero no es válido para MongoDB
new mongoose.Types.ObjectId(m.priority); // ❌ Puede lanzar excepción si el string es inválido
```

**Probabilidad**: BAJA (regex `OID_RE` valida formato correcto)

---

### **Causa 4: Violación de Restricciones del Schema**
```javascript
// SelectedAppDateSchema tiene validaciones pre-save
SelectedAppDateSchema.pre('validate', function(next) {
  // Si startDate existe pero no endDate, lanza error
  if ((this.startDate && !this.endDate) || (!this.startDate && this.endDate)) {
    return next(new Error('Both startDate and endDate must be set together'));
  }
  next();
});

// Al actualizar solo priority/position, NO debería afectar startDate/endDate
// PERO si hay otros hooks/validaciones que fallan...
await appointment.save({ session }); // ⚠️ Aquí puede fallar
```

**Probabilidad**: **ALTA** ⚠️  
**Evidencia**: Save() ejecuta todas las validaciones del schema  
**Posible escenario**:
- Slot tiene datos inconsistentes (startDate sin endDate, etc.)
- Al intentar guardar, las validaciones fallan
- La transacción hace rollback
- Se lanza error 500

---

### **Causa 5: Transacción Aborta por Timeout o Lock**
```javascript
await session.withTransaction(async () => {
  // Si procesar todos los moves toma mucho tiempo
  // O si hay locks en la base de datos
  // La transacción puede abortar
});
```

**Probabilidad**: MEDIA  
**Escenario**: Muchos moves (30+ items) pueden causar timeout

---

### **Causa 6: Error en Hook `pre('save')` del Schema**
```javascript
// Appointment schema puede tener hooks que fallen
AppointmentSchema.pre('save', function(next) {
  // Si algún hook lanza error:
  throw new Error('Validation failed');
  // Causa error 500
});
```

**Probabilidad**: **ALTA** ⚠️  
**Acción**: Revisar todos los hooks en `models/Appointments.js`

---

## 🔧 Hipótesis Principal

**El error 500 ocurre cuando**:

1. **Frontend envía moves válidos** (pasa validación de filtrado)
2. **Backend encuentra los appointments** (no retorna 404)
3. **Backend encuentra los slots** (no marca como failed)
4. **Pero al ejecutar `appointment.save({ session })`**:
   - Alguna validación del schema falla
   - Algún hook `pre('save')` o `pre('validate')` lanza error
   - La transacción hace rollback
   - El catch captura el error y retorna 500

---

## 🎯 Datos Necesarios para Confirmar

Para identificar la causa exacta, necesitas capturar:

### **Frontend (Consola del navegador)**:
```javascript
// Buscar estos logs:
🎯 [DragEnd] Moving item: { ... }
🚀 [DraggableCards] Sending moves to backend: [ ... ]
📋 [DraggableCards] Move context: { ... }
❌ Move error: { ... }
❌ Error response: { error: '...', details: '...' }
```

### **Backend (docker logs -f backend_dev)**:
```javascript
// Buscar estos logs:
📦 [PATCH /priority-list/move] Request body: { ... }
📦 [PATCH /priority-list/move] Parsed rawMoves: [ ... ]
🔍 [Processing Move] { id, position, priority, slotId }
✅ [Move Processing] Appointment found: { ... }
🔍 [Slot Search] { lookingFor, foundIndex, availableSlots }
❌ Critical error in /priority-list/move: [ERROR STACK]
```

---

## 🛠️ Plan de Acción

### **Paso 1: Añadir Validación Extra**
```javascript
// En backend, después de encontrar appointment:
if (!appointment.selectedAppDates || !Array.isArray(appointment.selectedAppDates)) {
  console.error('❌ Appointment has no selectedAppDates array:', appointment._id);
  results.push({
    status: 'failed',
    id: m.id,
    reason: 'Appointment has invalid selectedAppDates structure',
  });
  continue;
}
```

### **Paso 2: Capturar Error de Save**
```javascript
try {
  await appointment.save({ session });
} catch (saveError) {
  console.error('❌ Error saving appointment:', {
    appointmentId: m.id,
    slotId: m.slotId,
    error: saveError.message,
    stack: saveError.stack
  });
  results.push({
    status: 'failed',
    id: m.id,
    reason: `Save failed: ${saveError.message}`,
  });
  continue; // No lanzar error, solo marcar como failed
}
```

### **Paso 3: Revisar Hooks del Schema**
Buscar en `models/Appointments.js`:
- Todos los `pre('save')`
- Todos los `pre('validate')`
- Validaciones personalizadas que puedan fallar

### **Paso 4: Reproducir y Capturar Logs**
1. Abrir consola del navegador
2. Ejecutar `docker logs -f backend_dev` en terminal
3. Mover card entre columnas
4. Capturar AMBOS logs completos

---

## 📊 Estado Actual del Código

### ✅ **Implementado**:
- Logging detallado en frontend (move context, item details)
- Logging detallado en backend (processing moves, slot search)
- Validación de `_id` en frontend
- Validación de ObjectId format en backend

### ⚠️ **Falta Implementar**:
- Validación de `selectedAppDates` array antes de `findIndex`
- Try-catch específico alrededor de `appointment.save()`
- Logging del error completo (stack trace) en el catch

---

## 🎬 Próximos Pasos

1. **Implementar validaciones adicionales** (Paso 1 y 2)
2. **Reproducir el error** con logs activos
3. **Analizar stack trace** del error real
4. **Identificar causa exacta** (hook, validación, lock, etc.)
5. **Aplicar fix específico**

---

## 📝 Notas Adicionales

- El código actual usa `continue` en lugar de `throw` cuando falla un move individual
- Esto significa que el error 500 NO es causado por slot no encontrado
- El error viene del `catch` principal, lo que indica:
  - Error en `appointment.save()`
  - Error en alguna operación de MongoDB
  - Error en hook del schema
  - Timeout de transacción

**Conclusión**: El error NO es de lógica de negocio, es de persistencia o validación de datos.
