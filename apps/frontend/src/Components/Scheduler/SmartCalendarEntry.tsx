// 🔧 SUPER DEBUG BUILD — SmartCalendar + Parent con logs de drag/resize/move
// Abre DevTools (Console) y filtra por "[SC]" o "[PARENT]". Hay logs en: start/end de drag y resize,
// y al aplicar cambios al estado en el padre. 

/* ======================================================================
   FILE: apps/frontend/src/Components/Scheduler/SmartCalendarEntry.tsx
   ====================================================================== */
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
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverBody,
  PopoverArrow,
  PopoverCloseButton,
  Collapse,
  useColorModeValue,
  Badge,
  useToast,
} from "@chakra-ui/react";
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon } from "@chakra-ui/icons";

/* ====================================================================== */
/* Tipos                                                                  */
/* ====================================================================== */
export type CalendarEvent = {
  id: string | number;
  title: string;
  start: Date | string | number;
  end: Date | string | number;
  color?: string;
};

export type DateRange = { startDate: Date; endDate: Date };

export type SmartCalendarProps = {
  /** Modo controlado: única fuente de verdad */
  controlledRanges?: DateRange[];
  onChangeRanges?: (ranges: DateRange[]) => void;

  /** Legacy solo si NO usas controlledRanges */
  events?: CalendarEvent[];

  initialDate?: Date | string | number;
  defaultView?: "week" | "day";

  /** Granularidad y apariencia */
  slotMinutes?: number;
  slotHeightPx?: number;
  timeColWidthPx?: number;
  stickyHeaderHeightPx?: number;

  /** HH:mm o número decimal */
  startAt?: string | number;
  endAt?: string | number;
  startHour?: number;
  endHour?: number;

  /** Interacciones */
  onSelectEvent?: (ev: CalendarEvent) => void;
  onSelectSlot?: (start: Date, end: Date) => void;

  /** Resize y Drag */
  resizable?: boolean;
  minDurationMinutes?: number;
  draggable?: boolean;

  /** Callbacks legacy cuando no hay onChangeRanges */
  onResizeEvent?: (ev: CalendarEvent, nextStart: Date, nextEnd: Date) => void;
  onMoveEvent?: (ev: CalendarEvent, nextStart: Date, nextEnd: Date) => void;
};

/* ====================================================================== */
/* Helpers + DEBUG                                                        */
/* ====================================================================== */
const SYD_TZ = "Australia/Sydney";
const DATA_ATTR_EVENT = "data-evcard";
const DATA_ATTR_RESIZE = "data-resize-handle";

const isValidDate = (d: any): d is Date => d instanceof Date && !Number.isNaN(d.getTime());
const toDateSafe = (v: Date | string | number | null | undefined): Date => {
  if (v instanceof Date && isValidDate(v)) return new Date(v);
  const d = new Date(v ?? Date.now());
  return isValidDate(d) ? d : new Date();
};
const toIso = (v: Date | string | number) => toDateSafe(v).toISOString();

