// apps/frontend/src/Components/Provider/ProviderSummaryModal.tsx
import React, { useMemo, useState } from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Box,
  HStack,
  VStack,
  Grid,
  GridItem,
  Text,
  Tag,
  Badge,
  Button,
  Avatar,
  Divider,
  Tooltip,
  IconButton,
  useToast,
  Stat,
  StatLabel,
  StatNumber,
  SimpleGrid,
  Input,
  InputGroup,
  InputLeftElement,
  Skeleton,
  Card,
  CardBody,
  CardHeader,
  useColorModeValue,
  Tabs,
  Tab,
  TabList,
  TabPanels,
  TabPanel,
  Heading,
  Kbd,
  Switch,
  Spacer,
  useDisclosure,
  Collapse,
  ButtonGroup,
  Portal,
} from "@chakra-ui/react";
import {
  EmailIcon,
  PhoneIcon,
  TimeIcon,
  CalendarIcon,
  CopyIcon,
  InfoOutlineIcon,
} from "@chakra-ui/icons";

import { useProviderSchedule } from "@/Hooks/Query/useProviders";
import { useMeta, type Treatment } from "@/Hooks/Query/useMeta";
import { useProviderAppointments, useProviderTimeOff } from "@/Hooks/Query/useProviderAppointments";

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
dayjs.extend(utc);
dayjs.extend(timezone);

// Calendario
import SmartCalendar, { titleCase, type CalendarEvent as SmartEvent } from "@/Components/Scheduler/SmartCalendar";
import { Provider } from "@/types";
import AppointmentModal from "../Modal/AppointmentModal";
import { useModalIndex } from "../ModalStack/ModalStackContext";
import { formatAustralianMobile } from "@/Functions/formatAustralianMobile";

/* ====================================================================== */
/* Tipos y constantes                                                      */
/* ====================================================================== */
type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
type HHMM = `${number}${number}:${number}${number}`;
type HoursBlock = { start: HHMM; end: HHMM };
type WeeklyHours = Partial<Record<DayKey, HoursBlock[]>>;

const DAY_LABELS: Record<DayKey, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

const SYD_TZ = "Australia/Sydney";

/* Colores de Time Off (tokens Chakra) */
const TIME_OFF_COLOR_TOKEN = {
  PTO: "red.300",
  Sick: "orange.300",
  Course: "blue.300",
  PublicHoliday: "purple.300",
  Block: "gray.400",
  default: "red.300",
} as const;

/* ====================================================================== */
/* Helpers                                                                */
/* ====================================================================== */
function formatDateSydney12h(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-AU", {
    timeZone: SYD_TZ,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}
function formatRangeLocal(start?: Date | string, end?: Date | string) {
  if (!start || !end) return "—";
  const s = new Date(start);
  const e = new Date(end);
  const f = (d: Date) =>
    d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  return `${f(s)} – ${f(e)}`;
}
function sydneyWeekRangeUtc(anchor: Date) {
  const a = dayjs(anchor).tz(SYD_TZ);
  const mondayStartSYD = a.startOf("week").add(1, "day").hour(0).minute(0).second(0).millisecond(0);
  const sundayEndSYD = mondayStartSYD.add(6, "day").hour(23).minute(59).second(59).millisecond(999);
  return {
    fromUtc: mondayStartSYD.utc().toISOString(),
    toUtc: sundayEndSYD.utc().toISOString(),
    fromLocalInput: mondayStartSYD.local().format("YYYY-MM-DDTHH:mm"),
    toLocalInput: sundayEndSYD.local().format("YYYY-MM-DDTHH:mm"),
  };
}
function hhmmToMinutes(v: string) {
  if (typeof v !== "string") return 0;
  const [h, m] = v.split(":");
  const hh = Number(h ?? 0) || 0;
  const mm = Number(m ?? 0) || 0;
  return hh * 60 + mm;
}
function minutesTo12h(mins: number) {
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const h = ((h24 + 11) % 12) + 1;
  const ampm = h24 < 12 ? "AM" : "PM";
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}
function hourLabel12h(h24: number) {
  const h12 = ((h24 + 11) % 12) + 1;
  const ampm = h24 < 12 ? "AM" : "PM";
  return `${h12}\u00A0${ampm}`;
}

