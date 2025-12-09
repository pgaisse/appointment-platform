import React, { useMemo, useState, useEffect } from 'react';
import {
  Box,
  HStack,
  Icon,
  Text,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  VStack,
  Badge,
  useColorModeValue,
} from '@chakra-ui/react';
import { FiCalendar } from 'react-icons/fi';
import { DateRange } from '@/types';
import { AppointmentSlot } from '../Modal/AppointmentModal';
import { pickDisplaySlot } from '@/Functions/getLatestSelectedAppDate';
import AppointmentSlotEditorModal from '../CustomTemplates/AppointmentSlotEditorModal';

// Helpers
const deduplicateAndSortSlots = (slots: AppointmentSlot[]): AppointmentSlot[] => {
  if (!slots?.length) return [];

  const updatedAtTs = (s: AppointmentSlot): number => {
    if (s?.updatedAt) {
      const t = new Date(s.updatedAt).getTime();
      return Number.isFinite(t) ? t : 0;
    }
    return 0;
  };

  const sorted = [...slots].sort((a, b) => updatedAtTs(b) - updatedAtTs(a));
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

interface SelectedAppointmentDatesProps {
  appointmentId: string;
  initialSlotId?: string;
  slots: AppointmentSlot[];
  onSlotChange?: (slotGlobalIndex: number, updates: Partial<DateRange>) => void;
  onSlotDelete?: (slot: AppointmentSlot) => void;
  isUpdating?: boolean;
}

export const SelectedAppointmentDates: React.FC<SelectedAppointmentDatesProps> = ({
  appointmentId,
  initialSlotId,
  slots,
  onSlotChange,
  isUpdating = false,
}) => {
  const slotDateBg = useColorModeValue("gray.50", "gray.800");
  const slotDateBorder = useColorModeValue("gray.200", "gray.600");
  const slotDateTextColor = useColorModeValue("gray.600", "gray.300");

  // Deduplicate and sort slots, but ensure the slot matching initialSlotId
  // is placed first so that the first tab always corresponds to that slot.
  const dedupedSlots = useMemo(() => {
    const base = deduplicateAndSortSlots(slots ?? []);
    if (!initialSlotId || base.length === 0) return base;

    const idx = base.findIndex((slot) => String(slot?._id ?? "") === initialSlotId);
    if (idx <= 0) return base;

    const copy = [...base];
    const [target] = copy.splice(idx, 1);
    copy.unshift(target);
    return copy;
  }, [slots, initialSlotId]);

  const displaySlot = useMemo(
    () => pickDisplaySlot(dedupedSlots as any),
    [dedupedSlots]
  );

  // State for controlled tab (first tab always active)
  const [tabIndex, setTabIndex] = useState(0);

  // When the slots list changes (including reordering by initialSlotId),
  // reset to the first tab so it matches the selected slot.
  useEffect(() => {
    setTabIndex(0);
  }, [dedupedSlots.length, initialSlotId]);

  if (dedupedSlots.length === 0) {
    return <Text>No appointment dates found</Text>;
  }

  return (
    <Tabs isLazy colorScheme="purple" w="full" index={tabIndex} onChange={(index) => setTabIndex(index)}>
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
                  <Badge colorScheme="purple" fontSize="xs">Latest</Badge>
                )}
              </HStack>
            </Tab>
          );
        })}
      </TabList>
      
      <TabPanels>
        {dedupedSlots.map((slot, idx) => {
          const dateRange = {
            startDate: (() => {
              try {
                const d = slot?.startDate ? new Date(slot.startDate) : new Date();
                return isNaN(d.getTime()) ? new Date() : d;
              } catch {
                return new Date();
              }
            })(),
            endDate: (() => {
              try {
                const d = slot?.endDate ? new Date(slot.endDate) : new Date();
                return isNaN(d.getTime()) ? new Date() : d;
              } catch {
                return new Date();
              }
            })(),
            treatment: (() => {
              const t = slot?.treatment;
              if (!t) return undefined;
              if (typeof t === 'string') return t;
              if (typeof t === 'object' && t._id) return String(t._id);
              return undefined;
            })(),
            priority: (() => {
              const p = slot?.priority;
              if (!p) return undefined;
              if (typeof p === 'string') return p;
              if (typeof p === 'object' && p._id) return String(p._id);
              return undefined;
            })(),
            providers: (slot?.providers ?? []).map(p => {
              if (typeof p === 'string') return p;
              if (typeof p === 'object' && p?._id) return String(p._id);
              return null;
            }).filter((p): p is string => p !== null),
            duration: (() => {
              const slotAny = slot as any;
              if (slotAny?.duration && !isNaN(Number(slotAny.duration))) {
                return Math.round(Number(slotAny.duration));
              }
              
              if (slot?.startDate && slot?.endDate) {
                try {
                  const start = new Date(slot.startDate).getTime();
                  const end = new Date(slot.endDate).getTime();
                  const minutes = Math.round((end - start) / (1000 * 60));
                  if (!isNaN(minutes) && minutes > 0) return minutes;
                } catch {}
              }
              
              const treatment = slot?.treatment;
              if (treatment && typeof treatment === 'object' && treatment.duration) {
                const dur = Number(treatment.duration);
                if (!isNaN(dur)) return Math.round(dur);
              }
              
              return 60;
            })(),
            labels: (() => {
              const slotAny = slot as any;
              if (!slotAny?.labels || !Array.isArray(slotAny.labels)) return [];
              return slotAny.labels.map((l: any) => {
                if (typeof l === 'string') return l;
                if (typeof l === 'object' && l?.id) return String(l.id);
                return null;
              }).filter((id: any): id is string => typeof id === 'string' && id.length > 0);
            })(),
          };

          return (
            <TabPanel key={slot?._id ?? idx} px={0} pt={4}>
              <VStack align="stretch" spacing={4}>
                <Box
                  bg={slotDateBg}
                  border="1px solid"
                  borderColor={slotDateBorder}
                  rounded="lg"
                  p={4}
                >
                  <HStack justify="space-between" mb={3}>
                    <HStack>
                      <Icon as={FiCalendar} color={slotDateTextColor} />
                      <Text fontWeight="semibold" color={slotDateTextColor}>
                        Slot #{idx + 1}
                      </Text>
                    </HStack>
                    {slot?.status && (
                      <Badge
                        colorScheme={SLOT_STATUS_COLOR[slot.status.toLowerCase()] || 'gray'}
                        rounded="full"
                      >
                        {slot.status}
                      </Badge>
                    )}
                  </HStack>

                  <AppointmentSlotEditorModal
                    mode="EDITION"
                    tz="Australia/Sydney"
                    selectedAppDates={[dateRange]}
                    onSlotChange={(_slotIndex, updates) => {
                      // _slotIndex será siempre 0 porque solo pasamos un slot
                      if (onSlotChange) {
                        onSlotChange(idx, updates);
                      }
                    }}
                    appointmentId={appointmentId}
                    formBusy={isUpdating}
                    onPendingAssignmentsChange={() => {}}
                  />
                </Box>
              </VStack>
            </TabPanel>
          );
        })}
      </TabPanels>
    </Tabs>
  );
};
