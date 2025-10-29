# Correcciones al Filtro de Rangos de Fechas

## Problema Identificado
El filtro de rangos de fechas no mostraba todas las citas esperadas porque:
1. El backend solo enviaba citas de las próximas 2 semanas (13 días)
2. El backend usaba lógica de "contención" en lugar de "solapamiento"
3. El cálculo de "2 weeks" en el frontend no era correcto

## Cambios Realizados

### Backend (`apps/backend/src/helpers/index.js`)
**Antes:** Enviaba citas de los próximos 13 días
```javascript
end.setDate(start.getDate() + 13);
```

**Después:** Envía citas de los próximos 60 días (2 meses)
```javascript
end.setDate(start.getDate() + 60);
```

### Backend (`apps/backend/src/routes/priority-list.js`)
**Antes:** Buscaba citas completamente dentro del rango
```javascript
selectedAppDates: {
  $elemMatch: {
    startDate: { $gte: start },  // debe empezar después
    endDate: { $lte: end },      // debe terminar antes
  },
}
```

**Después:** Busca citas que se solapen con el rango
```javascript
selectedAppDates: {
  $elemMatch: {
    startDate: { $lte: end },    // empieza antes del fin
    endDate: { $gte: start },    // termina después del inicio
  },
}
```

### Frontend (`apps/frontend/src/Functions/filterAppointmentsByRage.tsx`)
- ✅ Agregado `startOfDay()` y `endOfDay()` para normalizar fechas
- ✅ Corregido "2weeks" para cubrir 14 días completos (esta semana + próxima)
- ✅ Agregado console.log para debugging
- ✅ Mejorado comentarios explicando la lógica

## Resultado
Ahora el filtro debería:
- ✅ Mostrar más citas en "This Month" que en "Next 2 Weeks"
- ✅ Incluir citas que comienzan o terminan en los límites del rango
- ✅ Funcionar correctamente con rangos personalizados de hasta 60 días
