# Integrar Google Calendar en AssignedAppointments

## Opción Simple: Agregar Botón de Sincronización

Esta es la forma más rápida de integrar Google Calendar en tu componente existente `AssignedAppointments.tsx`.

### 1. Importar el componente

Agrega al inicio de `AssignedAppointments.tsx`:

```tsx
import { GoogleCalendarButton } from '@/Components/GoogleCalendarButton';
```

### 2. Agregar el botón en el header del calendario

Busca la sección donde tienes los botones de vista (Day, Week, Month) y agrega:

```tsx
// En el header del calendario, junto a los botones de vista
<HStack spacing={3}>
  {/* Botones existentes de Day/Week/Month */}
  <Button onClick={() => onView('day')}>Day</Button>
  <Button onClick={() => onView('week')}>Week</Button>
  <Button onClick={() => onView('month')}>Month</Button>
  
  {/* NUEVO: Botón de Google Calendar */}
  <GoogleCalendarButton
    clientId="481917862024-4e86cicdql6e3qmepigdlmrkfdcpu6e3.apps.googleusercontent.com"
    appointments={appointments}
    variant="menu"
    size="md"
  />
</HStack>
```

### 3. Agregar botón en el modal de edición (opcional)

Si quieres permitir sincronizar appointments individuales desde el modal de edición/reschedule:

```tsx
// Dentro del modal, en el footer con los botones de acción
<ModalFooter>
  <HStack spacing={3}>
    {/* Botones existentes */}
    <Button onClick={handleClose}>Cancel</Button>
    <Button onClick={handleSave} colorScheme="blue">Save</Button>
    
    {/* NUEVO: Botón para sincronizar este appointment */}
    <GoogleCalendarButton
      clientId="481917862024-4e86cicdql6e3qmepigdlmrkfdcpu6e3.apps.googleusercontent.com"
      appointment={selectedAppointment}
      variant="icon"
      size="sm"
    />
  </HStack>
</ModalFooter>
```

## Opción Avanzada: Sincronización Automática después de Cambios

Si quieres que los appointments se sincronicen automáticamente después de crear/editar/eliminar:

### 1. Agregar el hook al componente

```tsx
import { useGoogleCalendar } from '@/Hooks/useGoogleCalendar';

// Dentro de tu componente AssignedAppointments
const {
  isAuthenticated,
  syncSingleAppointment,
} = useGoogleCalendar('481917862024-4e86cicdql6e3qmepigdlmrkfdcpu6e3.apps.googleusercontent.com');
```

### 2. Sincronizar después de acciones

Modifica tus handlers existentes:

```tsx
const handleConfirmManual = useCallback(async () => {
  if (!rescheduleData) return;

  const payload = {
    id: rescheduleData.id,
    selectedAppDates: [
      {
        _id: rescheduleData.slotId,
        startDate: rescheduleData.newStart.toISOString(),
        endDate: rescheduleData.newEnd.toISOString(),
        status: 'Contacted',
      },
    ],
  };

  await updateItems.mutateAsync(payload);
  await refreshData();
  
  // NUEVO: Sincronizar con Google Calendar si está autenticado
  if (isAuthenticated) {
    try {
      await syncSingleAppointment({
        _id: rescheduleData.id,
        nameInput: rescheduleData.name,
        lastNameInput: rescheduleData.lastName || '',
        phoneInput: rescheduleData.phoneInput,
        selectedAppDates: [
          {
            _id: rescheduleData.slotId,
            startDate: rescheduleData.newStart.toISOString(),
            endDate: rescheduleData.newEnd.toISOString(),
          },
        ],
      });
    } catch (err) {
      console.error('Google Calendar sync failed:', err);
    }
  }

  setRescheduleModalOpen(false);
}, [rescheduleData, updateItems, refreshData, isAuthenticated, syncSingleAppointment]);
```

### 3. Agregar indicador visual de sincronización

Puedes agregar un badge o icono para mostrar qué appointments están sincronizados:

```tsx
// En el evento del calendario
{appointment.syncedToGoogle && (
  <Badge colorScheme="green" ml={2}>
    <FcGoogle style={{ display: 'inline', marginRight: '4px' }} />
    Synced
  </Badge>
)}
```

## Configuración Completa Recomendada

Esta es la configuración más completa que combina todas las opciones:

```tsx
import React, { useState, useCallback } from 'react';
import { Box, Button, HStack, VStack, useToast } from '@chakra-ui/react';
import { Calendar } from 'react-big-calendar';
import { GoogleCalendarButton } from '@/Components/GoogleCalendarButton';
import { useGoogleCalendar } from '@/Hooks/useGoogleCalendar';

const GOOGLE_CLIENT_ID = '481917862024-4e86cicdql6e3qmepigdlmrkfdcpu6e3.apps.googleusercontent.com';

export const AssignedAppointments = () => {
  // Hook de Google Calendar
  const {
    isAuthenticated: isGoogleAuth,
    syncSingleAppointment,
  } = useGoogleCalendar(GOOGLE_CLIENT_ID);

  // ... resto de tu código existente ...

  // Modificar handleConfirmManual para incluir sync
  const handleConfirmManual = useCallback(async () => {
    if (!rescheduleData) return;

    try {
      // Actualizar en tu sistema
      const payload = {
        id: rescheduleData.id,
        selectedAppDates: [{
          _id: rescheduleData.slotId,
          startDate: rescheduleData.newStart.toISOString(),
          endDate: rescheduleData.newEnd.toISOString(),
          status: 'Contacted',
        }],
      };

      await updateItems.mutateAsync(payload);
      await refreshData();

      // Auto-sync con Google Calendar si está autenticado
      if (isGoogleAuth) {
        await syncSingleAppointment({
          _id: rescheduleData.id,
          nameInput: rescheduleData.name,
          lastNameInput: rescheduleData.lastName || '',
          phoneInput: rescheduleData.phoneInput,
          selectedAppDates: payload.selectedAppDates,
        });
      }

      setRescheduleModalOpen(false);
    } catch (err) {
      console.error('Error:', err);
    }
  }, [rescheduleData, updateItems, refreshData, isGoogleAuth, syncSingleAppointment]);

  return (
    <Box>
      {/* Header con botones */}
      <HStack justify="space-between" mb={4}>
        <HStack>
          <Button onClick={() => onView('day')}>Day</Button>
          <Button onClick={() => onView('week')}>Week</Button>
          <Button onClick={() => onView('month')}>Month</Button>
        </HStack>

        {/* Botón de Google Calendar */}
        <GoogleCalendarButton
          clientId={GOOGLE_CLIENT_ID}
          appointments={appointments}
          variant="menu"
        />
      </HStack>

      {/* Calendario */}
      <Calendar
        // ... props existentes ...
      />

      {/* Resto de tus modals y componentes */}
    </Box>
  );
};
```

## Verificar que todo funciona

1. Reinicia el servidor de desarrollo
2. Abre la página de appointments
3. Deberías ver el botón de Google Calendar
4. Haz click y auténticate
5. Selecciona appointments y sincroniza

## Troubleshooting

Si el botón no aparece:
- Verifica que las importaciones sean correctas
- Revisa la consola del navegador para errores
- Asegúrate que el Google Client ID sea correcto

Si da error de autenticación:
- Verifica la configuración en Google Cloud Console
- Revisa los redirect URIs autorizados
- Asegúrate que Google Calendar API esté habilitada
