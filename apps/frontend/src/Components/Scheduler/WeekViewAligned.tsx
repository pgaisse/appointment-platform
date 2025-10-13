import React, { useMemo } from "react";
import { Box, Grid, GridItem, Flex, Text } from "@chakra-ui/react";

export type EventItem = {
  id: string | number;
  title: string;
  start: Date; // local Date
  end: Date;   // local Date
  color?: string; // optional badge color
};

type Props = {
  weekStart: Date;         // Monday of the visible week
  events?: EventItem[];    // all events in the visible week
  startHour?: number;      // default 8
  endHour?: number;        // default 18
  slotMinutes?: number;    // default 30
  slotHeightPx?: number;   // default 40
  timeColWidthPx?: number; // default 64
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function minutesSinceStartOfDay(d: Date) {
  const sod = startOfDay(d);
  return Math.max(0, Math.round((d.getTime() - sod.getTime()) / 60000));
}
function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Layout overlapping events for one day.
 * Assigns each event a column index and column count so they render side-by-side.
 */
function layoutDay(events: EventItem[]) {
  type E = EventItem & {
    _startMin: number;
    _endMin: number;
    _col?: number;
    _cols?: number;
  };

  const items: E[] = events
    .map((e) => ({
      ...e,
      _startMin: minutesSinceStartOfDay(e.start),
      _endMin: minutesSinceStartOfDay(e.end),
    }))
    .sort((a, b) => a._startMin - b._startMin || a._endMin - b._endMin);

  const laidOut: E[] = [];
  let group: E[] = [];
  let active: E[] = [];

  const flush = () => {
    if (group.length === 0) return;

    // Greedy column packing
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
    const colCount = cols.length;
    for (const ev of group) {
      ev._cols = colCount;
      laidOut.push(ev);
    }

    group = [];
    active = [];
  };

  for (const ev of items) {
    // remove non-overlapping from active
    active = active.filter((a) => a._endMin > ev._startMin);
    if (active.length === 0 && group.length) {
      flush();
    }
    active.push(ev);
    group.push(ev);
  }
  flush();

  return laidOut;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function WeekViewAligned({
  weekStart,
  events = [],
  startHour = 8,
  endHour = 18,
  slotMinutes = 30,
  slotHeightPx = 40,
  timeColWidthPx = 64,
}: Props) {
  const days = useMemo(() => {
    const arr: Date[] = [];
    const ws = new Date(weekStart);
    ws.setHours(0, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      const d = new Date(ws);
      d.setDate(ws.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, [weekStart]);

  const times = useMemo(() => {
    const out: string[] = [];
    for (let h = startHour; h <= endHour; h++) {
      for (let m = 0; m < 60; m += slotMinutes) {
        const hh = ((h + 11) % 12) + 1;
        const mm = m.toString().padStart(2, "0");
        const ampm = h < 12 ? "AM" : "PM";
        out.push(`${hh}:${mm} ${ampm}`);
      }
    }
    return out;
  }, [startHour, endHour, slotMinutes]);

  const pxPerMinute = slotHeightPx / slotMinutes;
  const totalSlots =
    ((endHour - startHour) * 60) / slotMinutes + 1;

  const dayEvents = useMemo(() => {
    return days.map((day) =>
      events.filter((e) => sameDay(e.start, day)),
    );
  }, [days, events]);

  const positioned = useMemo(() => {
    return dayEvents.map((evs) => layoutDay(evs));
  }, [dayEvents]);

  return (
    <Box
      h="calc(100vh - 180px)"
      overflowY="auto"
      sx={
        {
          "--time-col": `${timeColWidthPx}px`,
        } as React.CSSProperties
      }
    >
      <Grid
        templateRows="auto 1fr"
        templateColumns="var(--time-col) repeat(7, 1fr)"
        w="full"
        boxSizing="border-box"
      >
        {/* Header left spacer */}
        <GridItem
          colStart={1}
          colEnd={2}
          h="44px"
          bg="chakra-body-bg"
          position="sticky"
          top={0}
          zIndex={2}
          borderBottom="1px solid"
          borderColor="gray.200"
        />
        {/* Header day cells */}
        {days.map((d, i) => (
          <GridItem
            key={i}
            h="44px"
            bg="chakra-body-bg"
            position="sticky"
            top={0}
            zIndex={2}
            borderBottom="1px solid"
            borderLeft={i === 0 ? "1px solid" : undefined}
            borderColor="gray.200"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <Text fontWeight="semibold">
              {d.toLocaleDateString(undefined, {
                weekday: "short",
                day: "2-digit",
              })}
            </Text>
          </GridItem>
        ))}

        {/* Time axis */}
        <GridItem
          colStart={1}
          colEnd={2}
          borderRight="1px solid"
          borderColor="gray.200"
        >
          {Array.from({ length: totalSlots }).map((_, idx) => (
            <Flex
              key={idx}
              h={`${slotHeightPx}px`}
              align="center"
              px={2}
              borderBottom="1px solid"
              borderColor="gray.50"
            >
              <Text fontSize="sm" color="gray.600">
                {times[idx] ?? ""}
              </Text>
            </Flex>
          ))}
        </GridItem>

        {/* Day columns */}
        {days.map((d, dayIdx) => (
          <GridItem
            key={d.toISOString()}
            borderLeft="1px solid"
            borderColor="gray.200"
            position="relative"
          >
            {/* background slot lines */}
            {Array.from({ length: totalSlots }).map((_, idx) => (
              <Box
                key={idx}
                h={`${slotHeightPx}px`}
                borderBottom="1px solid"
                borderColor="gray.50"
              />
            ))}

            {/* events for this day, absolutely positioned */}
            <Box position="absolute" inset={0} px={1}>
              {positioned[dayIdx]?.map((ev) => {
                const startMin = minutesSinceStartOfDay(ev.start);
                const endMin = minutesSinceStartOfDay(ev.end);
                const top =
                  (startMin - startHour * 60) * pxPerMinute;
                const height = Math.max(
                  18,
                  (endMin - startMin) * pxPerMinute - 2,
                );
                const cols = ev._cols ?? 1;
                const col = ev._col ?? 0;
                const widthPct = 100 / cols;
                const leftPct = col * widthPct;

                // clamp to visible time window
                if (endMin < startHour * 60 || startMin > endHour * 60) {
                  return null;
                }

                return (
                  <Box
                    key={ev.id}
                    position="absolute"
                    top={`${Math.max(0, top)}px`}
                    left={`${leftPct}%`}
                    width={`calc(${widthPct}% - 4px)`}
                    height={`${height}px`}
                    bg={ev.color || "purple.500"}
                    color="white"
                    borderRadius="lg"
                    px={3}
                    py={2}
                    boxShadow="sm"
                    overflow="hidden"
                    display="flex"
                    alignItems="center"
                    lineHeight="1.1"
                    title={`${ev.title}`}
                  >
                    <Text
                      fontSize="sm"
                      noOfLines={2}
                      textOverflow="ellipsis"
                    >
                      {ev.title}
                    </Text>
                  </Box>
                );
              })}
            </Box>
          </GridItem>
        ))}
      </Grid>
    </Box>
  );
}