function startOfWeekMonday(anyDate: Date | string | number) {
  const x = toDateSafe(anyDate);
  const day = x.getDay();
  const diff = (day + 6) % 7;
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}
function sameDay(a: Date | string | number, b: Date | string | number) {
  const da = toDateSafe(a);
  const db = toDateSafe(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}
function minutesSinceStartOfDay(v: Date | string | number) {
  const d = toDateSafe(v);
  const sod = new Date(d);
  sod.setHours(0, 0, 0, 0);
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
function toMinutesOfDay(input: string | number): number {
  if (typeof input === "number") return Math.round(input * 60);
  const s = `${input}`.trim();
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (m) {
    const h = clamp(parseInt(m[1], 10), 0, 23);
    const mm = clamp(parseInt(m[2] ?? "0", 10), 0, 59);
    return h * 60 + mm;
  }
  const asNum = Number(s.replace(",", "."));
  return Number.isFinite(asNum) ? Math.round(asNum * 60) : 0;
}
function formatDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h} h ${m} m`;
  if (h) return `${h} h`;
  return `${m} m`;
}

/** Layout por día con columnas para solapes */
function layoutDay(events: CalendarEvent[]) {
  type E = CalendarEvent & { _startMin: number; _endMin: number; _col?: number; _cols?: number };
  const toMin = (v: Date | string | number) => minutesSinceStartOfDay(v);
  const overlaps = (a: E, b: E) => a._startMin < b._endMin && b._startMin < a._endMin;

  const items: E[] = events
    .map((e) => ({ ...e, _startMin: toMin(e.start), _endMin: toMin(e.end) }))
    .filter((e) => e._endMin > e._startMin)
    .sort((a, b) => a._startMin - b._startMin || a._endMin - b._endMin);

  if (!items.length) return [] as unknown as CalendarEvent[];

  const colsEnd: number[] = [];
  for (const ev of items) {
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
  }
  for (const ev of items) {
    const crossing = items.filter((o) => overlaps(ev, o));
    const colsSet = new Set<number>(crossing.map((x) => x._col!));
    ev._cols = Math.max(1, colsSet.size);
    ev._col = Array.from(colsSet).sort((a, b) => a - b).indexOf(ev._col!);
  }
  return items as unknown as CalendarEvent[];
}
const titleCase = (s: string) =>
  (s ?? "").toLocaleLowerCase().replace(/\b(\p{L})/gu, (m) => m.toLocaleUpperCase());

/* ====================================================================== */
/* MiniCalendar opcional                                                   */
/* ====================================================================== */
function buildMonthMatrix(monthDate: Date) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const firstWeekday = (first.getDay() + 6) % 7;
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
          <IconButton aria-label="Toggle mini calendar" icon={<CalendarIcon />} size="sm" variant="ghost" onClick={onToggle} />
          <Text fontWeight="semibold">{monthLabel}</Text>
        </HStack>
        <HStack>
          <IconButton aria-label="Prev month" icon={<ChevronLeftIcon />} size="sm" variant="ghost"
            onClick={() => { const d = new Date(monthDate); d.setMonth(d.getMonth() - 1, 1); onNavigate(d); }} />
          <IconButton aria-label="Next month" icon={<ChevronRightIcon />} size="sm" variant="ghost"
            onClick={() => { const d = new Date(monthDate); d.setMonth(d.getMonth() + 1, 1); onNavigate(d); }} />
        </HStack>
      </HStack>

      <Collapse in={isOpen} animateOpacity>
        <Box w={width} bg={miniBg} border="1px solid" borderColor={miniBorder} borderRadius="xl" overflow="hidden" boxShadow="sm">
          <Grid templateColumns="repeat(7, 1fr)" bg={miniHdrBg} py={2} backdropFilter="blur(6px)">
            {weekDayLabels.map((wd) => (
              <Box key={wd} textAlign="center" fontSize="xs" color="gray.600">
                {wd}
              </Box>
            ))}
          </Grid>

          <Grid templateColumns="repeat(7, 1fr)" gap={0}>
            {days.map((d, i) => {
              const inMonth = d.getMonth() === monthDate.getMonth();
              const isSelected = sameDay(d, selectedDate);
              const border = useColorModeValue("gray.200", "whiteAlpha.200");
              return (
                <Box
                  key={`${d.toISOString()}-${i}`}
                  p={1}
                  h="46px"
                  borderRight={i % 7 !== 6 ? "1px solid" : undefined}
                  borderBottom="1px solid"
                  borderColor={border}
                  bg={isSelected ? useColorModeValue("teal.50", "whiteAlpha.100") : undefined}
                  opacity={inMonth ? 1 : 0.6}
                  _hover={{ bg: useColorModeValue("blackAlpha.50", "whiteAlpha.50") }}
                  transition="background 0.15s ease"
                  alignItems="center"
                >
                  <VStack spacing={0}>
                    <Text
                      fontSize="sm"
                      fontWeight={isSelected ? "bold" : "semibold"}
                      cursor="pointer"
                      onClick={() => onSelectDate(d)}
                    >
                      {d.getDate()}
                    </Text>
                  </VStack>
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
/* EventCard — resize + drag cross‑day + LOGS                             */
/* ====================================================================== */
function gradientFor(color?: string) {
  const token = color || "teal.500";
  const m = token.match(/^([a-zA-Z]+)\.(\d{3})$/);
  if (m) {
    const [, name, numStr] = m;
    const num = parseInt(numStr, 10);
    const num2 = Math.min(900, num + 100);
    return `linear(to-br, ${name}.${num}, ${name}.${num2})`;
  }
  return undefined;
}
function resolveBg(color?: string) {
  if (!color) return "teal.500";
  if (/\.[0-9]{3}$/.test(color)) return color;
  return `${color}.500`;
}

type EventCardProps = {
  ev: CalendarEvent & { _cols?: number; _col?: number };
  top: number;
  leftPct: number;
  widthPct: number;
  height: number;
  onClick?: () => void;

  // resize
  enableResize: boolean;
  pxPerMinute: number;
  dayStartMin: number;
  dayEndMin: number;
  slotMinutes: number;
  minDuration: number;
  onResize?: (nextStartMin: number, nextEndMin: number) => void;

  // drag cross‑day
  enableDrag: boolean;
  dayIndex: number;
  getDayRects: () => DOMRect[];
  onMoveAcross?: (targetDayIdx: number, nextStartMin: number, nextEndMin: number) => void;
};

function EventCard({
  ev,
  top,
  leftPct,
  widthPct,
  height,
  onClick,
  enableResize,
  pxPerMinute,
  dayStartMin,
  dayEndMin,
  slotMinutes,
  minDuration,
  onResize,
  enableDrag,
  dayIndex,
  getDayRects,
  onMoveAcross,
}: EventCardProps) {
  const bgColor = resolveBg(ev.color);
  const borderAccent = useColorModeValue("whiteAlpha.600", "whiteAlpha.400");

  const startMin = minutesSinceStartOfDay(ev.start);
  const endMin = minutesSinceStartOfDay(ev.end);
  const baseDuration = Math.max(minDuration, endMin - startMin);

  // Resize state
  const [resizeDeltaMin, setResizeDeltaMin] = useState<number | null>(null);
  const resizeSnapshot = useRef<{ endMin: number; initY: number } | null>(null);

  // Drag state cross‑day
  const [dragDeltaMin, setDragDeltaMin] = useState<number | null>(null);
  const [dragTargetDay, setDragTargetDay] = useState<number>(dayIndex);
  const dragSnapshot = useRef<{
    startMin: number;
    endMin: number;
    initY: number;
    initX: number;
    dayIdx: number;
    dayRects: DOMRect[];
  } | null>(null);

  const justInteractedAt = useRef(0);
  const applySnap = (mins: number) => Math.round(mins / slotMinutes) * slotMinutes;

  // Resize handlers
  const onResizeDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!enableResize) return;
    console.log("%c[SC] RESIZE start", "color:#f80", { id: ev.id, startIso: toIso(ev.start), endIso: toIso(ev.end) });
    resizeSnapshot.current = { endMin, initY: e.clientY };
    window.addEventListener("mousemove", onResizeMove);
    window.addEventListener("mouseup", onResizeUp);
    try { window.dispatchEvent(new Event("calendar-resize-start")); } catch {}
  };
  const onResizeMove = (e: MouseEvent) => {
    const snap = resizeSnapshot.current;
    if (!snap) return;
    const dy = e.clientY - snap.initY;
    const dyMin = Math.round(dy / pxPerMinute);
    const rawNextEnd = snap.endMin + dyMin;
    const clamped = clamp(rawNextEnd, startMin + minDuration, dayEndMin);
    const snapped = applySnap(clamped);
    setResizeDeltaMin(snapped - endMin);
  };
  const onResizeUp = () => {
    window.removeEventListener("mousemove", onResizeMove);
    window.removeEventListener("mouseup", onResizeUp);
    const delta = resizeDeltaMin ?? 0;
    if (delta !== 0) {
      const nextEnd = endMin + delta;
      console.log("%c[SC] RESIZE end", "color:#f80", { id: ev.id, nextEndMin: nextEnd });
      onResize?.(startMin, nextEnd);
    }
    setResizeDeltaMin(null);
    resizeSnapshot.current = null;
    justInteractedAt.current = Date.now();
    try { window.dispatchEvent(new Event("calendar-resize-end")); } catch {}
  };

  // Drag handlers
  const onCardDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest(`[${DATA_ATTR_RESIZE}]`)) return;
    if (!enableDrag) return;
    console.log("%c[SC] DRAG start", "color:#09f", { id: ev.id, startIso: toIso(ev.start), endIso: toIso(ev.end), dayIndex });
    dragSnapshot.current = {
      startMin,
      endMin,
      initY: e.clientY,
      initX: e.clientX,
      dayIdx: dayIndex,
      dayRects: getDayRects(),
    };
    window.addEventListener("mousemove", onDragMove);
    window.addEventListener("mouseup", onDragUp);
    try { window.dispatchEvent(new Event("calendar-resize-start")); } catch {}
  };
  const onDragMove = (e: MouseEvent) => {
    const snap = dragSnapshot.current;
    if (!snap) return;

    const dy = e.clientY - snap.initY;
    const dyMin = Math.round(dy / pxPerMinute);
    const nextStartRaw = snap.startMin + dyMin;
    const clampedStart = clamp(nextStartRaw, dayStartMin, dayEndMin - baseDuration);
    const snappedStart = applySnap(clampedStart);
    setDragDeltaMin(snappedStart - startMin);

    // horizontal día destino
    const rects = snap.dayRects;
    let targetIdx = snap.dayIdx;
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (e.clientX >= r.left && e.clientX <= r.right) {
        targetIdx = i;
        break;
      }
    }
    setDragTargetDay(targetIdx);
  };
  const onDragUp = () => {
    window.removeEventListener("mousemove", onDragMove);
    window.removeEventListener("mouseup", onDragUp);
    const delta = dragDeltaMin ?? 0;
    const targetIdx = dragTargetDay;
    if (delta !== 0 || targetIdx !== dayIndex) {
      const nextStart = startMin + delta;
      const nextEnd = nextStart + baseDuration;
      console.log("%c[SC] DRAG end", "color:#09f", { id: ev.id, deltaMin: delta, targetDayIdx: targetIdx, nextStartMin: nextStart, nextEndMin: nextEnd });
      onMoveAcross?.(
        targetIdx,
        clamp(nextStart, dayStartMin, dayEndMin - baseDuration),
        clamp(nextEnd, dayStartMin + baseDuration, dayEndMin)
      );
    }
    setDragDeltaMin(null);
    setDragTargetDay(dayIndex);
    dragSnapshot.current = null;
    justInteractedAt.current = Date.now();
    try { window.dispatchEvent(new Event("calendar-resize-end")); } catch {}
  };

  useEffect(() => {
    return () => {
      window.removeEventListener("mousemove", onResizeMove);
      window.removeEventListener("mouseup", onResizeUp);
      window.removeEventListener("mousemove", onDragMove);
      window.removeEventListener("mouseup", onDragUp);
    };
  }, []);

  const visualHeight =
    resizeDeltaMin == null ? height : Math.max(22, (baseDuration + resizeDeltaMin) * pxPerMinute - 4);
  const visualTranslateY = dragDeltaMin == null ? 0 : dragDeltaMin * pxPerMinute;

  const popBg = useColorModeValue("white", "gray.800");

  return (
    <Popover trigger="hover" openDelay={120} closeDelay={80} placement="auto-start">
      <PopoverTrigger>
        <Box
          {...{ [DATA_ATTR_EVENT]: "true" }}
          position="absolute"
          top={`${top}px`}
          left={`${leftPct}%`}
          width={`calc(${widthPct}% - 6px)`}
          height={`${visualHeight}px`}
          transform={visualTranslateY ? `translateY(${visualTranslateY}px)` : undefined}
          borderRadius="xl"
          px={3}
          py={2}
          color="white"
          lineHeight="1.1"
          overflow="hidden"
          boxShadow="md"
          border="1px solid"
          borderColor={borderAccent}
          bg={gradientFor(ev.color) ? undefined : bgColor}
          bgGradient={gradientFor(ev.color)}
          transition="transform .08s ease, box-shadow .12s ease, height .08s ease"
          _hover={{ transform: `translateY(${visualTranslateY}px) scale(1.01)`, boxShadow: "lg", zIndex: 2 }}
          zIndex={resizeDeltaMin != null || dragDeltaMin != null ? 3 : 1}
          onMouseDown={onCardDown}
          onClick={(e) => {
            // Evita el "ghost click" justo después de drag/resize
            if (Date.now() - justInteractedAt.current < 300) { e.stopPropagation(); return; }
            e.stopPropagation();
            onClick?.();
          }}
          cursor={enableDrag ? (dragDeltaMin != null ? "grabbing" : "grab") : "default"}
          style={{ willChange: "transform,height" }}
        >
          <Box position="relative" pr="16px">
            <Text fontWeight="normal" fontSize={"xs"} noOfLines={2}
              sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
              {titleCase(ev.title)}
            </Text>
          </Box>

          <HStack spacing={2} mt={1} opacity={0.95} fontSize="xs" align="center">
            <Text>{fmtTime(ev.start)} – {fmtTime(ev.end)}</Text>
            <Badge variant="subtle" colorScheme="blackAlpha" bg="whiteAlpha.300" borderRadius="full" px={2}>
              {formatDuration(baseDuration + (resizeDeltaMin ?? 0))}
            </Badge>
          </HStack>

          {enableResize && (
            <Box
              {...{ [DATA_ATTR_RESIZE]: "true" }}
              onMouseDown={onResizeDown}
              position="absolute"
              left="8px"
              right="8px"
              bottom="6px"
              h="8px"
              borderRadius="full"
              bg="whiteAlpha.500"
              _hover={{ bg: "whiteAlpha.700" }}
              cursor="ns-resize"
            />
          )}
        </Box>
      </PopoverTrigger>

      <PopoverContent w="sm" bg={popBg} _dark={{ bg: "gray.800" }}>
        <PopoverArrow />
        <PopoverCloseButton />
        <PopoverHeader fontWeight="semibold">{titleCase(ev.title)}</PopoverHeader>
        <PopoverBody>
          <VStack align="start" spacing={1} fontSize="sm">
            <Text>{fmtTime(ev.start)} – {fmtTime(ev.end)} ({formatDuration(baseDuration)})</Text>
            <Tag size="sm" variant="subtle"><Text fontSize="xs">{String(ev.id)}</Text></Tag>
          </VStack>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
}

/* ====================================================================== */
/* Grid principal + LOGS                                                   */
/* ====================================================================== */
function CalendarGrid({
  view,
  anchorDate,
  highlightDate,
  derivedEvents,
  onNavigate,
  onSelectEvent,
  onSelectSlot,
  slotMinutes,
  slotHeightPx,
  timeColWidthPx,
  stickyHeaderHeightPx,
  startMin,
  endMin,
  resizable,
  minDurationMinutes,
  draggable,
  onChangeRanges,
  onResizeEvent,
  onMoveEvent,
  currentRanges,
}: {
  view: "week" | "day";
  anchorDate: Date;
  highlightDate?: Date;
  derivedEvents: CalendarEvent[];
  onNavigate?: (d: Date) => void;
  onSelectEvent?: (e: CalendarEvent) => void;
  onSelectSlot?: (s: Date, e: Date) => void;
  slotMinutes: number;
  slotHeightPx: number;
  timeColWidthPx: number;
  stickyHeaderHeightPx: number;
  startMin: number;
  endMin: number;
  resizable: boolean;
  minDurationMinutes: number;
  draggable: boolean;
  onChangeRanges?: (ranges: DateRange[]) => void;
  onResizeEvent?: (ev: CalendarEvent, nextStart: Date, nextEnd: Date) => void;
  onMoveEvent?: (ev: CalendarEvent, nextStart: Date, nextEnd: Date) => void;
  currentRanges?: DateRange[];
}) {
  const weekStart = useMemo(() => startOfWeekMonday(anchorDate), [anchorDate]);
  const daysAll = useMemo(
    () => Array.from({ length: 7 }, (_, i) =>
      new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i)),
    [weekStart]
  );
  const days = view === "day" ? [highlightDate ?? anchorDate] : daysAll;

  const pxPerMinute = slotHeightPx / slotMinutes;
  const totalSlots = useMemo(() => Math.ceil((endMin - startMin) / slotMinutes), [startMin, endMin, slotMinutes]);

  const eventsByDay = useMemo(
    () => days.map((d) => derivedEvents.filter((e) => sameDay(e.start, d))),
    [days, derivedEvents]
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
  const getDayRects = useCallback(() => columnsRef.current.map((el) => el!.getBoundingClientRect()), []);

  const lastDragAt = useRef(0);
  const [draggingAny, setDraggingAny] = useState(false);
  useEffect(() => {
    const onStart = () => { setDraggingAny(true); console.log("%c[SC] global drag/resize START", "color:#999"); };
    const onEnd = () => { setDraggingAny(false); lastDragAt.current = Date.now(); console.log("%c[SC] global drag/resize END", "color:#999"); };
    window.addEventListener("calendar-resize-start", onStart as any);
    window.addEventListener("calendar-resize-end", onEnd as any);
    return () => {
      window.removeEventListener("calendar-resize-start", onStart as any);
      window.removeEventListener("calendar-resize-end", onEnd as any);
    };
  }, []);

  const handleColumnClick = (dayIdx: number, e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest(`[${DATA_ATTR_EVENT}]`) || target.closest(`[${DATA_ATTR_RESIZE}]`)) return;
    const since = Date.now() - lastDragAt.current;
    if (draggingAny || since < 300) return;
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

  const toDateFrom = (dayBase: Date, mins: number) => {
    const base = new Date(dayBase);
    base.setHours(0, 0, 0, 0);
    return new Date(base.getTime() + mins * 60000);
  };

  /** Emisor controlado. Si existe onChangeRanges, parchea por índice */
  const emitRangeUpdate = (ev: CalendarEvent, nextStart: Date, nextEnd: Date) => {
    if (onChangeRanges) {
      const idStr = String(ev.id ?? "");
      const idx = idStr.startsWith("ctrl-") ? Number(idStr.split("-")[1]) : -1;

      if (Array.isArray(currentRanges) && currentRanges.length > 0 && idx >= 0 && idx < currentRanges.length) {
        const before = currentRanges[idx];
        const next = currentRanges.slice();
        next[idx] = { startDate: nextStart, endDate: nextEnd };
        console.groupCollapsed("%c[SC] emitRangeUpdate (by index)", "color:#0bf");
        console.log({ id: ev.id, idx });
        console.table({
          before_startIso: before?.startDate?.toISOString?.(),
          before_endIso: before?.endDate?.toISOString?.(),
          next_startIso: nextStart.toISOString(),
          next_endIso: nextEnd.toISOString(),
        });
        console.groupEnd();
        onChangeRanges(next);
        return;
      }
      console.log("%c[SC] emitRangeUpdate (fallback)", "color:#0bf", { id: ev.id });
      onChangeRanges([{ startDate: nextStart, endDate: nextEnd }]);
      return;
    }
    // Legacy
    onResizeEvent?.(ev, nextStart, nextEnd);
    onMoveEvent?.(ev, nextStart, nextEnd);
  };

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
        <Grid
          templateRows="auto 1fr"
          templateColumns={view === "day" ? ` ${timeColWidthPx}px 1fr` : ` ${timeColWidthPx}px repeat(7, 1fr)`}
          w="full"
          boxSizing="border-box"
        >
          {/* Header vacío */}
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

          {/* Header días */}
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
              const label = new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit", hour12: true })
                .format(new Date(2000, 0, 1, h, m));
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
                {/* líneas */}
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
                    <Box position="absolute" left="6px" top="-4px" w="8px" h="8px" borderRadius="full" bg="red.400"
                      boxShadow="0 0 0 6px rgba(244,63,94,0.18)" />
                  </Box>
                )}

                {/* Eventos */}
                <Box ref={(el) => { columnsRef.current[dayIdx] = el; }} position="absolute" inset={0} px={1}>
                  {(positioned[dayIdx] as CalendarEvent[] | undefined)?.map((ev) => {
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

                    const handleResize = (nextStartMin: number, nextEndMin: number) => {
                      const s = toDateFrom(d, nextStartMin);
                      const e = toDateFrom(d, nextEndMin);
                      emitRangeUpdate(ev, s, e);
                    };

                    const handleMoveAcross = (targetDayIdx: number, nextStartMin: number, nextEndMin: number) => {
                      const targetDay = days[targetDayIdx] ?? d;
                      const s = toDateFrom(targetDay, nextStartMin);
                      const e = toDateFrom(targetDay, nextEndMin);
                      emitRangeUpdate(ev, s, e);
                    };

                    return (
                      <EventCard
                        key={String(ev.id)}
                        ev={ev as any}
                        top={top}
                        leftPct={leftPct}
                        widthPct={widthPct}
                        height={height}
                        onClick={() => onSelectEvent?.(ev)}
                        enableResize={resizable}
                        pxPerMinute={pxPerMinute}
                        dayStartMin={startMin}
                        dayEndMin={endMin}
                        slotMinutes={slotMinutes}
                        minDuration={minDurationMinutes}
                        onResize={handleResize}
                        enableDrag={!!draggable}
                        dayIndex={dayIdx}
                        getDayRects={getDayRects}
                        onMoveAcross={handleMoveAcross}
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
/* SmartCalendar export                                                    */
/* ====================================================================== */
export default function SmartCalendarEntry({
  controlledRanges,
  onChangeRanges,
  events = [],
  initialDate,
  defaultView = "week",
  slotMinutes = 30,
  slotHeightPx = 40,
  timeColWidthPx = 80,
  stickyHeaderHeightPx = 44,
  startAt,
  endAt,
  startHour = 8,
  endHour = 18,
  onSelectEvent,
  onSelectSlot,
  resizable = true,
  draggable = true,
  minDurationMinutes,
  onResizeEvent,
  onMoveEvent,
}: SmartCalendarProps) {
  const [view] = useState<"week" | "day">(defaultView);
  const [anchor, setAnchor] = useState<Date>(() => toDateSafe(initialDate ?? new Date()));
  const [highlightDate, setHighlightDate] = useState<Date>(anchor);

  const handleNavigate = useCallback((d: Date) => {
    setAnchor(d);
    setHighlightDate(d);
  }, []);

  const startMin = useMemo(
    () => (startAt != null ? toMinutesOfDay(startAt) : Math.max(0, Math.min(24 * 60, (startHour ?? 8) * 60))),
    [startAt, startHour]
  );
  const endMin = useMemo(
    () => (endAt != null ? toMinutesOfDay(endAt) : Math.max(0, Math.min(24 * 60, (endHour ?? 18) * 60))),
    [endAt, endHour]
  );
  const effectiveMinDuration = Math.max(1, minDurationMinutes ?? slotMinutes);

  // Controlado: si el prop existe, incluso si está vacío, es la fuente de verdad
  const derivedEvents: CalendarEvent[] = useMemo(() => {
    if (typeof controlledRanges !== "undefined") {
      const evs = (controlledRanges ?? []).map((r, i) => ({
        id: `ctrl-${i}`,
        title: "Date Selected",
        start: r.startDate,
        end: r.endDate,
        color: "teal",
      }));
      console.groupCollapsed("%c[SC] render derivedEvents", "color:#777");
      console.table(evs.map(e => ({ id: e.id, startIso: toIso(e.start), endIso: toIso(e.end) })));
      console.groupEnd();
      return evs;
    }
    return events;
  }, [controlledRanges, events]);

  return (
    <Grid templateColumns={{ base: "1fr", lg: `1fr` }} gap={4} alignItems="start">
      <Box>
        <CalendarGrid
          view={view}
          anchorDate={anchor}
          highlightDate={highlightDate}
          derivedEvents={derivedEvents}
          onNavigate={handleNavigate}
          onSelectEvent={onSelectEvent}
          onSelectSlot={onSelectSlot}
          slotMinutes={slotMinutes}
          slotHeightPx={slotHeightPx}
          timeColWidthPx={timeColWidthPx}
          stickyHeaderHeightPx={stickyHeaderHeightPx}
          startMin={startMin}
          endMin={endMin}
          resizable={!!resizable}
          minDurationMinutes={effectiveMinDuration}
          draggable={!!draggable}
          onChangeRanges={onChangeRanges}
          onResizeEvent={onResizeEvent}
          onMoveEvent={onMoveEvent}
          currentRanges={typeof controlledRanges !== "undefined" ? (controlledRanges ?? []) : undefined}
        />
      </Box>
    </Grid>
  );
}