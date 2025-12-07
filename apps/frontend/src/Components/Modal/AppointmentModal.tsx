// apps/frontend/src/Components/Modal/PremiumAppointmentModal.tsx
import React, { Suspense, useMemo, useCallback, useState, memo } from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Box,
  HStack,
  VStack,
  Text,
  Badge,
  Tag,
  TagLabel,
  Avatar,
  Button,
  Tooltip,
  useClipboard,
  SimpleGrid,
  Wrap,
  WrapItem,
  useColorModeValue,
  Icon,
  Skeleton,
  useDisclosure,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  IconButton,
  Input,
  useToast,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Divider,
} from "@chakra-ui/react";
import { FiCalendar, FiClock, FiClipboard, FiInfo, FiTrash2, FiEdit2, FiX } from "react-icons/fi";
import { PhoneIcon, EditIcon } from "@chakra-ui/icons";
import { FaStar } from "react-icons/fa";
import { TreatmentPopoverSelector } from "../Treatments/TreatmentPopoverSelector";
import { useQueryClient } from "@tanstack/react-query";
import { useGetCollection } from "@/Hooks/Query/useGetCollection";
import { useUpdateItems } from "@/Hooks/Query/useUpdateItems";
import { Appointment, ContactAppointment, Provider } from "@/types";
import { useProviderSchedule } from "@/Hooks/Query/useProviderSchedule";
import { useProviderAppointments } from "@/Hooks/Query/useProviderAppointments";
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);
import { formatDateWS } from "@/Functions/FormatDateWS";
import { GrContact } from "react-icons/gr";
import { CiUser } from "react-icons/ci";
import { pickDisplaySlot } from "@/Functions/getLatestSelectedAppDate";

// 🚀 Chat: componente reutilizable (lazy) + icono
import ChatLauncher from "@/Components/Chat/ChatLauncher";
import { FaCommentSms } from "react-icons/fa6";
import { useModalIndex } from "../ModalStack/ModalStackContext";
import { formatAusPhoneNumber } from "@/Functions/formatAusPhoneNumber";
import { RiParentFill } from "react-icons/ri";
import { useSocket } from "@/Hooks/Query/useSocket";
import { capitalize } from "@/utils/textFormat";
import { useGoogleReviewRequests } from "@/Hooks/Query/useGoogleReviews";
import { format } from "date-fns";
import AvailabilityDates2, { SelectedDaysState, SelectedDatesValue } from "@/Components/CustomTemplates/AvailabilityDates2";

// — Lazy load del ProviderSummaryModal —
const ProviderSummaryModalLazy = React.lazy(
  () => import("@/Components/Provider/ProviderSummaryModal")
);
// — Lazy load self for tutor jump —
const AppointmentModalLazy = React.lazy(() => import("@/Components/Modal/AppointmentModal"));

// -----------------------------
// Tipos basados en tus esquemas Mongoose (actualizados)
// -----------------------------
export type TimeSlot = string;
export type WeekDay = string;

