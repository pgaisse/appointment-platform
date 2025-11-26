import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Calendar,
  dateFnsLocalizer,
  Views,
  NavigateAction,
  SlotInfo,
  View,
  EventProps,
} from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import { format, parse, startOfWeek, getDay, isToday } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import "./CustomCalendar.css";

import CustomDayHeader from "./CustomDayHeader";
import CustomTimeGutterHeader from "./CustomTimeGutterHeader";
import { CustomTimeSlotWrapper } from "./CustomTimeSlotWrapper";

import {
  Box,
  HStack,
  Text,
  Button,
  ButtonGroup,
  IconButton,
  useColorModeValue,
  Center,
  Spinner,
  Tooltip,
  useToken,
  Tag,
  TagLabel,
} from "@chakra-ui/react";
import { ChevronLeft, ChevronRight, Calendar as CalIcon } from "lucide-react";

const locales = { "en-US": enUS };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

const DnDCalendar = withDragAndDrop(Calendar);

export type Data = {
  title: string;
  start: Date;
  end: Date;
  desc: string;
  name: string;
  lastName: string;
  _id: string;
  color?: string;         // opcional (hex o token)
  colorScheme?: string;   // p.ej. "teal" | "pink" | "purple" | "blue"...
};

type Props = {
  onView?: (view: View) => void;
  setDate?: React.Dispatch<React.SetStateAction<Date>>;
  isFetching?: boolean;
  selectable?: boolean;
  date?: Date;
  events?: Data[];
  toolbar?: boolean;
  step?: number;
  timeSlots?: number; // si lo pasas (>1) se respeta; si no, se usa 60/step
  min?: Date;
  max?: Date;
  calView?: View;
  height?: string;
  onNavigate?: (newDate: Date, view: View, action: NavigateAction) => void;
  onSelectSlot?: (slotInfo: SlotInfo) => void;
  onSelectEvent?: (event: Data) => void;
  onClick?: (event: { start: Date; end: Date }) => void;
  onEventDrop?: (args: { event: Data; start: Date; end: Date }) => void;
  onEventResize?: (args: { event: Data; start: Date; end: Date }) => void;
};
/* ======================= EVENT RENDERER ======================= */
interface RbcEventProps extends EventProps<Data> {
  step: number;
}

const RbcEvent: React.FC<RbcEventProps> = ({ event, step }) => {
  const scheme = event.colorScheme ?? event.color ?? "teal";

  const start = new Date(event.start);
  const end = new Date(event.end);
  const durationMs = Math.max(0, end.getTime() - start.getTime());
  const slots = Math.max(1, Math.round(durationMs / (step * 60_000)));

  // 1 línea si es muy bajo, 2 líneas si alcanza (>= 2 slots)
  const showTwoLines = slots >= 2;

  const fullName = [event.name, event.lastName].filter(Boolean).join(" ").trim();
  const primary = (event.title?.trim() || fullName || "(Sin título)").trim();

  const timeText = `${format(start, "p")} – ${format(end, "p")}`;

  return (
    <Tooltip label={`${primary} · ${timeText}`} placement="auto" hasArrow portalProps={{}}>
      <Box w="100%" h="100%" display="flex" alignItems="stretch" minW={0}>
        <Tag
          colorScheme={scheme as any}
          variant="solid"
          w="100%"
          h="100%"
          borderRadius="xl"
          px={2}
          py={1}
          display="flex"
          alignItems="center"
          justifyContent="flex-start"
          minW={0}
        >
          <TagLabel flex="1" minW={0} p={0} m={0}>
            {showTwoLines ? (
              <Box display="flex" flexDir="column" gap={0.5} minW={0}>
                <Text noOfLines={1} isTruncated fontWeight="semibold" minW={0} textTransform="capitalize">
                  {primary}
                </Text>
                <Text noOfLines={1} isTruncated opacity={0.9} fontSize="sm" minW={0}>
                  {timeText}
                </Text>
              </Box>
            ) : (
              <Text noOfLines={1} isTruncated minW={0} textTransform="capitalize">
                {primary} — {timeText}
              </Text>
            )}
          </TagLabel>
        </Tag>
      </Box>
    </Tooltip>
  );
};
/* ============================================================= */


/* ============================================================= */

/* ============================================================= */

