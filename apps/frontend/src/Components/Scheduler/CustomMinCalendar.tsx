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
import {  Box } from "@chakra-ui/react";
import { useState } from "react";

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

type Props = {
  events?: unknown[];
  eventDates?: string[];
  toolbar?: boolean;
  step?: number;
  timeSlots?: number;
  min?: Date;
  max?: Date;
  width?: string;
  calView?: View;
  height?: string;
  onNavigate?: (newDate: Date, view: View, action: NavigateAction) => void;
  onSelectSlot?: (slotInfo: SlotInfo) => void;
  onSelectEvent?: (slotInfo: SlotInfo) => void;
  onClick?: (event: { start: Date; end: Date }) => void;

};

function CustomMinCalendar({
  width,
  toolbar = true,
  calView = Views.MONTH,
  timeSlots = 1,
  min = new Date(2025, 0, 1, 9, 30),
  max = new Date(2025, 0, 1, 19, 0),
  height = "auto",
  eventDates,
  onNavigate,
}: Props) {
  //console.log("Eventos actualizados:", events);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_currentView, setCurrentView] = useState<View>(calView);
  const [currentDate, setCurrentDate] = useState(new Date());
  const handleNavigate = (
    newDate: Date,
    view: View,
    action: NavigateAction
  ) => {
    setCurrentDate(newDate);
    if (onNavigate) onNavigate(newDate, view, action);
  };

  const highlightDays = (date: Date) => {
    const isMarked = eventDates?.includes(date.toDateString());
    if (isMarked) {
      return {
        style: {
          backgroundColor: "#c6f6d5", // verde claro
          borderRadius: "50%",
        },
      };
    }

    return {};
  }


  return (
    <Box w="100%" overflow="auto" height={height} width={width}>
      <Calendar
        localizer={localizer}
        startAccessor="start"
        endAccessor="end"
        date={currentDate}
        view={Views.MONTH}
        onView={(view) => setCurrentView(view)}
        onNavigate={handleNavigate}
        timeslots={timeSlots}
        min={min}
        max={max}
        dayPropGetter={highlightDays}
        toolbar={toolbar}
        style={{
          fontSize: '12px', // Global font size for the calendar
          border: 'none', // Remove the outer border,
          background: 'none', // Remove any background color
        }}
        components={{
          toolbar: CustomToolbar,
          header: CustomDayHeader,

        }}

      />
    </Box>
  );
}

export default CustomMinCalendar;
