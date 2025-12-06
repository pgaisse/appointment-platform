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
import { FiRefreshCcw } from "react-icons/fi";
import { CiUser } from "react-icons/ci";
import { MdOutlinePostAdd } from "react-icons/md";

import CustomCalendar, { Data } from "@/Components/Scheduler/CustomCalendar";
import { capitalize } from "@/utils/textFormat";
import CustomMinCalendar from "@/Components/Scheduler/CustomMinCalendar";
import { Appointment } from "@/types";
import AppointmentModal from "@/Components/Modal/AppointmentModal";
import { ModalStackProvider } from "@/Components/ModalStack/ModalStackContext";
import { useMonthlyEventDays } from "@/Hooks/Query/useMonthlyEventDays";
import { useDeleteAppointmentSlot } from "@/Hooks/Query/useDeleteAppointmentSlot";
import { useSendAppointmentSMS } from "@/Hooks/Query/useSendAppointmentSMS";
import { useProposeAppointmentDates } from "@/Hooks/Query/useProposeAppointmentDates";
import { useCalendarAppointments } from "@/Hooks/Query/useCalendarAppointments";
import { useUpdateAppointmentDate } from "@/Hooks/Query/useUpdateAppointmentDate";
import ShowTemplateButton from "@/Components/Chat/CustomMessages/ShowTemplateButton";
import CreateLiquidTemplateModal from "@/Components/Chat/CustomMessages/CreateLiquidTemplateModal";
import { formatAusPhoneNumber } from "@/Functions/formatAusPhoneNumber";
import { useQueryClient } from "@tanstack/react-query";
import { useSocket } from "@/Hooks/Query/useSocket";
import { useEffect } from "react";

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
  const [rescheduleMode, setRescheduleMode] = useState<"sms" | "manual">("manual");
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
  const { socket, connected } = useSocket();

  // Mutations
  const { mutateAsync: updateDateAsync, isPending: isUpdating } = useUpdateAppointmentDate();
  const { mutateAsync: deleteSlotAsync, isPending: isDeleting } = useDeleteAppointmentSlot();
  const { mutateAsync: sendSMS, isPending: isSending } = useSendAppointmentSMS();
  const { mutateAsync: proposeDate, isPending: isProposing } = useProposeAppointmentDates();
  const isWorking = isUpdating || isSending || isProposing || isDeleting;

  // Data
  const {
    data: appointmentsData,
    isLoading: isLoadingAppointments,
    isFetching,
  } = useCalendarAppointments({
    date: currentDate,
    view: calendarView,
    populate: ["selectedAppDates.priority", "selectedAppDates.treatment"],
    limit: 300,
  });

  const { data: monthData, isFetching: isFetchingMonth, refetch: refetchMonthDays } = useMonthlyEventDays(currentDate);

  const appointments = useMemo(() => 
    (Array.isArray(appointmentsData) ? appointmentsData : []) as Appointment[],
    [appointmentsData]
  );

  const eventDates = useMemo(() => monthData?.days ?? [], [monthData]);

  // Socket listeners for appointment updates
  useEffect(() => {
    if (!socket || !connected) return;

    // Handler for SMS confirmation sent (immediate status update to Pending)
    const handleAppointmentUpdated = async (payload: any) => {
      console.log('📩 [appointmentUpdated] Received:', payload);

      const { appointmentId, selectedAppDates, reason } = payload;

      if (!appointmentId) {
        console.warn('⚠️ [appointmentUpdated] Missing appointmentId:', payload);
        return;
      }

      try {
        console.log(`🔄 [appointmentUpdated] Updating cache for appointment: ${appointmentId}, reason: ${reason}`);

        // Optimistically update the cache with new selectedAppDates
        queryClient.setQueriesData(
          {
            predicate: (query) => {
              const head = Array.isArray(query.queryKey) ? String(query.queryKey[0]) : "";
              return head === "calendar-appointments";
            },
          },
          (oldData: any) => {
            if (!Array.isArray(oldData)) return oldData;
            return oldData.map((apt: any) => {
              if (String(apt._id) === String(appointmentId)) {
                return { ...apt, selectedAppDates };
              }
              return apt;
            });
          }
        );

        toast({
          title: "Appointment Updated",
          description: reason || "Appointment status updated.",
          status: "info",
          duration: 3000,
          isClosable: true,
        });

        // Refetch to ensure consistency
        await queryClient.invalidateQueries({
          predicate: (query) => {
            const head = Array.isArray(query.queryKey) ? String(query.queryKey[0]) : "";
            return head === "calendar-appointments" || head === "appointments-month-days";
          },
        });

        console.log('✅ [appointmentUpdated] Cache updated and invalidated');
      } catch (error: any) {
        console.error('❌ [appointmentUpdated] Error updating cache:', error);
      }
    };

    // Handler for patient confirmation responses
    const handleConfirmationResolved = async (payload: any) => {
      console.log('📩 [confirmationResolved] Received:', payload);

      const { appointmentId, slotId, decision, selectedAppDates } = payload;

      if (!appointmentId || !slotId || !decision) {
        console.warn('⚠️ [confirmationResolved] Missing required fields:', payload);
        return;
      }

      try {
        // Cancel any in-flight queries to avoid race conditions
        await queryClient.cancelQueries({
          predicate: (query) => {
            const head = Array.isArray(query.queryKey) ? String(query.queryKey[0]) : "";
            return (
              head === "calendar-appointments" ||
              head === "appointments-month-days" ||
              head === "Appointment"
            );
          },
        });

        if (decision === "confirmed") {
          // Patient confirmed: update status to Confirmed
          console.log('✅ [confirmationResolved] Patient confirmed - updating status to Confirmed');
          
          // Optimistically update the cache with new status
          queryClient.setQueriesData(
            {
              predicate: (query) => {
                const key = query.queryKey as any[];
                return Array.isArray(key) && key[0] === 'calendar-appointments';
              },
            },
            (oldData: any) => {
              if (!Array.isArray(oldData)) return oldData;
              
              return oldData.map((apt: any) => {
                if (String(apt._id) !== String(appointmentId)) return apt;
                
                const slots = Array.isArray(apt.selectedAppDates) ? [...apt.selectedAppDates] : [];
                const slotIndex = slots.findIndex((s: any) => String(s._id) === String(slotId));
                
                if (slotIndex === -1) return apt;
                
                // Update slot status to Confirmed
                slots[slotIndex] = {
                  ...slots[slotIndex],
                  status: 'Confirmed',
                };
                
                return { ...apt, selectedAppDates: slots };
              });
            }
          );

          toast({
            title: "Appointment Confirmed",
            description: `The patient confirmed the new appointment time.`,
            status: "success",
            duration: 4000,
            isClosable: true,
          });
        } else if (decision === "declined") {
          // Patient declined: revert to original position using slot.origin
          console.log('❌ [confirmationResolved] Patient declined - reverting to original time');
          
          // Use the full selectedAppDates array from the payload to find origin data
          const targetSlot = selectedAppDates?.find((s: any) => String(s._id) === String(slotId));
          const originStart = targetSlot?.origin?.startDate;
          const originEnd = targetSlot?.origin?.endDate;

          if (!originStart || !originEnd) {
            console.error('❌ [confirmationResolved] Missing origin data, cannot revert');
            
            // Even without origin, update status to Rejected
            queryClient.setQueriesData(
              {
                predicate: (query) => {
                  const key = query.queryKey as any[];
                  return Array.isArray(key) && key[0] === 'calendar-appointments';
                },
              },
              (oldData: any) => {
                if (!Array.isArray(oldData)) return oldData;
                
                return oldData.map((apt: any) => {
                  if (String(apt._id) !== String(appointmentId)) return apt;
                  
                  const slots = Array.isArray(apt.selectedAppDates) ? [...apt.selectedAppDates] : [];
                  const slotIndex = slots.findIndex((s: any) => String(s._id) === String(slotId));
                  
                  if (slotIndex === -1) return apt;
                  
                  slots[slotIndex] = {
                    ...slots[slotIndex],
                    status: 'Rejected',
                  };
                  
                  return { ...apt, selectedAppDates: slots };
                });
              }
            );

            toast({
              title: "Cannot Revert",
              description: "Patient declined but original time not found. Status updated to Rejected.",
              status: "warning",
              duration: 4000,
              isClosable: true,
            });
          } else {
            // Revert the slot to its original time with Rejected status
            await updateDateAsync({
              appointmentId,
              slotId,
              newStartDate: new Date(originStart).toISOString(),
              newEndDate: new Date(originEnd).toISOString(),
              status: "Rejected",
            });

            toast({
              title: "Appointment Declined",
              description: "The patient declined. Appointment reverted to original time.",
              status: "info",
              duration: 4000,
              isClosable: true,
            });
          }
        }

        // Force invalidate and refetch ALL related queries
        console.log('🔄 [confirmationResolved] Force invalidating all queries...');
        
        await queryClient.invalidateQueries({
          predicate: (query) => {
            const head = Array.isArray(query.queryKey) ? String(query.queryKey[0]) : "";
            return (
              head === "calendar-appointments" ||
              head === "appointments-month-days" ||
              head === "Appointment" ||
              head === "DraggableCards"
            );
          },
        });

        // Force refetch active queries
        await Promise.all([
          queryClient.refetchQueries({ 
            predicate: (query) => {
              const key = query.queryKey as any[];
              return Array.isArray(key) && key[0] === 'calendar-appointments';
            },
            type: 'active',
          }),
          refetchMonthDays(),
        ]);

        console.log('✅ [confirmationResolved] All queries refreshed');
      } catch (error: any) {
        console.error('❌ [confirmationResolved] Error processing confirmation:', error);
        
        toast({
          title: "Error Processing Response",
          description: error?.message || "Could not process patient response.",
          status: "error",
          duration: 4000,
          isClosable: true,
        });

        // Still try to refresh queries
        await queryClient.invalidateQueries({
          predicate: (query) => {
            const head = Array.isArray(query.queryKey) ? String(query.queryKey[0]) : "";
            return (
              head === "calendar-appointments" ||
              head === "appointments-month-days" ||
              head === "Appointment" ||
              head === "DraggableCards"
            );
          },
        });
      }
    };

    socket.on('appointmentUpdated', handleAppointmentUpdated);
    socket.on('confirmationResolved', handleConfirmationResolved);

    console.log('✅ Socket listeners registered: appointmentUpdated, confirmationResolved');

    return () => {
      socket.off('appointmentUpdated', handleAppointmentUpdated);
      socket.off('confirmationResolved', handleConfirmationResolved);
      console.log('❌ Socket listeners removed: appointmentUpdated, confirmationResolved');
    };
  }, [socket, connected, queryClient, toast, updateDateAsync, refetchMonthDays]);

  // Events transformation
  const events: Data[] = useMemo(() => {
    return appointments.flatMap((apt) => {
      const slots = Array.isArray((apt as any).selectedAppDates) ? (apt as any).selectedAppDates : [];
      return slots
        .filter((slot: any) => slot?.startDate && slot?.endDate)
        .map((slot: any) => {
          const status = String(slot.status || '').toLowerCase();
          const isPending = status === 'pending';
          
          // Agregar indicador visual para slots pendientes de confirmación
          const titlePrefix = isPending ? '⏳ ' : '';
          
          return {
            _id: apt._id!,
            title: `${titlePrefix}${capitalize(apt.nameInput)} ${capitalize(apt.lastNameInput)}`.trim() || "Appointment",
            start: new Date(slot.startDate),
            end: new Date(slot.endDate),
            color: (slot as any)?.priority?.color || (apt as any)?.color,
            resource: {
              apId: apt._id,
              slotId: slot._id,
              status: slot.status,
              priority: (slot as any)?.priority,
              treatment: (slot as any)?.treatment,
              isPending, // Flag para uso posterior si necesitas más customización
            },
          };
        });
    });
  }, [appointments]);

  // Refresh function
  const refreshData = useCallback(async () => {
    console.log('🔄 [refreshData] Starting manual refresh...');
    
    // Invalidar todas las vistas relacionadas
    await queryClient.invalidateQueries({
      predicate: (query) => {
        const head = Array.isArray(query.queryKey) ? String(query.queryKey[0]) : "";
        return (
          head === "calendar-appointments" ||
          head === "appointments-month-days" ||
          head === "Appointment" ||
          head === "DraggableCards"
        );
      },
    });

    // Refetch all active calendar-appointments queries
    await queryClient.refetchQueries({ 
      predicate: (query) => {
        const key = query.queryKey as any[];
        return Array.isArray(key) && key[0] === 'calendar-appointments';
      },
      type: 'active',
    });
    
    await refetchMonthDays();
    
    console.log('✅ [refreshData] Refresh completed');
  }, [queryClient, refetchMonthDays]);

  // Manual refresh handler (defined after refreshData to avoid TDZ)
  const handleManualRefresh = useCallback(async () => {
    await refreshData();
    toast({
      title: "Calendar refreshed",
      status: "success",
      duration: 2000,
      isClosable: true,
    });
  }, [refreshData, toast]);

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
      setRescheduleMode("manual");
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
      setRescheduleMode("manual");
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
      await deleteSlotAsync({
        appointmentId: rescheduleData.appointmentId,
        slotId: rescheduleData.slotId,
      });

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
  }, [rescheduleData, toast, onRescheduleClose, deleteSlotAsync]);

  const handleConfirmWithSMS = useCallback(async () => {
    if (!rescheduleData || !customMessage) return;

    try {
      console.log('🔄 [handleConfirmWithSMS] Starting SMS flow...');
      
      // Update slot dates immediately (Pending status)
      await updateDateAsync({
        appointmentId: rescheduleData.appointmentId,
        slotId: rescheduleData.slotId,
        newStartDate: rescheduleData.newStart.toISOString(),
        newEndDate: rescheduleData.newEnd.toISOString(),
        status: "Pending",
      });

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

      onRescheduleClose();
      setRescheduleData(null);
      
      console.log('✅ [handleConfirmWithSMS] SMS flow completed');
    } catch (error: any) {
      console.error('❌ [handleConfirmWithSMS] Error:', error);
      toast({
        title: "Error",
        description: error?.message || "An error occurred.",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    }
  }, [rescheduleData, customMessage, updateDateAsync, proposeDate, sendSMS, toast, onRescheduleClose]);

  const handleConfirmManual = useCallback(async () => {
    if (!rescheduleData) return;

    try {
      console.log('🔄 [handleConfirmManual] Starting manual update...');
      
      await updateDateAsync({
        appointmentId: rescheduleData.appointmentId,
        slotId: rescheduleData.slotId,
        newStartDate: rescheduleData.newStart.toISOString(),
        newEndDate: rescheduleData.newEnd.toISOString(),
      });

      toast({
        title: "Updated",
        description: "Appointment rescheduled.",
        status: "success",
        duration: 3000,
        isClosable: true,
      });

      onRescheduleClose();
      setRescheduleData(null);
      
      console.log('✅ [handleConfirmManual] Manual update completed');
    } catch (error: any) {
      console.error('❌ [handleConfirmManual] Error:', error);
      toast({
        title: "Error",
        description: error?.message || "An error occurred.",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    }
  }, [rescheduleData, updateDateAsync, toast, onRescheduleClose]);

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
          {(isLoadingAppointments || isFetching || isFetchingMonth) && (
            <Center position="absolute" inset={0} zIndex={2} bg={overlayBg} backdropFilter="blur(2px)">
              <HStack>
                <Spinner size="lg" />
                <Text>Loading schedule…</Text>
              </HStack>
            </Center>
          )}

          <Box mb={4}>
            <HStack justify="space-between" mb={2}>
              <Text fontSize="md" fontWeight="semibold">Schedule</Text>
              <Button
                size="sm"
                leftIcon={<FiRefreshCcw />}
                onClick={handleManualRefresh}
                isDisabled={isFetching || isFetchingMonth || isWorking}
                variant="outline"
                colorScheme="blue"
              >
                Refresh
              </Button>
            </HStack>
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

      <Modal isOpen={isRescheduleOpen} onClose={onRescheduleClose} isCentered size="xl" scrollBehavior="inside">
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
          <ModalBody sx={{
            '&::-webkit-scrollbar': { display: 'none' },
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}>
            <VStack
              align="stretch"
              spacing={4}
              pt={2}
              maxH="70vh"
              overflowY="auto"
              sx={{
                '&::-webkit-scrollbar': { display: 'none' },
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
            >
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

                  <Box borderWidth="1px" borderColor="gray.200" borderRadius="lg" p={3} bg="gray.50" position="relative" minH="360px" pb={4} mb={4} overflow="hidden">
                    <Text fontSize="sm" fontWeight="semibold" mb={2}>Choose a date:</Text>
                    <CustomMinCalendar
                      height="320px"
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

                  <Grid templateColumns="repeat(2, 1fr)" gap={3} position="relative" zIndex={2}>
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
          <ModalFooter position="sticky" bottom={0} bg={useColorModeValue("white", "gray.800")} borderTopWidth="1px" zIndex={1}>
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

      {/* Premium loading modal while mutations are in progress */}
      <Modal isOpen={isWorking} onClose={() => {}} isCentered closeOnOverlayClick={false} autoFocus={false} returnFocusOnClose={false}>
        <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(6px)" />
        <ModalContent bg={useColorModeValue('white', 'gray.800')} borderRadius="2xl" boxShadow="2xl" maxW="sm">
          <ModalHeader>
            <HStack spacing={3} align="center">
              <Spinner thickness="4px" speed="0.65s" emptyColor="gray.200" color="blue.500" size="md" />
              <Text fontWeight="bold">Updating schedule…</Text>
            </HStack>
          </ModalHeader>
          <Divider />
          <ModalBody>
            <Text color="gray.600">We’re processing your change. The calendar will refresh automatically once it’s done.</Text>
          </ModalBody>
          <ModalFooter>
            <Button isDisabled size="sm" variant="ghost">Please wait</Button>
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
