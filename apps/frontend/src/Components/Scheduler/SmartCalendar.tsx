import React, { useMemo, useCallback, useRef, useState, useEffect } from "react";
import {
  Box,
  Grid,
  GridItem,
  Flex,
  Text,
  HStack,
  IconButton,
  Button,
  Spacer,
  VStack,
  Tooltip,
  Tag,
  useDisclosure,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverBody,
  PopoverArrow,
  PopoverCloseButton,
  Collapse,
  useColorModeValue,
  Portal,
  Divider,
  Badge,
} from "@chakra-ui/react";
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon } from "@chakra-ui/icons";

/* ====================================================================== */
/* Types                                                                  */
/* ====================================================================== */
export type CalendarEvent = {
  id: string | number;
  title: string;
  start: Date | string | number;
  end: Date | string | number;
  color?: string; // Chakra token o css (#hex, rgb, etc.)
};

export type SmartCalendarProps = {
  events: CalendarEvent[];
  initialDate?: Date | string | number;
  defaultView?: "week" | "day";

  /** Granularidad en minutos (equivale a step/timeslots de RBC) */
  slotMinutes?: number;

  /** Altura visual de cada slot en px (densidad) */
  slotHeightPx?: number;

  /** Ancho de columna de horas en px */
  timeColWidthPx?: number;

  /** Alto del header sticky en px */
  stickyHeaderHeightPx?: number;

  /** Panel mini-cal ancho */
  miniWidth?: string;

  /** HH:mm / decimal / entero (prioridad sobre startHour/endHour) */
  startAt?: string | number;
  endAt?: string | number;

  /** Compat heredada (si no pasas startAt/endAt) */
  startHour?: number;
  endHour?: number;

  onSelectEvent?: (ev: CalendarEvent) => void;
  onSelectSlot?: (start: Date, end: Date) => void;
};

/* ====================================================================== */
/* Helpers                                                                */
/* ====================================================================== */
const SYD_TZ = "Australia/Sydney";

const isValidDate = (d: any): d is Date => d instanceof Date && !Number.isNaN(d.getTime());
const toDateSafe = (v: Date | string | number | null | undefined): Date => {
  if (v instanceof Date && isValidDate(v)) return new Date(v);
  const d = new Date(v ?? Date.now());
  return isValidDate(d) ? d : new Date();
};

