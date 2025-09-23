// apps/frontend/src/Components/Scheduler/AssignedAppointments.tsx
import { useMemo, useState, useCallback } from "react";
import {
  Box, Grid, Center, HStack, Text, Spinner,
  useDisclosure, useColorModeValue, Skeleton
} from "@chakra-ui/react";
import { View, Views } from "react-big-calendar";

import CustomCalendar, { Data } from "@/Components/Scheduler/CustomCalendar";
import CustomMinCalendar from "@/Components/Scheduler/CustomMinCalendar";
import { createEvents } from "@/Functions/CreateEvents";
import { useGetCollection } from "@/Hooks/Query/useGetCollection";
import { Appointment } from "@/types";
import AppointmentModal from "@/Components/Modal/AppointmentModal";

const CALENDAR_STEP = 15 as const;
const SYD_TZ = "Australia/Sydney";

// YYYY-MM-DD en zona Australia/Sydney
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

const AssignedAppointments = () => {
  // Estado
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [calendarView, setCalendarView] = useState<View>(Views.WEEK);
  const [selectedEvent, setSelectedEvent] = useState<Appointment | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();

  const overlayBg = useColorModeValue("whiteAlpha.700", "blackAlpha.700");
  const border = useColorModeValue("gray.200", "whiteAlpha.300");

  // Opciones estables para la query
  const populateFields = useMemo(
    () => [
      { path: "priority",  select: "id description notes durationHours name color" },
      { path: "treatment", select: "_id name notes duration icon color minIcon" },
      { path: "selectedDates.days.timeBlocks" },
    ] as const,
    []
  );
  const queryBase = useMemo(() => ({} as const), []);
  const options = useMemo(
    () => ({ query: queryBase, limit: 100, populate: populateFields as unknown as any }),
    [queryBase, populateFields]
  );

  // Data (fuente de verdad)
  const { data, isFetching } = useGetCollection<Appointment>("Appointment", options);

  // Normaliza a Date reales
  const events: Data[] = useMemo(() => {
    const arr = Array.isArray(data) ? createEvents(data) : [];
    return arr.map(e => ({
      ...e,
      start: e.start instanceof Date ? e.start : new Date(e.start),
      end: e.end instanceof Date ? e.end : new Date(e.end),
    }));
  }, [data]);

  // Fechas para el MiniCalendar (solo fecha de inicio, en Sydney, sin duplicados)
  const eventDates: string[] = useMemo(() => {
    const s = new Set<string>();
    for (const e of events) s.add(toSydneyYMD(e.start as Date));
    return Array.from(s).sort(); // YYYY-MM-DD ya ordena lexicográficamente
  }, [events]);

  // Filtrado día (comparación consistente en Sydney)
  const filteredEvents: Data[] = useMemo(() => {
    if (calendarView !== Views.DAY) return events;
    const targetYMD = toSydneyYMD(currentDate);
    return events.filter(e => toSydneyYMD(e.start as Date) === targetYMD);
  }, [events, calendarView, currentDate]);

  // Callbacks
  const handleViewChange = useCallback((view: View) => setCalendarView(view), []);
  const handleNavigate = useCallback((newDate: Date, view?: View) => {
    setCurrentDate(newDate);
    if (view) setCalendarView(view);
  }, []);
  const handleSelectEvent = useCallback(
    (event: Data) => {
      const found = (data ?? []).find((item) => item._id === event._id) || null;
      setSelectedEvent(found);
      if (found) onOpen();
    },
    [data, onOpen]
  );

  // Render
  return (
    <>
      <Grid templateColumns={{ base: "100%", md: "80% 20%" }} gap={4} w="100%">
        <Box p={2} position="relative">
          {isFetching && (
            <Center
              position="absolute"
              inset={0}
              zIndex={2}
              bg={overlayBg}
              backdropFilter="blur(2px)"
              aria-busy="true"
            >
              <HStack>
                <Spinner size="lg" />
                <Text>Loading schedule…</Text>
              </HStack>
            </Center>
          )}

          <Box mb={4}>
            <CustomCalendar
              onView={handleViewChange}
              height="100dvh"
              calView={calendarView}
              setDate={setCurrentDate}
              selectable={false}
              date={currentDate}
              onSelectEvent={handleSelectEvent}
              isFetching={isFetching}
              events={filteredEvents}
              onNavigate={(d, v) => handleNavigate(d, v)}
              step={CALENDAR_STEP}
              toolbar
            />
          </Box>
        </Box>

        <Box p={2} display={{ base: "none", md: "block" }}>
          <Box mb={4} borderWidth="1px" borderColor={border} borderRadius="xl" p={3}>
            <Text fontWeight="bold" mb={2}>Monthly summary</Text>
            <Skeleton isLoaded={!isFetching} borderRadius="lg">
              <CustomMinCalendar
                height="350px"
                width="100%"
                step={CALENDAR_STEP}
                onSelectSlot={() => {}}
                calView={Views.MONTH}
                onNavigate={(d) => handleNavigate(d)}
                eventDates={eventDates} // <-- YYYY-MM-DD (Sydney) de la fecha de inicio
              />
            </Skeleton>
          </Box>
        </Box>
      </Grid>

      {selectedEvent && (
        <AppointmentModal
          id={selectedEvent._id ?? ""}
          isOpen={isOpen}
          onClose={() => {
            onClose();
            setSelectedEvent(null);
          }}
        />
      )}
    </>
  );
};

export default AssignedAppointments;
