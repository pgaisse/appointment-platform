import React, { useEffect, useState, useMemo, useCallback, memo } from "react";
import {
  Calendar as BaseCalendar,
  Views,
  SlotInfo,
  View,
  DateLocalizer,
  dateFnsLocalizer,
} from "react-big-calendar";
import withDragAndDrop, { EventInteractionArgs } from "react-big-calendar/lib/addons/dragAndDrop";
import { format, parse, startOfWeek as dfStartOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import "./CustomCalendar.css";

import CustomDayHeader from "./CustomDayHeader";
import CustomTimeGutterHeader from "./CustomTimeGutterHeader";
import { CalendarEvent, EventResizeDoneArg } from "@/types";
import eventStyleGetter from "./eventStyleGetter";
import { DateRange } from "@/Hooks/Handles/useSlotSelection";
import { UseFormSetValue, UseFormTrigger } from "react-hook-form";
import { Box, useToast } from "@chakra-ui/react";
import { AppointmentForm } from "@/schemas/AppointmentsSchema";

// Locales para date-fns
const locales = { "en-US": enUS };

// Localizador de fechas (firma correcta del startOfWeek) - memoizado fuera del componente
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => dfStartOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales,
});

// Wrap del Calendar para habilitar drag & drop - memoizado fuera del componente
const Calendar = withDragAndDrop<CalendarEvent>(BaseCalendar);

// Constantes fuera del componente para evitar recreación
const MAX_SLOTS = 10;
const TIME_SLOTS = 12; // 12 slots de 5 min = 60 min (1 hora)
const STEP = 5;
const DAY_START_HOUR = 6;
const DAY_END_HOUR = 23;

// ---------- Utils de fecha seguros ----------
const toDate = (v: unknown): Date | null => {
  if (v instanceof Date) return v;
  const d = new Date(v as any);
  return isNaN(d.getTime()) ? null : d;
};

const coerceEvent = (e: Partial<CalendarEvent>): CalendarEvent | null => {
  const start = toDate(e.start as any);
  const end = toDate(e.end as any);
  if (!start || !end) return null;
  return { title: e.title ?? "", start, end, desc: e.desc || "", color: (e as any).color };
};

const coerceRange = (r: DateRange): DateRange | null => {
  const s = toDate(r.startDate);
  const e = toDate(r.endDate);
  if (!s || !e) return null;
  return { startDate: s, endDate: e };
};
// --------------------------------------------

// 🔹 Helper para armar el título: "{min} min" - optimizado fuera del componente
const makeEventTitle = (start: Date, end: Date) => {
  const mins = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
  return `${mins} min`;
};

// TimeLabel component memoizado fuera del componente principal
const TimeLabel = memo(({ value, localizer }: { value?: Date; localizer: DateLocalizer }) => {
  const txt = value ? localizer.format(value, "h:mm a") : "";
  return <div style={{ fontSize: 12, textAlign: "center", color: "gray" }}>{txt}</div>;
});
TimeLabel.displayName = "TimeLabel";

type Props = {
  setSelectedAppDates?: React.Dispatch<React.SetStateAction<DateRange[]>>;
  selectedAppDates?: DateRange[];
  trigger?: UseFormTrigger<AppointmentForm>;
  setValue?: UseFormSetValue<any>;
  height: string;
  calView?: View;
  offset: number;
  colorEvent: string;
  toolbar?: boolean;
  onClose?: () => void;
};