/** Toolbar Premium */
function PremiumToolbar({
  label,
  onNavigate,
  onView,
  currentView,
}: {
  label: string;
  onNavigate: (action: "TODAY" | "PREV" | "NEXT") => void;
  onView: (view: View) => void;
  currentView: View;
}) {
  const bg = useColorModeValue("white", "gray.800");
  const border = useColorModeValue("gray.200", "whiteAlpha.300");
  const isWeek = currentView === Views.WEEK;

  return (
    <HStack
      justify="space-between"
      align="center"
      p={3}
      borderRadius="2xl"
      borderWidth="1px"
      borderColor={border}
      bg={bg}
      boxShadow="md"
      position="sticky"
      top="0"
      zIndex={1}
    >
      <HStack gap={3}>
        <CalIcon size={20} aria-hidden />
        <Text fontSize="lg" fontWeight="bold" lineHeight="1.2">
          {label}
        </Text>
      </HStack>

      <HStack gap={3}>
        <ButtonGroup isAttached variant="outline" size="sm">
          <IconButton
            aria-label="Previous"
            icon={<ChevronLeft size={18} />}
            onClick={() => onNavigate("PREV")}
          />
          <Button onClick={() => onNavigate("TODAY")}>Today</Button>
          <IconButton
            aria-label="Next"
            icon={<ChevronRight size={18} />}
            onClick={() => onNavigate("NEXT")}
          />
        </ButtonGroup>

        <ButtonGroup size="sm" variant="solid">
          <Button
            onClick={() => onView(Views.WEEK)}
            colorScheme={isWeek ? "teal" : undefined}
            variant={isWeek ? "solid" : "outline"}
          >
            Week
          </Button>
          <Button
            onClick={() => onView(Views.DAY)}
            colorScheme={!isWeek ? "teal" : undefined}
            variant={!isWeek ? "solid" : "outline"}
          >
            Day
          </Button>
        </ButtonGroup>
      </HStack>
    </HStack>
  );
}

