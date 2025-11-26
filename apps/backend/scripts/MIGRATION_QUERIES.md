# Migración de Providers a Primer Slot - Consulta MongoDB

## 🚀 Opción 1: Script Node.js (Recomendado)

```bash
cd /home/appointment-platform/apps/backend
node scripts/migrate-providers-to-first-slot.js
```

## 🔧 Opción 2: Consulta MongoDB Directa

### Conectar a MongoDB
```bash
# Si usas Docker
docker exec -it mongodb mongosh mongodb://localhost:27017/letsmarter

# O directamente
mongosh mongodb://localhost:27017/letsmarter
```

### Consulta para Ver Cuántos Necesitan Migración
```javascript
db.appointments.countDocuments({
  selectedAppDates: { $exists: true, $ne: [], $not: { $size: 0 } },
  $or: [
    { 'selectedAppDates.0.treatment': { $exists: false } },
    { 'selectedAppDates.0.priority': { $exists: false } },
    { 'selectedAppDates.0.providers': { $exists: false } },
    { 'selectedAppDates.0.duration': { $exists: false } }
  ]
})
```

### Migración Completa (Ejecutar en MongoDB Shell)
```javascript
// Ver un ejemplo antes de ejecutar
db.appointments.findOne({
  selectedAppDates: { $exists: true, $ne: [] },
  treatment: { $exists: true }
});

// EJECUTAR LA MIGRACIÓN
db.appointments.updateMany(
  {
    // Filtro: appointments con slots y sin datos en el primer slot
    selectedAppDates: { $exists: true, $ne: [], $not: { $size: 0 } }
  },
  [
    {
      $set: {
        selectedAppDates: {
          $map: {
            input: "$selectedAppDates",
            as: "slot",
            in: {
              $cond: {
                if: { $eq: [{ $indexOfArray: ["$selectedAppDates", "$$slot"] }, 0] },
                then: {
                  // Primer slot: copiar campos del root si no existen
                  $mergeObjects: [
                    "$$slot",
                    {
                      treatment: {
                        $ifNull: ["$$slot.treatment", "$treatment"]
                      },
                      priority: {
                        $ifNull: ["$$slot.priority", "$priority"]
                      },
                      providers: {
                        $cond: {
                          if: { $or: [
                            { $eq: [{ $ifNull: ["$$slot.providers", null] }, null] },
                            { $eq: [{ $size: { $ifNull: ["$$slot.providers", []] } }, 0] }
                          ]},
                          then: { $ifNull: ["$providers", []] },
                          else: "$$slot.providers"
                        }
                      },
                      duration: {
                        $ifNull: ["$$slot.duration", 60]
                      },
                      providerNotes: {
                        $ifNull: ["$$slot.providerNotes", ""]
                      }
                    }
                  ]
                },
                else: "$$slot"
              }
            }
          }
        }
      }
    }
  ]
);
```

### Verificar Resultados
```javascript
// Ver el primer appointment migrado
db.appointments.findOne({
  'selectedAppDates.0.treatment': { $exists: true }
});

// Contar cuántos tienen datos en el primer slot ahora
db.appointments.countDocuments({
  'selectedAppDates.0.treatment': { $exists: true }
});

db.appointments.countDocuments({
  'selectedAppDates.0.priority': { $exists: true }
});

db.appointments.countDocuments({
  'selectedAppDates.0.providers.0': { $exists: true }
});
```

## 🔍 Consulta Detallada por Organización

