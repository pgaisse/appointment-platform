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
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  VStack,
  RadioGroup,
  Radio,
  Stack,
  Badge,
  Icon,
  Divider,
  Textarea,
  IconButton,
  useToast,
  Input,
} from "@chakra-ui/react";
import { View, Views } from "react-big-calendar";
import { DateTime } from "luxon";
import { RiCalendarScheduleLine } from "react-icons/ri";
import { CiUser } from "react-icons/ci";
import { MdOutlinePostAdd } from "react-icons/md";

import CustomCalendar, { Data } from "@/Components/Scheduler/CustomCalendar";
import { capitalize } from "@/utils/textFormat";
import CustomMinCalendar from "@/Components/Scheduler/CustomMinCalendar";
import { Appointment } from "@/types";
import AppointmentModal from "@/Components/Modal/AppointmentModal";
import { ModalStackProvider } from "@/Components/ModalStack/ModalStackContext";
import { useAppointmentsByRange } from "@/Hooks/Query/useAppointmentsByRange";
import { useMonthlyEventDays } from "@/Hooks/Query/useMonthlyEventDays";
import { useUpdateItems } from "@/Hooks/Query/useUpdateItems";
import { useSendAppointmentSMS } from "@/Hooks/Query/useSendAppointmentSMS";
import { useProposeAppointmentDates } from "@/Hooks/Query/useProposeAppointmentDates";
import ShowTemplateButton from "@/Components/Chat/CustomMessages/ShowTemplateButton";
import CreateLiquidTemplateModal from "@/Components/Chat/CustomMessages/CreateLiquidTemplateModal";
import { formatAusPhoneNumber } from "@/Functions/formatAusPhoneNumber";
import { useQueryClient } from "@tanstack/react-query";

const TZ = "Australia/Sydney";

interface RescheduleData {
  appointmentId: string;
  slotId: string;
  newStart: Date;
  newEnd: Date;
  currentSlot: any;
  allSlots: any[];
  patientInfo: {
    name?: string;
    lastName?: string;
    phone?: string;
  };
}

