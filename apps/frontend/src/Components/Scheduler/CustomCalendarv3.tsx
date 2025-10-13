import React, { useMemo, useCallback, useRef } from "react";
import { Box, Grid, GridItem, Flex, Text, HStack, IconButton, Button, Spacer } from "@chakra-ui/react";
import { ChevronLeftIcon, ChevronRightIcon } from "@chakra-ui/icons";

/* ====================================================================== */
/* Types                                                                  */
/* ====================================================================== */
export type CalendarEvent = {
  id: string | number;
  title: string;
  start: Date | string | number;
  end: Date | string | number;
  color?: string;
};

export type CustomCalendarProps = {
  currentDate: Date | string | number;
  events?: CalendarEvent[];
  highlightDate?: Date | string | number;
  onNavigate?: (nextDate: Date) => void;
  onSelectEvent?: (ev: CalendarEvent) => void;
  onSelectSlot?: (start: Date, end: Date) => void;

  startHour?: number;
  endHour?: number;
  slotMinutes?: number;
  slotHeightPx?: number;
  timeColWidthPx?: number;
  stickyHeaderHeightPx?: number;
};

/* ====================================================================== */
/* Helpers                                                                */
/* ====================================================================== */
const isValidDate = (d: any): d is Date => d instanceof Date && !isNaN(d.getTime());
const toDateSafe = (v: Date | string | number | null | undefined): Date => {
  if (v instanceof Date && isValidDate(v)) return new Date(v);
  const d = new Date(v ?? Date.now());
  return isValidDate(d) ? d : new Date();
};
function startOfWeekMonday(anyDate: Date | string | number) {
  const x = toDateSafe(anyDate);
  const day = x.getDay();
  const diff = (day + 6) % 7;
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfDay(d: Date | string | number) {
  const x = toDateSafe(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function minutesSinceStartOfDay(d: Date | string | number) {
  const a = toDateSafe(d);
  const sod = startOfDay(a);
  return Math.max(0, Math.round((a.getTime() - sod.getTime()) / 60000));
}
function sameDay(a: Date | string | number, b: Date | string | number) {
  const da = toDateSafe(a);
  const db = toDateSafe(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
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
function layoutDay(events: CalendarEvent[]) {
  type E = CalendarEvent & { _startMin: number; _endMin: number; _col?: number; _cols?: number };
  const items: E[] = events
    .map((e) => ({
      ...e,
      _startMin: minutesSinceStartOfDay(e.start),
      _endMin: minutesSinceStartOfDay(e.end),
    }))
    .sort((a, b) => a._startMin - b._startMin || a._endMin - b._endMin);

  const laid: E[] = [];
  let active: E[] = [];
  let group: E[] = [];
  const flush = () => {
    if (!group.length) return;
    const cols: { endMin: number }[] = [];
    for (const ev of group) {
      let placed = false;
      for (let i = 0; i < cols.length; i++) {
        if (cols[i].endMin <= ev._startMin) {
          ev._col = i;
          cols[i].endMin = ev._endMin;
          placed = true;
          break;
        }
      }
      if (!placed) {
        ev._col = cols.length;
        cols.push({ endMin: ev._endMin });
      }
    }
    const count = cols.length;
    for (const ev of group) ev._cols = count, laid.push(ev);
    group = [];
    active = [];
  };
  for (const ev of items) {
    active = active.filter((a) => a._endMin > ev._startMin);
    if (!active.length && group.length) flush();
    active.push(ev);
    group.push(ev);
  }
  flush();
  return laid;
}

/* ====================================================================== */
/* Component                                                              */
/* ====================================================================== */
export default function CustomCalendarv3({
  currentDate,
  events = [],
  highlightDate,
  onNavigate,
  onSelectEvent,
  onSelectSlot,
  startHour = 8,
  endHour = 18,
  slotMinutes = 30,
  slotHeightPx = 40,
  timeColWidthPx = 64,
  stickyHeaderHeightPx = 44,
}: CustomCalendarProps) {
  const weekStart = useMemo(() => startOfWeekMonday(currentDate), [currentDate]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i)), [weekStart]);
  const totalSlots = useMemo(() => ((endHour - startHour) * 60) / slotMinutes, [startHour, endHour, slotMinutes]);
  const pxPerMinute = slotHeightPx / slotMinutes;
  const dayEvents = useMemo(() => days.map((d) => events.filter((e) => sameDay(e.start, d))), [days, events]);
  const positioned = useMemo(() => dayEvents.map((evs) => layoutDay(evs)), [dayEvents]);
  const weekLabel = useMemo(() => fmtWeekLabel(toDateSafe(currentDate)), [currentDate]);

  const goPrevWeek = useCallback(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    onNavigate?.(d);
  }, [onNavigate, weekStart]);
  const goNextWeek = useCallback(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    onNavigate?.(d);
  }, [onNavigate, weekStart]);
  const goToday = useCallback(() => onNavigate?.(new Date()), [onNavigate]);

  const columnsRef = useRef<Array<HTMLDivElement | null>>([]);
  const registerColumnRef = (el: HTMLDivElement | null, idx: number) => (columnsRef.current[idx] = el);

  const handleColumnClick = (dayIdx: number, e: React.MouseEvent) => {
    if (!onSelectSlot) return;
    const el = columnsRef.current[dayIdx];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minutesFromStart = Math.floor(y / pxPerMinute) + startHour * 60;
    const rounded = Math.floor(minutesFromStart / slotMinutes) * slotMinutes;
    const s = new Date(days[dayIdx]);
    s.setHours(0, 0, 0, 0);
    s.setMinutes(rounded);
    const eDate = new Date(s.getTime() + slotMinutes * 60000);
    onSelectSlot(s, eDate);
  };

  return (
    <Box w="full">
      {/* Toolbar */}
      <HStack mb={3} px={2} spacing={2}>
        <HStack>
          <IconButton aria-label="Previous week" icon={<ChevronLeftIcon />} size="sm" onClick={goPrevWeek} />
          <Button size="sm" onClick={goToday}>Today</Button>
          <IconButton aria-label="Next week" icon={<ChevronRightIcon />} size="sm" onClick={goNextWeek} />
        </HStack>
        <Text fontWeight="semibold">{weekLabel}</Text>
        <Spacer />
      </HStack>

      {/* Grid calendar */}
      <Box
        h="calc(100vh - 220px)"
        overflowY="auto"
        sx={{ "--time-col": `${timeColWidthPx}px`, "--hdr": `${stickyHeaderHeightPx}px` } as React.CSSProperties}
        border="1px solid"
        borderColor="gray.200"
        borderRadius="lg"
      >
        <Grid
          templateRows="auto 1fr"
          templateColumns="var(--time-col) repeat(7, 1fr)"
          w="full"
          boxSizing="border-box"
        >
          {/* Empty cell top-left */}
          <GridItem
            colStart={1}
            colEnd={2}
            h="var(--hdr)"
            bg="chakra-body-bg"
            position="sticky"
            top={0}
            zIndex={2}
            borderBottom="1px solid"
            borderColor="gray.200"
          />

          {/* Header days */}
          {days.map((d, i) => (
            <GridItem
              key={i}
              h="var(--hdr)"
              position="sticky"
              top={0}
              zIndex={2}
              bg={sameDay(d, highlightDate) ? "teal.50" : "chakra-body-bg"}
              borderBottom="1px solid"
              borderLeft={i === 0 ? "1px solid" : undefined}
              borderColor="gray.200"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <Text fontWeight="semibold">{d.toLocaleDateString("en-AU", { weekday: "short", day: "2-digit" })}</Text>
            </GridItem>
          ))}

          {/* Time column */}
          <GridItem colStart={1} colEnd={2} borderRight="1px solid" borderColor="gray.200">
            {Array.from({ length: totalSlots + 1 }).map((_, idx) => {
              const mins = startHour * 60 + idx * slotMinutes;
              const h = Math.floor(mins / 60);
              const m = mins % 60;
              const label = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(2000, 0, 1, h, m));
              return (
                <Flex key={idx} h={`${slotHeightPx}px`} align="center" px={2} borderBottom="1px solid" borderColor="gray.50">
                  <Text fontSize="sm" color="gray.600">{label}</Text>
                </Flex>
              );
            })}
          </GridItem>

          {/* Day columns */}
          {days.map((d, dayIdx) => (
            <GridItem
              key={d.toISOString()}
              borderLeft="1px solid"
              borderColor="gray.200"
              position="relative"
              bg={sameDay(d, highlightDate) ? "teal.25" : undefined}
              onClick={(e) => handleColumnClick(dayIdx, e)}
            >
              {Array.from({ length: totalSlots }).map((_, idx) => (
                <Box key={idx} h={`${slotHeightPx}px`} borderBottom="1px solid" borderColor="gray.50" />
              ))}

              <Box ref={(el) => registerColumnRef(el, dayIdx)} position="absolute" inset={0} px={1}>
                {positioned[dayIdx]?.map((ev) => {
                  const startMin = minutesSinceStartOfDay(ev.start);
                  const endMin = minutesSinceStartOfDay(ev.end);
                  const visStart = startHour * 60;
                  const visEnd = endHour * 60;
                  if (endMin <= visStart || startMin >= visEnd) return null;

                  const top = (clamp(startMin, visStart, visEnd) - visStart) * pxPerMinute;
                  const height = Math.max(18, (endMin - startMin) * pxPerMinute - 2);
                  const colCount = (ev as any)._cols ?? 1;
                  const colIdx = (ev as any)._col ?? 0;
                  const widthPct = 100 / colCount;
                  const leftPct = colIdx * widthPct;

                  return (
                    <Box
                      key={String(ev.id)}
                      position="absolute"
                      top={`${top}px`}
                      left={`${leftPct}%`}
                      width={`calc(${widthPct}% - 4px)`}
                      height={`${height}px`}
                      bg={ev.color || "purple.500"}
                      color="white"
                      borderRadius="lg"
                      px={2}
                      py={1}
                      fontSize="sm"
                      lineHeight="1.1"
                      overflow="hidden"
                      boxShadow="sm"
                      title={ev.title}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEvent?.(ev);
                      }}
                    >
                      <Text noOfLines={2}>{ev.title}</Text>
                    </Box>
                  );
                })}
              </Box>
            </GridItem>
          ))}
        </Grid>
      </Box>
    </Box>
  );
}
