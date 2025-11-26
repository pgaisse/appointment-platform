// AppointmentSlotEditor.tsx
// Componente para editar treatment, priority y providers por cada slot de appointment
import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  FormControl,
  FormLabel,
  Badge,
  Button,
  Collapse,
  IconButton,
  Tag,
  Divider,
  Alert,
  AlertIcon,
  useToast,
} from '@chakra-ui/react';
import { MdExpandMore, MdExpandLess } from 'react-icons/md';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import CustomButtonGroup from '../Form/CustomButtonGroup';
import { TreatmentSelector } from '../Treatments/TreatmentSelector';
import { useProvidersList } from '@/Hooks/Query/useProviders';
import {
  useAppointmentProviders,
  useCreateAppointmentProvider,
  useDeleteAppointmentProvider,
} from '@/Hooks/Query/useAppointmentProviders';
import { useProviderSchedule } from '@/Hooks/Query/useProviderSchedule';
import { useProviderAppointments } from '@/Hooks/Query/useProviderAppointments';
import { useGetCollection } from '@/Hooks/Query/useGetCollection';
import type { Provider, Treatment, Priority } from '@/types';

dayjs.extend(utc);
dayjs.extend(timezone);

const DEFAULT_TZ = 'Australia/Sydney';

// Status color mapping
const SLOT_STATUS_COLOR: Record<string, string> = {
  confirmed: 'green',
  pending: 'yellow',
  nocontacted: 'gray',
  contacted: 'blue',
  declined: 'red',
  reschedule: 'purple',
  cancelled: 'red',
  unknown: 'gray',
  new: 'blue',
};

export type DateRange = {
  startDate: Date;
  endDate: Date;
  status?: string;
  slotId?: string;
  _id?: string;
  treatment?: string; // ObjectId ref
  priority?: string; // ObjectId ref
  providers?: string[]; // ObjectId refs
  duration?: number;
  providerNotes?: string;
};

export type PendingAssignment = {
  slotIndex: number;
  providerId: string;
  startDate: Date;
  endDate: Date;
};

// Helper to check if provider has time conflicts with existing appointments
// providerEvents comes from useProviderAppointments which returns CalendarData[]
function hasTimeConflict(
  slotStartDate: Date | string,
  slotEndDate: Date | string,
  providerEvents: Array<{ _id: string; start: Date; end: Date }> = [],
  currentAppointmentId?: string,
  timezone: string = DEFAULT_TZ
): { hasConflict: boolean; reason?: string } {
  const slotStart = dayjs(slotStartDate).tz(timezone);
  const slotEnd = dayjs(slotEndDate).tz(timezone);

  for (const event of providerEvents) {
    // Skip events from the current appointment being edited
    // The event _id format is "appointmentId-slotId" or just "appointmentId"
    const eventAppointmentId = event._id.split('-')[0];
    if (currentAppointmentId && eventAppointmentId === String(currentAppointmentId)) {
      continue;
    }

    const eventStart = dayjs(event.start).tz(timezone);
    const eventEnd = dayjs(event.end).tz(timezone);

    // Check for overlap: slot starts before event ends AND slot ends after event starts
    const hasOverlap = slotStart.isBefore(eventEnd) && slotEnd.isAfter(eventStart);
    
    if (hasOverlap) {
      return { 
        hasConflict: true, 
        reason: `Booked ${eventStart.format('h:mm A')} - ${eventEnd.format('h:mm A')}` 
      };
    }
  }

  return { hasConflict: false };
}

