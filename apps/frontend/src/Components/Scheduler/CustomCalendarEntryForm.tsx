import React, { useEffect, useState, useMemo, useCallback, memo, useRef } from "react";
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

// ============================================================================
// CONSTANTS (moved outside for better performance)
// ============================================================================
const locales = { "en-US": enUS };
const MAX_SLOTS = 10;
const TIME_SLOTS = 12;
const STEP = 5;
const DAY_START_HOUR = 6;
const DAY_END_HOUR = 23;
const VIEWS: View[] = [Views.WEEK, Views.DAY];

// ============================================================================
// LOCALIZER (singleton, computed once)
// ============================================================================
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => dfStartOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales,
});

// ============================================================================
// CALENDAR (singleton, wrapped once)
// ============================================================================
const Calendar = withDragAndDrop<CalendarEvent>(BaseCalendar);

// ============================================================================
// UTILS
// ============================================================================
const toDate = (v: unknown): Date | null => {
  if (v instanceof Date) return v;
  const d = new Date(v as any);
  return isNaN(d.getTime()) ? null : d;
};

const makeEventTitle = (start: Date, end: Date): string => {
  const mins = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
  return `${mins} min`;
};

// Serializar range para comparación eficiente
const serializeRange = (ranges: DateRange[]): string => {
  return ranges.map(r => `${r.startDate.getTime()}-${r.endDate.getTime()}`).sort().join('|');
};