/**
 * Expande un time-off (rango) en eventos por día (00:00→24:00 en TZ proveedor),
 * pero los **recorta** a la ventana visible del calendario (por ej. 6→22) y
 * devuelve fechas en la TZ del calendario (navegador). Sin `allDay`.
 */
function expandTimeOffToDailyEventsClamped(
  items: Array<{ _id: string; kind?: string; start: string; end: string; reason?: string }>,
  providerTz: string,
  calendarTz: string,
  viewStartHour: number,
  viewEndHour: number
): SmartEvent[] {
  const out: SmartEvent[] = [];

  for (const t of items || []) {
    const kind = t.kind || "Time off";
    const color =
      TIME_OFF_COLOR_TOKEN[kind as keyof typeof TIME_OFF_COLOR_TOKEN] ??
      TIME_OFF_COLOR_TOKEN.default;

    const startSYD = dayjs(t.start).tz(providerTz);
    const endSYD = dayjs(t.end).tz(providerTz);
    const safeEndSYD = endSYD.isAfter(startSYD) ? endSYD : startSYD.add(1, "minute");

    let cursor = startSYD.startOf("day");
    const lastInclusive = safeEndSYD.subtract(1, "millisecond").startOf("day");

    while (cursor.isBefore(lastInclusive) || cursor.isSame(lastInclusive)) {
      // Día en calendario local
      const dayCal = cursor.tz(calendarTz).startOf("day");
      const visibleStartCal = dayCal.hour(viewStartHour).minute(0).second(0).millisecond(0);
      const visibleEndCal = dayCal.hour(viewEndHour).minute(0).second(0).millisecond(0);

      if (visibleEndCal.isAfter(visibleStartCal)) {
        out.push({
          id: `to-${t._id}-${cursor.format("YYYYMMDD")}`,
          title: `Time Off • ${kind}${t.reason ? ` – ${t.reason}` : ""}`,
          start: visibleStartCal.toDate(),
          end: visibleEndCal.toDate(),
          color, // rojo / token por tipo
        });
      }

      cursor = cursor.add(1, "day");
    }
  }

  return out;
}

/* ====================================================================== */
/* Cursor Tooltip (montado en document.body)                               */
/* ====================================================================== */
function CursorTooltip({
  visible,
  x,
  y,
  children,
}: {
  visible: boolean;
  x: number;
  y: number;
  children: React.ReactNode;
}) {
  if (!visible) return null;

  const OFFSET = 12;
  const MAX_W = 320;
  const MAX_H = 140;

  const vw = typeof window !== "undefined" ? window.innerWidth : 0;
  const vh = typeof window !== "undefined" ? window.innerHeight : 0;

  let left = x + OFFSET;
  let top = y + OFFSET;

  if (left + MAX_W > vw) left = Math.max(8, vw - MAX_W - 8);
  if (top + MAX_H > vh) top = Math.max(8, vh - MAX_H - 8);

  return (
    // Montado fuera del portal del Modal:
    <Portal appendToParentPortal={false}>
      <Box
        position="fixed"
        left={left}
        top={top}
        pointerEvents="none"
        bg="gray.800"
        color="white"
        px={3}
        py={2}
        fontSize="sm"
        borderRadius="md"
        boxShadow="xl"
        zIndex={2000}
        maxW={`${MAX_W}px`}
        transform="translate3d(0,0,0)"
      >
        {children}
      </Box>
    </Portal>
  );
}

