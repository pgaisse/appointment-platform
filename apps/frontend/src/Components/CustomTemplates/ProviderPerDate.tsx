import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import {
  Box,
  Badge,
  Button,
  FormControl,
  FormLabel,
  HStack,
  Tag,
  TagLabel,
  Text,
  VStack,
  Alert,
  AlertIcon,
} from "@chakra-ui/react";
// useQueryClient removed - handled by mutation hooks
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { Provider } from "@/types";
import { useToast } from "@chakra-ui/react";
import { 
  useAppointmentProviders, 
  useCreateAppointmentProvider, 
  useUpdateAppointmentProvider, 
  useDeleteAppointmentProvider,
  type AppointmentProvider
} from "@/Hooks/Query/useAppointmentProviders";
import { useProviderSchedule, type DayBlock } from "@/Hooks/Query/useProviders";

dayjs.extend(utc);
dayjs.extend(timezone);

const DEFAULT_TZ = "Australia/Sydney";

// Helper function to check if provider is available during the requested time slot
function isProviderAvailableInSlot(
  providerSchedule: any,
  slotStartDate: Date | string,
  slotEndDate: Date | string,
  timezone: string = DEFAULT_TZ
): { available: boolean; reason?: string; workingHours?: string } {
  if (!providerSchedule?.weekly) {
    return { available: false, reason: "No schedule" };
  }

  const slotStart = dayjs(slotStartDate).tz(timezone);
  const slotEnd = dayjs(slotEndDate).tz(timezone);
  
  // Check if appointment spans multiple days
  if (!slotStart.isSame(slotEnd, 'day')) {
    return { available: false, reason: "Multi-day slot" };
  }
  
  // Get day of week key
  const dayOfWeek = slotStart.day(); // 0 = Sunday, 1 = Monday, etc.
  const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const dayKey = dayKeys[dayOfWeek] as keyof typeof providerSchedule.weekly;

  const dayBlocks: DayBlock[] = providerSchedule.weekly[dayKey] || [];
  
  if (dayBlocks.length === 0) {
    return { available: false, reason: "Not working today" };
  }

  // Convert slot times to minutes from midnight for comparison
  const slotStartMinutes = slotStart.hour() * 60 + slotStart.minute();
  const slotEndMinutes = slotEnd.hour() * 60 + slotEnd.minute();

  // Get working hours for display
  const workingHours = dayBlocks
    .map(block => {
      const startTime = dayjs().hour(parseInt(block.start.split(':')[0])).minute(parseInt(block.start.split(':')[1]));
      const endTime = dayjs().hour(parseInt(block.end.split(':')[0])).minute(parseInt(block.end.split(':')[1]));
      return `${startTime.format('h:mm A')}-${endTime.format('h:mm A')}`;
    })
    .join(', ');

  // Check if the slot fits within any of the provider's working blocks
  for (const block of dayBlocks) {
    const [startHour, startMin] = block.start.split(':').map(Number);
    const [endHour, endMin] = block.end.split(':').map(Number);
    
    const blockStartMinutes = startHour * 60 + startMin;
    const blockEndMinutes = endHour * 60 + endMin;

    // Check if the entire slot fits within this working block
    if (slotStartMinutes >= blockStartMinutes && slotEndMinutes <= blockEndMinutes) {
      return { available: true, workingHours };
    }
  }

  return { 
    available: false, 
    reason: "Outside hours",
    workingHours
  };
}

function ProviderRow({
  p,
  onAdd,
  rightAdornment,
  highlight,
  nameTag,
}: {
  p: Provider;
  onAdd: (p: Provider) => void;
  rightAdornment?: React.ReactNode;
  highlight?: string;
  nameTag?: React.ReactNode;
}) {
  const label = `${p.firstName} ${p.lastName}`.trim();
  const renderHighlighted = (text: string, q?: string) => {
    if (!q) return text;
    const parts = text.split(new RegExp(`(${q})`, "i"));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === q.toLowerCase() ? (
            <mark
              key={i}
              style={{ background: "transparent", color: "inherit", fontWeight: 700 }}
            >
              {part}
            </mark>
          ) : (
            <React.Fragment key={i}>{part}</React.Fragment>
          )
        )}
      </>
    );
  };

  return (
    <HStack
      as="div"
      role="button"
      tabIndex={0}
      w="100%"
      justify="space-between"
      px={2}
      py={2}
      borderRadius="md"
      _hover={{ bg: "blackAlpha.50" }}
      onClick={() => onAdd(p)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onAdd(p)}
    >
      <HStack overflow="hidden">
        <Box w="8px" h="8px" borderRadius="full" bg={p.color || "gray.300"} />
        <Text noOfLines={1} textTransform="capitalize">
          {renderHighlighted(label, highlight)}
        </Text>
        {nameTag ? <Box ml={2}>{nameTag}</Box> : null}
      </HStack>
      {rightAdornment}
    </HStack>
  );
}