const AssignedAppointments = () => {
  // State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState<View>(Views.WEEK);
  const [selectedEvent, setSelectedEvent] = useState<Appointment | null>(null);
  const [rescheduleData, setRescheduleData] = useState<RescheduleData | null>(null);
  const [rescheduleMode, setRescheduleMode] = useState<"sms" | "manual">("sms");
  const [customMessage, setCustomMessage] = useState("");
  const [openTemplateVersion, setOpenTemplateVersion] = useState(0);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // UI
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isRescheduleOpen, onOpen: onRescheduleOpen, onClose: onRescheduleClose } = useDisclosure();
  const overlayBg = useColorModeValue("whiteAlpha.700", "blackAlpha.700");
  const border = useColorModeValue("gray.200", "whiteAlpha.300");
  const toast = useToast();
  const queryClient = useQueryClient();

  // Mutations
  const { mutateAsync: updateItems, isPending: isUpdating } = useUpdateItems();
  const { mutateAsync: sendSMS, isPending: isSending } = useSendAppointmentSMS();
  const { mutateAsync: proposeDate, isPending: isProposing } = useProposeAppointmentDates();
  const isWorking = isUpdating || isSending || isProposing;

  // Data
  const { data: appointmentsData, isFetching, refetch: refetchAppointments } = useAppointmentsByRange({
    date: currentDate,
    view: calendarView,
    populate: ["priority", "treatment"],
    limit: 600,
  });

  const { data: monthData, isFetching: isFetchingMonth, refetch: refetchMonthDays } = useMonthlyEventDays(currentDate);

  const appointments = useMemo(() => 
    (Array.isArray(appointmentsData) ? appointmentsData : []) as Appointment[],
    [appointmentsData]
  );

  const eventDates = useMemo(() => monthData?.days ?? [], [monthData]);

  // Events transformation
  const events: Data[] = useMemo(() => {
    return appointments.flatMap((apt) => {
      const slots = Array.isArray((apt as any).selectedAppDates) ? (apt as any).selectedAppDates : [];
      return slots
        .filter((slot: any) => slot?.startDate && slot?.endDate)
        .map((slot: any) => ({
          _id: apt._id!,
          title: `${capitalize(apt.nameInput)} ${capitalize(apt.lastNameInput)}`.trim() || "Appointment",
          start: new Date(slot.startDate),
          end: new Date(slot.endDate),
          color: (apt as any)?.priority?.color || (apt as any)?.color,
          resource: {
            apId: apt._id,
            slotId: slot._id,
            status: slot.status,
            priority: (apt as any)?.priority,
            treatment: (apt as any)?.treatment,
          },
        }));
    });
  }, [appointments]);

  // Refresh function
  const refreshData = useCallback(async () => {
    await queryClient.invalidateQueries({
      predicate: (query) => {
        const key = Array.isArray(query.queryKey) ? query.queryKey[0] : null;
        return key === "appointments-range" || key === "appointments-month-days" || key === "Appointment";
      },
    });
    await Promise.all([refetchAppointments(), refetchMonthDays()]);
  }, [queryClient, refetchAppointments, refetchMonthDays]);

  // Navigation handlers
  const handleViewChange = useCallback((view: View) => {
    setCalendarView(view);
  }, []);

  const handleNavigate = useCallback((newDate: Date, view?: View, action?: "PREV" | "NEXT" | "TODAY" | "DATE") => {
    let targetDate = newDate;
    
    if (action === "PREV") {
      targetDate = new Date(currentDate);
      targetDate.setDate(targetDate.getDate() - 7);
    } else if (action === "NEXT") {
      targetDate = new Date(currentDate);
      targetDate.setDate(targetDate.getDate() + 7);
    }
    
    setCurrentDate(targetDate);
    if (view) setCalendarView(view);
  }, [currentDate]);

  const handleMiniSelectDate = useCallback((date: Date) => {
    setCurrentDate(date);
    setCalendarView(Views.DAY);
  }, []);

  // Event handlers
  const handleSelectEvent = useCallback((event: Data) => {
    const appointment = appointments.find((apt) => apt._id === (event as any)._id);
    
    if (!appointment) return;

    const slotId = (event as any).resource?.slotId;
    const allSlots = Array.isArray((appointment as any).selectedAppDates) 
      ? (appointment as any).selectedAppDates 
      : [];
    const currentSlot = allSlots.find((s: any) => String(s._id) === String(slotId));

    if (currentSlot) {
      setRescheduleData({
        appointmentId: appointment._id!,
        slotId: String(slotId),
        newStart: new Date(currentSlot.startDate),
        newEnd: new Date(currentSlot.endDate),
        currentSlot,
        allSlots,
        patientInfo: {
          name: appointment.nameInput,
          lastName: appointment.lastNameInput,
          phone: appointment.phoneInput,
        },
      });
      setRescheduleMode("sms");
      setCustomMessage("");
      onRescheduleOpen();
    } else {
      setSelectedEvent(appointment);
      onOpen();
    }
  }, [appointments, onOpen, onRescheduleOpen]);

  const handleEventDrop = useCallback(({ event, start, end }: { event: Data; start: Date; end: Date }) => {
    const appointment = appointments.find((apt) => apt._id === (event as any)._id);
    
    if (!appointment) return;

    const slotId = (event as any).resource?.slotId;
    const allSlots = Array.isArray((appointment as any).selectedAppDates) 
      ? (appointment as any).selectedAppDates 
      : [];
    const currentSlot = allSlots.find((s: any) => String(s._id) === String(slotId));

    if (currentSlot) {
      setRescheduleData({
        appointmentId: appointment._id!,
        slotId: String(slotId),
        newStart: start,
        newEnd: end,
        currentSlot,
        allSlots,
        patientInfo: {
          name: appointment.nameInput,
          lastName: appointment.lastNameInput,
          phone: appointment.phoneInput,
        },
      });
      setRescheduleMode("sms");
      setCustomMessage("");
      onRescheduleOpen();
    }
  }, [appointments, onRescheduleOpen]);

  const handleChangeDate = useCallback((newStart: Date, newEnd: Date) => {
    if (!rescheduleData) return;
    setRescheduleData({ ...rescheduleData, newStart, newEnd });
  }, [rescheduleData]);

  // Mutation handlers
  const handleDeleteSlot = useCallback(async () => {
    if (!rescheduleData) return;

    try {
      const updatedSlots = rescheduleData.allSlots.filter(
        (slot: any) => String(slot._id) !== String(rescheduleData.slotId)
      );

      await updateItems([{
        table: "Appointment",
        id_field: "_id",
        id_value: rescheduleData.appointmentId,
        data: { selectedAppDates: updatedSlots },
      }] as any);

      await refreshData();

      toast({
        title: "Slot deleted",
        description: "The appointment slot has been removed.",
        status: "success",
        duration: 3000,
        isClosable: true,
      });

      setIsDeleteConfirmOpen(false);
      onRescheduleClose();
      setRescheduleData(null);
    } catch (error: any) {
      toast({
        title: "Error deleting slot",
        description: error?.message || "An error occurred.",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    }
  }, [rescheduleData, updateItems, refreshData, toast, onRescheduleClose]);

  const handleConfirmWithSMS = useCallback(async () => {
    if (!rescheduleData || !customMessage) return;

    try {
      const updatedSlots = rescheduleData.allSlots.map((slot: any) => {
        if (String(slot._id) !== String(rescheduleData.slotId)) return slot;
        return {
          ...slot,
          startDate: rescheduleData.newStart.toISOString(),
          endDate: rescheduleData.newEnd.toISOString(),
          status: "pending",
        };
      });

      await updateItems([{
        table: "Appointment",
        id_field: "_id",
        id_value: rescheduleData.appointmentId,
        data: { selectedAppDates: updatedSlots },
      }] as any);

      const proposal = await proposeDate({
        appointmentId: rescheduleData.appointmentId,
        proposedStartDate: rescheduleData.newStart.toISOString(),
        proposedEndDate: rescheduleData.newEnd.toISOString(),
        currentStartDate: rescheduleData.currentSlot?.startDate 
          ? new Date(rescheduleData.currentSlot.startDate).toISOString() 
          : undefined,
        currentEndDate: rescheduleData.currentSlot?.endDate 
          ? new Date(rescheduleData.currentSlot.endDate).toISOString() 
          : undefined,
        reason: "Rescheduled by drag & drop",
        baseSlotId: rescheduleData.slotId,
      });

      try {
        await sendSMS({ 
          appointmentId: rescheduleData.appointmentId, 
          msg: customMessage, 
          slotId: proposal?.slotId 
        });
        
        toast({
          title: "SMS Sent",
          description: "Appointment rescheduled and SMS sent.",
          status: "info",
          duration: 3000,
          isClosable: true,
        });
      } catch (err: any) {
        toast({
          title: "SMS Failed",
          description: err?.message || "Could not send SMS.",
          status: "warning",
          duration: 4000,
          isClosable: true,
        });
      }

      await refreshData();

      onRescheduleClose();
      setRescheduleData(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "An error occurred.",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    }
  }, [rescheduleData, customMessage, updateItems, proposeDate, sendSMS, refreshData, toast, onRescheduleClose]);

  const handleConfirmManual = useCallback(async () => {
    if (!rescheduleData) return;

    try {
      const updatedSlots = rescheduleData.allSlots.map((slot: any) => {
        if (String(slot._id) !== String(rescheduleData.slotId)) return slot;
        return {
          ...slot,
          startDate: rescheduleData.newStart.toISOString(),
          endDate: rescheduleData.newEnd.toISOString(),
        };
      });

      await updateItems([{
        table: "Appointment",
        id_field: "_id",
        id_value: rescheduleData.appointmentId,
        data: { selectedAppDates: updatedSlots },
      }] as any);

      await refreshData();

      toast({
        title: "Updated",
        description: "Appointment rescheduled.",
        status: "success",
        duration: 3000,
        isClosable: true,
      });

      onRescheduleClose();
      setRescheduleData(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "An error occurred.",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    }
  }, [rescheduleData, updateItems, refreshData, toast, onRescheduleClose]);

  // Helper functions
  const parseSydney = useCallback((val: Date | string | null | undefined): DateTime => {
    if (val instanceof Date) return DateTime.fromJSDate(val, { zone: TZ });
    const str = String(val ?? "");
    let dt = DateTime.fromISO(str, { zone: TZ });
    if (!dt.isValid) dt = DateTime.fromFormat(str, "yyyy-LL-dd'T'HH:mm:ss", { zone: TZ });
    return dt;
  }, []);

  const formatRange = useCallback((start: any, end: any) => {
    const s = parseSydney(start);
    const e = parseSydney(end);
    if (!s.isValid || !e.isValid) return "—";
    const sameDay = s.hasSame(e, "day");
    const dayPart = sameDay
      ? s.toFormat("ccc, dd LLL yyyy")
      : `${s.toFormat("ccc, dd LLL yyyy")} → ${e.toFormat("ccc, dd LLL yyyy")}`;
    const timePart = `${s.toFormat("h:mm a")} — ${e.toFormat("h:mm a")}`;
    return `${dayPart} • ${timePart}`;
  }, [parseSydney]);

  const statusBadge = useCallback((status?: string) => {
    const st = String(status || "").toLowerCase();
    const statusMap: Record<string, { label: string; color: string }> = {
      pending: { label: "Pending", color: "yellow" },
      contacted: { label: "Contacted", color: "blue" },
      nocontacted: { label: "NoContacted", color: "gray" },
      confirmed: { label: "Confirmed", color: "green" },
      rescheduled: { label: "Rescheduled", color: "purple" },
      cancelled: { label: "Cancelled", color: "red" },
      canceled: { label: "Cancelled", color: "red" },
      rejected: { label: "Rejected", color: "red" },
      failed: { label: "Failed", color: "red" },
    };
    const config = statusMap[st] || statusMap.pending;
    return <Badge colorScheme={config.color} variant="subtle">{config.label}</Badge>;
  }, []);

  return (
    <>
      <Grid templateColumns={{ base: "100%", md: "80% 20%" }} gap={4} w="100%">
        <Box p={2} position="relative">
          {(isFetching || isFetchingMonth) && (
            <Center position="absolute" inset={0} zIndex={2} bg={overlayBg} backdropFilter="blur(2px)">
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
              onEventDrop={handleEventDrop}
              onEventResize={handleEventDrop}
              isFetching={isFetching || isFetchingMonth}
              events={events}
              onNavigate={(d, v, action) => handleNavigate(d, v, action as any)}
              step={15}
              toolbar
            />
          </Box>
        </Box>

        <Box p={2} display={{ base: "none", md: "block" }}>
          <Box mb={4} borderWidth="1px" borderColor={border} borderRadius="xl" p={3}>
            <Text fontWeight="bold" mb={2}>Monthly summary</Text>
            <Skeleton isLoaded={!isFetching && !isFetchingMonth} borderRadius="lg">
              <CustomMinCalendar
                height="350px"
                width="100%"
                monthDate={currentDate}
                selectedDate={currentDate}
                onSelectDate={handleMiniSelectDate}
                onNavigate={handleNavigate}
                eventDates={eventDates}
              />
            </Skeleton>
          </Box>
        </Box>
      </Grid>

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

      <Modal isOpen={isRescheduleOpen} onClose={onRescheduleClose} isCentered size="xl">
        <ModalOverlay bg="blackAlpha.500" backdropFilter="blur(4px)" />
        <ModalContent maxW="800px">
          <ModalHeader>
            <VStack align="stretch" spacing={1}>
              <HStack justify="space-between">
                <Text fontSize="lg" fontWeight="bold">Reschedule Appointment</Text>
                {rescheduleData && <Badge colorScheme="purple" variant="subtle">Edit slot</Badge>}
              </HStack>
              {rescheduleData?.patientInfo && (
                <HStack spacing={3} color="gray.600">
                  <Icon as={CiUser} />
                  <Text fontSize="sm" noOfLines={1}>
                    {rescheduleData.patientInfo.name} {rescheduleData.patientInfo.lastName} • {formatAusPhoneNumber(rescheduleData.patientInfo.phone || "")}
                  </Text>
                </HStack>
              )}
            </VStack>
          </ModalHeader>
          <Divider />
          <ModalBody>
            <VStack align="stretch" spacing={4} pt={2} maxH="70vh" overflowY="auto">
              {rescheduleData && (
                <>
                  <Text fontWeight="semibold" fontSize="sm">Select new date and time:</Text>
                  <Grid templateColumns="repeat(2, 1fr)" gap={4}>
                    <Box>
                      <Text fontSize="xs" fontWeight="semibold" color="gray.600" mb={2}>Current slot:</Text>
                      <Box bg="gray.50" p={3} borderRadius="md" borderWidth="1px" borderColor="gray.200">
                        <HStack spacing={2}>
                          <Icon as={RiCalendarScheduleLine} color="gray.500" />
                          <VStack align="start" spacing={0}>
                            <Text fontSize="sm" fontWeight="medium">
                              {formatRange(rescheduleData.currentSlot?.startDate, rescheduleData.currentSlot?.endDate)}
                            </Text>
                            {statusBadge(rescheduleData.currentSlot?.status)}
                          </VStack>
                        </HStack>
                      </Box>
                    </Box>

                    <Box>
                      <Text fontSize="xs" fontWeight="semibold" color="blue.700" mb={2}>New slot:</Text>
                      <Box bg="blue.50" p={3} borderRadius="md" borderWidth="2px" borderColor="blue.300">
                        <HStack spacing={2}>
                          <Icon as={RiCalendarScheduleLine} color="blue.500" />
                          <VStack align="start" spacing={0}>
                            <Text fontSize="sm" fontWeight="semibold" color="blue.700">
                              {formatRange(rescheduleData.newStart, rescheduleData.newEnd)}
                            </Text>
                            <Badge colorScheme="blue" variant="subtle">New time</Badge>
                          </VStack>
                        </HStack>
                      </Box>
                    </Box>
                  </Grid>

                  <Box borderWidth="1px" borderColor="gray.200" borderRadius="lg" p={3} bg="gray.50">
                    <Text fontSize="sm" fontWeight="semibold" mb={2}>Choose a date:</Text>
                    <CustomMinCalendar
                      height="300px"
                      width="100%"
                      monthDate={rescheduleData.newStart}
                      selectedDate={rescheduleData.newStart}
                      onSelectDate={(newDate) => {
                        const duration = rescheduleData.newEnd.getTime() - rescheduleData.newStart.getTime();
                        handleChangeDate(newDate, new Date(newDate.getTime() + duration));
                      }}
                      onNavigate={(d) => {
                        const duration = rescheduleData.newEnd.getTime() - rescheduleData.newStart.getTime();
                        handleChangeDate(d, new Date(d.getTime() + duration));
                      }}
                      eventDates={[]}
                    />
                  </Box>

                  <Grid templateColumns="repeat(2, 1fr)" gap={3}>
                    <Box>
                      <Text fontSize="xs" fontWeight="semibold" color="gray.600" mb={1}>Start time:</Text>
                      <Input
                        type="time"
                        value={parseSydney(rescheduleData.newStart).toFormat("HH:mm")}
                        onChange={(e) => {
                          const [h, m] = e.target.value.split(":").map(Number);
                          const newStart = new Date(rescheduleData.newStart);
                          newStart.setHours(h, m, 0, 0);
                          handleChangeDate(newStart, rescheduleData.newEnd);
                        }}
                        size="sm"
                      />
                    </Box>
                    <Box>
                      <Text fontSize="xs" fontWeight="semibold" color="gray.600" mb={1}>End time:</Text>
                      <Input
                        type="time"
                        value={parseSydney(rescheduleData.newEnd).toFormat("HH:mm")}
                        onChange={(e) => {
                          const [h, m] = e.target.value.split(":").map(Number);
                          const newEnd = new Date(rescheduleData.newEnd);
                          newEnd.setHours(h, m, 0, 0);
                          handleChangeDate(rescheduleData.newStart, newEnd);
                        }}
                        size="sm"
                      />
                    </Box>
                  </Grid>
                </>
              )}

              <Divider />

              <Box>
                <Text fontWeight="semibold" mb={2}>How would you like to proceed?</Text>
                <RadioGroup value={rescheduleMode} onChange={(v) => setRescheduleMode(v as any)}>
                  <Stack direction="row" spacing={6}>
                    <Radio value="sms" colorScheme="purple">Consult via SMS</Radio>
                    <Radio value="manual" colorScheme="green">Manual change (no SMS)</Radio>
                  </Stack>
                </RadioGroup>
              </Box>

              {rescheduleMode === "sms" ? (
                <>
                  <Divider />
                  <Box>
                    <HStack justify="space-between" mb={2}>
                      <Text fontWeight="semibold">Custom message</Text>
                      <HStack>
                        <Text fontSize="xs" color="gray.600">Choose a template:</Text>
                        <ShowTemplateButton
                          category="confirmation"
                          selectedPatient={rescheduleData?.appointmentId || ""}
                          calendarSlot={rescheduleData ? { 
                            startDate: rescheduleData.newStart, 
                            endDate: rescheduleData.newEnd 
                          } : undefined}
                          selectedSlot={rescheduleData ? {
                            _id: rescheduleData.slotId,
                            startDate: rescheduleData.newStart,
                            endDate: rescheduleData.newEnd,
                          } : undefined}
                          onSelectTemplate={setCustomMessage}
                          tooltipText="Select template"
                          colorIcon={customMessage ? "green.500" : "purple.500"}
                          initialTypeFilter="liquid"
                          externalOpenVersion={openTemplateVersion}
                        />
                        <CreateLiquidTemplateModal
                          trigger={
                            <IconButton
                              aria-label="Create template"
                              icon={<MdOutlinePostAdd size={18} />}
                              variant="ghost"
                              size="sm"
                              colorScheme="purple"
                            />
                          }
                          defaultCategory="confirmation"
                          defaultAppointmentId={rescheduleData?.appointmentId}
                          calendarSlot={rescheduleData ? { 
                            startDate: rescheduleData.newStart, 
                            endDate: rescheduleData.newEnd 
                          } : undefined}
                          selectedSlot={rescheduleData ? {
                            _id: rescheduleData.slotId,
                            startDate: rescheduleData.newStart,
                            endDate: rescheduleData.newEnd,
                          } : undefined}
                          onCreated={() => setOpenTemplateVersion((v) => v + 1)}
                        />
                      </HStack>
                    </HStack>
                    <Text fontSize="xs" color="gray.500" mb={1}>
                      You can edit the message below before sending.
                    </Text>
                    <Textarea
                      value={customMessage}
                      onChange={(e) => setCustomMessage(e.target.value)}
                      placeholder="Select a template or write your message"
                      minH="120px"
                      fontFamily="mono"
                      fontSize="sm"
                    />
                  </Box>
                </>
              ) : (
                <>
                  <Divider />
                  <Box bg="green.50" borderWidth="1px" borderColor="green.200" p={3} rounded="md">
                    <Text fontSize="sm" color="green.800">
                      Manual path selected. No SMS will be sent. The appointment will be moved immediately.
                    </Text>
                  </Box>
                </>
              )}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <HStack spacing={3}>
              <Button variant="outline" colorScheme="red" onClick={() => setIsDeleteConfirmOpen(true)} isDisabled={isWorking}>
                Delete slot
              </Button>
              <Button variant="ghost" onClick={onRescheduleClose} isDisabled={isWorking}>
                Cancel
              </Button>
              {rescheduleMode === "sms" ? (
                <Button 
                  colorScheme="purple" 
                  isDisabled={!customMessage || isWorking} 
                  onClick={handleConfirmWithSMS}
                  isLoading={isWorking}
                >
                  Confirm & Send SMS
                </Button>
              ) : (
                <Button 
                  colorScheme="green" 
                  isDisabled={isWorking} 
                  onClick={handleConfirmManual}
                  isLoading={isWorking}
                >
                  Save without SMS
                </Button>
              )}
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Delete appointment slot</ModalHeader>
          <ModalBody>
            <Text>Are you sure you want to delete this appointment slot? This action cannot be undone.</Text>
          </ModalBody>
          <ModalFooter>
            <HStack spacing={3}>
              <Button variant="ghost" onClick={() => setIsDeleteConfirmOpen(false)}>Cancel</Button>
              <Button colorScheme="red" onClick={handleDeleteSlot}>Delete</Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default AssignedAppointments;
