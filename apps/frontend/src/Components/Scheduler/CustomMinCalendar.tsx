import {
  Calendar,
  dateFnsLocalizer,
  Views,
  NavigateAction,
  SlotInfo,
  View,
} from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import CustomToolbar from "./CustomToolBar";
import CustomDayHeader from "./CustomDayHeader";
import { Box, useColorModeValue } from "@chakra-ui/react";
import { useMemo, useState, useCallback } from "react";
import "react-big-calendar/lib/css/react-big-calendar.css";

/** Locales date-fns */
const locales = { "en-US": enUS };

/** ✅ Usa el `date` provisto por RBC (evita desalinear semanas) */
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales,
});

type EventLike = {
  start: Date | string | number;
  end?: Date | string | number;
  allDay?: boolean;
  [k: string]: any;
};

type Props = {
  events?: EventLike[];
  eventDates?: string[];
  toolbar?: boolean;
  step?: number;
  timeSlots?: number;
  min?: Date;
  max?: Date;
  width?: string;
  calView?: View; // fijo en month, se mantiene por compat
  height?: string | number;
  onNavigate?: (newDate: Date, view: View, action: NavigateAction) => void;
  onSelectSlot?: (slotInfo: SlotInfo) => void;
  onSelectEvent?: (slotInfo: SlotInfo) => void;
  onClick?: (event: { start: Date; end: Date }) => void;

  /** Opcional: fuerza tratar eventos como “de día” (sin hora). Por defecto false. */
  forceDateOnly?: boolean;
};

/* ========================  Helpers TZ / Normalización  ======================== */

/** Parser seguro para Date | string | number */
function parseAny(value: any): Date {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") return new Date(value);
  return new Date(value as any);
}

/**
 * Crea una fecha LOCAL a las 00:00 preservando Y/M/D en **UTC** del Date original.
 * Ej: "2025-10-04T14:00:00Z" -> toma UTC(Y=2025,M=9,D=4) y crea new Date(2025,9,4,00:00 local).
 * Esto ancla el día calendario y evita que "salte" por la zona horaria.
 */
function fixToLocalCalendarDayFromUTC(d: Date): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  return new Date(y, m, day, 0, 0, 0, 0);
}

/** Heurística: ¿parece "fecha sin hora" (medianoche o casi)? */
function looksDateOnly(d: Date): boolean {
  const h = d.getHours();
  const m = d.getMinutes();
  const s = d.getSeconds();
  const ms = d.getMilliseconds();
  return (h === 0 && m === 0 && s === 0 && ms === 0) || h < 1; // tolera <1h (DST)
}

/** ¿Se comporta como all-day? Si el backend no envía allDay, inferimos. */
function isAllDayLike(ev: EventLike, start: Date, end?: Date): boolean {
  if (ev.allDay) return true;
  if (!end) return looksDateOnly(start);
  return looksDateOnly(start) && looksDateOnly(end);
}

/* ============================================================================ */