/* ====================================================================== */
/* Weekly Working Hours (read-only)                                       */
/* ====================================================================== */
function WeeklyWorkingHours({
  week,
  startHour = 6,
  endHour = 22,
  color = "teal.400",
}: {
  week: WeeklyHours;
  startHour?: number;
  endHour?: number;
  color?: string;
}) {
  const border = useColorModeValue("gray.200", "whiteAlpha.300");
  const trackBg = useColorModeValue("gray.50", "whiteAlpha.100");
  const labelColor = useColorModeValue("gray.600", "gray.300");

  const totalMinutes = (endHour - startHour) * 60;
  const tickHours = useMemo(() => {
    const arr: number[] = [];
    for (let h = startHour; h <= endHour; h += 2) arr.push(h);
    return arr;
  }, [startHour, endHour]);

  return (
    <VStack align="stretch" spacing={2}>
      <HStack>
        <Heading size="sm">Working schedule</Heading>
        <Spacer />
        <HStack fontSize="xs" color={labelColor}>
          <Kbd>read-only</Kbd>
          <Text>&nbsp;· Australia/Sydney</Text>
        </HStack>
      </HStack>

      {/* Top scale */}
      <Box position="relative" pl="70px" pr="8px">
        <HStack justify="space-between" fontSize="xs" color={labelColor}>
          {tickHours.map((h) => (
            <Text
              key={h}
              minW="44px"
              textAlign="center"
              whiteSpace="nowrap"
              lineHeight="1"
              sx={{ fontVariantNumeric: "tabular-nums" }}
            >
              {hourLabel12h(h)}
            </Text>
          ))}
        </HStack>
      </Box>

      {/* Rows */}
      {(["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as DayKey[]).map((dk) => {
        const blocks = week[dk] || [];
        return (
          <HStack key={dk} align="center" spacing={3}>
            <Box w="60px" textAlign="right" fontSize="sm" color={labelColor}>
              {DAY_LABELS[dk]}
            </Box>
            <Box
              flex="1"
              h="28px"
              position="relative"
              borderRadius="md"
              borderWidth="1px"
              borderColor={border}
              bg={trackBg}
              overflow="hidden"
            >
              {blocks.length === 0 ? (
                <Text position="absolute" left="8px" top="4px" fontSize="xs" color={labelColor}>
                  Off
                </Text>
              ) : (
                blocks.map((b, i) => {
                  const leftPct =
                    ((hhmmToMinutes(b.start) - startHour * 60) / totalMinutes) * 100;
                  const widthPct =
                    ((hhmmToMinutes(b.end) - hhmmToMinutes(b.start)) / totalMinutes) * 100;
                  return (
                    <Tooltip
                      key={i}
                      label={`${minutesTo12h(hhmmToMinutes(b.start))} – ${minutesTo12h(
                        hhmmToMinutes(b.end)
                      )}`}
                      hasArrow
                    >
                      <Box
                        position="absolute"
                        left={`${Math.max(0, leftPct)}%`}
                        width={`${Math.max(0, Math.min(100 - leftPct, widthPct))}%`}
                        top="3px"
                        bottom="3px"
                        borderRadius="md"
                        bg={color}
                        opacity={0.9}
                      />
                    </Tooltip>
                  );
                })
              )}
            </Box>
            <Box w="180px" fontSize="xs" color={labelColor} textAlign="left">
              {blocks.length
                ? blocks
                    .map(
                      (b) =>
                        `${minutesTo12h(hhmmToMinutes(b.start))} – ${minutesTo12h(
                          hhmmToMinutes(b.end)
                        )}`
                    )
                    .join("  ·  ")
                : "—"}
            </Box>
          </HStack>
        );
      })}
    </VStack>
  );
}

/* ====================================================================== */
/* Section                                                                 */
/* ====================================================================== */
function Section({
  title,
  help,
  children,
}: {
  title: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <VStack align="stretch" spacing={2}>
      <HStack>
        <Text fontWeight="semibold">{title}</Text>
        {help && (
          <Tooltip label={help} placement="top" hasArrow>
            <Box as={InfoOutlineIcon} color="gray.500" />
          </Tooltip>
        )}
      </HStack>
      <Box>{children}</Box>
    </VStack>
  );
}

function useTreatmentIndex(external?: Treatment[]) {
  const { treatments: data } = useMeta();
  return useMemo(() => {
    const list = external ?? data ?? [];
    const byId = new Map<string, Treatment>();
    for (const t of list) byId.set(String((t as any).id ?? (t as any)._id), t);
    return byId;
  }, [external, data]);
}

/* ====================================================================== */
/* Modal principal                                                         */
/* ====================================================================== */
export type ProviderSummaryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  provider: Provider | null | undefined;
  treatments?: Treatment[];
  onEdit?: (provider: Provider) => void;
};