function ProviderRowWithScheduleCheck({
  p,
  windowIso,
  skillId,
  onAdd,
  qHighlight,
  appointmentProviders = [],
  currentSlot,
}: {
  p: Provider;
  windowIso?: { fromIso: string; toIso: string } | null;
  skillId?: string;
  onAdd: (p: Provider) => void;
  qHighlight?: string;
  appointmentProviders?: AppointmentProvider[];
  currentSlot?: { startDate: Date | string; endDate: Date | string; slotId?: string };
}) {
  // Hooks (must be called unconditionally)
  const toast = useToast();
  // Fetch provider's schedule
  const { data: providerSchedule } = useProviderSchedule(p._id);

  if (!windowIso) {
    return (
      <ProviderRow
        p={p}
        onAdd={onAdd}
        highlight={qHighlight}
        rightAdornment={<Tag size="sm">Schedule unknown</Tag>}
      />
    );
  }

  // Check if provider is available during this time slot
  const availability = isProviderAvailableInSlot(
    providerSchedule,
    windowIso.fromIso,
    windowIso.toIso,
    DEFAULT_TZ
  );

  if (!availability.available) {
    const handleUnavailableClick = () => {
      let message = `${p.firstName} ${p.lastName} is not available during this time.`;
      if (availability.workingHours) {
        message += ` Working hours: ${availability.workingHours}`;
      }

      toast({
        title: "Provider Unavailable",
        description: message,
        status: "info",
        duration: 4000,
        isClosable: true,
      });
    };

    return (
      <ProviderRow
        p={p}
        onAdd={handleUnavailableClick}
        highlight={qHighlight}
        rightAdornment={
          <Tag size="sm" colorScheme="gray">
            {availability.reason || "Unavailable"}
          </Tag>
        }
      />
    );
  }

  // If available, proceed with normal availability check
  return (
    <ProviderRowScheduleAvailability
      p={p}
      windowIso={windowIso}
      skillId={skillId}
      onAdd={onAdd}
      qHighlight={qHighlight}
      appointmentProviders={appointmentProviders}
      currentSlot={currentSlot}
    />
  );
}

