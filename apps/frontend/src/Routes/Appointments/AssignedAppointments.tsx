// apps/frontend/src/Components/Scheduler/AssignedAppointments.tsx
import { useMemo, useState, useCallback } from "react";
import {
  Box,
  Grid,
  Center,
  HStack,
  Text,
  Spinner,
  useDisclosure,
  useColorModeValue,
  Skeleton,
} from "@chakra-ui/react";
import { View, Views } from "react-big-calendar";

import CustomCalendar, { Data } from "@/Components/Scheduler/CustomCalendar";
import CustomMinCalendar from "@/Components/Scheduler/CustomMinCalendar";
import { Appointment } from "@/types";
import AppointmentModal from "@/Components/Modal/AppointmentModal";
import { ModalStackProvider } from "@/Components/ModalStack/ModalStackContext";
import { useAppointmentsByRange } from "@/Hooks/Query/useAppointmentsByRange";
import { useMonthlyEventDays } from "@/Hooks/Query/useMonthlyEventDays";

const CALENDAR_STEP = 15 as const;

const AssignedAppointments = () => {
  // Fuente de verdad para ambos calendarios
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [calendarView, setCalendarView] = useState<View>(Views.WEEK);

  // Modal
  const [selectedEvent, setSelectedEvent] = useState<Appointment | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();

  const overlayBg = useColorModeValue("whiteAlpha.700", "blackAlpha.700");
  const border = useColorModeValue("gray.200", "whiteAlpha.300");

  // === DATA por RANGO (día/semana/mes) — el backend ya limita por selectedAppDates en el rango ===
  const { data, isFetching } = useAppointmentsByRange({
    date: currentDate,
    view: calendarView,
    populate: ["priority", "treatment"],
    limit: 600,
  });

  const appointments = (Array.isArray(data) ? data : []) as Appointment[];

  // Construir eventos SOLO desde selectedAppDates (slots)
  const events: Data[] = useMemo(() => {
    return (appointments ?? []).flatMap((ap) => {
      const slots = Array.isArray((ap as any).selectedAppDates) ? (ap as any).selectedAppDates : [];
      return slots
        .filter((s: any) => s?.startDate && s?.endDate)
        .map((s: any) => ({
          _id: ap._id!, // para localizar el Appointment en onSelectEvent
          title: `${ap.nameInput ?? ""} ${ap.lastNameInput ?? ""}`.trim() || "Appointment",
          start: new Date(s.startDate),
          end: new Date(s.endDate),
          color: (ap as any)?.priority?.color || (ap as any)?.color,
          resource: {
            apId: ap._id,
            slotId: s._id,
            status: s.status,
            priority: (ap as any)?.priority,
            treatment: (ap as any)?.treatment,
          },
        }));
    });
  }, [appointments]);

  // === Días con eventos por MES (para el mini calendario) ===
  const { data: monthDays, isFetching: isFetchingMonth } = useMonthlyEventDays(currentDate);
  const eventDates = monthDays?.days ?? []; // ['YYYY-MM-DD', ...]

  // Helper para sumar días (±7) respetando fecha local
  const addDays = (base: Date, days: number) => {
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    return d;
  };

  // Navegación / sincronización
  const handleViewChange = useCallback((view: View) => setCalendarView(view), []);

  // 🚀 Forzar flechas a navegar SEMANALMENTE (±7 días) en cualquier vista
  const handleNavigate = useCallback(
    (newDate: Date, view?: View, action?: "PREV" | "NEXT" | "TODAY" | "DATE") => {
      let next = newDate;

      if (action === "PREV") {
        next = addDays(currentDate, -7);
      } else if (action === "NEXT") {
        next = addDays(currentDate, +7);
      }
      // TODAY y DATE usan el newDate que viene de RBC

      setCurrentDate(next);
      if (view) setCalendarView(view);
    },
    [currentDate]
  );

  const handleMiniSelectDate = useCallback((date: Date) => {
    setCurrentDate(date);
    setCalendarView(Views.DAY);
  }, []);

  const handleSelectEvent = useCallback(
    (event: Data) => {
      const found = appointments.find((item) => item._id === (event as any)._id) || null;
      setSelectedEvent(found);
      if (found) onOpen();
    },
    [appointments, onOpen]
  );

  return (
    <>
      <Grid templateColumns={{ base: "100%", md: "80% 20%" }} gap={4} w="100%">
        {/* Calendario principal */}
        <Box p={2} position="relative">
          {(isFetching || isFetchingMonth) && (
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
              isFetching={isFetching || isFetchingMonth}
              events={events}
              // ⬇️ IMPORTANTE: pasamos también el "action" para forzar salto semanal
              onNavigate={(d, v, action) => handleNavigate(d, v, action as any)}
              step={CALENDAR_STEP}
              toolbar
            />
          </Box>
        </Box>

        {/* Mini calendario sincronizado + días con eventos del mes */}
        <Box p={2} display={{ base: "none", md: "block" }}>
          <Box mb={4} borderWidth="1px" borderColor={border} borderRadius="xl" p={3}>
            <Text fontWeight="bold" mb={2}>
              Monthly summary
            </Text>
            <Skeleton isLoaded={!isFetching && !isFetchingMonth} borderRadius="lg">
              <CustomMinCalendar
                height="350px"
                width="100%"
                monthDate={currentDate}      // mes visible controlado
                selectedDate={currentDate}    // día activo
                onSelectDate={handleMiniSelectDate}
                onNavigate={(d) => handleNavigate(d)} // prev/next del mini mantiene su comportamiento
                eventDates={eventDates}       // días con eventos del mes (YYYY-MM-DD)
              />
            </Skeleton>
          </Box>
        </Box>
      </Grid>

      {/* Modal de cita */}
      {selectedEvent && (
        <ModalStackProvider>
          <AppointmentModal
            id={selectedEvent._id ?? ""}
            isOpen={isOpen}
            onClose={() => {
              onClose();
              setSelectedEvent(null);
            }}
          />
        </ModalStackProvider>
      )}
    </>
  );
};

export default AssignedAppointments;
