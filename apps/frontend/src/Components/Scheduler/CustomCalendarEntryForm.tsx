import React, { useEffect, useState } from "react";
import {
  Calendar as BaseCalendar,
  Views,
  NavigateAction,
  SlotInfo,
  View,
  DateLocalizer,

} from "react-big-calendar";
import withDragAndDrop, { EventInteractionArgs } from "react-big-calendar/lib/addons/dragAndDrop";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import { dateFnsLocalizer } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import "./CustomCalendar.css";

import CustomDayHeader from "./CustomDayHeader";
import { CustomTimeSlotWrapper } from "./CustomTimeSlotWrapper";
import CustomTimeGutterHeader from "./CustomTimeGutterHeader";
import { CalendarEvent, EventDropArg, EventResizeDoneArg } from "@/types";
import eventStyleGetter from "./eventStyleGetter";
import { DateRange } from "@/Hooks/Handles/useSlotSelection";
import { UseFormSetValue, UseFormTrigger } from "react-hook-form";
import { Box } from "@chakra-ui/react";
import { AppointmentForm } from "@/schemas/AppointmentsSchema";

// Locales para date-fns
const locales = {
  "en-US": enUS,
};

// Localizador de fechas
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

// Wrap del Calendar para habilitar drag & drop
const Calendar = withDragAndDrop<CalendarEvent>(BaseCalendar);

type Props = {
  setSelectedAppDates?: React.Dispatch<React.SetStateAction<DateRange[]>>
  selectedAppDates?: DateRange[]
  trigger?: UseFormTrigger<AppointmentForm>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  selectedAppDates,
  colorEvent,
  offset,
  height,
  toolbar = true,
  calView = Views.WEEK,
}: Props) {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [currentView, setCurrentView] = useState<View>(Views.WEEK);
  const [selectedDate] = useState<Date>(new Date(2025, 4, 3));
  const [range, setRange] = useState<DateRange[] | null>(selectedAppDates ? selectedAppDates : null);
  const [event, setEvents] = useState<CalendarEvent[]>();
  const timeSlots = 4;
  const min = new Date(2025, 0, 1, 9, 30);
  const max = new Date(2025, 0, 1, 18, 0);
  const step = 15;

  const handleNavigate = (newDate: Date, view: View, action: NavigateAction): void => {
    setCurrentDate(newDate);
  };

  const handleSelectSlot = (slotInfo: SlotInfo): void => {
    const start: Date = new Date(slotInfo.start);
    const end: Date = new Date(start.getTime() + offset * 60 * 60 * 1000);
    const newRange = [{ startDate: start, endDate: end }];

    setRange(newRange);

    // Cierra el modal 1 segundo después
    /*if (onClose) {
      setTimeout(() => {
        onClose();
      }, 1000);
    }*/
  };

  const handleSelectEvent = (event: CalendarEvent): void => {
    const startTime = event.start?.getTime();
    const endTime = event.end?.getTime();
    if (!startTime || !endTime) return;

    setEvents((prev) =>
      (prev ?? []).filter(
        (e) =>
          e.start?.getTime() !== startTime || e.end?.getTime() !== endTime
      )
    );

    setRange((prev) =>
      (prev ?? []).filter(
        (r) =>
          r.startDate.getTime() !== startTime || r.endDate.getTime() !== endTime
      )
    );

  };

  const handleEventDrop = (args: EventInteractionArgs<CalendarEvent>) => {
    const { event: droppedEvent, start, end } = args;

    // Convierte string|Date a Date estrictamente
    const startDate = start instanceof Date ? start : new Date(start);
    const endDate = end instanceof Date ? end : new Date(end);

    const updated = { ...droppedEvent, start: startDate, end: endDate };

    setEvents((prev) =>
      (prev ?? []).map((e) => (e === droppedEvent ? updated : e))
    );

    setRange((prev) =>
      (prev ?? []).map((r) =>
        r.startDate.getTime() === droppedEvent.start?.getTime() &&
          r.endDate.getTime() === droppedEvent.end?.getTime()
          ? { startDate: startDate, endDate: endDate }
          : r
      )
    );
  };

  const handleEventResize = (args: EventInteractionArgs<CalendarEvent>) => {
    const { event: resizedEvent, start, end } = args;

    const startDate = start instanceof Date ? start : new Date(start);
    const endDate = end instanceof Date ? end : new Date(end);

    const updated = { ...resizedEvent, start: startDate, end: endDate };

    setEvents((prev) =>
      (prev ?? []).map((e) => (e === resizedEvent ? updated : e))
    );

    setRange((prev) =>
      (prev ?? []).map((r) =>
        r.startDate.getTime() === resizedEvent.start?.getTime() &&
          r.endDate.getTime() === resizedEvent.end?.getTime()
          ? { startDate: startDate, endDate: endDate }
          : r
      )
    );
  };

  useEffect(() => {
    const newMarkedEvents: CalendarEvent[] | undefined = range?.map((item) => ({
      title: "",
      start: item?.startDate,
      end: item?.endDate,
      desc: "Date Selected",
      color: colorEvent,
    }));
    if (newMarkedEvents) setEvents(newMarkedEvents);
    if (setSelectedAppDates && range) setSelectedAppDates(range);
    if (setValue) setValue("selectedAppDates", range);
    if (trigger) trigger("selectedAppDates");
    //if(onClose)onClose();
  }, [range, colorEvent]);






  const CustomTimeSlotWrapper = ({ value, localizer }: { value?: Date; localizer: DateLocalizer }) => {
    const customTimeLabel = value ? localizer.format(value, "h:mm a") : "";
    return (
      <div style={{ fontSize: 12, textAlign: "center", color: "gray" }}>
        {customTimeLabel}
      </div>
    );
  };

  // Wrapper que cumple con la firma que espera react-big-calendar
  const TimeSlotWrapperAdapter: React.FC = (props) => {
    // `props` puede tener más props internas, pero aquí solo nos interesa pasar `value` y el localizer
    return <CustomTimeSlotWrapper {...(props as any)} localizer={localizer} />;
  };
  return (
    <Box
      w="100%"
      overflow="auto"
      height={height}

    >
      <Calendar
        localizer={localizer}
        events={event}
        startAccessor="start"
        endAccessor="end"
        date={currentDate}
        view={currentView}
        defaultView={calView}
        onView={(view: View) => setCurrentView(view)}
        onNavigate={handleNavigate}
        views={[Views.WEEK, Views.DAY]}
        step={step}
        timeslots={timeSlots}
        min={min}
        max={max}
        selected={selectedDate}
        onSelectSlot={handleSelectSlot}
        onSelectEvent={handleSelectEvent}
        onEventDrop={handleEventDrop}
        onEventResize={handleEventResize}
        resizable
        draggableAccessor={() => true}
        toolbar={toolbar}
        selectable="ignoreEvents"
        eventPropGetter={eventStyleGetter}
        components={{
          header: CustomDayHeader,
          timeSlotWrapper: TimeSlotWrapperAdapter,
          // otros componentes...

          timeGutterHeader: CustomTimeGutterHeader,
        }}
      /></Box>
  );
}

export default CustomCalendarEntryForm;