function CustomCalendarEntryForm({
  onClose: _onClose,
  setValue,
  trigger,
  setSelectedAppDates,
  selectedAppDates,
  colorEvent,
  offset,
  height,
  toolbar = true,
  calView = Views.WEEK,
}: Props) {
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [currentView, setCurrentView] = useState<View>(calView);
  
  const toast = useToast();

  // ✅ Normaliza de entrada lo que venga por props - memoizado
  const initialRange = useMemo<DateRange[] | null>(() => 
    selectedAppDates
      ? (selectedAppDates.map(coerceRange).filter(Boolean) as DateRange[])
      : null,
    [] // Solo ejecutar una vez al montar
  );

  const [range, setRange] = useState<DateRange[] | null>(initialRange);

  // ✅ events como array (no undefined)
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  // 🔹 Rango horario extendido: 6:00 AM - 11:00 PM - memoizado
  const { dayMin, dayMax } = useMemo(() => {
    const min = new Date(currentDate);
    min.setHours(DAY_START_HOUR, 0, 0, 0);
    const max = new Date(currentDate);
    max.setHours(DAY_END_HOUR, 0, 0, 0);
    return { dayMin: min, dayMax: max };
  }, [currentDate]);

  // mark onClose consumed to avoid unused warnings
  void _onClose;

  const handleNavigate = useCallback((newDate: Date): void => {
    setCurrentDate(newDate);
  }, []);

  const handleSelectSlot = useCallback((slotInfo: SlotInfo): void => {
    const start = toDate(slotInfo.start);
    if (!start) return;
    const end = new Date(start.getTime() + offset * 60 * 60 * 1000);

    setRange((prev) => {
      const list = prev ?? [];
      if (list.length >= MAX_SLOTS) {
        toast({
          title: `Maximum of ${MAX_SLOTS} appointment slots reached`,
          status: "warning",
          duration: 2500,
          isClosable: true,
        });
        return list; // no change
      }
      const exists = list.some(
        (r) => r.startDate.getTime() === start.getTime() && r.endDate.getTime() === end.getTime()
      );
      if (exists) {
        toast({
          title: "Slot already added",
          status: "info",
          duration: 1800,
          isClosable: true,
        });
        return list;
      }
      return [...list, { startDate: start, endDate: end }];
    });
  }, [offset, toast]);

  const handleSelectEvent = useCallback((ev: CalendarEvent): void => {
    const startTime = ev.start?.getTime();
    const endTime = ev.end?.getTime();
    if (!startTime || !endTime) return;

    setEvents((prev) =>
      prev.filter(
        (e) =>
          (e.start ? e.start : new Date()).getTime() !== startTime ||
          (e.end ? e.end : new Date()).getTime() !== endTime
      )
    );

    setRange((prev) =>
      (prev ?? []).filter(
        (r) => r.startDate.getTime() !== startTime || r.endDate.getTime() !== endTime
      )
    );
  }, []);

  const handleEventDrop = useCallback((args: EventInteractionArgs<CalendarEvent>) => {
    const { event: droppedEvent, start, end } = args;
    const startDate = toDate(start);
    const endDate = toDate(end);
    if (!startDate || !endDate) return;

    const updated: CalendarEvent = {
      ...droppedEvent,
      start: startDate,
      end: endDate,
      title: makeEventTitle(startDate, endDate),
    };

    setEvents((prev) => prev.map((e) => (e === droppedEvent ? updated : e)));

    setRange((prev) =>
      (prev ?? []).map((r) =>
        r.startDate.getTime() === (droppedEvent.start ? droppedEvent.start : new Date()).getTime() &&
        r.endDate.getTime() === (droppedEvent.end ? droppedEvent.end : new Date()).getTime()
          ? { startDate: startDate, endDate: endDate }
          : r
      )
    );
  }, []);

  const handleEventResize = useCallback((args: EventInteractionArgs<CalendarEvent>) => {
    const { event: resizedEvent, start, end } = args as EventResizeDoneArg<CalendarEvent>;
    const startDate = toDate(start);
    const endDate = toDate(end);
    if (!startDate || !endDate) return;

    const updated: CalendarEvent = {
      ...resizedEvent,
      start: startDate,
      end: endDate,
      title: makeEventTitle(startDate, endDate),
    };

    setEvents((prev) => prev.map((e) => (e === resizedEvent ? updated : e)));

    setRange((prev) =>
      (prev ?? []).map((r) =>
        r.startDate.getTime() === (resizedEvent.start ? resizedEvent.start : new Date()).getTime() &&
        r.endDate.getTime() === (resizedEvent.end ? resizedEvent.end : new Date()).getTime()
          ? { startDate: startDate, endDate: endDate }
          : r
      )
    );
  }, []);

  // ✅ Memoizar events para evitar recalcular en cada render
  const memoizedEvents = useMemo(() => {
    return (range ?? [])
      .map((item) =>
        coerceEvent({
          title: makeEventTitle(item.startDate, item.endDate),
          start: item?.startDate,
          end: item?.endDate,
          desc: "Date Selected",
          color: colorEvent,
        })
      )
      .filter(Boolean) as CalendarEvent[];
  }, [range, colorEvent]);

  // ✅ Sincronizar events con el memo - solo cuando cambien los memoized events
  useEffect(() => {
    setEvents(memoizedEvents);
  }, [memoizedEvents]);

  // ✅ Sincronizar con form - separado y optimizado con refs estables
  useEffect(() => {
    if (setSelectedAppDates && range) setSelectedAppDates(range);
    if (setValue && range !== null) setValue("selectedAppDates", range);
    if (trigger) trigger("selectedAppDates");
  }, [range, setSelectedAppDates, setValue, trigger]);

  // 🏷️ Adapter memoizado para TimeLabel
  const TimeSlotWrapperAdapter = useCallback<React.FC>((props) => {
    return <TimeLabel {...(props as any)} localizer={localizer} />;
  }, []);

  // Memoizar accesores de eventos para evitar recreación
  const startAccessor = useCallback((e: CalendarEvent) => toDate(e.start)!, []);
  const endAccessor = useCallback((e: CalendarEvent) => toDate(e.end)!, []);
  const draggableAccessor = useCallback(() => true, []);
  const handleViewChange = useCallback((view: View) => setCurrentView(view), []);

  // Memoizar views array
  const views = useMemo(() => [Views.WEEK, Views.DAY], []);

  // Memoizar components object para evitar recreación
  const calendarComponents = useMemo(() => ({
    header: CustomDayHeader,
    timeSlotWrapper: TimeSlotWrapperAdapter,
    timeGutterHeader: CustomTimeGutterHeader,
  }), [TimeSlotWrapperAdapter]);

  return (
    <Box w="100%" overflow="auto" height={height}>
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor={startAccessor}
        endAccessor={endAccessor}
        date={currentDate}
        view={currentView}
        defaultView={calView}
        onView={handleViewChange}
        onNavigate={handleNavigate}
        views={views}
        step={STEP}
        timeslots={TIME_SLOTS}
        min={dayMin}
        max={dayMax}
        onSelectSlot={handleSelectSlot}
        onSelectEvent={handleSelectEvent}
        onEventDrop={handleEventDrop}
        onEventResize={handleEventResize}
        resizable
        draggableAccessor={draggableAccessor}
        toolbar={toolbar}
        selectable="ignoreEvents"
        eventPropGetter={eventStyleGetter}
        components={calendarComponents}
      />
    </Box>
  );
}

export default CustomCalendarEntryForm;
