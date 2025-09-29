// apps/frontend/src/Components/Scheduler/CustomMinCalendar.tsx
import { Box, HStack, IconButton, Text, VStack, SimpleGrid } from "@chakra-ui/react";
import { ChevronLeftIcon, ChevronRightIcon } from "@chakra-ui/icons";
import { useMemo } from "react";

export type Props = {
  height?: string;
  width?: string;
  monthDate: Date;                  // mes visible (controlado por el padre)
  selectedDate?: Date;              // día seleccionado
  onSelectDate?: (d: Date) => void; // click en día
  onNavigate?: (d: Date) => void;   // cambiar de mes (prev/next)
  eventDates?: string[];            // YYYY-MM-DD (Sydney) con eventos (dots)
};

const SYD_TZ = "Australia/Sydney";

function toSydneyYMD(d: Date | string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SYD_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(d));
  const y = parts.find(p => p.type === "year")!.value;
  const m = parts.find(p => p.type === "month")!.value;
  const day = parts.find(p => p.type === "day")!.value;
  return `${y}-${m}-${day}`;
}

// Lunes como inicio de semana
function startOfWeekSydney(date: Date) {
  const ymd = toSydneyYMD(date);
  const [y, m, dd] = ymd.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, dd));
  while (new Intl.DateTimeFormat("en-US", { timeZone: SYD_TZ, weekday: "short" }).format(base) !== "Mon") {
    base.setUTCDate(base.getUTCDate() - 1);
  }
  return base;
}

function startOfMonthSydney(date: Date) {
  const ymd = toSydneyYMD(date);
  const [y, m] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
}

function addMonths(date: Date, months: number) {
  const ymd = toSydneyYMD(date);
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + months, d));
}

export default function CustomMinCalendar({
  height = "350px",
  width = "100%",
  monthDate,
  selectedDate,
  onSelectDate,
  onNavigate,
  eventDates = [],
}: Props) {
  const visibleMonth = startOfMonthSydney(monthDate);
  const monthLabel = new Intl.DateTimeFormat("en-AU", {
    timeZone: SYD_TZ, month: "long", year: "numeric"
  }).format(new Date(visibleMonth));

  const nextMonth = () => onNavigate?.(addMonths(visibleMonth, 1));
  const prevMonth = () => onNavigate?.(addMonths(visibleMonth, -1));

  // 6 semanas x 7 días = 42 celdas
  const days = useMemo(() => {
    const firstOfMonth = startOfMonthSydney(visibleMonth);
    const gridStart = startOfWeekSydney(firstOfMonth);
    const arr: Date[] = [];
    const cursor = new Date(gridStart);
    for (let i = 0; i < 42; i++) {
      arr.push(new Date(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return arr;
  }, [visibleMonth]);

  const eventSet = useMemo(() => new Set(eventDates), [eventDates]);
  const selectedYMD = selectedDate ? toSydneyYMD(selectedDate) : null;
  const visibleMonthNum = parseInt(toSydneyYMD(visibleMonth).split("-")[1], 10);

  return (
    <VStack align="stretch" spacing={3} h={height} w={width}>
      {/* Header navegación */}
      <HStack justify="space-between">
        <IconButton
          aria-label="Previous month"
          icon={<ChevronLeftIcon />}
          size="sm"
          variant="ghost"
          onClick={prevMonth}
        />
        <Text fontWeight="bold">{monthLabel}</Text>
        <IconButton
          aria-label="Next month"
          icon={<ChevronRightIcon />}
          size="sm"
          variant="ghost"
          onClick={nextMonth}
        />
      </HStack>

      {/* Encabezado de semana en GRID (7 columnas fijas) */}
      <SimpleGrid columns={7} spacing={1} px={1} fontSize="sm" color="gray.500">
        {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => (
          <Box key={d} textAlign="center">{d}</Box>
        ))}
      </SimpleGrid>

      {/* Días en GRID (7 columnas fijas) */}
      <SimpleGrid columns={7} spacing={1} flex="1">
        {days.map((day, idx) => {
          const ymd = toSydneyYMD(day);
          const isSelected = selectedYMD === ymd;
          const isEventDay = eventSet.has(ymd);
          const dayMonth = parseInt(ymd.split("-")[1], 10);
          const isCurrentMonth = dayMonth === visibleMonthNum;

          return (
            <Box
              key={idx}
              role="button"
              tabIndex={0}
              onClick={() => onSelectDate?.(new Date(day))}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onSelectDate?.(new Date(day));
              }}
              h="44px"
              borderRadius="md"
              borderWidth="1px"                 // borde constante (no cambia el ancho)
              borderColor={isSelected ? "blue.400" : "transparent"}
              boxShadow={isSelected ? "0 0 0 2px var(--chakra-colors-blue-400)" : "none"} // resalta sin alterar layout
              bg={isSelected ? "blue.500" : isCurrentMonth ? "transparent" : "blackAlpha.200"}
              _dark={{
                bg: isSelected ? "blue.400" : isCurrentMonth ? "transparent" : "whiteAlpha.200",
              }}
              position="relative"
              cursor="pointer"
              _hover={{ borderColor: isSelected ? "blue.500" : "gray.400" }}
              display="flex"
              alignItems="center"
              justifyContent="center"
              aria-selected={isSelected}
            >
              <Text
                fontSize="sm"
                color={isSelected ? "white" : isCurrentMonth ? "inherit" : "gray.500"}
                // Opcional: monoespaciado para números uniformes
                // fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
              >
                {new Intl.DateTimeFormat("en-AU", { timeZone: SYD_TZ, day: "2-digit" }).format(day)}
              </Text>

              {/* Indicador de evento (dot) */}
              {isEventDay && (
                <Box
                  position="absolute"
                  bottom="6px"
                  w="6px"
                  h="6px"
                  borderRadius="full"
                  bg={isSelected ? "white" : "blue.400"}
                  _dark={{ bg: isSelected ? "white" : "blue.300" }}
                />
              )}
            </Box>
          );
        })}
      </SimpleGrid>
    </VStack>
  );
}