export interface Treatment {
  _id: string;
  org_id?: string;
  name: string;
  duration: number;
  icon: string;
  minIcon: string;
  color: string;
  category?: string;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface TimeBlock {
  _id?: string;
  org_id: string;
  blockNumber: number;
  label: TimeSlot;
  short?: string;
  from: string;
  to: string;
}

export interface SelectedDates {
  startDate: Date;
  endDate: Date;
  days: Array<{
    weekDay: WeekDay;
    timeBlocks: TimeBlock[];
    timeBlocksData?: TimeBlock[];
  }>;
}

export interface Priority {
  _id?: string;
  org_id?: string;
  id: number;
  description?: string;
  notes?: string;
  durationHours?: number;
  name: string;
  color: string;
}

// -----------------------------
// Tipado adicional para slots y logs de contacto (reduce uso de any)
// -----------------------------
export interface AppointmentSlotConfirmation {
  askMessageSid?: string;
  sentAt?: string | Date;
  decidedAt?: string | Date;
  lateResponse?: boolean;
  status?: string;
}
export interface AppointmentSlotProposed {
  startDate?: string | Date;
  endDate?: string | Date;
  createdAt?: string | Date;
  reason?: string;
}
export interface AppointmentSlot {
  _id?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  proposed?: AppointmentSlotProposed;
  confirmation?: AppointmentSlotConfirmation;
  status?: string;
  rescheduleRequested?: boolean;
  treatment?: Treatment;
  priority?: Priority;
  providers?: Provider[];
  updatedAt?: string | Date;
}

export interface ContactAppointmentSlim extends Omit<ContactAppointment, 'appointment'> {
  selectedAppDate?: string | AppointmentSlot; // puede venir poblado con el objeto del slot
  askMessageSid?: string;
  proposedStartDate?: string | Date;
  proposedEndDate?: string | Date;
  appointment?: {
    selectedAppDates?: AppointmentSlot[]; // lista recortada (solo slot relacionado)
  };
}

export interface ContactLog {
  _id?: string;
  appointment: string;
  contactedAt: Date;
  contactedBy: string;
  method: "Phone" | "Email" | "SMS" | "WhatsApp";
  status: "Pending" | "Contacted" | "Failed" | "No Contacted";
  notes?: string;
  org_id: string;
}
// removed unused Contacted type

// -----------------------------
// Helpers visuales
// -----------------------------
const fmtDateTime = (d?: Date | string | number) =>
  d
    ? new Date(d).toLocaleString("en-AU", {
      timeZone: "Australia/Sydney",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    : "—";

function contrastText(hex?: string): string {
  if (!hex) return "white";
  const h = hex.replace("#", "");
  const bigint = parseInt(
    h.length === 3 ? h.split("").map((c) => c + c).join("") : h,
    16
  );
  const r = (bigint >> 16) & 255,
    g = (bigint >> 8) & 255,
    b = bigint & 255;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? "black" : "white";
}

function enrichAvatarColor(color?: string): { bg: string; color: string; borderColor: string } {
  if (!color) return { bg: "gray.500", color: "white", borderColor: "gray.700" };

  // Si es un color de Chakra (e.g., "blue", "red")
  if (!color.startsWith('#') && !color.includes('.')) {
    return {
      bg: `${color}.500`,
      color: "white",
      borderColor: `${color}.700`,
    };
  }

  // Si ya viene con nivel (e.g., "blue.500"), lo mantenemos
  if (color.includes(".")) {
    const [base] = color.split(".");
    return {
      bg: `${base}.500`,
      color: "white",
      borderColor: `${base}.700`,
    };
  }

  // Si es hex, calculamos contraste y añadimos borde oscuro
  const textColor = contrastText(color);
  return {
    bg: color,
    color: textColor,
    borderColor: textColor === "white" ? "blackAlpha.400" : "blackAlpha.600",
  };
}

// Normaliza status para comparaciones case-insensitive
const statusKey = (s?: string): string => String(s || '').trim().toLowerCase();

const capStatus = (s?: string): string => {
  const k = statusKey(s);
  if (!k) return 'Unknown';
  return k.replace(/^[a-z]/, c => c.toUpperCase());
};

// ✨ Optimized slot deduplication and sorting
const deduplicateAndSortSlots = (slots: AppointmentSlot[]): AppointmentSlot[] => {
  if (!slots?.length) return [];

  const updatedAtTs = (s: AppointmentSlot): number => {
    if (s?.updatedAt) {
      const t = new Date(s.updatedAt).getTime();
      return Number.isFinite(t) ? t : 0;
    }
    return 0;
  };

  // Sort by updatedAt (most recent first)
  const sorted = [...slots].sort((a, b) => updatedAtTs(b) - updatedAtTs(a));

  // Deduplicate by range
  const seen = new Set<string>();
  const deduped: AppointmentSlot[] = [];
  
  for (const s of sorted) {
    const hasTopDates = s?.startDate && s?.endDate;
    const key = hasTopDates
      ? `${new Date(s.startDate!).getTime()}|${new Date(s.endDate!).getTime()}`
      : `__unique__${String(s?._id ?? Math.random())}`;
    
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(s);
  }

  return deduped;
};

// ✨ Centralized slot matching logic
const matchSlot = (
  log: ContactAppointmentSlim,
  slotList: AppointmentSlot[]
): AppointmentSlot | null => {
  if (!slotList?.length) return null;

  const rawSel = log?.selectedAppDate;
  
  // 1. Already populated object
  if (rawSel && typeof rawSel === 'object') {
    return rawSel as AppointmentSlot;
  }

  // 2. Match by ID
  const selId = typeof rawSel === 'string' ? rawSel : '';
  if (selId) {
    const match = slotList.find(s => String(s?._id) === selId);
    if (match) return match;
  }

  // 3. Match by askMessageSid
  const askSid = log?.askMessageSid ? String(log.askMessageSid) : "";
  if (askSid) {
    const match = slotList.find(s => String(s?.confirmation?.askMessageSid || "") === askSid);
    if (match) return match;
  }

  // 4. Match by dates
  if (log?.startDate && log?.endDate) {
    const st = new Date(log.startDate).getTime();
    const et = new Date(log.endDate).getTime();
    
    if (!Number.isNaN(st) && !Number.isNaN(et)) {
      const match = slotList.find(s => {
        const t1 = s?.startDate ? new Date(s.startDate).getTime() : NaN;
        const t2 = s?.endDate ? new Date(s.endDate).getTime() : NaN;
        const p1 = s?.proposed?.startDate ? new Date(s.proposed.startDate).getTime() : NaN;
        const p2 = s?.proposed?.endDate ? new Date(s.proposed.endDate).getTime() : NaN;
        return (t1 === st && t2 === et) || (p1 === st && p2 === et);
      });
      if (match) return match;
    }
  }

  return null;
};

// ============================================================================
// SUB-COMPONENTS (memoized for performance)
// ============================================================================
const SectionCard = memo<{
  title: React.ReactNode;
  right?: React.ReactNode;
  children?: React.ReactNode;
}>(({ title, right, children }) => {
  const bg = useColorModeValue("whiteAlpha.900", "whiteAlpha.50");
  const border = useColorModeValue("blackAlpha.100", "whiteAlpha.200");
  
  return (
    <Box
      bg={bg}
      border="1px solid"
      borderColor={border}
      rounded="2xl"
      p={4}
      boxShadow="xl"
      backdropFilter="auto"
      backdropBlur="6px"
    >
      <HStack justify="space-between" mb={3}>
        <HStack>{title}</HStack>
        {right}
      </HStack>
      {children}
    </Box>
  );
});
SectionCard.displayName = "SectionCard";

const LabeledRow = memo<{
  icon?: any;
  label: string;
  value?: React.ReactNode;
  copyable?: boolean;
}>(({ icon, label, value, copyable }) => {
  const isPrimitive = typeof value === "string" || typeof value === "number";
  const copyText = isPrimitive ? String(value) : "";
  const { onCopy } = useClipboard(copyText);
  const sub = useColorModeValue("gray.600", "gray.300");
  
  return (
    <HStack align="flex-start" spacing={3}>
      {icon && <Icon as={icon} boxSize={4} mt={1} opacity={0.9} />}
      <VStack align="start" spacing={0} flex={1}>
        <Text fontSize="xs" textTransform="uppercase" letterSpacing={0.4} color={sub}>
          {label}
        </Text>
        <HStack align="start">
          {isPrimitive ? (
            <Text as="span" fontWeight="semibold">{value ?? "—"}</Text>
          ) : (
            <Box as="span" fontWeight="semibold">{value ?? "—"}</Box>
          )}
          {copyable && copyText && (
            <Tooltip label="Copy" placement="top">
              <Box as="button" onClick={onCopy} aria-label={`Copy ${label}`}>
                <FiClipboard />
              </Box>
            </Tooltip>
          )}
        </HStack>
      </VStack>
    </HStack>
  );
});
LabeledRow.displayName = "LabeledRow";

const PriorityTag = memo<{ priority?: Priority | null }>(({ priority }) => (
  <Tag
    size="sm"
    rounded="full"
    px={3}
    py={1}
    bg={priority?.color ?? "pink.400"}
    color={contrastText(priority?.color)}
  >
    <TagLabel>{priority?.name ?? "No priority"}</TagLabel>
  </Tag>
));
PriorityTag.displayName = "PriorityTag";

// ============================================================================
// PROVIDER ROW WITH AVAILABILITY CHECKING (like CustomEntryForm)
// ============================================================================
const DEFAULT_TZ = 'Australia/Sydney';

// Helper to check if provider has time conflicts with existing appointments
function hasTimeConflict(
  slotStartDate: Date,
  slotEndDate: Date,
  providerEvents: Array<{ _id: string; start: Date; end: Date }> = [],
  currentAppointmentId?: string,
  timezone: string = DEFAULT_TZ
): { hasConflict: boolean; reason?: string } {
  const slotStart = dayjs(slotStartDate).tz(timezone);
  const slotEnd = dayjs(slotEndDate).tz(timezone);

  for (const event of providerEvents) {
    // Skip events from the current appointment being edited
    const eventAppointmentId = event._id.split('-')[0];
    if (currentAppointmentId && eventAppointmentId === String(currentAppointmentId)) {
      continue;
    }

    const eventStart = dayjs(event.start).tz(timezone);
    const eventEnd = dayjs(event.end).tz(timezone);

    // Check for overlap
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
  slotStartDate: Date,
  slotEndDate: Date,
  timezone: string = DEFAULT_TZ
): { available: boolean; reason?: string } {
  if (!providerSchedule || !providerSchedule.weekly) {
    return { available: false, reason: 'No schedule' };
  }

  const slotStart = dayjs(slotStartDate).tz(timezone);
  const slotEnd = dayjs(slotEndDate).tz(timezone);

  if (!slotStart.isSame(slotEnd, 'day')) {
    return { available: false, reason: 'Multi-day slot' };
  }

  const dayOfWeek = slotStart.day();
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

const ProviderRowWithAvailability = memo<{
  provider: Provider;
  slotStartDate: string;
  slotStartTime: string;
  slotDurationMinutes: number;
  appointmentId?: string;
  onAdd: () => void;
}>(({ provider, slotStartDate, slotStartTime, slotDurationMinutes, appointmentId, onAdd }) => {
  const { data: providerSchedule } = useProviderSchedule(provider._id);
  
  // Calculate slot dates
  const { startDate, endDate } = useMemo(() => {
    try {
      const start = new Date(`${slotStartDate}T${slotStartTime}`);
      const end = new Date(start.getTime() + slotDurationMinutes * 60 * 1000);
      return { startDate: start, endDate: end };
    } catch {
      return { startDate: new Date(), endDate: new Date() };
    }
  }, [slotStartDate, slotStartTime, slotDurationMinutes]);

  // Calculate date range for query
  const dateRange = useMemo(() => {
    const start = dayjs(startDate).tz(DEFAULT_TZ).subtract(1, 'day');
    const end = dayjs(endDate).tz(DEFAULT_TZ).add(1, 'day');
    return {
      from: start.toISOString(),
      to: end.toISOString(),
    };
  }, [startDate, endDate]);

  // Fetch provider's existing appointments
  const { data: providerEvents = [] } = useProviderAppointments(provider._id, dateRange);

  const availabilityCheck = useMemo(() => {
    // Check schedule availability
    const scheduleCheck = isProviderAvailableInSlot(providerSchedule, startDate, endDate, DEFAULT_TZ);
    if (!scheduleCheck.available) {
      return { available: false, reason: scheduleCheck.reason };
    }

    // Check for appointment conflicts
    const conflictCheck = hasTimeConflict(startDate, endDate, providerEvents, appointmentId, DEFAULT_TZ);
    
    if (conflictCheck.hasConflict) {
      return { available: false, reason: conflictCheck.reason };
    }

    return { available: true };
  }, [providerSchedule, providerEvents, startDate, endDate, appointmentId]);

  const statusTag = useMemo(() => {
    if (availabilityCheck.available) {
      return { label: 'Available', color: 'green' };
    }
    return { label: availabilityCheck.reason || 'Unavailable', color: 'red' };
  }, [availabilityCheck]);

  const providerName = `${provider.firstName} ${provider.lastName}`;

  return (
    <HStack
      as="div"
      justify="space-between"
      px={2}
      py={2}
      borderRadius="md"
      _hover={{ bg: 'blackAlpha.50' }}
      cursor="pointer"
      onClick={onAdd}
    >
      <HStack>
        <Box w="8px" h="8px" borderRadius="full" bg={provider.color || 'gray.300'} />
        <Text fontSize="sm" fontWeight="medium" textTransform="capitalize">
          {providerName}
        </Text>
      </HStack>
      <Tag size="sm" colorScheme={statusTag.color}>
        {statusTag.label}
      </Tag>
    </HStack>
  );
});
ProviderRowWithAvailability.displayName = "ProviderRowWithAvailability";

// ============================================================================
// SLOT TAB COMPONENT (extracted for clarity and performance)
// ============================================================================
const SlotTab = memo<{
  slot: AppointmentSlot;
  index: number;
  isLatest: boolean;
  isEditing: boolean;
  editData: { startDate: string; startTime: string; durationMinutes: number; treatmentId: string | null; providerIds: string[] } | null;
  onEdit: () => void;
  onDelete: () => void;
  onSave: () => void;
  onCancel: () => void;
  onEditDataChange: (field: 'startDate' | 'startTime' | 'durationMinutes' | 'treatmentId' | 'providerIds', value: string | string[]) => void;
  allTreatments?: Treatment[];
  allProviders?: Provider[];
  appointmentId?: string;
}>(({ slot, isLatest, isEditing, editData, onEdit, onDelete, onSave, onCancel, onEditDataChange, allTreatments, allProviders, appointmentId }) => {
  // ALL HOOKS MUST BE AT THE TOP - BEFORE ANY CONDITIONAL LOGIC
  const sub = useColorModeValue("gray.600", "gray.300");
  
  const s = slot?.startDate || slot?.proposed?.startDate;
  const e = slot?.endDate || slot?.proposed?.endDate;
  
  // Calculate duration - MUST be before any conditional returns
  const slotDuration = useMemo(() => {
    const startVal = s ?? slot?.startDate ?? slot?.proposed?.startDate;
    const endVal = e ?? slot?.endDate ?? slot?.proposed?.endDate;
    
    if (startVal && endVal) {
      try {
        const start = new Date(startVal).getTime();
        const end = new Date(endVal).getTime();
        const diffMs = end - start;
        return Math.round(diffMs / (1000 * 60));
      } catch {
        return null;
      }
    }
    return null;
  }, [s, e, slot]);
  
  // Non-hook logic after all hooks
  console.log('🎯 SlotTab Received:', {
    isEditing,
    hasEditData: !!editData,
    treatmentsCount: allTreatments?.length ?? 0,
    providersCount: allProviders?.length ?? 0,
    treatments: allTreatments?.slice(0, 3).map(t => t.name),
    providers: allProviders?.slice(0, 3).map(p => `${p.firstName} ${p.lastName}`),
  });
  
  // Effective status
  const rawStatusOriginal = slot?.status;
  let effectiveStatus = rawStatusOriginal;
  
  if (!effectiveStatus || !String(effectiveStatus).trim()) {
    if (slot?.proposed && !slot?.confirmation) {
      effectiveStatus = 'Pending';
    } else if (slot?.confirmation?.status) {
      effectiveStatus = slot.confirmation.status;
    } else {
      effectiveStatus = 'Unknown';
    }
  }
  
  const sk = statusKey(effectiveStatus);
  const colorSchemeMap: Record<string, string> = {
    confirmed: 'green',
    declined: 'red',
    rejected: 'red',
    reschedule: 'orange',
    pending: 'purple',
    nocontacted: 'gray',
    'no contacted': 'gray',
    unknown: 'gray',
  };
  const colorScheme = colorSchemeMap[sk] ?? 'gray';
  
  const slotTreatment = slot?.treatment;
  const slotPriority = slot?.priority;
  const slotProviders = slot?.providers || [];
  
  return (
    <VStack align="stretch" spacing={4}>
      {/* Status and Actions */}
      <HStack justify="space-between" align="center" flexWrap="wrap">
        <HStack spacing={2}>
          <Tooltip label={`Created at ${fmtDateTime(slot?.updatedAt)}`}>
            <Badge rounded="full" colorScheme={colorScheme} fontSize="sm" px={3} py={1}>
              {capStatus(effectiveStatus)}
            </Badge>
          </Tooltip>
          {slot?.rescheduleRequested && (
            <Badge colorScheme="orange" rounded="full" fontSize="sm" px={3} py={1}>
              Reschedule requested
            </Badge>
          )}
          {isLatest && (
            <Badge colorScheme="blue" variant="subtle" rounded="full" fontSize="sm" px={3} py={1}>
              Latest
            </Badge>
          )}
        </HStack>
        
        <HStack>
          <Tooltip label="Edit slot">
            <IconButton
              icon={<EditIcon />}
              size="sm"
              variant="ghost"
              colorScheme="blue"
              aria-label="Edit slot"
              onClick={onEdit}
            />
          </Tooltip>
          <Tooltip label="Delete slot">
            <IconButton
              icon={<FiTrash2 />}
              size="sm"
              variant="ghost"
              colorScheme="red"
              aria-label="Delete slot"
              onClick={onDelete}
            />
          </Tooltip>
        </HStack>
      </HStack>
      
      {/* Content Grid */}
      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
        {isEditing && editData ? (
          <VStack align="stretch" spacing={4} gridColumn="1 / -1">
            <VStack align="stretch" spacing={3} bg={useColorModeValue("blue.50", "blue.900")} p={4} rounded="lg">
              <HStack>
                <Icon as={FiCalendar} color="blue.500" />
                <Text fontSize="sm" fontWeight="bold" color="blue.600">
                  Edit Appointment Time
                </Text>
              </HStack>
              
              {/* Start Date & Time */}
              <VStack align="stretch" spacing={2}>
                <Text fontSize="xs" fontWeight="semibold" textTransform="uppercase" color={sub}>
                  📅 Appointment Date & Start Time
                </Text>
                <HStack spacing={2}>
                  <Input
                    type="date"
                    value={editData.startDate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      onEditDataChange('startDate', e.target.value);
                    }}
                    size="md"
                    flex={2}
                  />
                  <Input
                    type="time"
                    value={editData.startTime}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      onEditDataChange('startTime', e.target.value);
                    }}
                    size="md"
                    flex={1}
                  />
                </HStack>
              </VStack>

              {/* Duration */}
              <VStack align="stretch" spacing={2}>
                <HStack justify="space-between">
                  <Text fontSize="xs" fontWeight="semibold" textTransform="uppercase" color={sub}>
                    ⏱️ Duration (minutes)
                  </Text>
                  {slot?.treatment && (
                    <Badge colorScheme="purple" fontSize="xx-small">
                      Treatment: {slot.treatment.duration} min
                    </Badge>
                  )}
                </HStack>
                <HStack spacing={2}>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const newDuration = Math.max(5, editData.durationMinutes - 15);
                      onEditDataChange('durationMinutes', String(newDuration));
                    }}
                  >
                    -15
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const newDuration = Math.max(5, editData.durationMinutes - 5);
                      onEditDataChange('durationMinutes', String(newDuration));
                    }}
                  >
                    -5
                  </Button>
                  <Input
                    type="number"
                    value={editData.durationMinutes}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const val = parseInt(e.target.value) || 0;
                      onEditDataChange('durationMinutes', String(Math.max(5, val)));
                    }}
                    size="md"
                    textAlign="center"
                    fontWeight="bold"
                    min={5}
                    step={5}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onEditDataChange('durationMinutes', String(editData.durationMinutes + 5));
                    }}
                  >
                    +5
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onEditDataChange('durationMinutes', String(editData.durationMinutes + 15));
                    }}
                  >
                    +15
                  </Button>
                </HStack>
              </VStack>

              {/* Calculated End Time */}
              <VStack align="stretch" spacing={2}>
                <Text fontSize="xs" fontWeight="semibold" textTransform="uppercase" color={sub}>
                  🏁 End Time (Calculated)
                </Text>
                <Box
                  bg={useColorModeValue("white", "gray.700")}
                  p={3}
                  rounded="md"
                  border="1px solid"
                  borderColor={useColorModeValue("gray.200", "gray.600")}
                >
                  <Text fontWeight="bold" fontSize="lg">
                    {(() => {
                      try {
                        const start = new Date(`${editData.startDate}T${editData.startTime}`);
                        const end = new Date(start.getTime() + editData.durationMinutes * 60 * 1000);
                        return end.toLocaleTimeString('en-US', { 
                          hour: 'numeric', 
                          minute: '2-digit',
                          hour12: true 
                        });
                      } catch {
                        return '—';
                      }
                    })()}
                  </Text>
                </Box>
              </VStack>

              <Divider />

              {/* Treatment Selection - USING TreatmentPopoverSelector */}
              <VStack align="stretch" spacing={2}>
                <HStack justify="space-between">
                  <Text fontSize="xs" fontWeight="semibold" textTransform="uppercase" color={sub}>
                    💉 Treatment
                  </Text>
                  {editData.treatmentId && (
                    <Button
                      size="xs"
                      variant="ghost"
                      colorScheme="red"
                      leftIcon={<Icon as={FiX} />}
                      onClick={() => {
                        onEditDataChange('treatmentId', '');
                        // Reset duration when treatment is removed
                        onEditDataChange('durationMinutes', '60');
                      }}
                    >
                      Remove
                    </Button>
                  )}
                </HStack>
                <TreatmentPopoverSelector
                  value={editData.treatmentId ?? ''}
                  onChange={(treatmentId, treatment) => {
                    onEditDataChange('treatmentId', treatmentId);
                    // Auto-update duration with treatment duration
                    if (treatment && (treatment as any).duration) {
                      onEditDataChange('durationMinutes', String((treatment as any).duration));
                    }
                  }}
                  isDisabled={false}
                />
              </VStack>

              {/* Providers Selection - WITH AVAILABILITY CHECKING LIKE CUSTOMENTRYFORM */}
              <VStack align="stretch" spacing={2}>
                <Text fontSize="xs" fontWeight="semibold" textTransform="uppercase" color={sub}>
                  👥 Providers
                </Text>
                
                {/* Selected Providers - Assigned style */}
                {editData.providerIds.length > 0 && (
                  <Box>
                    <Text fontSize="xs" fontWeight="semibold" mb={2} color="gray.600">
                      Assigned
                    </Text>
                    <VStack align="stretch" spacing={2}>
                      {editData.providerIds.map((providerId) => {
                        const provider = allProviders?.find(p => String(p._id) === providerId);
                        if (!provider) return null;
                        
                        const providerName = `${provider.firstName} ${provider.lastName}`;
                        
                        return (
                          <Box 
                            key={providerId}
                            borderWidth="1px"
                            borderRadius="md"
                            p={2}
                            bg={useColorModeValue("green.50", "green.900")}
                            borderColor={useColorModeValue("green.200", "green.700")}
                          >
                            <HStack justify="space-between">
                              <HStack spacing={2}>
                                <Box 
                                  w="8px" 
                                  h="8px" 
                                  borderRadius="full" 
                                  bg={provider.color || 'gray.300'} 
                                />
                                <Text 
                                  fontSize="sm" 
                                  fontWeight="medium" 
                                  textTransform="capitalize"
                                  color={useColorModeValue("gray.800", "gray.100")}
                                >
                                  {providerName}
                                </Text>
                              </HStack>
                              <HStack spacing={2}>
                                <Badge colorScheme="green" size="sm">
                                  Assigned
                                </Badge>
                                <Button
                                  size="xs"
                                  variant="ghost"
                                  colorScheme="red"
                                  onClick={() => {
                                    onEditDataChange(
                                      'providerIds',
                                      editData.providerIds.filter(id => id !== providerId)
                                    );
                                  }}
                                >
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
                
                {/* Add Provider - With availability checking */}
                <Box>
                  <Text fontSize="xs" fontWeight="semibold" mb={2} color="gray.600">
                    {editData.providerIds.length > 0 ? 'Add provider' : 'Select provider'}
                  </Text>
                  <Box 
                    borderWidth="1px" 
                    borderRadius="md" 
                    maxH="180px" 
                    overflowY="auto" 
                    px={1} 
                    py={1}
                    bg={useColorModeValue("white", "gray.800")}
                  >
                    {(() => {
                      const availableProviders = allProviders?.filter(p => !editData.providerIds.includes(String(p._id))) || [];
                      
                      if (availableProviders.length === 0) {
                        return (
                          <Text fontSize="xs" color="gray.500" p={3} textAlign="center">
                            {allProviders && allProviders.length > 0 
                              ? 'All providers already assigned' 
                              : 'No providers available in this organization'}
                          </Text>
                        );
                      }
                      
                      return availableProviders.map((provider) => (
                        <ProviderRowWithAvailability
                          key={String(provider._id)}
                          provider={provider}
                          slotStartDate={editData.startDate}
                          slotStartTime={editData.startTime}
                          slotDurationMinutes={editData.durationMinutes}
                          appointmentId={appointmentId}
                          onAdd={() => {
                            onEditDataChange('providerIds', [...editData.providerIds, String(provider._id)]);
                          }}
                        />
                      ));
                    })()}
                  </Box>
                </Box>
              </VStack>
            </VStack>

            <HStack spacing={2} justify="flex-end">
              <Button size="sm" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
              <Button size="sm" colorScheme="blue" leftIcon={<Icon as={FiCalendar} />} onClick={onSave}>
                Save Changes
              </Button>
            </HStack>
          </VStack>
        ) : (
          <LabeledRow
            label="Range"
            value={(() => {
              const startVal = s ?? slot?.startDate ?? slot?.proposed?.startDate;
              const endVal = e ?? slot?.endDate ?? slot?.proposed?.endDate;
              
              if (startVal && endVal) {
                try {
                  return formatDateWS({
                    startDate: new Date(startVal),
                    endDate: new Date(endVal)
                  });
                } catch {
                  return "—";
                }
              }
              return "—";
            })()}
          />
        )}
        
        {!isEditing && slotTreatment && (
          <LabeledRow
            label="Treatment"
            value={
              <HStack spacing={2}>
                <Text fontWeight="semibold">{slotTreatment.name}</Text>
                {slotTreatment.active === false && (
                  <Badge colorScheme="orange" size="sm">Inactive</Badge>
                )}
              </HStack>
            }
          />
        )}
        
        {!isEditing && slotPriority && (
          <LabeledRow
            label="Priority"
            value={<PriorityTag priority={slotPriority} />}
          />
        )}
        
        {!isEditing && slotDuration && (
          <LabeledRow
            label="Duration"
            value={`${slotDuration} min`}
          />
        )}
        
        {!isEditing && slotProviders.length > 0 && (
          <LabeledRow
            label="Providers"
            value={
              <Wrap>
                {slotProviders.map((p: Provider) => {
                  const name = `${capitalize(p.firstName)} ${capitalize(p.lastName)}`.trim() || "Provider";
                  return (
                    <WrapItem key={String(p._id ?? name)}>
                      <Tag size="sm" colorScheme="teal" variant="subtle">
                        {name}
                      </Tag>
                    </WrapItem>
                  );
                })}
              </Wrap>
            }
          />
        )}
      </SimpleGrid>
      
      {/* Additional info */}
      {(slot?.proposed || slot?.confirmation) && (
        <VStack align="stretch" spacing={2} mt={2}>
          {slot?.proposed && (
            <Box>
              <Text fontSize="xs" color={sub}>
                {slot?.confirmation?.sentAt ? `Sent at: ${fmtDateTime(slot?.confirmation?.sentAt)}` : ""}
                {slot?.proposed?.createdAt ? ` · ${fmtDateTime(slot?.proposed.createdAt)}` : ""}
              </Text>
              {slot?.proposed?.reason && (
                <Text fontSize="sm">Reason: {slot?.proposed.reason}</Text>
              )}
            </Box>
          )}
          {slot?.confirmation && (
            <Box>
              <Text fontSize="xs" color={sub}>
                Decided at: {fmtDateTime(slot?.confirmation.decidedAt)}
                {slot?.confirmation.lateResponse ? " · Late response" : ""}
              </Text>
            </Box>
          )}
        </VStack>
      )}
    </VStack>
  );
});
SlotTab.displayName = "SlotTab";

// -----------------------------
// Componente principal
// -----------------------------
export type PremiumAppointmentModalProps = {
  id: string;
  isOpen: boolean;
  onClose: () => void;
};

const PremiumAppointmentModal: React.FC<PremiumAppointmentModalProps> = ({
  id,
  isOpen,
  onClose,
}) => {
  const headerBg = useColorModeValue(
    "linear-gradient(135deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0) 100%), linear-gradient(90deg, #7C3AED 0%, #06B6D4 100%)",
    "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 100%), linear-gradient(90deg, #7C3AED 0%, #06B6D4 100%)"
  );
  const sub = useColorModeValue("blackAlpha.700", "whiteAlpha.700");
  const border = useColorModeValue("blackAlpha.200", "whiteAlpha.300");

  const toast = useToast();
  const queryClient = useQueryClient();
  const { socket, connected } = useSocket();

  // Mutation para actualizar appointment
  const { mutate: updateAppointment, isPending: isUpdating } = useUpdateItems(
    "update-items",
    {
      invalidateKeys: [
        ["Appointment"],
        ["DraggableCards"],
        ["ContactAppointment"],
      ],
    }
  );

  // Modals state
  const {
    isOpen: isProviderOpen,
    onClose: onProviderClose,
  } = useDisclosure();
  
  const {
    isOpen: isRepOpen,
    onOpen: onRepOpen,
    onClose: onRepClose,
  } = useDisclosure();
  
  const {
    isOpen: isDeleteOpen,
    onOpen: onDeleteOpen,
    onClose: onDeleteClose,
  } = useDisclosure();
  
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [editingSlotData, setEditingSlotData] = useState<{
    startDate: string;
    startTime: string;
    durationMinutes: number;
    treatmentId: string | null;
    providerIds: string[];
  } | null>(null);
  const [selectedSlotForDelete, setSelectedSlotForDelete] = useState<AppointmentSlot | null>(null);
  const [showAllContacts, setShowAllContacts] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [isEditingAvailability, setIsEditingAvailability] = useState(false);
  const [editingAvailability, setEditingAvailability] = useState<SelectedDaysState | null>(null);
  const cancelRef = React.useRef<HTMLButtonElement>(null);

  // 👇 Modal index (solo gestión open/close)
  // Mantén el registro en el stack por si se requiere z-index entre modales, aunque no bloqueamos la visibilidad
  useModalIndex(isOpen, { id: "premium-appointment-modal" });
  const isTopOpen = isOpen;

  // --- Fetch con populate actualizado a tus refs ---
  const populateFields = [
    { path: "priority", select: "id description notes durationHours name color org_id" },
    { path: "treatment", select: "_id name duration icon minIcon color category active" },
    { path: "providers" },
    // ✨ NUEVO: populate de campos en cada slot
    { path: "selectedAppDates.treatment", select: "_id name duration icon minIcon color category active" },
    { path: "selectedAppDates.priority", select: "id description notes durationHours name color org_id" },
    { path: "selectedAppDates.providers", select: "_id firstName lastName email phone" },
    { path: "selectedDates.days.timeBlocks", select: "_id org_id blockNumber label short from to" },
    { path: "user", select: "auth0_id name email" },
    // Necesitamos los datos del representante para mostrar el teléfono efectivo
    { path: "representative.appointment", select: "nameInput lastNameInput phoneInput phoneE164 emailLower sid proxyAddress" },
  ] as const;

  const limit = 25;
  const safeQuery = React.useMemo(
    () => (id && id.trim() ? { _id: id } : { _id: { $exists: false } }),
    [id]
  );

  const safeQuery2 = React.useMemo(
    () => (id && id.trim() ? { appointment: id } : { appointment: { $exists: false } }),
    [id]
  );

  const { data, isLoading, refetch } = useGetCollection<Appointment>(
    "Appointment",
    { mongoQuery: safeQuery, limit, populate: populateFields }
  );

  // 👉 Contact logs population: bring only minimal slot fields to reduce payload.
  // NOTE: Mongoose populate 'select' can't deep-filter array elements; we still project only needed keys.
  // For tighter backend filtering (single selectedAppDate), we'd need a custom endpoint or aggregation ($filter).
  const populateFieldsContacted = [
    { path: "user", select: "auth0_id name email" },
    { path: "appointment", select: "selectedAppDates._id selectedAppDates.startDate selectedAppDates.endDate selectedAppDates.proposed selectedAppDates.confirmation" },
    // selectedAppDate es un ObjectId a subdocumento embebido: no se puede hacer populate directo
  ] as const;

  const { data: contacted } = useGetCollection<ContactAppointment>(
    "ContactAppointment",
    { mongoQuery: safeQuery2, limit, populate: populateFieldsContacted }
  );

  // ✨ Fetch Google Review requests for this patient
  const { data: reviewRequests } = useGoogleReviewRequests(id);

  // Get appointment and org_id FIRST
  const appointment = data?.[0] ?? null;
  const orgId = appointment?.org_id;

  console.log('🔍 AppointmentModal Debug:', {
    hasAppointment: !!appointment,
    orgId,
    appointmentId: appointment?._id,
  });

  // Fetch all treatments and providers for editing slots (filtered by org_id)
  // Use useMemo to create stable query object
  const treatmentsQuery = React.useMemo(
    () => {
      const query = orgId ? { active: true, org_id: orgId } : { _id: { $exists: false } };
      console.log('💊 Treatments Query:', query);
      return query;
    },
    [orgId]
  );

  const providersQuery = React.useMemo(
    () => {
      const query = orgId ? { org_id: orgId } : { _id: { $exists: false } };
      console.log('👨‍⚕️ Providers Query:', query);
      return query;
    },
    [orgId]
  );

  const { data: allTreatments, isLoading: isLoadingTreatments, error: treatmentsError } = useGetCollection<Treatment>("Treatment", {
    mongoQuery: treatmentsQuery,
    limit: 100,
  });

  const { data: allProviders, isLoading: isLoadingProviders, error: providersError } = useGetCollection<Provider>("Provider", {
    mongoQuery: providersQuery,
    limit: 100,
  });

  console.log('📊 Fetched Data:', {
    treatmentsCount: allTreatments?.length ?? 0,
    providersCount: allProviders?.length ?? 0,
    isLoadingTreatments,
    isLoadingProviders,
    treatmentsError,
    providersError,
    treatments: allTreatments?.map(t => ({ id: t._id, name: t.name, org_id: t.org_id, active: t.active })),
    providers: allProviders?.map(p => ({ id: p._id, firstName: p.firstName, lastName: p.lastName, org_id: p.org_id })),
  });

  // Log cuando cambian los datos
  React.useEffect(() => {
    if (allTreatments) {
      console.log('✅ Treatments loaded:', allTreatments.length, 'items');
    }
  }, [allTreatments]);

  React.useEffect(() => {
    if (allProviders) {
      console.log('✅ Providers loaded:', allProviders.length, 'items');
    }
  }, [allProviders]);

  // Enrich contact logs (memoized with centralized logic)
  const contactedSlim = useMemo<ContactAppointmentSlim[]>(() => {
    if (!contacted) return [];
    
    return (contacted as ContactAppointmentSlim[]).map((log) => {
      const populatedApp = log?.appointment as { selectedAppDates?: AppointmentSlot[] } | undefined;
      const list: AppointmentSlot[] = Array.isArray(populatedApp?.selectedAppDates)
        ? populatedApp.selectedAppDates
        : [];
      
      const matched = matchSlot(log, list);
      
      const slim: ContactAppointmentSlim = { ...log };
      if (matched) {
        slim.selectedAppDate = matched;
        if (populatedApp) {
          slim.appointment = { ...populatedApp, selectedAppDates: [matched] };
        }
      }
      return slim;
    });
  }, [contacted]);
  
  // Deduplicated and sorted slots (memoized)
  const dedupedSlots = useMemo(
    () => deduplicateAndSortSlots(appointment?.selectedAppDates ?? []),
    [appointment?.selectedAppDates]
  );
  
  const displaySlot = useMemo(
    () => pickDisplaySlot(dedupedSlots as any),
    [dedupedSlots]
  );
  
  const cap = useCallback((s?: string) => 
    (s ?? "").toLocaleLowerCase().replace(/^\p{L}/u, c => c.toLocaleUpperCase()),
    []
  );
  
  const fullName = useMemo(() => {
    const name = cap(appointment?.nameInput);
    const last = cap(appointment?.lastNameInput);
    const v = `${name} ${last}`.trim();
    return v || "Unnamed";
  }, [appointment, cap]);

  // Teléfono efectivo (mismo criterio que en DraggableCards)
  const hasRep = Boolean((appointment as any)?.representative?.appointment);
  const rep = hasRep && typeof (appointment as any)?.representative?.appointment === 'object'
    ? (appointment as any).representative.appointment as any
    : null;
  const phoneDisplay = useMemo(() => 
    rep
      ? formatAusPhoneNumber(rep.phoneInput || rep.phoneE164 || "")
      : formatAusPhoneNumber(appointment?.phoneInput || ""),
    [rep, appointment]
  );

  // 🔄 Live refresh: ensure modal always shows the freshest appointment after server-side updates
  React.useEffect(() => {
    if (!socket || !connected || !id) return;
    // When a confirmation resolves, refetch this specific appointment + general lists
    const handleConfirm = (evt: any) => {
      // evt.conversationId matches appointment.sid (conversation) or we fallback to always refetch
      if (!appointment || evt?.conversationId === appointment.sid) {
        queryClient.invalidateQueries({ queryKey: ["Appointment"] });
        queryClient.refetchQueries({ queryKey: ["Appointment"] });
        queryClient.invalidateQueries({ queryKey: ["DraggableCards"] });
        queryClient.refetchQueries({ queryKey: ["DraggableCards"] });
      }
    };
    socket.on("confirmationResolved", handleConfirm);
    return () => {
      socket.off("confirmationResolved", handleConfirm);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, connected, id, appointment?.sid]);

  // Handlers
  const handleEditSlot = useCallback((slot: AppointmentSlot) => {
    if (!slot?._id) return;
    const startDate = slot?.startDate || slot?.proposed?.startDate;
    const endDate = slot?.endDate || slot?.proposed?.endDate;
    
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      // Calcular duración actual en minutos
      const durationMs = end.getTime() - start.getTime();
      const durationMinutes = Math.round(durationMs / (1000 * 60));
      
      // Formatear fecha y hora
      const formatDate = (d: Date): string => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      
      const formatTime = (d: Date): string => {
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
      };
      
      // Sugerir duración del tratamiento si existe
      const suggestedDuration = slot?.treatment?.duration || durationMinutes;

      console.log('🔧 Opening edit mode:', {
        slotId: slot._id,
        originalStartDate: startDate,
        originalEndDate: endDate,
        calculatedDuration: durationMinutes,
        suggestedDuration,
        treatment: slot?.treatment?.name
      });

      setEditingSlotId(String(slot._id));
      setEditingSlotData({
        startDate: formatDate(start),
        startTime: formatTime(start),
        durationMinutes: suggestedDuration,
        treatmentId: slot?.treatment?._id ? String(slot.treatment._id) : null,
        providerIds: (slot?.providers ?? []).map(p => String(p._id ?? '')).filter(Boolean),
      });
    }
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingSlotId(null);
    setEditingSlotData(null);
  }, []);

  const handleSaveSlot = useCallback(async (slotId: string) => {
    if (!editingSlotData || !appointment?._id || isUpdating) return;

    // Calcular endDate basado en startDate + duración
    const startDateTime = new Date(`${editingSlotData.startDate}T${editingSlotData.startTime}`);
    const endDateTime = new Date(startDateTime.getTime() + editingSlotData.durationMinutes * 60 * 1000);

    console.log('✏️ Updating slot:', {
      slotId,
      editingData: editingSlotData,
      calculatedStartDate: startDateTime.toISOString(),
      calculatedEndDate: endDateTime.toISOString(),
      allSlots: appointment.selectedAppDates?.map(s => ({ id: s._id, str: String(s._id) }))
    });

    // Encontrar el slot actual y actualizarlo
    let slotFound = false;
    const updatedSlots = (appointment.selectedAppDates ?? []).map((slot) => {
      if (String(slot._id ?? '') === slotId) {
        slotFound = true;
        
        // Prepare updated slot
        const updated: any = {
          ...slot,
          startDate: startDateTime.toISOString(),
          endDate: endDateTime.toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        // Update treatment (store as ID, backend will populate)
        if (editingSlotData.treatmentId) {
          updated.treatment = editingSlotData.treatmentId;
        } else {
          delete updated.treatment;
        }
        
        // Update providers (store as IDs array)
        if (editingSlotData.providerIds.length > 0) {
          updated.providers = editingSlotData.providerIds;
        } else {
          updated.providers = [];
        }
        
        return updated;
      }
      return slot;
    });

    if (!slotFound) {
      console.error('❌ Slot not found for update!');
      toast({
        title: "Failed to update slot",
        description: "Could not find the slot to update",
        status: "error",
        duration: 3000,
      });
      return;
    }

    console.log('📊 Update result:', {
      originalLength: appointment.selectedAppDates?.length,
      updatedLength: updatedSlots.length,
      slotFound
    });

    updateAppointment(
      [
        {
          table: "Appointment",
          id_field: "_id",
          id_value: appointment._id,
          data: {
            selectedAppDates: updatedSlots,
          },
        },
      ],
      {
        onSuccess: () => {
          console.log('✅ Slot updated successfully');
          toast({
            title: "Slot updated successfully",
            status: "success",
            duration: 2000,
          });
          setEditingSlotId(null);
          setEditingSlotData(null);
          refetch();
        },
        onError: (error) => {
          console.error('❌ Error updating slot:', error);
          toast({
            title: "Failed to update slot",
            description: String(error),
            status: "error",
            duration: 3000,
          });
        },
      }
    );
  }, [editingSlotData, appointment, isUpdating, updateAppointment, toast, refetch]);

  const handleDeleteSlot = useCallback((slot: AppointmentSlot) => {
    setSelectedSlotForDelete(slot);
    onDeleteOpen();
  }, [onDeleteOpen]);

  const handleEditAvailability = useCallback(() => {
    if (!appointment?.selectedDates?.days) {
      setEditingAvailability({});
    } else {
      // Convertir selectedDates a formato SelectedDaysState
      const daysState: any = {};
      appointment.selectedDates.days.forEach((day: any) => {
        if (day.timeBlocks && day.timeBlocks.length > 0) {
          daysState[day.weekDay] = day.timeBlocksData || day.timeBlocks;
        }
      });
      setEditingAvailability(daysState as SelectedDaysState);
    }
    setIsEditingAvailability(true);
  }, [appointment]);

  const handleCancelAvailability = useCallback(() => {
    setIsEditingAvailability(false);
    setEditingAvailability(null);
  }, []);

  const handleSaveAvailability = useCallback((value: SelectedDatesValue) => {
    if (!appointment?._id || isUpdating) return;

    console.log('📅 Updating availability:', value);

    updateAppointment(
      [
        {
          table: "Appointment",
          id_field: "_id",
          id_value: appointment._id,
          data: {
            selectedDates: value,
          },
        },
      ],
      {
        onSuccess: () => {
          console.log('✅ Availability updated successfully');
          toast({
            title: "Availability updated successfully",
            status: "success",
            duration: 2000,
          });
          setIsEditingAvailability(false);
          setEditingAvailability(null);
          refetch();
        },
        onError: (error) => {
          console.error('❌ Error updating availability:', error);
          toast({
            title: "Failed to update availability",
            description: String(error),
            status: "error",
            duration: 3000,
          });
        },
      }
    );
  }, [appointment, isUpdating, updateAppointment, toast, refetch]);

  const confirmDeleteSlot = useCallback(async () => {
    if (!selectedSlotForDelete || !appointment?._id || isUpdating) return;

    console.log('🗑️ Deleting slot:', {
      slotToDelete: selectedSlotForDelete,
      slotId: selectedSlotForDelete._id,
      allSlots: appointment.selectedAppDates,
      allSlotIds: appointment.selectedAppDates?.map(s => ({ id: s._id, str: String(s._id) }))
    });

    const selectedId = String(selectedSlotForDelete._id ?? '');
    
    // Filtrar el slot a eliminar usando múltiples criterios para mayor seguridad
    const updatedSlots = (appointment.selectedAppDates ?? []).filter((slot) => {
      const slotId = String(slot._id ?? '');
      
      // Si no hay ID, usar comparación por fechas
      if (!slotId || !selectedId) {
        const slotStart = slot?.startDate || slot?.proposed?.startDate;
        const slotEnd = slot?.endDate || slot?.proposed?.endDate;
        const selectedStart = selectedSlotForDelete?.startDate || selectedSlotForDelete?.proposed?.startDate;
        const selectedEnd = selectedSlotForDelete?.endDate || selectedSlotForDelete?.proposed?.endDate;
        
        return !(
          slotStart && slotEnd && selectedStart && selectedEnd &&
          new Date(slotStart).getTime() === new Date(selectedStart).getTime() &&
          new Date(slotEnd).getTime() === new Date(selectedEnd).getTime()
        );
      }
      
      // Comparación por ID
      return slotId !== selectedId;
    });

    console.log('📊 Filter result:', {
      originalLength: appointment.selectedAppDates?.length,
      filteredLength: updatedSlots.length,
      removed: (appointment.selectedAppDates?.length ?? 0) - updatedSlots.length
    });

    // Validar que no se elimine el último slot
    if (updatedSlots.length === 0) {
      toast({
        title: "Cannot delete last slot",
        description: "An appointment must have at least one slot",
        status: "warning",
        duration: 3000,
      });
      onDeleteClose();
      return;
    }

    // Validar que efectivamente se eliminó un slot
    if (updatedSlots.length === (appointment.selectedAppDates?.length ?? 0)) {
      console.error('❌ No slot was removed!');
      toast({
        title: "Failed to delete slot",
        description: "Could not identify the slot to delete",
        status: "error",
        duration: 3000,
      });
      return;
    }

    updateAppointment(
      [
        {
          table: "Appointment",
          id_field: "_id",
          id_value: appointment._id,
          data: {
            selectedAppDates: updatedSlots,
          },
        },
      ],
      {
        onSuccess: () => {
          console.log('✅ Slot deleted successfully');
          toast({
            title: "Slot deleted successfully",
            status: "success",
            duration: 2000,
          });
          setSelectedSlotForDelete(null);
          onDeleteClose();
          refetch();
        },
        onError: (error) => {
          console.error('❌ Error deleting slot:', error);
          toast({
            title: "Failed to delete slot",
            description: String(error),
            status: "error",
            duration: 3000,
          });
        },
      }
    );
  }, [selectedSlotForDelete, appointment, isUpdating, updateAppointment, toast, refetch, onDeleteClose]);

  return (
    <>
      {/* Main Modal - hidden when provider modal is open */}
      <Modal isOpen={isTopOpen && !isProviderOpen} onClose={onClose} size="6xl" closeOnOverlayClick={false}>
        <ModalOverlay backdropFilter="blur(6px)" />
        <ModalContent
          overflow="hidden"
          border="1px solid"
          borderColor={border}
          rounded="2xl"
        >
          {/* Header */}
          <Box
            bg={headerBg}
            color="white"
            px={6}
            py={6}
            borderLeftWidth={6}
            borderLeftStyle="solid"
            borderLeftColor={appointment?.color ?? "transparent"}
          >
            <HStack spacing={4} align="center" justify="space-between">
              <HStack spacing={4} align="center">
                <Avatar
                  name={appointment?.nameInput?.[0] || fullName}
                  {...enrichAvatarColor(appointment?.color)}
                  size="lg"
                  boxShadow="0 2px 8px rgba(0,0,0,0.15)"
                />
                <VStack align="start" spacing={1} flex={1}>
                  <HStack wrap="wrap" spacing={3} align="center">
                    <Text fontSize="xl" fontWeight="extrabold">
                      {fullName}
                    </Text>

                    {appointment?.unknown ? (
                      <Badge colorScheme="orange" rounded="full">
                        Unknown
                      </Badge>
                    ) : null}
                    {/* Teléfono al lado del nombre (estilizado) */}
                    <Box
                      bg="whiteAlpha.200"
                      px={2}
                      py={1}
                      rounded="full"
                      border="1px solid"
                      borderColor="whiteAlpha.300"
                    >
                      <HStack spacing={2} align="center" color="white">
                        <PhoneIcon boxSize={3.5} />
                        {rep ? (
                          <HStack spacing={1} align="center">
                            <Box
                              as="button"
                              onClick={(e: React.MouseEvent) => {
                                e.stopPropagation();
                                onRepOpen();
                              }}
                              aria-label="Open representative"
                              _hover={{ opacity: 0.9 }}
                            >
                              <Box as={RiParentFill} color="purple.200" />
                            </Box>
                            <Text fontSize="sm" fontWeight="semibold">{phoneDisplay || '—'}</Text>
                          </HStack>
                        ) : (
                          <Text fontSize="sm" fontWeight="semibold">{phoneDisplay || '—'}</Text>
                        )}
                      </HStack>
                    </Box>
                  </HStack>
                </VStack>
              </HStack>
              {/* 🔗 Acceso rápido al chat desde el header */}
              {appointment && (
                <ChatLauncher
                  item={appointment}
                  tooltip="Open chat"
                  buildContact={(i: Appointment) => {
                    // Always derive chat to representative if present; otherwise use patient
                    const repApp = (i as any)?.representative?.appointment && typeof (i as any)?.representative?.appointment === 'object'
                      ? ((i as any).representative.appointment as any)
                      : null;

                    if (repApp) {
                      const conversationId = repApp.sid || '';
                      const phone = repApp.phoneInput || repApp.phoneE164 || '';
                      const email = repApp.emailLower || '';
                      const author = `${repApp.nameInput || ''}`.trim();
                      return {
                        conversationId,
                        lastMessage: {
                          author,
                          body: '',
                          conversationId,
                          createdAt: new Date().toISOString(),
                          direction: 'outbound' as const,
                          media: [],
                          sid: 'temp-lastmessage',
                          status: 'delivered' as const,
                          updatedAt: new Date().toISOString(),
                        },
                        owner: {
                          email,
                          lastName: repApp.lastNameInput || '',
                          name: repApp.nameInput || '',
                          org_id: i.org_id || '',
                          phone,
                          color: (i as any)?.color || undefined,
                          unknown: false,
                          _id: repApp._id,
                          represented: true,
                        },
                      };
                    }

                    const conversationId = (i as any).sid || '';
                    const author = (i.nameInput || '').trim();
                    return {
                      conversationId,
                      lastMessage: {
                        author,
                        body: '',
                        conversationId,
                        createdAt: new Date().toISOString(),
                        direction: 'outbound' as const,
                        media: [],
                        sid: 'temp-lastmessage',
                        status: 'delivered' as const,
                        updatedAt: new Date().toISOString(),
                      },
                      owner: {
                        email: i.emailInput || '',
                        lastName: i.lastNameInput || '',
                        name: i.nameInput || '',
                        org_id: i.org_id || '',
                        phone: i.phoneInput || '',
                        color: (i as any)?.color || undefined,
                        unknown: !!i.unknown,
                        _id: i._id,
                        represented: false,
                      },
                    };
                  }}
                  modalInitial={{ appId: appointment._id }}
                  trigger={
                    <Button
                      size="sm"
                      leftIcon={<FaCommentSms />}
                      variant="outline"
                      colorScheme="teal"
                    >
                      Open chat
                    </Button>
                  }
                />
              )}
            </HStack>
          </Box>

          <ModalCloseButton top={3} right={3} color="white" />

          {/* Body */}
          <ModalBody px={6} py={5}>
            {isLoading && !appointment ? (
              <VStack align="stretch" spacing={4}>
                <Skeleton h="28px" />
                <Skeleton h="180px" />
                <Skeleton h="220px" />
              </VStack>
            ) : (
              <VStack align="stretch" spacing={5} w="full">
                {/* Selected Appointment Dates - Full Width con Tabs */}
                <SectionCard
                  title={
                    <HStack>
                      <Icon as={FiCalendar} />
                      <Text>Selected Appointment Dates</Text>
                    </HStack>
                  }
                  
                >
                  {dedupedSlots.length === 0 ? (
                    <Text>—</Text>
                  ) : (
                    <Tabs isLazy colorScheme="purple" w="full">
                      <TabList overflowX="auto" overflowY="hidden">
                        {dedupedSlots.map((slot, idx) => {
                          const startVal = slot?.startDate || slot?.proposed?.startDate;
                          const displayId = displaySlot ? String(displaySlot._id ?? "") : "";
                          const isLatest = String(slot?._id ?? '') === displayId;
                          
                          let dateLabel = "—";
                          if (startVal) {
                            try {
                              const start = new Date(startVal);
                              dateLabel = start.toLocaleDateString("en-AU", {
                                day: "numeric",
                                month: "short",
                                year: "numeric"
                              });
                            } catch {
                              dateLabel = `Slot ${idx + 1}`;
                            }
                          } else {
                            dateLabel = `Slot ${idx + 1}`;
                          }
                          
                          return (
                            <Tab key={slot?._id ?? idx} whiteSpace="nowrap">
                              <HStack spacing={2}>
                                <Text>{dateLabel}</Text>
                                {isLatest && (
                                  <Badge colorScheme="blue" variant="subtle" rounded="full" fontSize="xx-small">
                                    Latest
                                  </Badge>
                                )}
                              </HStack>
                            </Tab>
                          );
                        })}
                      </TabList>
                      
                      <TabPanels>
                        {dedupedSlots.map((slot, idx) => {
                          const slotId = String(slot?._id ?? '');
                          const isEditing = editingSlotId === slotId;
                          
                          return (
                            <TabPanel key={slot?._id ?? idx} px={0}>
                              <SlotTab
                                slot={slot}
                                index={idx}
                                isLatest={String(slot?._id ?? '') === String(displaySlot?._id ?? "")}
                                isEditing={isEditing}
                                editData={isEditing ? editingSlotData : null}
                                onEdit={() => handleEditSlot(slot)}
                                onDelete={() => handleDeleteSlot(slot)}
                                onSave={() => handleSaveSlot(slotId)}
                                onCancel={handleCancelEdit}
                                allTreatments={allTreatments ?? []}
                                allProviders={allProviders ?? []}
                                appointmentId={appointment?._id}
                                onEditDataChange={(field, value) => {
                                  if (editingSlotData) {
                                    if (field === 'providerIds' && Array.isArray(value)) {
                                      setEditingSlotData({ ...editingSlotData, providerIds: value });
                                    } else if (field === 'treatmentId') {
                                      setEditingSlotData({ ...editingSlotData, treatmentId: value as string || null });
                                    } else if (field === 'durationMinutes') {
                                      const numVal = parseInt(value as string) || 0;
                                      setEditingSlotData({ ...editingSlotData, durationMinutes: Math.max(5, numVal) });
                                    } else {
                                      setEditingSlotData({ ...editingSlotData, [field]: value });
                                    }
                                  }
                                }}
                              />
                            </TabPanel>
                          );
                        })}
                      </TabPanels>
                    </Tabs>
                  )}
                </SectionCard>

                {/* Sección de Notes */}
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={5}>
                  <VStack align="stretch" spacing={5}>
                  

                  <SectionCard
                    title={
                      <HStack>
                        <Icon as={FiInfo} />
                        <Text>Notes</Text>
                      </HStack>
                    }
                  >
                    <VStack align="stretch" spacing={3}>
                      <Box
                        bg={useColorModeValue("blackAlpha.50", "whiteAlpha.100")}
                        p={3}
                        rounded="lg"
                      >
                        <Text fontSize="xs" color={sub} mb={1}>
                          Note
                        </Text>
                        <Text>{appointment?.note || "—"}</Text>
                      </Box>
                    </VStack>
                  </SectionCard>

                  <SectionCard
                    title={
                      <HStack>
                        <Icon as={FiInfo} />
                        <Text>Contact History</Text>
                      </HStack>
                    }
                    right={(() => {
                      console.log("contacted", contacted)
                      const list = (contactedSlim ?? []) as any[];
                      const total = list.length;
                      const confirmed = list.filter((l) => statusKey((l as any).status) === "confirmed").length;
                      const declined = list.filter((l) => {
                        const sk = statusKey((l as any).status);
                        return sk === "rejected" || sk === "declined";
                      }).length;
                      const pending = list.filter((l) => statusKey((l as any).status) === "pending").length;
                      return (
                        <HStack spacing={2}>
                          <Badge rounded="full" colorScheme="blue">{total} attempts</Badge>
                          <Badge rounded="full" colorScheme="green">{confirmed} confirmed</Badge>
                          <Badge rounded="full" colorScheme="red">{declined} declined</Badge>
                          <Badge rounded="full" colorScheme="purple">{pending} pending</Badge>
                        </HStack>
                      );
                    })()}
                  >
                    {contactedSlim?.length === 0 ? (
                      <Text>—</Text>
                    ) : (
                      <VStack align="stretch" spacing={3}>
                        {contactedSlim?.slice(0, showAllContacts ? undefined : 1).map((log, idx) => (
                          <HStack
                            key={log._id ?? idx}
                            align="flex-start"
                            border="1px solid"
                            borderColor={border}
                            rounded="lg"
                            p={2}
                            justify="space-between"
                          >
                            <VStack align="start" spacing={1} flex={1}>
                              <HStack spacing={2}>
                                {(() => {
                                  const status = (log as any).status as string | undefined;
                                  const sk = statusKey(status);
                                  const isConfirmed = sk === "confirmed";
                                  const isPending = sk === "pending";
                                  const isRejected = sk === "rejected" || sk === "declined";
                                  const bg = isConfirmed
                                    ? "green.100"
                                    : isPending
                                      ? "purple.100"
                                      : isRejected
                                        ? "red.100"
                                        : "gray.100";
                                  const color = isConfirmed
                                    ? "green.800"
                                    : isPending
                                      ? "purple.800"
                                      : isRejected
                                        ? "red.800"
                                        : "gray.800";
                                  return (
                                    <Badge rounded="xl" px={2} py={1} bg={bg} color={color} fontSize="xs" fontWeight="bold" textTransform="uppercase">
                                      {capStatus(status)}
                                    </Badge>
                                  );
                                })()}
                              </HStack>
                              <HStack spacing={4} align="flex-start" flexWrap="wrap">
                                <LabeledRow
                                  icon={CiUser}
                                  label="User"
                                  value={
                                    ((log as any).user?.name || "")
                                      .trim()
                                      .split(" ")[0] ||
                                    (log as any).user?.email ||
                                    (log as any).user?.auth0_id
                                  }
                                />
                                <LabeledRow
                                  icon={GrContact}
                                  label="Contacted"
                                  value={fmtDateTime((log as any).sentAt || (log as any).createdAt)}
                                />
                                <LabeledRow
                                  icon={FiClock}
                                  label="Responded"
                                  value={
                                    (log as any).status && statusKey((log as any).status) !== "pending"
                                      ? fmtDateTime((log as any).respondedAt || (log as any).updatedAt)
                                      : "—"
                                  }
                                />
                                {(() => {
                                  // Resolver slot usando primero la version poblada dentro del propio log (appointment.selectedAppDates)
                                  const populatedApp = (log as any).appointment as any | undefined;
                                  const localList = Array.isArray(populatedApp?.selectedAppDates) ? populatedApp.selectedAppDates : [];
                                  const globalList = (appointment?.selectedAppDates ?? []) as any[];
                                  const list = localList.length ? localList : globalList;

                                  // selectedAppDate puede venir poblado (objeto) o como id (string)
                                  const rawSel = (log as any).selectedAppDate as string | AppointmentSlot | undefined;
                                  const selId = typeof rawSel === 'string' ? rawSel : '';
                                  let slot: AppointmentSlot | null = null;
                                  let linkSource: string = ""; // debug metadata

                                  // Preferimos el objeto ya poblado dentro de selectedAppDate
                                  if (rawSel && typeof rawSel === 'object') {
                                    slot = rawSel as AppointmentSlot;
                                    linkSource = '';
                                  }
                                  if (selId) {
                                    if (!slot) {
                                      slot = (list as AppointmentSlot[]).find((s: AppointmentSlot) => String(s?._id) === selId) || null;
                                      if (slot) linkSource = "selectedAppDate";
                                    }
                                  }
                                  if (!slot) {
                                    const askSid = (log as any).askMessageSid ? String((log as any).askMessageSid) : "";
                                    if (askSid) {
                                      slot = (list as AppointmentSlot[]).find((sd: AppointmentSlot) => String(sd?.confirmation?.askMessageSid || "") === askSid) || null;
                                      if (slot) linkSource = "askMessageSid";
                                    }
                                  }
                                  if (!slot) {
                                    const s = (log as any).startDate ? new Date((log as any).startDate) : null;
                                    const e = (log as any).endDate ? new Date((log as any).endDate) : null;
                                    const st = s && !isNaN(s.getTime()) ? s.getTime() : NaN;
                                    const et = e && !isNaN(e.getTime()) ? e.getTime() : NaN;
                                    if (!Number.isNaN(st) && !Number.isNaN(et)) {
                                      slot = (list as AppointmentSlot[]).find((sd: AppointmentSlot) => {
                                        const t1 = sd?.startDate ? new Date(sd.startDate as any).getTime() : NaN;
                                        const t2 = sd?.endDate ? new Date(sd.endDate as any).getTime() : NaN;
                                        const p1 = sd?.proposed?.startDate ? new Date(sd.proposed.startDate as any).getTime() : NaN;
                                        const p2 = sd?.proposed?.endDate ? new Date(sd.proposed.endDate as any).getTime() : NaN;
                                        return (t1 === st && t2 === et) || (p1 === st && p2 === et);
                                      }) || null;
                                      if (slot) linkSource = "dates";
                                    }
                                  }

                                  let proposedStr: string | null = null;
                                  let currentStr: string | null = null;

                                  // Proposed priority: use persisted log fields first, then fallback to slot
                                  if ((log as any).proposedStartDate && (log as any).proposedEndDate) {
                                    const logProposedStart = new Date((log as any).proposedStartDate);
                                    const logProposedEnd = new Date((log as any).proposedEndDate);
                                    if (!isNaN(logProposedStart.getTime()) && !isNaN(logProposedEnd.getTime())) {
                                      proposedStr = formatDateWS({ startDate: logProposedStart, endDate: logProposedEnd });
                                    }
                                  } else if (slot?.proposed?.startDate && slot?.proposed?.endDate) {
                                    proposedStr = formatDateWS({
                                      startDate: new Date(slot.proposed.startDate),
                                      endDate: new Date(slot.proposed.endDate)
                                    });
                                  } else if (slot?.proposed && slot?.startDate && slot?.endDate) {
                                    // proposed object exists but missing explicit proposed dates: treat slot dates as proposed
                                    proposedStr = formatDateWS({
                                      startDate: new Date(slot.startDate),
                                      endDate: new Date(slot.endDate)
                                    });
                                  }

                                  // Current always from actual slot top-level
                                  if (slot?.startDate && slot?.endDate) {
                                    currentStr = formatDateWS({
                                      startDate: new Date(slot.startDate),
                                      endDate: new Date(slot.endDate)
                                    });
                                  } else {
                                    const s = (log as any).startDate ? new Date((log as any).startDate) : null;
                                    const e = (log as any).endDate ? new Date((log as any).endDate) : null;
                                    if (s && e && !isNaN(s.getTime()) && !isNaN(e.getTime())) {
                                      currentStr = formatDateWS({ startDate: s as Date, endDate: e as Date });
                                    }
                                  }

                                  return (
                                    <>
                                      <LabeledRow icon={FiClock} label="Proposed" value={proposedStr ?? "—"} />
                                      <LabeledRow icon={FiClock} label="Current" value={currentStr ?? "—"} />
                                      {/* Optional debug badge showing link source (remove in prod) */}
                                      {process.env.NODE_ENV === 'development' && linkSource && (
                                        <Badge colorScheme="blue" rounded="full">{linkSource}</Badge>
                                      )}
                                    </>
                                  );
                                })()}
                              </HStack>
                            </VStack>
                          </HStack>
                        ))}
                        {contactedSlim && contactedSlim.length > 1 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            colorScheme="blue"
                            onClick={() => setShowAllContacts(!showAllContacts)}
                            w="full"
                          >
                            {showAllContacts ? 'Show less' : `Show ${contactedSlim.length - 1} more`}
                          </Button>
                        )}
                      </VStack>
                    )}
                  </SectionCard>
                  </VStack>

                  {/* Columna derecha - Patient Availability & Google Reviews */}
                  <VStack align="stretch" spacing={5}>
                    {/* Patient Availability */}
                    <SectionCard 
                      title={
                        <HStack>
                          <Icon as={FiCalendar} />
                          <Text>Patient Availability</Text>
                        </HStack>
                      }
                      right={
                        !isEditingAvailability && (
                          <Button
                            size="sm"
                            leftIcon={<Icon as={FiEdit2} />}
                            colorScheme="blue"
                            variant="ghost"
                            onClick={handleEditAvailability}
                            isDisabled={isUpdating}
                          >
                            Edit
                          </Button>
                        )
                      }
                    >
                      {isEditingAvailability && editingAvailability !== null ? (
                        <VStack align="stretch" spacing={4}>
                          <AvailabilityDates2
                            value={editingAvailability}
                            onChange={(value: SelectedDatesValue) => {
                              console.log('📥 AppointmentModal received onChange:', value);
                              // El componente AvailabilityDates2 ya maneja internamente la actualización
                              // Solo necesitamos guardar el valor completo que nos llega
                              const daysState: any = {};
                              value.days.forEach((day: any) => {
                                // value.days ya contiene los objetos completos de TimeBlock desde AvailabilityDates2
                                if (day.timeBlocks && day.timeBlocks.length > 0) {
                                  daysState[day.weekDay] = day.timeBlocks;
                                }
                              });
                              console.log('💾 Setting editingAvailability to:', daysState);
                              setEditingAvailability(daysState as SelectedDaysState);
                            }}
                            baseStartDate={appointment?.selectedDates?.startDate ? new Date(appointment.selectedDates.startDate) : undefined}
                            initialDuration={appointment?.selectedDates?.startDate && appointment?.selectedDates?.endDate ? 
                              Math.ceil((new Date(appointment.selectedDates.endDate).getTime() - new Date(appointment.selectedDates.startDate).getTime()) / (1000 * 60 * 60 * 24)) as 7 | 14 | 30
                              : 7
                            }
                            showSummary
                            showDurationControl
                            allowDurationChange
                          />
                          <HStack spacing={2} justify="flex-end">
                            <Button size="sm" variant="ghost" onClick={handleCancelAvailability}>
                              Cancel
                            </Button>
                            <Button 
                              size="sm" 
                              colorScheme="blue" 
                              leftIcon={<Icon as={FiCalendar} />} 
                              onClick={() => {
                                if (editingAvailability) {
                                  const days: any = Object.entries(editingAvailability).map(([weekDay, timeBlocks]) => ({
                                    weekDay,
                                    timeBlocks: (timeBlocks ?? []).map((b: any) => ({ _id: b._id ?? "" })),
                                  }));
                                  
                                  const startDate = appointment?.selectedDates?.startDate ? new Date(appointment.selectedDates.startDate) : new Date();
                                  const duration = appointment?.selectedDates?.startDate && appointment?.selectedDates?.endDate ? 
                                    Math.ceil((new Date(appointment.selectedDates.endDate).getTime() - new Date(appointment.selectedDates.startDate).getTime()) / (1000 * 60 * 60 * 24))
                                    : 7;
                                  const endDate = new Date(startDate);
                                  endDate.setDate(endDate.getDate() + duration);
                                  
                                  handleSaveAvailability({
                                    startDate,
                                    endDate,
                                    days,
                                  });
                                }
                              }}
                              isLoading={isUpdating}
                            >
                              Save Changes
                            </Button>
                          </HStack>
                        </VStack>
                      ) : (
                        <AvailabilityDates2
                          value={(() => {
                            if (!appointment?.selectedDates?.days) return {};
                            const daysState: any = {};
                            appointment.selectedDates.days.forEach((day: any) => {
                              if (day.timeBlocks && day.timeBlocks.length > 0) {
                                daysState[day.weekDay] = day.timeBlocksData || day.timeBlocks;
                              }
                            });
                            return daysState as SelectedDaysState;
                          })()}
                          onChange={() => {}}
                          baseStartDate={appointment?.selectedDates?.startDate ? new Date(appointment.selectedDates.startDate) : undefined}
                          readOnly
                          showSummary
                        />
                      )}
                    </SectionCard>

                    <SectionCard
                    title={
                      <HStack>
                        <Icon as={FaStar} />
                        <Text>Google Reviews</Text>
                      </HStack>
                    }
                    right={(() => {
                      const list = reviewRequests ?? [];
                      const total = list.length;
                      const sent = list.filter((r: any) => r.status === 'sent' || r.status === 'delivered').length;
                      const clicked = list.filter((r: any) => r.status === 'clicked').length;
                      const reviewed = list.filter((r: any) => r.status === 'reviewed').length;
                      const failed = list.filter((r: any) => r.status === 'failed').length;
                      return (
                        <HStack spacing={2}>
                          <Badge rounded="full" colorScheme="blue">{total} requests</Badge>
                          {sent > 0 && <Badge rounded="full" colorScheme="green">{sent} sent</Badge>}
                          {clicked > 0 && <Badge rounded="full" colorScheme="purple">{clicked} clicked</Badge>}
                          {reviewed > 0 && <Badge rounded="full" colorScheme="yellow">{reviewed} reviewed</Badge>}
                          {failed > 0 && <Badge rounded="full" colorScheme="red">{failed} failed</Badge>}
                        </HStack>
                      );
                    })()}
                  >
                    {!reviewRequests || reviewRequests.length === 0 ? (
                      <Text>No review requests sent yet</Text>
                    ) : (
                      <VStack align="stretch" spacing={3}>
                        {reviewRequests.slice(0, showAllReviews ? undefined : 1).map((request: any, idx: number) => {
                          const statusColorMap: Record<string, string> = {
                            pending: 'gray',
                            sent: 'blue',
                            delivered: 'green',
                            clicked: 'purple',
                            reviewed: 'yellow',
                            failed: 'red',
                          };
                          const statusColor = statusColorMap[request.status] ?? 'gray';
                          
                          return (
                            <HStack
                              key={request._id ?? idx}
                              align="flex-start"
                              border="1px solid"
                              borderColor={border}
                              rounded="lg"
                              p={3}
                              justify="space-between"
                            >
                              <VStack align="start" spacing={2} flex={1}>
                                <HStack spacing={2} flexWrap="wrap">
                                  <Badge rounded="xl" px={2} py={1} colorScheme={statusColor} fontSize="xs" fontWeight="bold" textTransform="uppercase">
                                    {request.status}
                                  </Badge>
                                  {request.reviewRating && (
                                    <Badge rounded="xl" px={2} py={1} colorScheme="yellow" fontSize="xs">
                                      {request.reviewRating}★
                                    </Badge>
                                  )}
                                </HStack>
                                
                                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3} w="full">
                                  <LabeledRow
                                    icon={FiClock}
                                    label="Requested"
                                    value={request.requestedAt ? format(new Date(request.requestedAt), 'MMM dd, yyyy HH:mm') : '—'}
                                  />
                                  
                                  {request.sentAt && (
                                    <LabeledRow
                                      icon={FiClock}
                                      label="Sent"
                                      value={format(new Date(request.sentAt), 'MMM dd, yyyy HH:mm')}
                                    />
                                  )}
                                  
                                  {request.clickedAt && (
                                    <LabeledRow
                                      icon={FiClock}
                                      label="Clicked"
                                      value={format(new Date(request.clickedAt), 'MMM dd, yyyy HH:mm')}
                                    />
                                  )}
                                  
                                  {request.reviewedAt && (
                                    <LabeledRow
                                      icon={FaStar}
                                      label="Reviewed"
                                      value={format(new Date(request.reviewedAt), 'MMM dd, yyyy HH:mm')}
                                    />
                                  )}
                                </SimpleGrid>

                                {request.errorMessage && (
                                  <Box
                                    bg="red.50"
                                    border="1px solid"
                                    borderColor="red.200"
                                    rounded="md"
                                    p={2}
                                    w="full"
                                  >
                                    <Text fontSize="xs" color="red.700">
                                      Error: {request.errorMessage}
                                    </Text>
                                  </Box>
                                )}
                              </VStack>
                            </HStack>
                          );
                        })}
                        {reviewRequests && reviewRequests.length > 1 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            colorScheme="blue"
                            onClick={() => setShowAllReviews(!showAllReviews)}
                            w="full"
                          >
                            {showAllReviews ? 'Show less' : `Show ${reviewRequests.length - 1} more`}
                          </Button>
                        )}
                      </VStack>
                    )}
                  </SectionCard>
                  </VStack>
                </SimpleGrid>
              </VStack>
            )}
          </ModalBody>

          {/* Footer */}
          <ModalFooter>
            <HStack w="full" justify="space-between">
              <HStack color={sub}>
                <FiInfo />
              </HStack>
              <HStack>
                <Button variant="ghost" onClick={onClose}>
                  Close
                </Button>
              </HStack>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* — Modal del Provider en lazy load — */}
      {selectedProvider && (
        <Suspense
          fallback={
            <Modal isOpen={isProviderOpen} onClose={() => { }} isCentered>
              <ModalOverlay />
              <ModalContent>
                <ModalBody p={6}>
                  <VStack align="stretch" spacing={3}>
                    <Skeleton h="24px" />
                    <Skeleton h="18px" />
                    <Skeleton h="240px" />
                  </VStack>
                </ModalBody>
              </ModalContent>
            </Modal>
          }
        >
          <ProviderSummaryModalLazy
            isOpen={isProviderOpen}
            onClose={() => {
              onProviderClose();
              setSelectedProvider(null);
              // 👇 Si quieres que al cerrar Provider se reabra el Appointment,
              //     no toques nada: al quedar isProviderOpen=false, este modal vuelve a abrirse
              //     automáticamente por la condición (isTopOpen && !isProviderOpen).
            }}
            provider={selectedProvider}
          />
        </Suspense>
      )}

      {/* — Modal del Tutor (representante) en lazy load — */}
      {rep && (
        <Suspense
          fallback={
            <Modal isOpen={isRepOpen} onClose={() => { }} isCentered>
              <ModalOverlay />
              <ModalContent>
                <ModalBody p={6}>
                  <VStack align="stretch" spacing={3}>
                    <Skeleton h="24px" />
                    <Skeleton h="18px" />
                    <Skeleton h="240px" />
                  </VStack>
                </ModalBody>
              </ModalContent>
            </Modal>
          }
        >
          <AppointmentModalLazy id={String(rep._id || '')} isOpen={isRepOpen} onClose={onRepClose} />
        </Suspense>
      )}
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog
        isOpen={isDeleteOpen}
        leastDestructiveRef={cancelRef}
        onClose={onDeleteClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Appointment Slot
            </AlertDialogHeader>
            
            <AlertDialogBody>
              Are you sure you want to delete this slot? This action cannot be undone.
            </AlertDialogBody>
            
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDeleteClose}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={confirmDeleteSlot} ml={3}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
};

export default memo(PremiumAppointmentModal);