// Helper to check provider availability in schedule
function isProviderAvailableInSlot(
  providerSchedule: any,
  slotStartDate: Date | string,
  slotEndDate: Date | string,
  timezone: string = DEFAULT_TZ
): { available: boolean; reason?: string } {
  if (!providerSchedule) {
    return { available: false, reason: 'No schedule' };
  }

  // Check if schedule has weekly property
  if (!providerSchedule.weekly) {
    return { available: false, reason: 'No schedule' };
  }

  const slotStart = dayjs(slotStartDate).tz(timezone);
  const slotEnd = dayjs(slotEndDate).tz(timezone);

  if (!slotStart.isSame(slotEnd, 'day')) {
    return { available: false, reason: 'Multi-day slot' };
  }

  const dayOfWeek = slotStart.day();
  // Use abbreviated day names to match the schedule structure: mon, tue, wed, thu, fri, sat, sun
  const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const dayKey = dayKeys[dayOfWeek];
  
  const dayBlocks = providerSchedule.weekly[dayKey];

  if (!Array.isArray(dayBlocks) || dayBlocks.length === 0) {
    return { available: false, reason: 'Not working this day' };
  }

  const slotStartTime = slotStart.hour() * 60 + slotStart.minute();
  const slotEndTime = slotEnd.hour() * 60 + slotEnd.minute();

  for (const block of dayBlocks) {
    const [startHour, startMin] = block.start.split(':').map(Number);
    const [endHour, endMin] = block.end.split(':').map(Number);
    const blockStart = startHour * 60 + startMin;
    const blockEnd = endHour * 60 + endMin;

    if (slotStartTime >= blockStart && slotEndTime <= blockEnd) {
      return { available: true };
    }
  }

  return { available: false, reason: 'Outside working hours' };
}

// Provider row component
function ProviderRow({
  p,
  onAdd,
  rightAdornment,
}: {
  p: Provider;
  onAdd: (p: Provider) => void;
  rightAdornment?: React.ReactNode;
}) {
  return (
    <HStack
      as="div"
      justify="space-between"
      px={2}
      py={2}
      borderRadius="md"
      _hover={{ bg: 'blackAlpha.50' }}
      cursor="pointer"
      onClick={() => onAdd(p)}
    >
      <HStack>
        <Box w="8px" h="8px" borderRadius="full" bg={p.color || 'gray.300'} />
        <Text fontSize="sm" fontWeight="medium" textTransform="capitalize">
          {`${p.firstName} ${p.lastName}`.trim()}
        </Text>
      </HStack>
      {rightAdornment}
    </HStack>
  );
}

// Provider row with schedule and appointment conflict check
function ProviderRowWithAvailabilityCheck({
  p,
  slot,
  onAdd,
  currentAppointmentId,
  tz = DEFAULT_TZ,
}: {
  p: Provider;
  slot: { startDate: Date; endDate: Date };
  onAdd: (p: Provider) => void;
  currentAppointmentId?: string;
  tz?: string;
}) {
  const { data: providerSchedule } = useProviderSchedule(p._id);
  
  // Calculate date range for query (add buffer to catch overlapping appointments)
  const dateRange = useMemo(() => {
    const start = dayjs(slot.startDate).tz(tz).subtract(1, 'day');
    const end = dayjs(slot.endDate).tz(tz).add(1, 'day');
    return {
      from: start.toISOString(),
      to: end.toISOString(),
    };
  }, [slot.startDate, slot.endDate, tz]);

  // Fetch provider's existing appointments in the time range
  const { data: providerEvents = [] } = useProviderAppointments(p._id, dateRange);

  const availabilityCheck = useMemo(() => {
    // First check schedule availability
    const scheduleCheck = isProviderAvailableInSlot(providerSchedule, slot.startDate, slot.endDate, tz);
    if (!scheduleCheck.available) {
      return { available: false, reason: scheduleCheck.reason };
    }

    // Then check for appointment conflicts
    const conflictCheck = hasTimeConflict(
      slot.startDate, 
      slot.endDate, 
      providerEvents,
      currentAppointmentId,
      tz
    );
    
    if (conflictCheck.hasConflict) {
      return { available: false, reason: conflictCheck.reason };
    }

    return { available: true };
  }, [providerSchedule, providerEvents, slot.startDate, slot.endDate, currentAppointmentId, tz]);

  const statusTag = useMemo(() => {
    if (availabilityCheck.available) {
      return { label: 'Available', color: 'green' };
    }
    return { label: availabilityCheck.reason || 'Unavailable', color: 'red' };
  }, [availabilityCheck]);

  return (
    <ProviderRow
      p={p}
      onAdd={onAdd}
      rightAdornment={
        <Tag size="sm" colorScheme={statusTag.color}>
          {statusTag.label}
        </Tag>
      }
    />
  );
}