```javascript
// Reemplaza 'YOUR_ORG_ID' con tu org_id
const orgId = 'YOUR_ORG_ID';

// Ver estado antes de migrar
db.appointments.aggregate([
  { $match: { org_id: orgId } },
  {
    $project: {
      hasRootTreatment: { $cond: [{ $ifNull: ["$treatment", false] }, 1, 0] },
      hasRootPriority: { $cond: [{ $ifNull: ["$priority", false] }, 1, 0] },
      hasRootProviders: { $cond: [{ $gt: [{ $size: { $ifNull: ["$providers", []] } }, 0] }, 1, 0] },
      hasSlotTreatment: { $cond: [{ $ifNull: ["$selectedAppDates.0.treatment", false] }, 1, 0] },
      hasSlotPriority: { $cond: [{ $ifNull: ["$selectedAppDates.0.priority", false] }, 1, 0] },
      hasSlotProviders: { $cond: [{ $gt: [{ $size: { $ifNull: ["$selectedAppDates.0.providers", []] } }, 0] }, 1, 0] }
    }
  },
  {
    $group: {
      _id: null,
      totalWithRootTreatment: { $sum: "$hasRootTreatment" },
      totalWithRootPriority: { $sum: "$hasRootPriority" },
      totalWithRootProviders: { $sum: "$hasRootProviders" },
      totalWithSlotTreatment: { $sum: "$hasSlotTreatment" },
      totalWithSlotPriority: { $sum: "$hasSlotPriority" },
      totalWithSlotProviders: { $sum: "$hasSlotProviders" }
    }
  }
]);
```

## ⚡ Ejecución Rápida

### Desde Terminal (usando Docker)
```bash
# Ejecutar la migración directamente
docker exec -it mongodb mongosh mongodb://localhost:27017/letsmarter --eval '
db.appointments.updateMany(
  {
    selectedAppDates: { $exists: true, $ne: [], $not: { $size: 0 } }
  },
  [
    {
      $set: {
        selectedAppDates: {
          $map: {
            input: "$selectedAppDates",
            as: "slot",
            in: {
              $cond: {
                if: { $eq: [{ $indexOfArray: ["$selectedAppDates", "$$slot"] }, 0] },
                then: {
                  $mergeObjects: [
                    "$$slot",
                    {
                      treatment: { $ifNull: ["$$slot.treatment", "$treatment"] },
                      priority: { $ifNull: ["$$slot.priority", "$priority"] },
                      providers: {
                        $cond: {
                          if: { $or: [
                            { $eq: [{ $ifNull: ["$$slot.providers", null] }, null] },
                            { $eq: [{ $size: { $ifNull: ["$$slot.providers", []] } }, 0] }
                          ]},
                          then: { $ifNull: ["$providers", []] },
                          else: "$$slot.providers"
                        }
                      },
                      duration: { $ifNull: ["$$slot.duration", 60] },
                      providerNotes: { $ifNull: ["$$slot.providerNotes", ""] }
                    }
                  ]
                },
                else: "$$slot"
              }
            }
          }
        }
      }
    }
  ]
)
'
```

## 🎯 Rollback (Si Algo Sale Mal)

```javascript
// Solo si necesitas revertir (esto ELIMINA los campos del slot, no restaura)
db.appointments.updateMany(
  {},
  {
    $unset: {
      'selectedAppDates.$[].treatment': '',
      'selectedAppDates.$[].priority': '',
      'selectedAppDates.$[].providers': '',
      'selectedAppDates.$[].duration': '',
      'selectedAppDates.$[].providerNotes': ''
    }
  }
);
```

## 📊 Verificación Final

```javascript
// Buscar appointments que aún necesitan migración
db.appointments.find({
  selectedAppDates: { $exists: true, $ne: [] },
  treatment: { $exists: true },
  'selectedAppDates.0.treatment': { $exists: false }
}).limit(5);

// Debe retornar 0 documentos si la migración fue exitosa
```

## ⚠️ Notas Importantes

1. **Backup**: Asegúrate de tener un backup antes de ejecutar
2. **Idempotencia**: La consulta es segura de ejecutar múltiples veces
3. **Solo Primer Slot**: Solo modifica `selectedAppDates[0]`, otros slots no se tocan
4. **No Sobrescribe**: Solo copia si el campo no existe en el slot

## 🐛 Troubleshooting

### Error: "selectedAppDates is not an array"
- Algunos appointments pueden tener `selectedAppDates: null` o indefinido
- La consulta ya filtra estos casos con `$ne: []`

### Los providers están vacíos después de migrar
- Verifica que el root tenga providers: `db.appointments.findOne({ providers: { $exists: true, $ne: [] } })`
- Ejecuta la consulta de verificación para ver el estado

### La consulta no actualiza nada
- Verifica que haya appointments con el criterio: 
  ```javascript
  db.appointments.countDocuments({
    selectedAppDates: { $exists: true, $ne: [], $not: { $size: 0 } }
  })
  ```
