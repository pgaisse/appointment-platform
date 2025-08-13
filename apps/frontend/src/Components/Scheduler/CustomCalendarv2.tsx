import React, { useEffect, useRef, useState } from "react";
import {
  Calendar, dateFnsLocalizer, Views, NavigateAction, SlotInfo, View
} from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import "./rounded-calendar.css";
import CustomDayHeader from "./CustomDayHeader";
import { Box, Button, HStack } from "@chakra-ui/react";
import CustomEventContent from "./CustomEventContent";
import CustomTimeGutterHeader from "./CustomTimeGutterHeader";
import { CustomTimeSlotWrapper } from "./CustomTimeSlotWrapper";
import CustomTimeGutterHeader2 from "./CustomTimeGutterHeader2";

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
  num: number;
  color: string;
};

type Props = {
  setDate?: React.Dispatch<React.SetStateAction<Date>>
  plainMode?: boolean
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
  onSelectEvent?: (slotInfo: SlotInfo) => void;
  onClick?: (event: {
    start: Date;
    end: Date;
  }) => void
};

function CustomCalendarv2({
  setDate,
  plainMode = false,
  events = [],
  selectable = true,
  isFetching,
  date,
  toolbar = true,
  calView = Views.WEEK,
  step = 15,
  timeSlots = 4,
  min = new Date(2025, 0, 1, 9, 30),
  max = new Date(2025, 0, 1, 18, 0),
  height = "80vh",
  onNavigate,
  onSelectSlot,
  onSelectEvent,
}: Props) {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [currentView, setCurrentView] = useState<View>(calView);
  const [isHandlingSelection, setIsHandlingSelection] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date(2025, 4, 3));

  const handleNavigate = (newDate: Date, view: View, action: NavigateAction) => {
    setCurrentDate(newDate);
    if (onNavigate) onNavigate(newDate, view, action);
  };

  const handleSelectSlot = async (slotInfo: SlotInfo) => {
    if (isHandlingSelection) return;
    setIsHandlingSelection(true);
    try {
      setSelectedDate(slotInfo.start);
      if (onSelectSlot) await onSelectSlot(slotInfo);
      if (currentView === Views.MONTH) setCurrentView(Views.WEEK);
    } finally {
      setTimeout(() => setIsHandlingSelection(false), 500);
    }
  };

  const handleSelectEvent = async (event: Data) => {
    if (isFetching && !isHandlingSelection) return;
    setIsHandlingSelection(true);
    try {
      if (onSelectEvent) await onSelectEvent(event as unknown as SlotInfo);
    } finally {
      setIsHandlingSelection(false);
    }
  };

  const handleSelectEventReturnDate = async (event: Data) => {
    if (isFetching && !isHandlingSelection) return;
    if (setDate) setDate(event.start);
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
        borderRadius: "12px",
        color: "white",
        border: "0px",
        display: "block",
        padding: "4px 6px",
      },
      className: "custom-event-class",
      title: `${event.title} (${event.name})`,
    };
  };

  return (
    <Box
      w="100%"
      overflow="auto"
      height={height}
      borderRadius="2xl"
      bgGradient="linear(to-b, #fdfdfd, #f8fafc)"
      boxShadow="lg"
      cursor={isFetching || isHandlingSelection ? 'wait' : 'pointer'}
      p={4}
    >
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        date={currentDate}
        view={currentView}
        onView={(view) => setCurrentView(view)}
        onNavigate={handleNavigate}
        views={[Views.WEEK, Views.DAY]}
        defaultView={calView}
        step={15}
        timeslots={4}
        min={min}
        max={max}
        scrollToTime={min}
        selectable={true}
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

export default CustomCalendarv2;