function ProviderRowScheduleAvailability({
  p,
  windowIso,
  skillId,
  onAdd,
  qHighlight,
  appointmentProviders = [],
  currentSlot,
}: {
  p: Provider;
  windowIso?: { fromIso: string; toIso: string } | null;
  skillId?: string;
  onAdd: (p: Provider) => void;
  qHighlight?: string;
  appointmentProviders?: AppointmentProvider[];
  currentSlot?: { startDate: Date | string; endDate: Date | string; slotId?: string };
}) {
  const toast = useToast();

  if (!windowIso) {
    return (
      <ProviderRow
        p={p}
        onAdd={onAdd}
        highlight={qHighlight}
        rightAdornment={<Tag size="sm">Schedule unknown</Tag>}
      />
    );
  }

  // Si el provider no tiene las habilidades requeridas, no lo mostramos
  if (skillId && !(p.skills || []).map(String).includes(String(skillId))) {
    return null;
  }

  const wf = new Date(windowIso.fromIso).getTime();
  const wt = new Date(windowIso.toIso).getTime();

  // Verificar el estado de disponibilidad del provider para este slot
  const getProviderStatus = () => {
    let hasExactMatch = false;
    let hasPartialOverlap = false;

    (appointmentProviders || []).forEach((a) => {
      const providerId = typeof a.provider === 'object' ? a.provider._id : a.provider;
      if (String(providerId || "") !== String(p._id)) return;
      
      const aStart = new Date(a.startDate).getTime();
      const aEnd = new Date(a.endDate).getTime();

      // Priorizar comparación por slotId cuando ambos lo tienen
      if (currentSlot?.slotId && a.slotId) {
        if (String(currentSlot.slotId) === String(a.slotId)) {
          hasExactMatch = true;
        }
        return;
      }
      
      // Verificar coincidencia exacta por fechas
      if (aStart === wf && aEnd === wt) {
        hasExactMatch = true;
        return;
      }

      // Verificar solapamiento parcial
      const hasOverlap = (aStart < wt && aEnd > wf);
      if (hasOverlap) {
        hasPartialOverlap = true;
      }
    });

    if (hasExactMatch) {
      return { label: "Booked", color: "red" as const, canAssign: false };
    } else if (hasPartialOverlap) {
      return { label: "Partial", color: "orange" as const, canAssign: true };
    } else {
      return { label: "Fits", color: "green" as const, canAssign: true };
    }
  };

  const statusTag = getProviderStatus();

  const handleAdd = () => {
    if (!statusTag.canAssign) {
      toast({
        title: "Provider already assigned to this slot",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    if (statusTag.label === "Partial") {
      toast({
        title: "Warning: Partial overlap detected",
        description: "This provider has partial time conflicts. Assignment may cause scheduling issues.",
        status: "warning",
        duration: 4000,
        isClosable: true,
      });
    }
    
    onAdd(p);
  };

  return (
    <ProviderRow
      p={p}
      onAdd={handleAdd}
      highlight={qHighlight}
      rightAdornment={
        <Tag size="sm" colorScheme={statusTag.color}>
          {statusTag.label}
        </Tag>
      }
    />
  );
}

// tipos
export type DateRange = {
  startDate: Date;
  endDate: Date;
  status?: string;
  slotId?: string;
  _id?: string;
};

// Temporary assignment for CREATION mode
export type PendingAssignment = {
  slotIndex: number;
  providerId: string;
  startDate: Date;
  endDate: Date;
};

export default function ProviderPerDate({
  mode,
  tz = DEFAULT_TZ,
  selectedAppDates,
  allProviders,
  selectedTreatmentId,
  appointmentId,
  onPendingAssignmentsChange,
}: {
  mode: "CREATION" | "EDITION";
  tz?: string;
  selectedAppDates: DateRange[];
  allProviders: Provider[];
  selectedTreatmentId?: string;
  appointmentId?: string;
  onPendingAssignmentsChange?: (assignments: PendingAssignment[]) => void;
}) {
  const toast = useToast();
  
  // State for pending assignments in CREATION mode
  const [pendingAssignments, setPendingAssignments] = useState<PendingAssignment[]>([]);
  
  // Fetch current provider assignments from AppointmentProvider collection
  const { data: appointmentProviders = [], refetch: refetchProviders } = useAppointmentProviders(appointmentId);
  const { mutateAsync: createAssignment } = useCreateAppointmentProvider();
  const { mutateAsync: updateAssignment } = useUpdateAppointmentProvider();
  const { mutateAsync: deleteAssignment } = useDeleteAppointmentProvider();
  
  const slots = useMemo(() => selectedAppDates || [], [selectedAppDates]);
  
  // Debug logs
  React.useEffect(() => {
    if (mode === "EDITION" && appointmentId) {
      console.log('ProviderPerDate EDITION mode debug:', {
        appointmentId,
        appointmentProviders,
        selectedAppDates,
        slotsCount: slots.length
      });
    }
  }, [mode, appointmentId, appointmentProviders, selectedAppDates, slots.length]);

  // Helper to manage pending assignments
  const addPendingAssignment = useCallback((slotIndex: number, providerId: string, startDate: Date, endDate: Date) => {
    setPendingAssignments(prev => {
      // Allow multiple pending assignments per slot, but avoid exact duplicates
      const exists = prev.some(p => p.slotIndex === slotIndex && String(p.providerId) === String(providerId));
      if (exists) return prev;
      return [...prev, { slotIndex, providerId, startDate, endDate }];
    });
  }, []);

  // If providerId is provided, remove that specific pending assignment for the slot.
  // Otherwise remove all pending assignments for the slot.
  const removePendingAssignment = useCallback((slotIndex: number, providerId?: string) => {
    setPendingAssignments(prev => {
      if (providerId) {
        return prev.filter(p => !(p.slotIndex === slotIndex && String(p.providerId) === String(providerId)));
      }
      return prev.filter(p => p.slotIndex !== slotIndex);
    });
  }, []);

  // Track previous assignments to avoid unnecessary notifications
  const prevAssignmentsRef = useRef<PendingAssignment[]>([]);
  
  // Effect to notify parent component when pending assignments change
  React.useEffect(() => {
    if (onPendingAssignmentsChange && mode === "CREATION" && !appointmentId) {
      // Only notify if assignments actually changed
      const hasChanged = JSON.stringify(prevAssignmentsRef.current) !== JSON.stringify(pendingAssignments);
      if (hasChanged) {
        prevAssignmentsRef.current = [...pendingAssignments];
        onPendingAssignmentsChange(pendingAssignments);
      }
    }
  }, [pendingAssignments, onPendingAssignmentsChange, mode, appointmentId]);

  const getPendingAssignmentsForSlot = useCallback((slotIndex: number) => {
    return pendingAssignments.filter(p => p.slotIndex === slotIndex);
  }, [pendingAssignments]);

  if (!slots.length) {
    return (
      <Box mt={4} p={3} borderWidth="1px" borderRadius="md" bg="blackAlpha.50">
        <FormControl>
          <FormLabel>Provider per date</FormLabel>
          <Alert status="info" borderRadius="md">
            <AlertIcon />
            Add at least one appointment date to assign a provider.
          </Alert>
        </FormControl>
      </Box>
    );
  }

  return (
    <Box mt={4} p={3} borderWidth="1px" borderRadius="md" bg="blackAlpha.50">
      <FormControl>
        <FormLabel>Provider per date</FormLabel>
        <VStack align="stretch" spacing={3}>
          {slots.map((slot, idx) => {
            const s = dayjs.utc(slot.startDate).tz(tz);
            const e = dayjs.utc(slot.endDate).tz(tz);
            const sameDay = s.format("YYYY-MM-DD") === e.format("YYYY-MM-DD");
            const label = sameDay
              ? `${s.format("ddd, DD MMM • h:mm A")} – ${e.format("h:mm A")}`
              : `${s.format("ddd, DD MMM • h:mm A")} → ${e.format("ddd, DD MMM • h:mm A")}`;

            // Generate a consistent slot identifier for both creation and edition modes
            // In EDITION mode, prefer the actual _id from the slot data
            const slotId = mode === "EDITION" 
              ? ((slot as any)?._id || (slot as any)?.slotId || `slot-${idx}-${s.valueOf()}`)
              : `temp-${idx}-${s.valueOf()}`;
            
            // Find all existing assignments for this slot
            const assignmentsForSlot = mode === "CREATION" && !appointmentId
              ? [] // No real assignments in creation mode without appointmentId
              : appointmentProviders.filter(ap => {
                  // First try to match by slotId if both have it
                  if (ap.slotId && slotId && String(ap.slotId) === String(slotId)) {
                    return true;
                  }

                  // Fallback: match by exact time range
                  const apStart = new Date(ap.startDate).getTime();
                  const apEnd = new Date(ap.endDate).getTime();
                  const slotStart = new Date(slot.startDate).getTime();
                  const slotEnd = new Date(slot.endDate).getTime();

                  return apStart === slotStart && apEnd === slotEnd;
                });
            
            if (mode === "EDITION" && idx === 0) {
              console.log(`Slot ${idx} matching debug:`, {
                slotId,
                slot: { startDate: slot.startDate, endDate: slot.endDate },
                availableAssignments: appointmentProviders.map(ap => ({
                  id: ap._id,
                  slotId: ap.slotId,
                  startDate: ap.startDate,
                  endDate: ap.endDate,
                  provider: ap.provider
                })),
                foundAssignment: assignmentsForSlot.length > 0 ? { id: assignmentsForSlot[0]._id, provider: assignmentsForSlot[0].provider } : null
              });
            }

            // Get pending assignments for creation mode (allow multiple)
            const pendingAssignmentsForSlot = mode === "CREATION" && !appointmentId
              ? getPendingAssignmentsForSlot(idx)
              : [];

            const upsertAssignmentProvider = async (provId: string) => {
              // In CREATION mode without appointmentId, store assignment locally
              if (mode === "CREATION" && !appointmentId) {
                addPendingAssignment(idx, provId, slot.startDate, slot.endDate);
                toast({
                  title: "Provider selected",
                  description: "Provider will be assigned when the appointment is created.",
                  status: "success",
                  duration: 2000,
                });
                return;
              }
              
              if (!appointmentId || !slotId) {
                toast({
                  title: "Cannot assign provider",
                  description: "Missing appointment ID or slot ID.",
                  status: "error",
                  duration: 3000,
                });
                return;
              }
              
              try {
                // Always create a new assignment for this slot/provider combination.
                // This allows multiple providers per same time slot. The server/indexes
                // were adjusted to allow this.
                const result = await createAssignment({
                  appointment: appointmentId,
                  provider: provId,
                  slotId: slotId,
                  startDate: slot.startDate,
                  endDate: slot.endDate,
                });
                console.log('Create result:', result);
                
                // Force refetch to ensure UI updates
                await refetchProviders();
                
                toast({
                  title: "Provider assigned successfully",
                  status: "success",
                  duration: 2000,
                });
              } catch (error) {
                console.error('Error updating assignment:', error);
                toast({
                  title: "Error assigning provider",
                  description: error instanceof Error ? error.message : "An unexpected error occurred",
                  status: "error",
                  duration: 4000,
                });
              }
            };

            const removeAssignment = async (assignmentId?: string) => {
              // In CREATION mode, remove pending assignment
              if (mode === "CREATION" && !appointmentId) {
                removePendingAssignment(idx);
                toast({
                  title: "Provider selection removed",
                  status: "info",
                  duration: 2000,
                });
                return;
              }

              if (!assignmentId) return;
              
              try {
                const result = await deleteAssignment(assignmentId);
                console.log('Delete result:', result);
                // Force refetch to ensure UI updates
                await refetchProviders();
                
                toast({
                  title: "Provider assignment removed",
                  status: "info",
                  duration: 2000,
                });
              } catch (error) {
                console.error('Error removing assignment:', error);
                toast({
                  title: "Error removing assignment",
                  description: error instanceof Error ? error.message : "An unexpected error occurred",
                  status: "error",
                  duration: 4000,
                });
              }
            };

            const windowIso = {
              fromIso: dayjs.utc(slot.startDate).toDate().toISOString(),
              toIso: dayjs.utc(slot.endDate).toDate().toISOString(),
            };

            const removeAllAssignments = async () => {
              if (!assignmentsForSlot.length) return;
              try {
                await Promise.all(assignmentsForSlot.map(a => deleteAssignment(a._id)));
                await refetchProviders();
                toast({ title: "All assignments removed for this slot", status: "info", duration: 2000 });
              } catch (err) {
                console.error('Error removing assignments for slot:', err);
                toast({ title: "Error removing assignments", status: "error", duration: 3000 });
              }
            };

            return (
              <Box key={`${s.toISOString()}-${idx}`} borderWidth="1px" borderRadius="md" p={2}>
                <HStack justify="space-between" align="center" mb={2}>
                  <Tag size="sm" colorScheme={assignmentsForSlot.length > 0 ? "green" : "gray"}>
                    <TagLabel>{label}</TagLabel>
                  </Tag>
                  {assignmentsForSlot.length > 0 ? (
                    <HStack>
                      <Badge colorScheme="green">Assigned</Badge>
                      {mode === "EDITION" && (
                        <Button size="xs" variant="ghost" onClick={removeAllAssignments}>
                          Remove all
                        </Button>
                      )}
                    </HStack>
                  ) : pendingAssignmentsForSlot.length ? (
                    <HStack>
                      <Badge colorScheme="blue">Selected</Badge>
                      <Button size="xs" variant="ghost" onClick={() => removePendingAssignment(idx)}>
                        Remove all
                      </Button>
                    </HStack>
                  ) : mode === "CREATION" && !appointmentId ? (
                    <Badge colorScheme="gray">Select provider</Badge>
                  ) : (
                    <Badge colorScheme="yellow">Unassigned</Badge>
                  )}
                </HStack>

                <Box>
                  {/* Show assigned provider (EDITION mode) */}
                  {assignmentsForSlot.length > 0 && (
                    <Box mb={3}>
                      <Text fontSize="sm" fontWeight="semibold" mb={2}>
                        Assigned providers
                      </Text>
                      <VStack align="stretch" spacing={2}>
                        {assignmentsForSlot.map((ap) => {
                          const assignedProvider = typeof ap.provider === 'object'
                            ? ap.provider
                            : allProviders.find(p => String(p._id) === String(ap.provider));

                          return (
                            <Box
                              key={ap._id}
                              borderWidth="1px"
                              borderRadius="md"
                              p={2}
                              bg="green.50"
                              borderColor="green.200"
                            >
                              <HStack justify="space-between">
                                <HStack>
                                  <Box
                                    w="8px"
                                    h="8px"
                                    borderRadius="full"
                                    bg={assignedProvider?.color || "gray.300"}
                                  />
                                  <Text
                                    fontSize="sm"
                                    fontWeight="medium"
                                    textTransform="capitalize"
                                  >
                                    {assignedProvider
                                      ? `${assignedProvider.firstName} ${assignedProvider.lastName}`.trim()
                                      : 'Provider not found'}
                                  </Text>
                                </HStack>
                                <HStack>
                                  <Badge colorScheme="green" size="sm">Assigned</Badge>
                                  {mode === "EDITION" && (
                                    <Button size="xs" variant="ghost" onClick={() => removeAssignment(ap._id)}>
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

                  {/* Show pending/selected providers (CREATION mode) */}
                  {pendingAssignmentsForSlot.length > 0 && (
                    <Box mb={3}>
                      <Text fontSize="sm" fontWeight="semibold" mb={2}>
                        Selected providers
                      </Text>
                      <VStack align="stretch" spacing={2}>
                        {pendingAssignmentsForSlot.map((pa) => {
                          const selectedProvider = allProviders.find(p => String(p._id) === String(pa.providerId));
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
                                  <Box
                                    w="8px"
                                    h="8px"
                                    borderRadius="full"
                                    bg={selectedProvider?.color || "gray.300"}
                                  />
                                  <Text fontSize="sm" fontWeight="medium" textTransform="capitalize">
                                    {selectedProvider ? `${selectedProvider.firstName} ${selectedProvider.lastName}`.trim() : 'Provider not found'}
                                  </Text>
                                </HStack>
                                <HStack>
                                  <Badge colorScheme="blue" size="sm">Selected</Badge>
                                  <Button size="xs" variant="ghost" onClick={() => removePendingAssignment(idx, pa.providerId)}>
                                    Remove
                                  </Button>
                                </HStack>
                              </HStack>
                            </Box>
                          );
                        })}
                      </VStack>
                    </Box>
                  )}
                  
                  <Text fontSize="sm" fontWeight="semibold" mb={1}>
                    {assignmentsForSlot.length > 0 || pendingAssignmentsForSlot.length > 0 ? "Change provider" : "Select provider"}
                  </Text>
                  <Box
                    borderWidth="1px"
                    borderRadius="md"
                    maxH="180px"
                    overflowY="auto"
                    px={1}
                    py={1}
                  >
                    {allProviders
                      .filter((p) => {
                        // Don't show providers already assigned to this slot
                        const alreadyAssigned = assignmentsForSlot.some(ap => {
                          const assignedProviderId = typeof ap.provider === 'object'
                            ? ap.provider._id
                            : ap.provider;
                          return String(p._id) === String(assignedProviderId);
                        });
                        if (alreadyAssigned) return false;

                        // No mostrar el provider que ya está seleccionado pendiente
                        if (pendingAssignmentsForSlot.length) {
                          const alreadyPending = pendingAssignmentsForSlot.some(pa => String(pa.providerId) === String(p._id));
                          if (alreadyPending) return false;
                        }
                        return true;
                      })
                      .map((p) => (
                        <ProviderRowWithScheduleCheck
                          key={`assign-${p._id}-${slotId || idx}`}
                          p={p}
                          windowIso={windowIso}
                          skillId={selectedTreatmentId}
                          onAdd={(prov) => upsertAssignmentProvider(String(prov._id))}
                          appointmentProviders={appointmentProviders}
                          currentSlot={{
                            startDate: slot.startDate,
                            endDate: slot.endDate,
                            slotId,
                          }}
                        />
                      ))}
                  </Box>
                </Box>
              </Box>
            );
          })}
        </VStack>
      </FormControl>
    </Box>
  );
}
