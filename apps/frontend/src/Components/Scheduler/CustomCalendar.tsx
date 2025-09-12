import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar, dateFnsLocalizer, Views, NavigateAction, SlotInfo, View, type CalendarProps
} from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "./CustomCalendar.css";
import CustomDayHeader from "./CustomDayHeader";
import { Box } from "@chakra-ui/react";
import CustomEventContent from "./CustomEventContent";
import CustomTimeGutterHeader from "./CustomTimeGutterHeader";
import { CustomTimeSlotWrapper } from "./CustomTimeSlotWrapper";

const locales = {
  "en-US": enUS,
};


const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});
export type Data = {
  title: string;
  start: Date;
  end: Date;
  desc: string;
  name: string;
  lastName: string,
  _id: string;
  color: string;
};

type Props = {

  onView?: ((view: View) => void) | undefined
  setDate?: React.Dispatch<React.SetStateAction<Date>>
  isFetching?: boolean;
  selectable?: boolean;
  date?: Date;
  events?: Data[] | undefined;
  toolbar?: boolean;
  step?: number;
  timeSlots?: number;
  min?: Date;
  max?: Date;
  calView?: View;
  height?: string;
  onNavigate?: (newDate: Date, view: View, action: NavigateAction) => void;
  onSelectSlot?: (slotInfo: SlotInfo) => void;
  onSelectEvent?: (event: Data) => void;
  onClick?: (event: {
    start: Date;
    end: Date;
  }) => void
};

function CustomCalendar({
  onView,
  setDate,
  events = [],
  selectable = true,
  isFetching,
  date,
  toolbar = true,
  calView = Views.WEEK,
  step = 15,
  timeSlots = 1,
  min = new Date(0, 0, 1, 9, 30),
  max = new Date(0, 0, 1, 18, 0),
  height = "auto",
  onNavigate,
  onSelectSlot,
  onSelectEvent,

}: Props) {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [currentView, setCurrentView] = useState<View>(calView);
  const [isHandlingSelection, setIsHandlingSelection] = useState(false);

  const [selectedDate, setSelectedDate] = useState(new Date(2025, 4, 3)); // Fecha preseleccionada


  const memoizedEvents = useMemo(() => events, [events]);
  const handleNavigate = (newDate: Date, view: View, action: NavigateAction) => {
    setCurrentDate(newDate);
    if (onNavigate) onNavigate(newDate, view, action);
  };

  const handleSelectSlot = async (slotInfo: SlotInfo) => {
    if (isHandlingSelection) {
      return;
    }

    setIsHandlingSelection(true);

    try {
      setSelectedDate(slotInfo.start);
      if (onSelectSlot) await onSelectSlot(slotInfo);
      if (currentView === Views.MONTH) {
        setCurrentView(Views.WEEK);
      }
    } finally {
      setTimeout(() => setIsHandlingSelection(false), 500); // Evita doble click rápido
    }
  };


  const handleSelectEvent = async (event: Data) => {
    if (isFetching && !isHandlingSelection) return;
    setIsHandlingSelection(true);

    try {
      if (onSelectEvent) await onSelectEvent(event); // <-- ahora enviamos el Data
    } finally {
      setIsHandlingSelection(false);
    }
  };


  useEffect(() => {
    if (date) {
      setCurrentDate(new Date(date));
    }
  }, [date]);
  const eventStyleGetter = (event: Data) => {
    const backgroundColor = event.color || "gray";
    return {
      style: {

        backgroundColor,
        borderRadius: "5px",
        color: "white",
        border: "0px",
        display: "block",
      },
      className: "custom-event-class", // opcional
      title: `${event.title} (${event.name})`, // tooltip opcional
    };
  };


  useEffect(() => {
    if (calView && calView !== currentView) {
      setCurrentView(calView);
    }
  }, [calView]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any

  return (
    <Box
      w="100%"
      overflow="auto"
      height={height}
      cursor={isFetching || isHandlingSelection ? 'wait' : 'pointer'}
    >  <Calendar
        //formats={formats}
        localizer={localizer}
        events={memoizedEvents}
        startAccessor="start"
        endAccessor="end"
        date={currentDate}
        view={currentView}
        onView={(view) => {
          setCurrentView(view);       // ✅ actualiza estado local
          if (onView) onView(view);   // ✅ avisa al padre
        }}
        onNavigate={handleNavigate}
        views={[Views.WEEK, Views.DAY]}
        defaultView={calView}
        step={step}
        timeslots={timeSlots}
        min={min}
        max={max}

        selectable={selectable}//{!isFetching && !isHandlingSelection}
        selected={selectedDate}
        onSelectSlot={handleSelectSlot}
        onSelectEvent={handleSelectEvent}
        toolbar={toolbar}
        eventPropGetter={eventStyleGetter}
        components={{
          header: CustomDayHeader,
          timeSlotWrapper: (props) => (<CustomTimeSlotWrapper  {...props} localizer={localizer} />),
          timeGutterHeader: CustomTimeGutterHeader,

        }}
      />
    </Box>
  );
}

export default CustomCalendar;