// ============================================================================
// MEMOIZED COMPONENTS
// ============================================================================
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
  onClose,
  setValue,
  trigger,
  setSelectedAppDates,
  selectedAppDates = [],
  colorEvent,
  offset,
  height,
  toolbar = true,
  calView = Views.WEEK,
}: Props) {
  // ============================================================================
  // STATE
  // ============================================================================
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [currentView, setCurrentView] = useState<View>(calView);
  const [localRanges, setLocalRanges] = useState<DateRange[]>(selectedAppDates);
  
  const toast = useToast();
  
  // ============================================================================
  // REFS para tracking y prevenir notificaciones duplicadas
  // ============================================================================
  const lastNotifiedRef = useRef<string>("");
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // ============================================================================
  // SYNC: selectedAppDates (external) -> localRanges (internal)
  // Solo cuando realmente cambie desde afuera
  // ============================================================================
  useEffect(() => {
    const serialized = serializeRange(selectedAppDates);
    const currentSerialized = serializeRange(localRanges);
    
    if (serialized !== currentSerialized) {
      setLocalRanges(selectedAppDates);
    }
  }, [selectedAppDates]); // Solo cuando selectedAppDates cambie

  // ============================================================================
  // SYNC: localRanges -> parent (con debounce para mejor performance)
  // ============================================================================
  useEffect(() => {
    const serialized = serializeRange(localRanges);
    
    // Solo notificar si realmente cambió
    if (serialized === lastNotifiedRef.current) return;
    
    // Debounce: esperar 100ms antes de notificar al padre
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    
    syncTimerRef.current = setTimeout(() => {
      lastNotifiedRef.current = serialized;
      
      // Notificar al padre
      if (setSelectedAppDates) {
        setSelectedAppDates(localRanges);
      }
      if (setValue) {
        setValue("selectedAppDates", localRanges, { 
          shouldDirty: true,
          shouldValidate: false // Evitar validación en cada cambio
        });
      }
      if (trigger) {
        trigger("selectedAppDates");
      }
    }, 100);
    
    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [localRanges, setSelectedAppDates, setValue, trigger]);

  // ============================================================================
  // MEMOIZED VALUES
  // ============================================================================
  
  // Calcular min/max del día
  const { dayMin, dayMax } = useMemo(() => {
    const min = new Date(currentDate);
    min.setHours(DAY_START_HOUR, 0, 0, 0);
    const max = new Date(currentDate);
    max.setHours(DAY_END_HOUR, 0, 0, 0);
    return { dayMin: min, dayMax: max };
  }, [currentDate]);

  // Convertir ranges a events (memoizado agresivamente)
  const events = useMemo<CalendarEvent[]>(() => {
    return localRanges
      .map((r): CalendarEvent | null => {
        const start = toDate(r.startDate);
        const end = toDate(r.endDate);
        if (!start || !end) return null;
        
        return {
          title: makeEventTitle(start, end),
          start,
          end,
          desc: "Date Selected",
          color: colorEvent,
        };
      })
      .filter((e): e is CalendarEvent => e !== null);
  }, [localRanges, colorEvent]);

  // mark onClose consumed to avoid unused warnings
  void onClose;

  // ============================================================================
  // HANDLERS (todos memoizados para estabilidad)
  // ============================================================================
  
  const handleNavigate = useCallback((newDate: Date): void => {
    setCurrentDate(newDate);
  }, []);

  const handleViewChange = useCallback((view: View) => {
    setCurrentView(view);
  }, []);

  const handleSelectSlot = useCallback((slotInfo: SlotInfo): void => {
    const start = toDate(slotInfo.start);
    if (!start) return;
    
    const end = new Date(start.getTime() + offset * 60 * 60 * 1000);

    setLocalRanges((prev) => {
      // Validar límite de slots
      if (prev.length >= MAX_SLOTS) {
        toast({
          title: `Maximum of ${MAX_SLOTS} appointment slots reached`,
          status: "warning",
          duration: 2500,
          isClosable: true,
        });
        return prev;
      }
      
      // Validar duplicados
      const exists = prev.some(
        (r) => r.startDate.getTime() === start.getTime() && r.endDate.getTime() === end.getTime()
      );
      
      if (exists) {
        toast({
          title: "Slot already added",
          status: "info",
          duration: 1800,
          isClosable: true,
        });
        return prev;
      }
      
      // Agregar nuevo slot
      return [...prev, { startDate: start, endDate: end }];
    });
  }, [offset, toast]);

  const handleSelectEvent = useCallback((ev: CalendarEvent): void => {
    const startTime = ev.start?.getTime();
    const endTime = ev.end?.getTime();
    if (!startTime || !endTime) return;

    // Remover el slot seleccionado
    setLocalRanges((prev) =>
      prev.filter(
        (r) => r.startDate.getTime() !== startTime || r.endDate.getTime() !== endTime
      )
    );
  }, []);

  const handleEventDrop = useCallback((args: EventInteractionArgs<CalendarEvent>) => {
    const { event: droppedEvent, start, end } = args;
    const startDate = toDate(start);
    const endDate = toDate(end);
    if (!startDate || !endDate) return;

    const originalStart = droppedEvent.start?.getTime();
    const originalEnd = droppedEvent.end?.getTime();
    if (!originalStart || !originalEnd) return;

    // Actualizar el rango movido
    setLocalRanges((prev) =>
      prev.map((r) =>
        r.startDate.getTime() === originalStart && r.endDate.getTime() === originalEnd
          ? { startDate, endDate }
          : r
      )
    );
  }, []);

  const handleEventResize = useCallback((args: EventInteractionArgs<CalendarEvent>) => {
    const { event: resizedEvent, start, end } = args as EventResizeDoneArg<CalendarEvent>;
    const startDate = toDate(start);
    const endDate = toDate(end);
    if (!startDate || !endDate) return;

    const originalStart = resizedEvent.start?.getTime();
    const originalEnd = resizedEvent.end?.getTime();
    if (!originalStart || !originalEnd) return;

    // Actualizar el rango redimensionado
    setLocalRanges((prev) =>
      prev.map((r) =>
        r.startDate.getTime() === originalStart && r.endDate.getTime() === originalEnd
          ? { startDate, endDate }
          : r
      )
    );
  }, []);

  // ============================================================================
  // MEMOIZED CALENDAR PROPS (evitar recreación en cada render)
  // ============================================================================
  
  const TimeSlotWrapperAdapter = useCallback<React.FC>((props) => {
    return <TimeLabel {...(props as any)} localizer={localizer} />;
  }, []);

  const startAccessor = useCallback((e: CalendarEvent) => toDate(e.start)!, []);
  const endAccessor = useCallback((e: CalendarEvent) => toDate(e.end)!, []);
  const draggableAccessor = useCallback(() => true, []);

  const calendarComponents = useMemo(() => ({
    header: CustomDayHeader,
    timeSlotWrapper: TimeSlotWrapperAdapter,
    timeGutterHeader: CustomTimeGutterHeader,
  }), [TimeSlotWrapperAdapter]);

  // ============================================================================
  // RENDER
  // ============================================================================
  
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
        views={VIEWS}
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

// ============================================================================
// MEMO WRAPPER para prevenir re-renders innecesarios
// ============================================================================
export default memo(CustomCalendarEntryForm);