// Main component
export default function AppointmentSlotEditor({
  mode,
  tz = DEFAULT_TZ,
  selectedAppDates,
  onSlotChange,
  appointmentId,
  formBusy,
  onPendingAssignmentsChange,
  globalDuration,
  globalTreatmentId,
  globalPriorityId,
}: {
  mode: 'CREATION' | 'EDITION';
  tz?: string;
  selectedAppDates: DateRange[];
  onSlotChange: (index: number, updates: Partial<DateRange>) => void;
  appointmentId?: string;
  formBusy?: boolean;
  onPendingAssignmentsChange?: (assignments: PendingAssignment[]) => void;
  globalDuration?: number;
  globalTreatmentId?: string;
  globalPriorityId?: string;
}) {
  const toast = useToast();
  const { data: allProviders = [] } = useProvidersList({ active: true });
  const { data: appointmentProviders = [], refetch: refetchProviders } = useAppointmentProviders(appointmentId);
  const { mutateAsync: createAssignment } = useCreateAppointmentProvider();
  const { mutateAsync: deleteAssignment } = useDeleteAppointmentProvider();

  // Fetch all treatments and priorities for display
  const { data: allTreatments = [] } = useGetCollection<Treatment>('Treatment', {
    mongoQuery: {},
    limit: 1000,
    projection: { _id: 1, name: 1, duration: 1, color: 1 },
  });
  const { data: allPriorities = [] } = useGetCollection<Priority>('PriorityList', {
    mongoQuery: {},
    limit: 1000,
    projection: { _id: 1, name: 1, color: 1, durationHours: 1 },
  });

  // Helper functions to find treatment/priority by ID
  const getTreatmentById = useCallback((id?: string) => {
    if (!id) return null;
    return allTreatments.find(t => String(t._id) === String(id)) || null;
  }, [allTreatments]);

  const getPriorityById = useCallback((id?: string) => {
    if (!id) return null;
    return allPriorities.find(p => String(p._id) === String(id)) || null;
  }, [allPriorities]);

  const [pendingAssignments, setPendingAssignments] = useState<PendingAssignment[]>([]);
  const [expandedSlots, setExpandedSlots] = useState<Record<number, boolean>>({});

  // Toggle slot expansion
  const toggleSlot = useCallback((idx: number) => {
    setExpandedSlots((prev) => ({ ...prev, [idx]: !prev[idx] }));
  }, []);

  // Add pending assignment (CREATION mode)
  const addPendingAssignment = useCallback((slotIndex: number, providerId: string, startDate: Date, endDate: Date) => {
    setPendingAssignments((prev) => {
      // Evitar duplicados
      if (prev.some((p) => p.slotIndex === slotIndex && String(p.providerId) === String(providerId))) {
        return prev;
      }
      return [...prev, { slotIndex, providerId, startDate, endDate }];
    });
  }, []);

  // Remove pending assignment
  const removePendingAssignment = useCallback((slotIndex: number, providerId?: string) => {
    setPendingAssignments((prev) => {
      if (providerId) {
        return prev.filter((p) => !(p.slotIndex === slotIndex && String(p.providerId) === String(providerId)));
      }
      return prev.filter((p) => p.slotIndex !== slotIndex);
    });
    
    // Also remove from the slot's providers array
    if (providerId) {
      const slot = selectedAppDates[slotIndex];
      if (slot && slot.providers) {
        const updatedProviders = slot.providers.filter(p => String(p) !== String(providerId));
        onSlotChange(slotIndex, { providers: updatedProviders });
      }
    }
  }, [selectedAppDates, onSlotChange]);

  // Notify parent of pending assignments
  React.useEffect(() => {
    if (onPendingAssignmentsChange && mode === 'CREATION' && !appointmentId) {
      onPendingAssignmentsChange(pendingAssignments);
    }
  }, [pendingAssignments, onPendingAssignmentsChange, mode, appointmentId]);

  // Track the last global values to detect changes
  const lastGlobalValuesRef = React.useRef({ 
    treatmentId: globalTreatmentId, 
    priorityId: globalPriorityId, 
    duration: globalDuration 
  });

  // Initialize slots with global values - runs when global values change or slots are added
  React.useEffect(() => {
    if (mode !== 'CREATION' || appointmentId) return;
    if (!globalTreatmentId && !globalPriorityId && globalDuration === undefined) return;

    // Check if global values have changed
    const globalsChanged = 
      lastGlobalValuesRef.current.treatmentId !== globalTreatmentId ||
      lastGlobalValuesRef.current.priorityId !== globalPriorityId ||
      lastGlobalValuesRef.current.duration !== globalDuration;

    if (globalsChanged) {
      lastGlobalValuesRef.current = { 
        treatmentId: globalTreatmentId, 
        priorityId: globalPriorityId, 
        duration: globalDuration 
      };
    }

    // Update all slots that don't have values
    selectedAppDates.forEach((slot, idx) => {
      const updates: Partial<DateRange> = {};
      
      // Always apply global values if slot doesn't have them
      if (!slot.treatment && globalTreatmentId) {
        updates.treatment = globalTreatmentId;
      }
      if (!slot.priority && globalPriorityId) {
        updates.priority = globalPriorityId;
      }
      if (slot.duration === undefined && globalDuration !== undefined) {
        updates.duration = globalDuration;
      }
      
      // Apply updates if any
      if (Object.keys(updates).length > 0) {
        onSlotChange(idx, updates);
      }
    });
  }, [mode, appointmentId, globalTreatmentId, globalPriorityId, globalDuration, selectedAppDates.length]);

  // Separate effect to handle individual slot updates when they're added
  React.useEffect(() => {
    if (mode !== 'CREATION' || appointmentId) return;
    if (!globalTreatmentId && !globalPriorityId && globalDuration === undefined) return;

    // Check each slot individually
    selectedAppDates.forEach((slot, idx) => {
      if (!slot.treatment || !slot.priority || slot.duration === undefined) {
        const updates: Partial<DateRange> = {};
        if (!slot.treatment && globalTreatmentId) updates.treatment = globalTreatmentId;
        if (!slot.priority && globalPriorityId) updates.priority = globalPriorityId;
        if (slot.duration === undefined && globalDuration !== undefined) updates.duration = globalDuration;
        
        if (Object.keys(updates).length > 0) {
          // Use setTimeout to avoid state updates during render
          setTimeout(() => onSlotChange(idx, updates), 0);
        }
      }
    });
  }, [mode, appointmentId, globalTreatmentId, globalPriorityId, globalDuration, selectedAppDates]);

  // Get pending assignments for a slot
  const getPendingAssignmentsForSlot = useCallback(
    (slotIndex: number) => {
      return pendingAssignments.filter((p) => p.slotIndex === slotIndex);
    },
    [pendingAssignments]
  );

  // Assign/update provider in EDITION mode
  const upsertAssignmentProvider = async (slotIndex: number, providerId: string, slot: DateRange) => {
    if (mode === 'CREATION' && !appointmentId) {
      // Add to pending assignments for AppointmentProvider collection
      addPendingAssignment(slotIndex, providerId, slot.startDate, slot.endDate);
      
      // CRITICAL: Also add provider to the slot's providers array in selectedAppDates
      const currentProviders = slot.providers || [];
      if (!currentProviders.includes(providerId)) {
        const updatedProviders = [...currentProviders, providerId];
        onSlotChange(slotIndex, { providers: updatedProviders });
      }
      
      toast({
        title: 'Provider selected',
        description: 'Provider will be assigned when appointment is created.',
        status: 'success',
        duration: 2000,
      });
      return;
    }

    if (!appointmentId) {
      toast({
        title: 'Cannot assign provider',
        description: 'Missing appointment ID.',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    const slotId = (slot as any)?._id || (slot as any)?.slotId || `temp-${slotIndex}`;

    try {
      await createAssignment({
        appointment: appointmentId,
        provider: providerId,
        slotId,
        startDate: slot.startDate,
        endDate: slot.endDate,
      });

      // Also update the slot's providers array
      const currentProviders = slot.providers || [];
      if (!currentProviders.includes(providerId)) {
        const updatedProviders = [...currentProviders, providerId];
        onSlotChange(slotIndex, { providers: updatedProviders });
      }

      await refetchProviders();
      toast({
        title: 'Provider assigned',
        status: 'success',
        duration: 2000,
      });
    } catch (error) {
      console.error('Error assigning provider:', error);
      toast({
        title: 'Error assigning provider',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        status: 'error',
        duration: 4000,
      });
    }
  };

  // Remove provider assignment
  const removeAssignment = async (assignmentId: string, slotIndex?: number, providerId?: string) => {
    try {
      await deleteAssignment(assignmentId);
      
      // Also remove from the slot's providers array
      if (slotIndex !== undefined && providerId) {
        const slot = selectedAppDates[slotIndex];
        if (slot && slot.providers) {
          const updatedProviders = slot.providers.filter(p => String(p) !== String(providerId));
          onSlotChange(slotIndex, { providers: updatedProviders });
        }
      }
      
      await refetchProviders();
      toast({ title: 'Provider removed', status: 'info', duration: 2000 });
    } catch (err) {
      console.error('Error removing provider:', err);
      toast({ title: 'Error removing provider', status: 'error', duration: 3000 });
    }
  };

  if (!selectedAppDates.length) {
    return (
      <Box mt={4} p={3} borderWidth="1px" borderRadius="md" bg="blackAlpha.50">
        <Alert status="info" borderRadius="md">
          <AlertIcon />
          Add at least one appointment date to configure treatments, priorities and providers.
        </Alert>
      </Box>
    );
  }

  return (
    <Box mt={4} p={3} borderWidth="1px" borderRadius="md" bg="blackAlpha.50">
      <FormControl>
        <FormLabel mb={3}>Appointment Slots Configuration</FormLabel>
        <VStack align="stretch" spacing={3}>
          {selectedAppDates.map((slot, idx) => {
            const s = dayjs.utc(slot.startDate).tz(tz);
            const e = dayjs.utc(slot.endDate).tz(tz);
            const sameDay = s.format('YYYY-MM-DD') === e.format('YYYY-MM-DD');
            const displayDate = sameDay
              ? `${s.format('ddd, DD MMM • h:mm A')} – ${e.format('h:mm A')}`
              : `${s.format('ddd, DD MMM • h:mm A')} → ${e.format('ddd, DD MMM • h:mm A')}`;

            const statusRaw = mode === 'CREATION' ? 'new' : String(slot.status || '').toLowerCase();
            const colorScheme = SLOT_STATUS_COLOR[statusRaw] || (mode === 'CREATION' ? 'blue' : 'gray');

            const slotId = (slot as any)?._id || (slot as any)?.slotId || `temp-${idx}`;
            
            // Get assignments for this slot
            const assignmentsForSlot =
              mode === 'CREATION' && !appointmentId
                ? []
                : appointmentProviders.filter((ap: any) => {
                    if (ap.slotId && slotId && String(ap.slotId) === String(slotId)) {
                      return true;
                    }
                    const apStart = new Date(ap.startDate).getTime();
                    const apEnd = new Date(ap.endDate).getTime();
                    const slotStart = new Date(slot.startDate).getTime();
                    const slotEnd = new Date(slot.endDate).getTime();
                    return apStart === slotStart && apEnd === slotEnd;
                  });

            const pendingAssignmentsForSlot = mode === 'CREATION' && !appointmentId
              ? getPendingAssignmentsForSlot(idx)
              : [];

            const isExpanded = expandedSlots[idx];

            // Calculate duration for display
            const slotDuration = slot.duration ? Math.round(slot.duration * 60) : null;

            return (
              <Box key={`slot-${idx}-${s.valueOf()}`} borderWidth="1px" borderRadius="md" p={3} bg="white">
                {/* Header */}
                <HStack justify="space-between" mb={2}>
                  <HStack spacing={3} flex={1} flexWrap="wrap">
                    <Badge colorScheme={colorScheme} fontSize="xs">
                      Slot {idx + 1}
                    </Badge>
                    <Text fontSize="sm" fontWeight="semibold">
                      {displayDate} {slotDuration && `(${slotDuration} min)`}
                    </Text>
                    {(() => {
                      const slotPriority = getPriorityById(slot.priority);
                      const slotTreatment = getTreatmentById(slot.treatment);
                      return (
                        <>
                          {slotPriority && (
                            <HStack spacing={1} px={2} py={0.5} bg="gray.50" borderRadius="md" borderWidth="1px" borderColor="gray.200">
                              <Box w={2} h={2} borderRadius="full" bg={slotPriority.color || 'gray.400'} />
                              <Text fontSize="xs" fontWeight="medium">{slotPriority.name}</Text>
                            </HStack>
                          )}
                          {slotTreatment && (
                            <HStack spacing={1} px={2} py={0.5} bg="blue.50" borderRadius="md" borderWidth="1px" borderColor="blue.200">
                              <Text fontSize="xs" fontWeight="medium">{slotTreatment.name}</Text>
                            </HStack>
                          )}
                        </>
                      );
                    })()}
                  </HStack>
                  <IconButton
                    aria-label="Toggle slot details"
                    icon={isExpanded ? <MdExpandLess /> : <MdExpandMore />}
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleSlot(idx)}
                    isDisabled={formBusy}
                  />
                </HStack>

                <Collapse in={isExpanded} animateOpacity>
                  <VStack align="stretch" spacing={4} mt={3}>
                    {/* Treatment */}
                    <FormControl>
                      <FormLabel fontSize="sm">Treatment</FormLabel>
                      <TreatmentSelector
                        selectedId={slot.treatment || globalTreatmentId || ''}
                        selected={-1}
                        onChange={(id: string) => {
                          // Find the selected treatment to get its duration
                          const selectedTreatment = getTreatmentById(id);
                          const updates: Partial<DateRange> = { treatment: id };
                          
                          // If treatment has a duration, update slot duration and endDate
                          if (selectedTreatment?.duration) {
                            // Treatment duration is stored in MINUTES in the database
                            const treatmentDurationMinutes = selectedTreatment.duration;
                            // Convert to hours for the slot (slot.duration expects hours)
                            const treatmentDurationHours = treatmentDurationMinutes / 60;
                            updates.duration = treatmentDurationHours;
                            
                            // Recalculate endDate based on startDate + treatment duration (in minutes)
                            const newStartDate = dayjs(slot.startDate).tz(tz);
                            const newEndDate = newStartDate.add(treatmentDurationMinutes, 'minute').toDate();
                            updates.endDate = newEndDate;
                          }
                          
                          onSlotChange(idx, updates);
                        }}
                        onSelect={() => {}}
                      />
                    </FormControl>

                    <Divider />

                    {/* Priority */}
                    <FormControl>
                      <FormLabel fontSize="sm">Priority</FormLabel>
                      <CustomButtonGroup
                        selected={-1}
                        setSelected={() => {}}
                        isPending={formBusy}
                        value={slot.priority || globalPriorityId || ''}
                        onChange={(id: string, _name: string, _color?: string, _duration?: number | null) => {
                          // Priority duration is deprecated - do not update slot duration
                          onSlotChange(idx, { priority: id });
                        }}
                      />
                    </FormControl>

                    <Divider />

                    {/* Duration */}
                    <FormControl>
                      <FormLabel fontSize="sm">Duration (minutes)</FormLabel>
                      <input
                        type="number"
                        value={slot.duration ? Math.round(slot.duration * 60) : (globalDuration ? Math.round(globalDuration * 60) : '')}
                        onChange={(e) => {
                          const minutes = parseInt(e.target.value) || 0;
                          const hours = minutes / 60;
                          
                          // Recalculate endDate based on startDate + new duration
                          const newStartDate = dayjs(slot.startDate).tz(tz);
                          const newEndDate = newStartDate.add(minutes, 'minute').toDate();
                          
                          onSlotChange(idx, { 
                            duration: hours,
                            endDate: newEndDate
                          });
                        }}
                        disabled={formBusy}
                        placeholder="Duration in minutes"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          fontSize: '0.875rem',
                          border: '1px solid #E2E8F0',
                          borderRadius: '6px',
                          backgroundColor: formBusy ? '#F7FAFC' : 'white',
                        }}
                      />
                    </FormControl>

                    <Divider />

                    {/* Providers */}
                    <Box>
                      <FormLabel fontSize="sm">Providers</FormLabel>

                      {/* Assigned providers (EDITION) */}
                      {assignmentsForSlot.length > 0 && (
                        <Box mb={3}>
                          <Text fontSize="xs" fontWeight="semibold" mb={2} color="gray.600">
                            Assigned
                          </Text>
                          <VStack align="stretch" spacing={2}>
                            {assignmentsForSlot.map((ap: any) => {
                              const assignedProvider =
                                typeof ap.provider === 'object'
                                  ? ap.provider
                                  : allProviders.find((p: any) => String(p._id) === String(ap.provider));

                              return (
                                <Box key={ap._id} borderWidth="1px" borderRadius="md" p={2} bg="green.50" borderColor="green.200">
                                  <HStack justify="space-between">
                                    <HStack>
                                      <Box w="8px" h="8px" borderRadius="full" bg={assignedProvider?.color || 'gray.300'} />
                                      <Text fontSize="sm" fontWeight="medium" textTransform="capitalize">
                                        {assignedProvider
                                          ? `${assignedProvider.firstName} ${assignedProvider.lastName}`.trim()
                                          : 'Provider not found'}
                                      </Text>
                                    </HStack>
                                    <HStack>
                                      <Badge colorScheme="green" size="sm">
                                        Assigned
                                      </Badge>
                                      {mode === 'EDITION' && (
                                        <Button 
                                          size="xs" 
                                          variant="ghost" 
                                          onClick={() => {
                                            const providerId = typeof ap.provider === 'object' ? ap.provider._id : ap.provider;
                                            removeAssignment(ap._id, idx, String(providerId));
                                          }}
                                        >
                                          Remove
                                        </Button>
                                      )}
                                    </HStack>
                                  </HStack>
                                </Box>
                              );
                            })}
                          </VStack>
                        </Box>
                      )}

                      {/* Pending providers (CREATION) */}
                      {pendingAssignmentsForSlot.length > 0 && (
                        <Box mb={3}>
                          <Text fontSize="xs" fontWeight="semibold" mb={2} color="gray.600">
                            Selected
                          </Text>
                          <VStack align="stretch" spacing={2}>
                            {pendingAssignmentsForSlot.map((pa) => {
                              const selectedProvider = allProviders.find((p: any) => String(p._id) === String(pa.providerId));
                              return (
                                <Box
                                  key={`${pa.slotIndex}-${pa.providerId}`}
                                  borderWidth="1px"
                                  borderRadius="md"
                                  p={2}
                                  bg="blue.50"
                                  borderColor="blue.200"
                                >
                                  <HStack justify="space-between">
                                    <HStack>
                                      <Box w="8px" h="8px" borderRadius="full" bg={selectedProvider?.color || 'gray.300'} />
                                      <Text fontSize="sm" fontWeight="medium" textTransform="capitalize">
                                        {selectedProvider
                                          ? `${selectedProvider.firstName} ${selectedProvider.lastName}`.trim()
                                          : 'Unknown provider'}
                                      </Text>
                                    </HStack>
                                    <Button size="xs" variant="ghost" onClick={() => removePendingAssignment(idx, pa.providerId)}>
                                      Remove
                                    </Button>
                                  </HStack>
                                </Box>
                              );
                            })}
                          </VStack>
                        </Box>
                      )}

                      {/* Provider selector */}
                      <Box>
                        <Text fontSize="xs" fontWeight="semibold" mb={2} color="gray.600">
                          {assignmentsForSlot.length > 0 || pendingAssignmentsForSlot.length > 0 ? 'Add provider' : 'Select provider'}
                        </Text>
                        <Box borderWidth="1px" borderRadius="md" maxH="180px" overflowY="auto" px={1} py={1}>
                          {allProviders
                            .filter((p: any) => {
                              // Filter out already assigned
                              const alreadyAssigned = assignmentsForSlot.some((ap: any) => {
                                const assignedProviderId = typeof ap.provider === 'object' ? ap.provider._id : ap.provider;
                                return String(p._id) === String(assignedProviderId);
                              });
                              if (alreadyAssigned) return false;

                              // Filter out already pending
                              if (pendingAssignmentsForSlot.length) {
                                const alreadyPending = pendingAssignmentsForSlot.some(
                                  (pa) => String(pa.providerId) === String(p._id)
                                );
                                if (alreadyPending) return false;
                              }
                              return true;
                            })
                            .map((p: any) => (
                              <ProviderRowWithAvailabilityCheck
                                key={`assign-${p._id}-${slotId}`}
                                p={p}
                                slot={{ startDate: slot.startDate, endDate: slot.endDate }}
                                onAdd={(prov) => upsertAssignmentProvider(idx, String(prov._id), slot)}
                                currentAppointmentId={appointmentId}
                                tz={tz}
                              />
                            ))}
                        </Box>
                      </Box>
                    </Box>
                  </VStack>
                </Collapse>
              </Box>
            );
          })}
        </VStack>
      </FormControl>
    </Box>
  );
}