export default function ProviderSummaryModal({
  isOpen,
  onClose,
  provider,
  treatments,
  onEdit,
}: ProviderSummaryModalProps) {
  const toast = useToast();
  const border = useColorModeValue("gray.100", "whiteAlpha.300");
  const timeOffHoverBg = useColorModeValue("red.50", "whiteAlpha.100");
  const tIndex = useTreatmentIndex(treatments);

  const fullName = provider ? `${provider.firstName ?? ""} ${provider.lastName ?? ""}`.trim() : "";
  const { isOpen: isOpenApp, onOpen: onOpenApp, onClose: onCloseApp } = useDisclosure();

  const stackId = React.useMemo(
    () => `provider-summary-modal-${provider?._id ?? "unknown"}`,
    [provider?._id]
  );
  const { modalIndex, topModalIndex } = useModalIndex(isOpen, { id: stackId });
  const isTopOpen = isOpen && modalIndex === topModalIndex;

  const skillTags = useMemo(() => {
    const ids = (provider?.skills ?? []).map(String);
    return ids
      .map((id) => tIndex.get(id))
      .filter((t): t is Treatment => !!t)
      .map((t) => (
        <Tag
          key={String((t as any).id ?? (t as any)._id)}
          size="sm"
          borderRadius="md"
          mr={2}
          mb={2}
          bg={`${(t as any).color}.500` || undefined}
          color={(t as any).color ? "white" : undefined}
        >
          {t.name}
        </Tag>
      ));
  }, [provider?.skills, tIndex]);

  const copy = async (text?: string, label?: string) => {
    try {
      if (!text) return;
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied",
        description: label ? `${label}: ${text}` : text,
        status: "success",
        duration: 1200,
      });
    } catch {
      toast({ title: "Clipboard not available", status: "warning" });
    }
  };

  /* ================= Rango (aware Sydney) =================== */
  const [weekAnchor, setWeekAnchor] = useState<Date>(() => new Date());
  const weekRange = useMemo(() => sydneyWeekRangeUtc(weekAnchor), [weekAnchor]);

  const [rangeLocal, setRangeLocal] = useState<{ from: string; to: string }>(() => ({
    from: weekRange.fromLocalInput,
    to: weekRange.toLocalInput,
  }));
  React.useEffect(() => {
    setRangeLocal({ from: weekRange.fromLocalInput, to: weekRange.toLocalInput });
  }, [weekRange.fromLocalInput, weekRange.toLocalInput]);

  const weekParams = useMemo(
    () => ({
      from: dayjs(rangeLocal.from).toDate().toISOString(),
      to: dayjs(rangeLocal.to).toDate().toISOString(),
    }),
    [rangeLocal]
  );

  /* ================= Schedule ==================== */
  const { data: schedule, isFetching: scheduleLoading } = useProviderSchedule(provider?._id);
  const weeklyFromSchedule: WeeklyHours = useMemo(() => {
    const src = (schedule as any)?.weekly || {};
    const out: WeeklyHours = {};
    (Object.keys(DAY_LABELS) as DayKey[]).forEach((d) => {
      const arr = Array.isArray(src?.[d]) ? src[d] : [];
      out[d] = (arr as any[]).map((b) => ({ start: b.start, end: b.end }));
    });
    return out;
  }, [schedule]);

  /* ================= Appointments + TimeOff ======================== */
  const {
    data: appts,
    isFetching: apptsLoading,
    error: apptsError,
  } = useProviderAppointments(provider?._id, weekParams);

  const { data: timeOff = [], isFetching: timeOffLoading } = useProviderTimeOff(
    provider?._id,
    { from: weekParams.from, to: weekParams.to }
  );

  const apptEvents: SmartEvent[] = useMemo(
    () =>
      (appts || []).map((a: any) => ({
        id: a._id,
        title: a.title || a.patientName || "Appointment",
        start: new Date(a.start),
        end: new Date(a.end),
        color: a?.color || "purple.500",
      })),
    [appts]
  );

  // Time off como “bloques” por día recortados a la ventana visible
  const CAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "Australia/Sydney";
  const VIEW_START = 6;
  const VIEW_END = 22;

  const timeOffDayEvents: SmartEvent[] = useMemo(
    () =>
      expandTimeOffToDailyEventsClamped(
        (timeOff as any[]) ?? [],
        SYD_TZ, // proveedor
        CAL_TZ, // calendario
        VIEW_START,
        VIEW_END
      ),
    [timeOff]
  );

  // UI toggles
  const [showAppointments, setShowAppointments] = useState<boolean>(true);
  const [showTimeOff, setShowTimeOff] = useState<boolean>(true);

  // Vista calendario
  type CalView = "week" | "day";
  const [calView, setCalView] = useState<CalView>("week");
  const calendarKey = `${calView}-${dayjs(weekAnchor).format("YYYYMMDD")}`;

  const calendarEvents = useMemo(() => {
    const arr: SmartEvent[] = [];
    if (showAppointments) arr.push(...apptEvents);
    if (showTimeOff) arr.push(...timeOffDayEvents);
    return arr;
  }, [apptEvents, timeOffDayEvents, showAppointments, showTimeOff]);

  const { isOpen: isOpenTreatment, onToggle } = useDisclosure({ defaultIsOpen: false });
  const treatmentsCount = React.Children.count(skillTags);
  const [selectedApptId, setSelectedApptId] = useState<string | null>(null);

  // Estado del tooltip que sigue el cursor
  const [hover, setHover] = useState<{
    show: boolean;
    x: number;
    y: number;
    content: React.ReactNode;
  }>({ show: false, x: 0, y: 0, content: null });

  /* ================= UI ================================================== */
  return (
    <Modal
      isOpen={isTopOpen}
      onClose={onClose}
      size="6xl"
      motionPreset="scale"
      scrollBehavior="inside"
      blockScrollOnMount
      preserveScrollBarGap
      isCentered
      trapFocus
    >
      <ModalOverlay />
      <ModalContent maxH="85vh">
        <ModalHeader>
          <HStack align="center" spacing={4}>
            <Avatar
              name={titleCase(fullName)}
              src={provider?.avatarUrl || undefined}
              bg={provider?.color || undefined}
              size="lg"
            />
            <VStack align="start" spacing={0} flex={1}>
              <Text fontWeight="bold" fontSize="xl">
                {titleCase(fullName) || "Provider"}
              </Text>
              <HStack spacing={2} flexWrap="wrap" mt={1}>
                {provider?.acceptingNewPatients ? (
                  <Badge colorScheme="green">ACCEPTING NEW PATIENTS</Badge>
                ) : (
                  <Badge>Not accepting new</Badge>
                )}
                {provider?.isActive ? (
                  <Badge colorScheme="green">ACTIVE</Badge>
                ) : (
                  <Badge>Inactive</Badge>
                )}
              </HStack>
            </VStack>
            {provider && onEdit && (
              <Button size="sm" onClick={() => onEdit(provider)} variant="outline" colorScheme="teal">
                Edit
              </Button>
            )}
          </HStack>
        </ModalHeader>
        <ModalCloseButton />

        <ModalBody>
          {!provider ? (
            <Text color="gray.500">No provider selected.</Text>
          ) : (
            <VStack align="stretch" spacing={6}>
              {/* KPIs */}
              <SimpleGrid columns={{ base: 2, md: 5 }} spacing={4}>
                <Stat p={3} border="1px solid" borderColor={border} borderRadius="lg">
                  <StatLabel>Default slot</StatLabel>
                  <StatNumber>{provider.defaultSlotMinutes}m</StatNumber>
                </Stat>
                <Stat p={3} border="1px solid" borderColor={border} borderRadius="lg">
                  <StatLabel>Buffers</StatLabel>
                  <StatNumber>
                    {provider.bufferBefore}/{provider.bufferAfter}m
                  </StatNumber>
                </Stat>
                <Stat p={3} border="1px solid" borderColor={border} borderRadius="lg">
                  <StatLabel>Max overlap</StatLabel>
                  <StatNumber>{provider.maxOverlap ?? 0}</StatNumber>
                </Stat>
                <Stat p={3} border="1px solid" borderColor={border} borderRadius="lg">
                  <StatLabel>Treatments</StatLabel>
                  <StatNumber>{provider.skills?.length ?? 0}</StatNumber>
                </Stat>
                <Stat p={3} border="1px solid" borderColor={border} borderRadius="lg">
                  <StatLabel>Locations</StatLabel>
                  <StatNumber>{provider.locations?.length ?? 0}</StatNumber>
                </Stat>
              </SimpleGrid>

              {/* Contacto + Preferencias + Treatments */}
              <Grid templateColumns={{ base: "1fr", md: "1fr 1fr 1fr" }} gap={8}>
                <GridItem>
                  <Section title="Contact" help="Primary contact methods.">
                    <VStack align="stretch" spacing={2}>
                      <HStack>
                        <EmailIcon />
                        <Text>{provider.email || "—"}</Text>
                        {provider.email && (
                          <Tooltip label="Copy email">
                            <IconButton
                              aria-label="copy email"
                              size="xs"
                              icon={<CopyIcon />}
                              onClick={() => copy(provider.email, "Email")}
                            />
                          </Tooltip>
                        )}
                      </HStack>
                      <HStack>
                        <PhoneIcon />
                        <Text>{provider.phone ? formatAustralianMobile(provider.phone) : "—"}</Text>
                        {provider.phone && (
                          <Tooltip label="Copy phone">
                            <IconButton
                              aria-label="copy phone"
                              size="xs"
                              icon={<CopyIcon />}
                              onClick={() => copy(provider.phone, "Phone")}
                            />
                          </Tooltip>
                        )}
                      </HStack>
                    </VStack>
                  </Section>
                </GridItem>

                <GridItem>
                  <Section title="Preferences" help="Defaults used to build appointments.">
                    <VStack align="stretch" spacing={2}>
                      <HStack>
                        <TimeIcon />
                        <Text>
                          Default slot: <b>{provider.defaultSlotMinutes}</b> min
                        </Text>
                      </HStack>
                      <HStack>
                        <CalendarIcon />
                        <Text>
                          Buffers: <b>{provider.bufferBefore}</b> / <b>{provider.bufferAfter}</b> min
                        </Text>
                      </HStack>
                      <HStack>
                        <Text>
                          Max overlap: <b>{provider.maxOverlap ?? 0}</b>
                        </Text>
                      </HStack>
                    </VStack>
                  </Section>
                </GridItem>

                <GridItem>
                  <Section title="Treatments" help="Common procedures performed by this provider.">
                    <HStack justify="space-between" mb={2}>
                      <Badge
                        variant="solid"
                        cursor="pointer"
                        colorScheme={treatmentsCount ? "teal" : "gray"}
                        borderRadius="lg"
                        px={2}
                        onClick={() => onToggle()}
                      >
                        {treatmentsCount} selected
                      </Badge>
                    </HStack>
                    <Collapse in={isOpenTreatment} animateOpacity>
                      <Box>
                        {treatmentsCount ? (
                          <HstackWrap>{skillTags}</HstackWrap>
                        ) : (
                          <Text color="gray.500">No treatments selected.</Text>
                        )}
                      </Box>
                    </Collapse>
                  </Section>
                </GridItem>
              </Grid>

              <Divider />

              {/* TABS */}
              <Tabs isFitted colorScheme="teal" variant="enclosed-colored" borderRadius="xl">
                <TabList>
                  <Tab>Working schedule</Tab>
                  <Tab>Appointments</Tab>
                  <Tab>Time off</Tab>
                </TabList>
                <TabPanels>
                  {/* === Tab 1: Working schedule === */}
                  <TabPanel>
                    <Card variant="outline">
                      <CardHeader pb={2}>
                        <HStack justify="space-between" align="center">
                          <Text fontWeight="semibold">Weekly view</Text>
                          <Tag>Australia/Sydney</Tag>
                        </HStack>
                      </CardHeader>
                      <CardBody>
                        {scheduleLoading ? (
                          <VStack align="stretch" spacing={2}>
                            <Skeleton h="20px" />
                            <Skeleton h="20px" />
                            <Skeleton h="20px" />
                          </VStack>
                        ) : (
                          <WeeklyWorkingHours
                            week={weeklyFromSchedule}
                            startHour={6}
                            endHour={22}
                            color="teal.400"
                          />
                        )}
                      </CardBody>
                    </Card>
                  </TabPanel>

                  {/* === Tab 2: Appointments (Calendar + time off overlay rojo) === */}
                  <TabPanel>
                    <VStack align="stretch" spacing={3}>
                      {/* Controles de rango + vista */}
                      <HStack wrap="wrap" gap={3}>
                        <InputGroup maxW={{ base: "100%", md: "280px" }}>
                          <InputLeftElement pointerEvents="none">
                            <CalendarIcon />
                          </InputLeftElement>
                          <Input
                            type="datetime-local"
                            value={rangeLocal.from}
                            onChange={(e) =>
                              setRangeLocal((r) => ({ ...r, from: e.target.value }))
                            }
                            aria-label="from"
                          />
                        </InputGroup>
                        <InputGroup maxW={{ base: "100%", md: "280px" }}>
                          <InputLeftElement pointerEvents="none">
                            <CalendarIcon />
                          </InputLeftElement>
                          <Input
                            type="datetime-local"
                            value={rangeLocal.to}
                            onChange={(e) =>
                              setRangeLocal((r) => ({ ...r, to: e.target.value }))
                            }
                            aria-label="to"
                          />
                        </InputGroup>

                        <Spacer />

                        <HStack gap={2}>
                          <Button size="sm" variant="outline" onClick={() => setWeekAnchor(new Date())}>
                            Today
                          </Button>
                          <ButtonGroup isAttached size="sm" variant="outline">
                            <Button
                              onClick={() => setCalView("day")}
                              colorScheme={calView === "day" ? "teal" : undefined}
                            >
                              Day
                            </Button>
                            <Button
                              onClick={() => setCalView("week")}
                              colorScheme={calView === "week" ? "teal" : undefined}
                            >
                              Week
                            </Button>
                          </ButtonGroup>
                        </HStack>
                      </HStack>

                      {/* Toggles de capas */}
                      <HStack justify="space-between" align="center" flexWrap="wrap" gap={2}>
                        <HStack gap={2} fontSize="sm">
                          <Text fontWeight="semibold">Calendar</Text>
                          <Tag colorScheme="purple">Appts: {appts?.length ?? 0}</Tag>
                          <Tag colorScheme="red">Time off: {timeOff?.length ?? 0}</Tag>
                        </HStack>
                        <HStack>
                          <Switch
                            size="sm"
                            isChecked={showAppointments}
                            onChange={(e) => setShowAppointments(e.target.checked)}
                          />
                          <Tag size="sm" colorScheme="purple">Appointments</Tag>
                          <Switch
                            size="sm"
                            isChecked={showTimeOff}
                            onChange={(e) => setShowTimeOff(e.target.checked)}
                          />
                          <Tag size="sm" colorScheme="red">Time off</Tag>
                        </HStack>
                      </HStack>

                      <Card variant="outline">
                        <CardBody>
                          {!!apptsError && (
                            <Text color="red.500" mb={2}>
                              Failed to load appointments.
                            </Text>
                          )}

                          <SmartCalendar
                            key={calendarKey}                 // re-mount en cambio de vista/anchor
                            events={calendarEvents}           // incluye time off en rojo
                            initialDate={weekAnchor}
                            defaultView={calView}
                            startHour={VIEW_START}
                            endHour={VIEW_END}
                            slotMinutes={15}
                            slotHeightPx={32}
                            timeColWidthPx={100}
                            onSelectSlot={(start) => setWeekAnchor(start)}
                            onSelectEvent={(ev) => {
                              const start = new Date(ev.start);
                              setWeekAnchor(start);
                              setSelectedApptId(String(ev.id ?? ""));
                              onOpenApp();
                            }}
                            // 👇 Handlers para tooltip tipo "cursor"
                            onEventMouseEnter={(ev, e) => {
                              setHover({
                                show: true,
                                x: (e as MouseEvent).clientX,
                                y: (e as MouseEvent).clientY,
                                content: (
                                  <Box>
                                    <Text fontWeight="semibold" mb={1}>
                                      {ev.title || "Event"}
                                    </Text>
                                    <Text fontSize="xs">{formatRangeLocal(ev.start, ev.end)}</Text>
                                  </Box>
                                ),
                              });
                            }}
                            onEventMouseMove={(ev, e) => {
                              setHover((h) =>
                                h.show
                                  ? {
                                      ...h,
                                      x: (e as MouseEvent).clientX,
                                      y: (e as MouseEvent).clientY,
                                    }
                                  : h
                              );
                            }}
                            onEventMouseLeave={() => setHover((h) => ({ ...h, show: false }))}
                          />

                          {/* Modal de cita al hacer click */}
                          {selectedApptId && (
                            <AppointmentModal
                              id={selectedApptId}
                              isOpen={isOpenApp}
                              onClose={() => {
                                setSelectedApptId(null);
                                onCloseApp();
                              }}
                            />
                          )}
                        </CardBody>
                      </Card>

                      {/* Tooltip flotante pegado al cursor */}
                      <CursorTooltip visible={hover.show} x={hover.x} y={hover.y}>
                        {hover.content}
                      </CursorTooltip>
                    </VStack>
                  </TabPanel>

                  {/* === Tab 3: Time off (lista) === */}
                  <TabPanel>
                    <VStack align="stretch" spacing={3}>
                      <HStack>
                        <InputGroup maxW={{ base: "100%", md: "280px" }}>
                          <InputLeftElement pointerEvents="none">
                            <CalendarIcon />
                          </InputLeftElement>
                          <Input
                            type="datetime-local"
                            value={rangeLocal.from}
                            onChange={(e) =>
                              setRangeLocal((r) => ({ ...r, from: e.target.value }))
                            }
                            aria-label="from"
                          />
                        </InputGroup>
                        <InputGroup maxW={{ base: "100%", md: "280px" }}>
                          <InputLeftElement pointerEvents="none">
                            <CalendarIcon />
                          </InputLeftElement>
                          <Input
                            type="datetime-local"
                            value={rangeLocal.to}
                            onChange={(e) =>
                              setRangeLocal((r) => ({ ...r, to: e.target.value }))
                            }
                            aria-label="to"
                          />
                        </InputGroup>
                      </HStack>

                      <Card variant="outline">
                        <CardHeader pb={0}>
                          <HStack justify="space-between">
                            <HStack gap={2}>
                              <Text fontWeight="semibold">Time off</Text>
                              <Tag colorScheme="red">{timeOff?.length ?? 0} items</Tag>
                            </HStack>
                            {timeOffLoading && <Skeleton height="16px" width="120px" />}
                          </HStack>
                        </CardHeader>
                        <CardBody>
                          {!timeOffLoading && (!timeOff || timeOff.length === 0) ? (
                            <Text color="gray.500">No time off found for the selected range.</Text>
                          ) : (
                            <VStack align="stretch" spacing={2}>
                              {timeOff.map((t: any) => (
                                <HStack
                                  key={t._id}
                                  p={2}
                                  borderWidth="1px"
                                  borderColor={border}
                                  borderRadius="md"
                                  _hover={{ bg: timeOffHoverBg }}
                                  align="center"
                                  spacing={3}
                                >
                                  <Tag colorScheme="red" minW="92px" justifyContent="center">
                                    {t.kind || "Time off"}
                                  </Tag>
                                  <Text flex={1}>
                                    {formatDateSydney12h(t.start)} – {formatDateSydney12h(t.end)}
                                  </Text>
                                  {t.reason ? <Badge variant="subtle">{t.reason}</Badge> : null}
                                </HStack>
                              ))}
                            </VStack>
                          )}
                        </CardBody>
                      </Card>
                    </VStack>
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </VStack>
          )}
        </ModalBody>

        <ModalFooter>
          <HStack w="full" justify="flex-end">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

/* Utilidad para envolver tags sin romper flex-wrap */
function HstackWrap({ children }: { children: React.ReactNode }) {
  return (
    <HStack spacing={0} flexWrap="wrap">
      {children}
    </HStack>
  );
}