const CustomCalendar = ({
  onView,
  setDate,
  events = [],
  selectable = true,
  isFetching,
  date,
  toolbar = true,
  calView = Views.WEEK,
  step = 15,
  timeSlots,
  min = new Date(0, 0, 1, 9, 30),
  max = new Date(0, 0, 1, 18, 0),
  height = "auto",
  onNavigate,
  onSelectSlot,
  onSelectEvent,
  onEventDrop,
  onEventResize,
}: Props) => {
  const [currentDate, setCurrentDate] = useState<Date>(date ?? new Date());
  const [currentView, setCurrentView] = useState<View>(calView);
  const [isHandlingSelection, setIsHandlingSelection] = useState(false);

  const [teal400, cyan400, purple400] = useToken("colors", [
    "teal.400",
    "cyan.400",
    "purple.400",
  ]);

  const cardBg = useColorModeValue("white", "gray.900");
  const cardBorder = useColorModeValue("gray.200", "whiteAlpha.300");
  const overlayBg = useColorModeValue("whiteAlpha.600", "blackAlpha.600");
  const emptyBg = useColorModeValue("gray.50", "whiteAlpha.50");

  const memoizedEvents = useMemo(() => events, [events]);

  // sincronizaciones
  useEffect(() => { if (date) setCurrentDate(new Date(date)); }, [date]);
  useEffect(() => { if (calView && calView !== currentView) setCurrentView(calView); }, [calView, currentView]);

  // navegación y selección
  const handleNavigate = useCallback((newDate: Date, view: View, action: NavigateAction) => {
    setCurrentDate(newDate);
    setDate?.(newDate);
    onNavigate?.(newDate, view, action);
  }, [onNavigate, setDate]);

  const handleSelectSlot = useCallback(async (slotInfo: SlotInfo) => {
    if (isHandlingSelection) return;
    setIsHandlingSelection(true);
    try {
      await onSelectSlot?.(slotInfo);
      if (currentView === Views.MONTH) setCurrentView(Views.WEEK);
    } finally {
      setTimeout(() => setIsHandlingSelection(false), 300);
    }
  }, [isHandlingSelection, onSelectSlot, currentView]);

  const handleSelectEvent = useCallback(async (event: Data) => {
    if (isFetching && !isHandlingSelection) return;
    setIsHandlingSelection(true);
    try {
      await onSelectEvent?.(event);
    } finally {
      setIsHandlingSelection(false);
    }
  }, [isFetching, isHandlingSelection, onSelectEvent]);

  const dayPropGetter = useCallback((d: Date) => {
    const wknd = [0, 6].includes(getDay(d));
    return { className: isToday(d) ? "rbc-day--today-premium" : wknd ? "rbc-day--weekend" : undefined };
  }, []);

  const slotPropGetter = useCallback(() => ({ className: "rbc-slot--soft" }), []);

  const label = useMemo(() =>
    currentView === Views.DAY
      ? format(currentDate, "EEEE dd MMM yyyy")
      : `${format(currentDate, "dd MMM")} – ${format(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 6), "dd MMM yyyy")}`,
    [currentDate, currentView]
  );

  // ====== Altura por slot / nº de slots por hora ======
  const slotsPerGroup = timeSlots && timeSlots > 1 ? timeSlots : Math.max(1, Math.round(60 / step));
  const slotHeightPx = "22px"; // ajusta a tu gusto
  const formats = useMemo(() => ({
    eventTimeRangeFormat: () => "",    // ← oculta la etiqueta .rbc-event-label
  }), []);
  return (
    <Box
      w="100%"
      
      overflow="hidden"
      borderRadius="2xl"
      borderWidth="1px"
      borderColor={cardBorder}
      bg={cardBg}
      boxShadow="xl"
      position="relative"
    >
      <Box
        h="10px"
        borderTopRadius="2xl"
        bgGradient={`linear(to-r, ${teal400}, ${cyan400}, ${purple400})`}
      />

      {toolbar && (
        <Box px={4} pt={3}>
          <PremiumToolbar
            label={label}
            currentView={currentView}
            onView={(v) => { setCurrentView(v); onView?.(v); }}
            onNavigate={(act) => {
              if (act === "TODAY") {
                handleNavigate(new Date(), currentView, "TODAY");
              } else {
                const delta = currentView === Views.DAY ? (act === "NEXT" ? 1 : -1) : (act === "NEXT" ? 7 : -7);
                const d = new Date(currentDate); d.setDate(d.getDate() + delta);
                handleNavigate(d, currentView, act as NavigateAction);
              }
            }}
          />
        </Box>
      )}

      <Box
        px={3}
        pb={3}
        pt={toolbar ? 2 : 3}
        height={`calc(${height} - 10px)`}
        overflow="auto"
        position="relative"
        sx={{
          "--rbc-slots-per-group": slotsPerGroup as any,
          "--rbc-slot-h": slotHeightPx as any,
        }}
      >
        {(isFetching || isHandlingSelection) && (
          <Center position="absolute" inset={0} bg={overlayBg} backdropFilter="blur(3px)" zIndex={2} aria-busy="true">
            <HStack><Spinner size="lg" /><Text>Loading…</Text></HStack>
          </Center>
        )}

        {!isFetching && memoizedEvents.length === 0 && (
          <Center p={10} borderRadius="xl" borderWidth="1px" borderColor={cardBorder} bg={emptyBg} mb={3}>
            <HStack><CalIcon /><Text>No events in this range.</Text></HStack>
          </Center>
        )}

        <DnDCalendar
          formats={formats}
          localizer={localizer}
          events={memoizedEvents}
          startAccessor="start"
          endAccessor="end"
          date={currentDate}
          view={currentView}
          onView={(v) => { setCurrentView(v); onView?.(v); }}
          onNavigate={handleNavigate}
          views={[Views.WEEK, Views.DAY]}
          defaultView={calView}
          step={15}
          timeslots={4}   // << usa los slots correctos
          min={min}
          max={max}
          selectable={selectable}
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          toolbar={false}
          draggableAccessor={() => true}
          resizable
          onEventDrop={onEventDrop}
          onEventResize={onEventResize}
          // Wrapper sin estilos propios (para que nuestro Tag ocupe todo):
          eventPropGetter={() => ({
            style: {
              background: "transparent",
              border: 0,
              padding: 0,
              color: "inherit",
              height: "100%",
            },
          })}
          dayPropGetter={dayPropGetter}
          slotPropGetter={slotPropGetter}
          components={{
            header: CustomDayHeader,
            timeSlotWrapper: (props) => (<CustomTimeSlotWrapper  {...props} localizer={localizer} />),
            timeGutterHeader: CustomTimeGutterHeader,
            event: (p) => <RbcEvent {...p} step={step} />, // << nuestro renderer estirado
          }}
        />
      </Box>
    </Box>
  );
};

export default CustomCalendar;