function toSydneyYMD(d: Date | string | number) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SYD_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(toDateSafe(d));
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const day = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${day}`;
}
function startOfWeekMonday(anyDate: Date | string | number) {
  const x = toDateSafe(anyDate);
  const day = x.getDay(); // 0..6
  const diff = (day + 6) % 7; // desde lunes
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfDay(v: Date | string | number) {
  const d = toDateSafe(v);
  d.setHours(0, 0, 0, 0);
  return d;
}
function sameDay(a: Date | string | number, b: Date | string | number) {
  const da = toDateSafe(a);
  const db = toDateSafe(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}
function minutesSinceStartOfDay(v: Date | string | number) {
  const d = toDateSafe(v);
  const sod = startOfDay(d);
  return Math.max(0, Math.round((d.getTime() - sod.getTime()) / 60000));
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function fmtWeekLabel(anchor: Date) {
  const monday = startOfWeekMonday(anchor);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short" });
  return `${fmt.format(monday)} – ${fmt.format(sunday)}`;
}
function fmtTime(d: Date | string | number) {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: SYD_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(toDateSafe(d));
}

/** Convierte "9:15", "18:45", 9.5, 9 a minutos desde 00:00 */
function toMinutesOfDay(input: string | number): number {
  if (typeof input === "number") return Math.round(input * 60);
  const s = input.trim();
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (m) {
    const h = Math.max(0, Math.min(23, parseInt(m[1], 10)));
    const mm = Math.max(0, Math.min(59, parseInt(m[2] ?? "0", 10)));
    return h * 60 + mm;
  }
  const asNum = Number(s.replace(",", "."));
  return Number.isFinite(asNum) ? Math.round(asNum * 60) : 0;
}

/** Distribuye eventos solapados (por día) en columnas */
function layoutDay(events: CalendarEvent[]) {
  type E = CalendarEvent & {
    _startMin: number;
    _endMin: number;
    _col?: number;
    _cols?: number;
    __group?: number;
  };

  const toMin = (v: Date | string | number) => minutesSinceStartOfDay(v);
  const overlaps = (a: E, b: E) => a._startMin < b._endMin && b._startMin < a._endMin;

  const items: E[] = events
    .map((e) => ({ ...e, _startMin: toMin(e.start), _endMin: toMin(e.end) }))
    .filter((e) => Number.isFinite(e._startMin) && Number.isFinite(e._endMin) && e._endMin > e._startMin)
    .sort((a, b) => a._startMin - b._startMin || a._endMin - b._endMin);

  if (!items.length) return [];

  const groups: E[][] = [];
  let current: E[] = [];
  let active: E[] = [];

  const flushGroup = () => {
    if (current.length) groups.push(current), (current = []), (active = []);
  };

  for (const ev of items) {
    active = active.filter((a) => a._endMin > ev._startMin);
    if (active.length === 0 && current.length) flushGroup();
    current.push(ev);
    active.push(ev);
  }
  flushGroup();

  let groupId = 0;
  for (const group of groups) {
    const colsEnd: number[] = [];
    for (const ev of group) {
      let placed = false;
      for (let i = 0; i < colsEnd.length; i++) {
        if (colsEnd[i] <= ev._startMin) {
          ev._col = i;
          colsEnd[i] = ev._endMin;
          placed = true;
          break;
        }
      }
      if (!placed) {
        ev._col = colsEnd.length;
        colsEnd.push(ev._endMin);
      }
      ev.__group = groupId;
    }

    for (const ev of group) {
      const crossing = group.filter((other) => overlaps(ev, other));
      const colsSet = new Set<number>(crossing.map((x) => x._col!));
      const sortedCols = Array.from(colsSet).sort((a, b) => a - b);
      ev._cols = Math.max(1, sortedCols.length);
      const localIdx = sortedCols.indexOf(ev._col!);
      ev._col = Math.max(0, localIdx);
    }
    groupId++;
  }

  return items;
}
export function titleCase(s: string) {
  return (s ?? "")
    .toLocaleLowerCase()
    .replace(/\b(\p{L})/gu, (m) => m.toLocaleUpperCase());
}

/* ====================================================================== */
/* MiniCalendar (mensual)                                                 */
/* ====================================================================== */
function buildMonthMatrix(monthDate: Date) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const firstWeekday = (first.getDay() + 6) % 7; // 0=Mon..6=Sun
  const start = new Date(first);
  start.setDate(first.getDate() - firstWeekday);
  start.setHours(0, 0, 0, 0);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

type MiniCalendarProps = {
  monthDate: Date;
  selectedDate: Date;
  eventMap: Map<string, CalendarEvent[]>;
  onSelectDate: (d: Date) => void;
  onSelectEvent: (ev: CalendarEvent) => void;
  onNavigate: (newMonthDate: Date) => void;
  width?: string;
  isOpen: boolean;
  onToggle: () => void;
};

function MiniCalendar({
  monthDate,
  selectedDate,
  eventMap,
  onSelectDate,
  onSelectEvent,
  onNavigate,
  width = "300px",
  isOpen,
  onToggle,
}: MiniCalendarProps) {
  const monthLabel = new Intl.DateTimeFormat("en-AU", { month: "long", year: "numeric" }).format(monthDate);
  const days = useMemo(() => buildMonthMatrix(monthDate), [monthDate]);
  const weekDayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const miniBg = useColorModeValue("white", "gray.800");
  const miniHdrBg = useColorModeValue("whiteAlpha.700", "whiteAlpha.100");
  const miniBorder = useColorModeValue("gray.200", "whiteAlpha.200");

  return (
    <Box>
      <HStack mb={2} px={2} justify="space-between">
        <HStack>
          <IconButton
            aria-label="Toggle mini calendar"
            icon={<CalendarIcon />}
            size="sm"
            variant="ghost"
            onClick={onToggle}
          />
          <Text fontWeight="semibold">{monthLabel}</Text>
        </HStack>
        <HStack>
          <IconButton
            aria-label="Prev month"
            icon={<ChevronLeftIcon />}
            size="sm"
            variant="ghost"
            onClick={() => {
              const d = new Date(monthDate);
              d.setMonth(d.getMonth() - 1, 1);
              onNavigate(d);
            }}
          />
          <IconButton
            aria-label="Next month"
            icon={<ChevronRightIcon />}
            size="sm"
            variant="ghost"
            onClick={() => {
              const d = new Date(monthDate);
              d.setMonth(d.getMonth() + 1, 1);
              onNavigate(d);
            }}
          />
        </HStack>
      </HStack>

      <Collapse in={isOpen} animateOpacity>
        <Box
          w={width}
          bg={miniBg}
          border="1px solid"
          borderColor={miniBorder}
          borderRadius="xl"
          overflow="hidden"
          boxShadow="sm"
        >
          {/* Weekday header */}
          <Grid templateColumns="repeat(7, 1fr)" bg={miniHdrBg} py={2} backdropFilter="blur(6px)">
            {weekDayLabels.map((wd) => (
              <Box key={wd} textAlign="center" fontSize="xs" color="gray.600">
                {wd}
              </Box>
            ))}
          </Grid>

          {/* Days */}
          <Grid templateColumns="repeat(7, 1fr)" gap={0}>
            {days.map((d, i) => {
              const inMonth = d.getMonth() === monthDate.getMonth();
              const isSelected = sameDay(d, selectedDate);
              const ymd = toSydneyYMD(d);
              const evs = eventMap.get(ymd) || [];
              const count = evs.length;

              return (
                <Box
                  key={`${d.toISOString()}-${i}`}
                  p={1}
                  h="46px"
                  borderRight={i % 7 !== 6 ? "1px solid" : undefined}
                  borderBottom="1px solid"
                  borderColor={miniBorder}
                  bg={isSelected ? useColorModeValue("teal.50", "whiteAlpha.100") : undefined}
                  opacity={inMonth ? 1 : 0.6}
                  _hover={{ bg: useColorModeValue("blackAlpha.50", "whiteAlpha.50") }}
                  transition="background 0.15s ease"
                  alignItems={"center"}
                >
                  <VStack justify="space-between" align="center" spacing={0}>
                    <Text
                      textAlign={"center"}
                      fontSize="sm"
                      fontWeight={isSelected ? "bold" : "semibold"}
                      cursor="pointer"
                      onClick={() => onSelectDate(d)}
                    >
                      {d.getDate()}
                    </Text>

                    {/* Contador de citas: click navega al día */}
                    {count > 0 && (
                      <Tooltip label={`${count} ${count === 1 ? "appointment" : "appointments"}`} hasArrow>
                        <Badge
                          as="button"
                          onClick={() => onSelectDate(d)}
                          borderRadius="full"
                          px={2}
                          fontSize="2xs"
                          colorScheme="red"
                          cursor="pointer"
                        >
                          {count}
                        </Badge>
                      </Tooltip>
                    )}
                  </VStack>

                  {/* Se eliminaron los “dots” por evento para usar un contador total */}
                </Box>
              );
            })}
          </Grid>
        </Box>
      </Collapse>
    </Box>
  );
}

/* ====================================================================== */
/* EventCard (premium)                                                    */
/* ====================================================================== */
function gradientFor(color?: string) {
  const token = color || "teal.500";
  const m = token.match(/^([a-zA-Z]+)\.(\d{3})$/);
  if (m) {
    const [_, name, numStr] = m;
    const num = parseInt(numStr, 10);
    const num2 = Math.min(900, num + 100);
    return `linear(to-br, ${name}.${num}, ${name}.${num2})`;
  }
  return undefined;
}

function EventCard({
  ev,
  top,
  leftPct,
  widthPct,
  height,
  onClick,
}: {
  ev: CalendarEvent & { _cols?: number; _col?: number };
  top: number;
  leftPct: number;
  widthPct: number;
  height: number;
  onClick?: () => void;
}) {
  const bg = `${ev.color}.500` || "teal.500";
  const popBg = useColorModeValue("white", "gray.800");
  const borderAccent = useColorModeValue("whiteAlpha.600", "whiteAlpha.400");

  return (
    <Popover trigger="hover" openDelay={120} closeDelay={80} placement="auto-start">
      <PopoverTrigger>
        <Box
          position="absolute"
          top={`${top}px`}
          left={`${leftPct}%`}
          width={`calc(${widthPct}% - 6px)`}
          height={`${height}px`}
          borderRadius="xl"
          px={3}
          py={2}
          color="white"
          lineHeight="1.1"
          overflow="hidden"
          boxShadow="md"
          border="1px solid"
          borderColor={borderAccent}
          bg={gradientFor(ev.color) ? undefined : bg}
          bgGradient={gradientFor(ev.color)}
          transition="transform .12s ease, box-shadow .12s ease"
          _hover={{ transform: "translateY(-1px) scale(1.01)", boxShadow: "lg" }}
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
          }}
        >
          <Box position="relative" pr="16px">
            <Text
              fontWeight="normal"
              fontSize={"xs"}
              noOfLines={2}
              sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
            >
              {titleCase(ev.title)}
            </Text>
            <Box
              position="absolute"
              right={0}
              top={0}
              bottom={0}
              w="22px"
              pointerEvents="none"
              borderTopRightRadius="xl"
              borderBottomRightRadius="xl"
            />
          </Box>

          <HStack spacing={2} mt={1} opacity={0.95} fontSize="xs">
            <Text>
              {fmtTime(ev.start)} – {fmtTime(ev.end)}
            </Text>
          </HStack>
        </Box>
      </PopoverTrigger>

      <Portal>
        <PopoverContent
          maxW="360px"
          bg={popBg}
          borderRadius="xl"
          boxShadow="xl"
          border="1px solid"
          borderColor={useColorModeValue("gray.200", "whiteAlpha.200")}
        >
          <PopoverArrow />
          <PopoverCloseButton />
          <PopoverHeader fontWeight="semibold" pb={1}>
            {titleCase(ev.title)}
          </PopoverHeader>
          <PopoverBody>
            <HStack spacing={2} mb={2} color="gray.600" fontSize="xs">
              <Text>
                {fmtTime(ev.start)} – {fmtTime(ev.end)}
              </Text>
            </HStack>
            <Divider my={2} />
            <Text fontSize="sm" color="gray.700" noOfLines={6}>
              {titleCase(ev.title)}
            </Text>
          </PopoverBody>
        </PopoverContent>
      </Portal>
    </Popover>
  );
}

/* ====================================================================== */
/* Main calendar (Week / Day)                                             */
/* ====================================================================== */
function CalendarGrid({
  view,
  anchorDate,
  highlightDate,
  events,
  onNavigate,
  onSelectEvent,
  onSelectSlot,
  slotMinutes,
  slotHeightPx,
  timeColWidthPx,
  stickyHeaderHeightPx,
  startMin,
  endMin,
  scrollToEventId,
}: {
  view: "week" | "day";
  anchorDate: Date;
  highlightDate?: Date;
  events: CalendarEvent[];
  onNavigate?: (d: Date) => void;
  onSelectEvent?: (e: CalendarEvent) => void;
  onSelectSlot?: (s: Date, e: Date) => void;
  slotMinutes: number;
  slotHeightPx: number;
  timeColWidthPx: number;
  stickyHeaderHeightPx: number;
  startMin: number;
  endMin: number;
  scrollToEventId?: string | number | null;
}) {
  const weekStart = useMemo(() => startOfWeekMonday(anchorDate), [anchorDate]);
  const daysAll = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i)),
    [weekStart]
  );
  const days = view === "day" ? [highlightDate ?? anchorDate] : daysAll;

  const pxPerMinute = slotHeightPx / slotMinutes;
  const totalSlots = useMemo(
    () => Math.ceil((endMin - startMin) / slotMinutes),
    [startMin, endMin, slotMinutes]
  );

  const eventsByDay = useMemo(
    () => days.map((d) => events.filter((e) => sameDay(e.start, d))),
    [days, events]
  );
  const positioned = useMemo(() => eventsByDay.map((arr) => layoutDay(arr)), [eventsByDay]);

  const weekLabel = useMemo(() => fmtWeekLabel(anchorDate), [anchorDate]);

  const goPrev = useCallback(() => {
    const d = new Date(anchorDate);
    d.setDate(d.getDate() + (view === "day" ? -1 : -7));
    onNavigate?.(d);
  }, [anchorDate, view, onNavigate]);

  const goNext = useCallback(() => {
    const d = new Date(anchorDate);
    d.setDate(d.getDate() + (view === "day" ? 1 : 7));
    onNavigate?.(d);
  }, [anchorDate, view, onNavigate]);

  const goToday = useCallback(() => onNavigate?.(new Date()), [onNavigate]);

  const columnsRef = useRef<Array<HTMLDivElement | null>>([]);
  const registerColumnRef = (el: HTMLDivElement | null, idx: number) => (columnsRef.current[idx] = el);

  const eventRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const setEventRef = (id: string | number, el: HTMLDivElement | null) => {
    const key = String(id);
    if (!el) eventRefs.current.delete(key);
    else eventRefs.current.set(key, el);
  };
  useEffect(() => {
    if (!scrollToEventId) return;
    const el = eventRefs.current.get(String(scrollToEventId));
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [scrollToEventId, events, view]);

  const handleColumnClick = (dayIdx: number, e: React.MouseEvent) => {
    if (!onSelectSlot) return;
    const el = columnsRef.current[dayIdx];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minutesFromStart = Math.floor(y / pxPerMinute) + startMin;
    const rounded = Math.floor(minutesFromStart / slotMinutes) * slotMinutes;
    const s = new Date(days[dayIdx]);
    s.setHours(0, 0, 0, 0);
    s.setMinutes(rounded);
    const eDate = new Date(s.getTime() + slotMinutes * 60000);
    onSelectSlot(s, eDate);
  };

  const timeColWidth = ` ${timeColWidthPx}px`;
  const colsDef = view === "day" ? ` ${timeColWidth} 1fr` : ` ${timeColWidth} repeat(7, 1fr)`;

  const hdrBg = useColorModeValue("whiteAlpha.700", "whiteAlpha.100");
  const gridBorder = useColorModeValue("gray.200", "whiteAlpha.200");
  const timeColBg = useColorModeValue("whiteAlpha.600", "whiteAlpha.100");
  const timeColTxt = useColorModeValue("gray.600", "gray.300");

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);
  const nowMin = minutesSinceStartOfDay(now);

  return (
    <Box w="full">
      {/* Toolbar */}
      <HStack mb={3} px={2} spacing={2}>
        <HStack>
          <IconButton aria-label="Prev" icon={<ChevronLeftIcon />} size="sm" variant="ghost" onClick={goPrev} />
          <Button size="sm" onClick={goToday} variant="outline">Today</Button>
          <IconButton aria-label="Next" icon={<ChevronRightIcon />} size="sm" variant="ghost" onClick={goNext} />
        </HStack>
        <Text fontWeight="semibold">
          {view === "day"
            ? new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).format(anchorDate)
            : weekLabel}
        </Text>
        <Spacer />
      </HStack>

      {/* Grid */}
      <Box
        h="calc(100vh - 260px)"
        overflowY="auto"
        sx={{ "--time-col": `${timeColWidthPx}px`, "--hdr": `${stickyHeaderHeightPx}px` } as React.CSSProperties}
        border="1px solid"
        borderColor={gridBorder}
        borderRadius="2xl"
        boxShadow="sm"
      >
        <Grid templateRows="auto 1fr" templateColumns={colsDef} w="full" boxSizing="border-box">
          {/* Header primer celda (glass) */}
          <GridItem
            colStart={1}
            colEnd={2}
            h="var(--hdr)"
            bg={hdrBg}
            position="sticky"
            top={0}
            zIndex={2}
            borderBottom="1px solid"
            borderColor={gridBorder}
            backdropFilter="blur(8px) saturate(1.1)"
          />

          {/* Header de días (glass) */}
          {(view === "day" ? [anchorDate] : daysAll).map((d, i) => (
            <GridItem
              key={`hdr-${i}-${d.toISOString()}`}
              h="var(--hdr)"
              position="sticky"
              top={0}
              zIndex={2}
              bg={sameDay(d, highlightDate ?? anchorDate) ? useColorModeValue("teal.50", "whiteAlpha.100") : hdrBg}
              borderBottom="1px solid"
              borderLeft={i === 0 ? "1px solid" : undefined}
              borderColor={gridBorder}
              display="flex"
              alignItems="center"
              justifyContent="center"
              backdropFilter="blur(8px) saturate(1.1)"
            >
              <Text fontWeight="semibold">
                {new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "2-digit" }).format(d)}
              </Text>
            </GridItem>
          ))}

          {/* Columna de horas */}
          <GridItem colStart={1} colEnd={2} borderRight="1px solid" borderColor={gridBorder} bg={timeColBg}>
            {Array.from({ length: totalSlots + 1 }).map((_, idx) => {
              const mins = startMin + idx * slotMinutes;
              const h = Math.floor(mins / 60);
              const m = mins % 60;
              const label = new Intl.DateTimeFormat("en-AU", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              }).format(new Date(2000, 0, 1, h, m));
              return (
                <Flex
                  key={idx}
                  h={`${slotHeightPx}px`}
                  align="center"
                  px={3}
                  borderBottom="1px solid"
                  borderColor={useColorModeValue("blackAlpha.50", "whiteAlpha.100")}
                >
                  <Text fontSize="sm" color={timeColTxt} sx={{ fontVariantNumeric: "tabular-nums" }}>
                    {label}
                  </Text>
                </Flex>
              );
            })}
          </GridItem>

          {/* Columnas de días */}
          {days.map((d, dayIdx) => {
            const isWeekend = [0, 6].includes(toDateSafe(d).getDay());
            return (
              <GridItem
                key={`col-${d.toISOString()}`}
                borderLeft="1px solid"
                borderColor={gridBorder}
                position="relative"
                onClick={(e) => handleColumnClick(dayIdx, e)}
                bg={isWeekend ? useColorModeValue("blackAlpha.25", "whiteAlpha.50") : undefined}
              >
                {/* Líneas de fondo */}
                {Array.from({ length: totalSlots }).map((_, idx) => (
                  <Box
                    key={idx}
                    h={`${slotHeightPx}px`}
                    borderBottom="1px solid"
                    borderColor={useColorModeValue("blackAlpha.50", "whiteAlpha.100")}
                  />
                ))}

                {/* NOW line */}
                {sameDay(d, now) && nowMin >= startMin && nowMin <= endMin && (
                  <Box
                    position="absolute"
                    left="0"
                    right="0"
                    top={`${(nowMin - startMin) * (slotHeightPx / slotMinutes)}px`}
                    h="2px"
                    bg="red.400"
                    boxShadow="0 0 0 1px rgba(244,63,94,0.3)"
                  >
                    <Box
                      position="absolute"
                      left="6px"
                      top="-4px"
                      w="8px"
                      h="8px"
                      borderRadius="full"
                      bg="red.400"
                      boxShadow="0 0 0 6px rgba(244,63,94,0.18)"
                    />
                  </Box>
                )}

                {/* Eventos posicionados */}
                <Box
                  ref={(el) => {
                    columnsRef.current[dayIdx] = el;
                  }}
                  position="absolute"
                  inset={0}
                  px={1}
                >
                  {positioned[dayIdx]?.map((ev) => {
                    const startEv = minutesSinceStartOfDay(ev.start);
                    const endEv = minutesSinceStartOfDay(ev.end);
                    if (endEv <= startMin || startEv >= endMin) return null;

                    const top = (clamp(startEv, startMin, endMin) - startMin) * (slotHeightPx / slotMinutes);
                    const height = Math.max(22, (endEv - startEv) * (slotHeightPx / slotMinutes) - 4);
                    const colCount = (ev as any)._cols ?? 1;
                    const colIdx = (ev as any)._col ?? 0;

                    const STACK_OVERLAP = true;
                    let widthPct: number;
                    let leftPct: number;

                    if (STACK_OVERLAP && colCount > 1) {
                      widthPct = 100;
                      leftPct = 0;
                    } else {
                      widthPct = 100 / colCount;
                      leftPct = colIdx * widthPct;
                    }

                    return (
                      <EventCard
                        key={String(ev.id)}
                        ev={ev as any}
                        top={top}
                        leftPct={leftPct}
                        widthPct={widthPct}
                        height={height}
                        onClick={() => onSelectEvent?.(ev)}
                      />
                    );
                  })}
                </Box>
              </GridItem>
            );
          })}
        </Grid>
      </Box>
    </Box>
  );
}

/* ====================================================================== */
/* SmartCalendar (export default)                                         */
/* ====================================================================== */
export default function SmartCalendar({
  events,
  initialDate,
  defaultView = "week",
  slotMinutes = 30,
  slotHeightPx = 40,
  timeColWidthPx = 80,
  stickyHeaderHeightPx = 44,
  miniWidth = "250px",
  startAt,
  endAt,
  startHour = 8,
  endHour = 18,
  onSelectEvent,
  onSelectSlot,
}: SmartCalendarProps) {
  const [view, setView] = useState<"week" | "day">(defaultView);
  const [anchor, setAnchor] = useState<Date>(() => toDateSafe(initialDate ?? new Date()));
  const [highlightDate, setHighlightDate] = useState<Date>(anchor);
  const [scrollToEventId, setScrollToEventId] = useState<string | number | null>(null);

  // Mapa YMD → eventos (Sydney)
  const eventMap = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const key = toSydneyYMD(ev.start);
      const arr = map.get(key) ?? [];
      arr.push(ev);
      map.set(key, arr);
    }
    for (const [k, arr] of map) {
      arr.sort((a, b) => toDateSafe(a.start).getTime() - toDateSafe(b.start).getTime());
      map.set(k, arr);
    }
    return map;
  }, [events]);

  // Navegación compartida
  const handleNavigate = useCallback((d: Date) => {
    setAnchor(d);
    setHighlightDate(d);
  }, []);

  // MiniCalendar state
  const [miniMonth, setMiniMonth] = useState<Date>(() => {
    const d = new Date(anchor);
    d.setDate(1);
    return d;
  });
  useEffect(() => {
    const m = new Date(anchor);
    m.setDate(1);
    setMiniMonth(m);
  }, [anchor]);

  const { isOpen: isMiniOpen, onToggle: toggleMini } = useDisclosure({ defaultIsOpen: true });

  // Click en mini-day
  const handleMiniSelectDate = useCallback(
    (d: Date) => {
      setHighlightDate(d);
      setAnchor(d);
      setView("day");
      const key = toSydneyYMD(d);
      const evs = eventMap.get(key) || [];
      setScrollToEventId(evs[0]?.id ?? null);
    },
    [eventMap]
  );

  // Click en mini-event (se mantiene por compat, ya no se usa en el mini)
  const handleMiniSelectEvent = useCallback(
    (ev: CalendarEvent) => {
      const d = toDateSafe(ev.start);
      setHighlightDate(d);
      setAnchor(d);
      setView("day");
      setScrollToEventId(ev.id);
      onSelectEvent?.(ev);
    },
    [onSelectEvent]
  );

  useEffect(() => {
    if (scrollToEventId == null) return;
    const t = setTimeout(() => setScrollToEventId(null), 800);
    return () => clearTimeout(t);
  }, [scrollToEventId, view, anchor]);

  const containerBg = useColorModeValue("white", "gray.800");

  // Inicio/fin visible (prioriza startAt/endAt)
  const startMin = useMemo(
    () => (startAt != null ? toMinutesOfDay(startAt) : Math.max(0, Math.min(24 * 60, startHour * 60))),
    [startAt, startHour]
  );
  const endMin = useMemo(
    () => (endAt != null ? toMinutesOfDay(endAt) : Math.max(0, Math.min(24 * 60, endHour * 60))),
    [endAt, endHour]
  );

  return (
    <Grid templateColumns={{ base: "1fr", lg: `${isMiniOpen ? miniWidth : "0px"} 1fr` }} gap={4} alignItems="start">
      {/* Main calendar + top controls */}
      {/* Mini calendar panel */}
      <Box>
        <HStack mb={3} justify="space-between" wrap="wrap" gap={2}>
          {/* <HStack>
            <Button size="sm" variant={view === "week" ? "solid" : "outline"} colorScheme="teal" onClick={() => setView("week")}>
              Week
            </Button>
            <Button size="sm" variant={view === "day" ? "solid" : "outline"} colorScheme="teal" onClick={() => setView("day")}>
              Day
            </Button>
          </HStack>*/
          }

          {/* Toggle mini */}
          <HStack>
            <IconButton
              aria-label="Toggle mini calendar"
              icon={<CalendarIcon />}
              size="sm"
              onClick={toggleMini}
              variant="outline"
            />
          </HStack>
        </HStack>
        <Box
          display={{ base: "none", lg: "block" }}
          overflow="hidden"
          transition="width 0.25s ease"
          width={isMiniOpen ? miniWidth : "0px"}
          bg={containerBg}
          borderRadius="2xl"
          boxShadow="sm"
        >
          <MiniCalendar
            monthDate={miniMonth}
            selectedDate={highlightDate}
            eventMap={eventMap}
            onSelectDate={handleMiniSelectDate}
            onSelectEvent={handleMiniSelectEvent}
            onNavigate={(d) => setMiniMonth(d)}
            width={miniWidth}
            isOpen={isMiniOpen}
            onToggle={toggleMini}
          />
        </Box>


      </Box>
      <Box>


        <CalendarGrid
          view={view}
          anchorDate={anchor}
          highlightDate={highlightDate}
          events={events}
          onNavigate={handleNavigate}
          onSelectEvent={onSelectEvent}
          onSelectSlot={onSelectSlot}
          slotMinutes={slotMinutes}
          slotHeightPx={slotHeightPx}
          timeColWidthPx={timeColWidthPx}
          stickyHeaderHeightPx={stickyHeaderHeightPx}
          startMin={startMin}
          endMin={endMin}
          scrollToEventId={scrollToEventId}
        />
      </Box>


    </Grid >
  );
}
