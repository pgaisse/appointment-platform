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
import "react-big-calendar/lib/css/react-big-calendar.css";
import "./CustomCalendar.css";
import CustomToolbar from "./CustomToolBar";
import CustomDayHeader from "./CustomDayHeader";
import { Box, useColorModeValue } from "@chakra-ui/react";
import { useMemo, useState, useCallback } from "react";

const locales = { "en-US": enUS };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

type Props = {
  events?: unknown[];
  eventDates?: string[];
  toolbar?: boolean;
  step?: number;
  timeSlots?: number;
  min?: Date;
  max?: Date;
  width?: string;
  calView?: View; // ya no permitimos cambiar, pero lo mantenemos por compat
  height?: string | number;
  onNavigate?: (newDate: Date, view: View, action: NavigateAction) => void;
  onSelectSlot?: (slotInfo: SlotInfo) => void;
  onSelectEvent?: (slotInfo: SlotInfo) => void;
  onClick?: (event: { start: Date; end: Date }) => void;
};

function CustomMinCalendar({
  width,
  toolbar = true,
  // forzamos vista mensual; ignoramos calView si viene distinto
  calView = Views.MONTH,
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
}: Props) {
  const [currentDate, setCurrentDate] = useState(new Date());

  // colores (usar hooks aquí, no dentro de callbacks)
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

  const handleNavigate = (
    newDate: Date,
    view: View,
    action: NavigateAction
  ) => {
    setCurrentDate(newDate);
    onNavigate?.(newDate, view, action);
  };

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

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
          events={(events as any) ?? []}
          startAccessor="start"
          endAccessor="end"
          date={currentDate}
          view={Views.MONTH}                 // 🔒 fija vista mensual
          views={{ month: true }}            // 🔒 solo mes disponible
          // sin onView: no permitimos cambio
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
          // ❌ sin drilldown a día/semana
          // drilldownView eliminado
          formats={{
            weekdayFormat: (d: Date) => format(d, "EEE").toUpperCase(),
            monthHeaderFormat: (d: Date) => format(d, "MMMM yyyy"),
          }}
          style={{ fontSize: "12px", border: "none", background: "transparent", height: "100%" }}
          components={{ toolbar: CustomToolbar, header: CustomDayHeader }}
        />
      </Box>
    </Box>
  );
}

export default CustomMinCalendar;