function CustomMinCalendar({
  width,
  toolbar = true,
  calView = Views.MONTH, // fijo mensual
  timeSlots = 1,
  min = new Date(2025, 0, 1, 9, 30),
  max = new Date(2025, 0, 1, 19, 0),
  height = "auto",
  eventDates,
  onNavigate,
  onSelectSlot,
  onSelectEvent,
  onClick,
  events = [],
  forceDateOnly = false,
}: Props) {
  const [currentDate, setCurrentDate] = useState(new Date());

  /** 🎯 Normaliza eventos antes de pasarlos a RBC (evita corrimientos de día) */
  const normalizedEvents = useMemo(() => {
    return (events as EventLike[]).map((raw) => {
      const start0 = parseAny(raw.start);
      const end0 = raw.end ? parseAny(raw.end) : start0;

      // Tratamiento de "fecha sin hora" o all-day
      if (forceDateOnly || isAllDayLike(raw, start0, end0)) {
        const startLocal = fixToLocalCalendarDayFromUTC(start0);
        // Para RBC all-day, el end es exclusivo (día siguiente)
        const desiredEnd =
          raw.end ? fixToLocalCalendarDayFromUTC(end0) : new Date(startLocal.getFullYear(), startLocal.getMonth(), startLocal.getDate() + 1);

        const endLocal =
          desiredEnd.getTime() === startLocal.getTime()
            ? new Date(startLocal.getFullYear(), startLocal.getMonth(), startLocal.getDate() + 1)
            : desiredEnd;

        return { ...raw, allDay: true, start: startLocal, end: endLocal };
      }

      // Eventos con hora real: se dejan como Date (local)
      return { ...raw, start: start0, end: end0 };
    });
  }, [events, forceDateOnly]);

  // Colores (hooks SOLO aquí)
  const bg = useColorModeValue("white", "gray.900");
  const border = useColorModeValue("blackAlpha.200", "whiteAlpha.200");
  const subtle = useColorModeValue("gray.50", "whiteAlpha.100");
  const accent = useColorModeValue("#22c55e", "#34d399");
  const todayRing = useColorModeValue("#0ea5e9", "#38bdf8");
  const markedBg = useColorModeValue("#e8f7ef", "rgba(34,197,94,0.12)");

  const normalizeKey = (d: Date) => ({
    dStr: d.toDateString(),
    ymd: format(d, "yyyy-MM-dd"),
  });

  const markedSet = useMemo(() => {
    const set = new Set<string>();
    (eventDates ?? []).forEach((s) => {
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        const { dStr, ymd } = normalizeKey(d);
        set.add(dStr);
        set.add(ymd);
      } else {
        set.add(s);
      }
    });
    return set;
  }, [eventDates]);

  const handleNavigate = (newDate: Date, view: View, action: NavigateAction) => {
    setCurrentDate(newDate);
    onNavigate?.(newDate, view, action);
  };

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  /** Estilo por-día (sin hooks) */
  const dayPropGetter = useCallback(
    (date: Date) => {
      const { dStr, ymd } = normalizeKey(date);
      const isMarked = markedSet.has(dStr) || markedSet.has(ymd);
      const today = isSameDay(date, new Date());

      const style: React.CSSProperties = {
        transition: "background 180ms ease, transform 120ms ease",
        background: isMarked ? markedBg : "transparent",
        boxShadow: today ? `inset 0 0 0 2px ${todayRing}` : undefined,
        borderRadius: today ? 12 : undefined,
      };
      return { className: isMarked ? "is-marked" : undefined, style };
    },
    [markedSet, markedBg, todayRing]
  );

  const messages = {
    today: "Today",
    previous: "Prev",
    next: "Next",
    month: "Month",
    showMore: (total: number) => `+${total} more`,
  };

  /** CSS premium, scopeado al wrapper para no interferir con otros calendarios */
  const premiumCss = `
  [data-rbc="premium"] .rbc-month-view { border: none !important; background: transparent !important; }
  [data-rbc="premium"] .rbc-toolbar {
    padding: 8px 10px; border-bottom: 1px solid ${border};
    background: linear-gradient(180deg, ${subtle}, transparent);
  }
  [data-rbc="premium"] .rbc-header {
    padding: 8px 0; font-weight: 700; letter-spacing: .02em;
    text-transform: uppercase; font-size: 11px; border-bottom: 1px solid ${border};
  }
  [data-rbc="premium"] .rbc-row-bg .rbc-day-bg { transition: background 180ms ease; border-right: 1px solid ${border}; }
  [data-rbc="premium"] .rbc-row-bg .rbc-day-bg:last-child { border-right: none; }
  [data-rbc="premium"] .rbc-off-range-bg { background: transparent; opacity: .55; }
  [data-rbc="premium"] .rbc-date-cell { padding: 6px 8px; }
  [data-rbc="premium"] .rbc-date-cell > button.rbc-button-link {
    border-radius: 10px; padding: 2px 6px; line-height: 1.2; font-weight: 600;
    transition: transform 120ms ease, background 180ms ease, box-shadow 180ms ease;
  }
  [data-rbc="premium"] .rbc-month-row:hover { background: ${subtle}; }
  [data-rbc="premium"] .is-marked .rbc-date-cell > button.rbc-button-link {
    background: ${accent}1F; box-shadow: 0 0 0 1px ${accent}33 inset;
  }
  [data-rbc="premium"] .rbc-today .rbc-date-cell > button.rbc-button-link {
    box-shadow: 0 0 0 2px ${todayRing} inset;
  }
  [data-rbc="premium"] .rbc-selected-cell { background: ${accent}22 !important; }
  [data-rbc="premium"] .rbc-event {
    border-radius: 10px; border: 1px solid ${accent}55; background: ${accent}; opacity: .92; padding: 2px 6px;
  }`;

  return (
    <Box
      w="100%"
      height={height}
      maxW={width}
      bg={bg}
      border="1px solid"
      borderColor={border}
      rounded="2xl"
      shadow="xl"
      overflow="hidden"
      role="group"
      aria-label="Calendar"
    >
      <style>{premiumCss}</style>

      <Box
        data-rbc="premium"
        px={{ base: 2, md: 3 }}
        pb={{ base: 2, md: 3 }}
        pt={{ base: 2, md: 2 }}
        sx={{ "& .rbc-calendar": { minHeight: 320 } }}
      >
        <Calendar
          localizer={localizer}
          events={normalizedEvents}      // ✅ eventos ya corregidos
          startAccessor="start"
          endAccessor="end"
          date={currentDate}
          view={Views.MONTH}             // 🔒 solo mensual
          views={{ month: true }}
          onNavigate={handleNavigate}
          timeslots={timeSlots}
          min={min}
          max={max}
          selectable
          onSelectSlot={(slot) => {
            onSelectSlot?.(slot);
            if (onClick) onClick({ start: slot.start as Date, end: slot.end as Date });
          }}
          onSelectEvent={onSelectEvent as any}
          dayPropGetter={dayPropGetter}
          toolbar={toolbar}
          popup
          messages={messages}
          formats={{
            weekdayFormat: (d: Date) => format(d, "EEE").toUpperCase(),
            monthHeaderFormat: (d: Date) => format(d, "MMMM yyyy"),
          }}
          style={{
            fontSize: "12px",
            border: "none",
            background: "transparent",
            height: "100%",
          }}
          components={{ toolbar: CustomToolbar, header: CustomDayHeader }}
        />
      </Box>
    </Box>
  );
}

export default CustomMinCalendar;
