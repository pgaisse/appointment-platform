import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Icon,
  Badge,
  Button,
  ButtonGroup,
  Spinner,
  useToast,
  Tooltip,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  RadioGroup,
  Radio,
  Stack,
  Textarea,
  Divider,
  IconButton,
} from '@chakra-ui/react';
import { Calendar, luxonLocalizer, type Event } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { DateTime } from 'luxon';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import { useCalendarAppointments } from '@/Hooks/Query/useCalendarAppointments';
import { useUpdateAppointmentDate } from '@/Hooks/Query/useUpdateAppointmentDate';
import { useProposeAppointmentDates } from '@/Hooks/Query/useProposeAppointmentDates';
import { useSendAppointmentSMS } from '@/Hooks/Query/useSendAppointmentSMS';
import { getIconComponent } from '../CustomIcons';
import { formatAusPhoneNumber } from '@/Functions/formatAusPhoneNumber';
import { RiCalendarScheduleLine } from 'react-icons/ri';
import { FiRefreshCcw } from 'react-icons/fi';
import { MdOutlinePostAdd } from 'react-icons/md';
import ShowTemplateButton from '../Chat/CustomMessages/ShowTemplateButton';
import CreateLiquidTemplateModal from '../Chat/CustomMessages/CreateLiquidTemplateModal';
import { useQueryClient } from '@tanstack/react-query';
import './calendar-custom.css';

const DnDCalendar = withDragAndDrop(Calendar);

const TZ = 'Australia/Sydney';
const localizer = luxonLocalizer(DateTime, { firstDayOfWeek: 1 });

type RangeOption = 'thisWeek' | 'nextTwoWeeks' | 'thisMonth' | 'prevTwoWeeks';

interface CalendarEvent extends Event {
  appointmentId: string;
  slotId: string;
  patientName: string;
  phone: string;
  priorityColor: string;
  treatmentIcon?: string;
  treatmentColor?: string;
  treatmentName?: string;
  slot: any;
}

const AppointmentCalendar: React.FC = () => {
  const toast = useToast();
  const queryClient = useQueryClient();
  
  // Range state
  const [range, setRange] = useState<RangeOption>('thisWeek');
  const [customStart, setCustomStart] = useState<Date | null>(null);
  const [customEnd, setCustomEnd] = useState<Date | null>(null);

  // Modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingMove, setPendingMove] = useState<{
    appointmentId: string;
    slotId: string;
    newStart: Date;
    newEnd: Date;
    patientName: string;
    phone: string;
    oldStart: Date;
    oldEnd: Date;
  } | null>(null);
  const [moveMode, setMoveMode] = useState<'sms' | 'manual'>('sms');
  const [templateText, setTemplateText] = useState('');
  const [templateDrawerVersion, setTemplateDrawerVersion] = useState(0);

  // Calculate date range based on selected option
  const dateRange = useMemo(() => {
    const now = DateTime.now().setZone(TZ);
    
    switch (range) {
      case 'thisWeek': {
        const start = now.startOf('week');
        const end = now.endOf('week');
        return { start: start.toJSDate(), end: end.toJSDate() };
      }
      case 'nextTwoWeeks': {
        const start = now.startOf('day');
        const end = now.plus({ weeks: 2 }).endOf('day');
        return { start: start.toJSDate(), end: end.toJSDate() };
      }
      case 'thisMonth': {
        const start = now.startOf('month');
        const end = now.endOf('month');
        return { start: start.toJSDate(), end: end.toJSDate() };
      }
      case 'prevTwoWeeks': {
        const start = now.minus({ weeks: 2 }).startOf('day');
        const end = now.endOf('day');
        return { start: start.toJSDate(), end: end.toJSDate() };
      }
      default:
        return { start: now.startOf('week').toJSDate(), end: now.endOf('week').toJSDate() };
    }
  }, [range]);

  // Fetch appointments
  const { data: appointments, isLoading } = useCalendarAppointments(dateRange.start, dateRange.end);

  // Mutations
  const { mutateAsync: updateDateAsync, isPending: isUpdating } = useUpdateAppointmentDate();
  const { mutateAsync: proposeAsync, isPending: isProposing } = useProposeAppointmentDates();
  const { mutateAsync: sendSMSAsync, isPending: isSending } = useSendAppointmentSMS();

  const isWorking = isUpdating || isProposing || isSending;

  // Manual refresh (invalidate + refetch critical queries)
  const handleRefresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['calendarAppointments'] }),
      queryClient.invalidateQueries({ queryKey: ['appointments-range'] }),
      queryClient.invalidateQueries({ queryKey: ['appointments-month-days'] }),
      queryClient.invalidateQueries({ queryKey: ['DraggableCards'] }),
      queryClient.invalidateQueries({ queryKey: ['Appointment'] }),
    ]);
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ['calendarAppointments'] }),
      queryClient.refetchQueries({ queryKey: ['DraggableCards'] }),
    ]);
    toast({
      title: 'Calendar refreshed',
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  }, [queryClient, toast]);

  // Transform appointments to calendar events
  const events: CalendarEvent[] = useMemo(() => {
    if (!appointments) return [];

    const calendarEvents: CalendarEvent[] = [];

    appointments.forEach((appt) => {
      if (!Array.isArray(appt.selectedAppDates)) return;

      appt.selectedAppDates.forEach((slot) => {
        // Solo mostrar slots confirmados, pending o no contactados
        const status = String(slot.status || '').toLowerCase();
        if (!['confirmed', 'pending', 'nocontacted'].includes(status)) return;

        const start = slot.startDate ? new Date(slot.startDate) : null;
        const end = slot.endDate ? new Date(slot.endDate) : null;

        if (!start || !end) return;

        const treatment = slot.treatment as any;
        const priority = slot.priority as any;

        calendarEvents.push({
          appointmentId: appt._id,
          slotId: slot._id,
          title: `${appt.nameInput || ''} ${appt.lastNameInput || ''}`.trim(),
          start,
          end,
          patientName: `${appt.nameInput || ''} ${appt.lastNameInput || ''}`.trim(),
          phone: appt.phoneInput || '',
          priorityColor: priority?.color || 'gray',
          treatmentIcon: treatment?.minIcon,
          treatmentColor: treatment?.color,
          treatmentName: treatment?.name,
          slot,
        });
      });
    });

    return calendarEvents;
  }, [appointments]);

  // Handle event drop
  const handleEventDrop = useCallback(
    ({ event, start, end }: { event: CalendarEvent; start: Date; end: Date }) => {
      setPendingMove({
        appointmentId: event.appointmentId,
        slotId: event.slotId,
        newStart: start,
        newEnd: end,
        patientName: event.patientName,
        phone: event.phone,
        oldStart: event.start as Date,
        oldEnd: event.end as Date,
      });
      setMoveMode('sms');
      setTemplateText('');
      setConfirmOpen(true);
    },
    []
  );

  // Handle event resize
  const handleEventResize = useCallback(
    ({ event, start, end }: { event: CalendarEvent; start: Date; end: Date }) => {
      setPendingMove({
        appointmentId: event.appointmentId,
        slotId: event.slotId,
        newStart: start,
        newEnd: end,
        patientName: event.patientName,
        phone: event.phone,
        oldStart: event.start as Date,
        oldEnd: event.end as Date,
      });
      setMoveMode('sms');
      setTemplateText('');
      setConfirmOpen(true);
    },
    []
  );

  // Confirm SMS mode
  const handleConfirmSMS = async () => {
    if (!pendingMove || !templateText) return;

    try {
      // Proponer nueva fecha
      const resp = await proposeAsync({
        appointmentId: pendingMove.appointmentId,
        proposedStartDate: pendingMove.newStart.toISOString(),
        proposedEndDate: pendingMove.newEnd.toISOString(),
        currentStartDate: pendingMove.oldStart.toISOString(),
        currentEndDate: pendingMove.oldEnd.toISOString(),
        reason: 'Calendar rescheduling',
        baseSlotId: pendingMove.slotId,
      });

      // Enviar SMS
      try {
        await sendSMSAsync({
          appointmentId: pendingMove.appointmentId,
          msg: templateText,
          slotId: resp?.slotId || pendingMove.slotId,
        });
        
        toast({
          title: 'Proposal & SMS Sent',
          description: 'Date proposed and SMS dispatched.',
          status: 'info',
          duration: 3000,
          isClosable: true,
        });
      } catch (err: any) {
        toast({
          title: 'Proposed but SMS failed',
          description: err?.message || 'Could not send SMS.',
          status: 'warning',
          duration: 4000,
          isClosable: true,
        });
      }

      // Invalidar + forzar refetch para ver el cambio inmediatamente
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['calendarAppointments'] }),
        queryClient.invalidateQueries({ queryKey: ['DraggableCards'] }),
        queryClient.invalidateQueries({ queryKey: ['Appointment'] }),
        queryClient.invalidateQueries({ queryKey: ['appointments-range'] }),
        queryClient.invalidateQueries({ queryKey: ['appointments-month-days'] }),
      ]);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['calendarAppointments'] }),
        queryClient.refetchQueries({ queryKey: ['DraggableCards'] }),
        queryClient.refetchQueries({ queryKey: ['Appointment'] }),
      ]);

      setConfirmOpen(false);
      setPendingMove(null);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to propose date.',
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    }
  };

  // Confirm manual mode
  const handleConfirmManual = async () => {
    if (!pendingMove) return;

    try {
      await updateDateAsync({
        appointmentId: pendingMove.appointmentId,
        slotId: pendingMove.slotId,
        newStartDate: pendingMove.newStart.toISOString(),
        newEndDate: pendingMove.newEnd.toISOString(),
      });

      toast({
        title: 'Date updated',
        description: 'Appointment date changed without SMS.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      // Invalidar + forzar refetch para ver el cambio inmediatamente
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['calendarAppointments'] }),
        queryClient.invalidateQueries({ queryKey: ['DraggableCards'] }),
        queryClient.invalidateQueries({ queryKey: ['Appointment'] }),
        queryClient.invalidateQueries({ queryKey: ['appointments-range'] }),
        queryClient.invalidateQueries({ queryKey: ['appointments-month-days'] }),
      ]);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['calendarAppointments'] }),
        queryClient.refetchQueries({ queryKey: ['DraggableCards'] }),
        queryClient.refetchQueries({ queryKey: ['Appointment'] }),
      ]);

      setConfirmOpen(false);
      setPendingMove(null);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to update date.',
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    }
  };

  // Custom event component
  const EventComponent = ({ event }: { event: CalendarEvent }) => {
    const IconComp = event.treatmentIcon ? getIconComponent(event.treatmentIcon) : null;

    return (
      <Tooltip
        label={
          <VStack align="start" spacing={1}>
            <Text fontWeight="bold">{event.patientName}</Text>
            <Text fontSize="xs">{formatAusPhoneNumber(event.phone)}</Text>
            {event.treatmentName && <Text fontSize="xs">{event.treatmentName}</Text>}
          </VStack>
        }
        placement="top"
        hasArrow
      >
        <Box
          h="100%"
          w="100%"
          px={1}
          overflow="hidden"
          bg={`${event.priorityColor}.100`}
          borderLeft="3px solid"
          borderLeftColor={`${event.priorityColor}.500`}
          borderRadius="md"
          _hover={{ bg: `${event.priorityColor}.200` }}
        >
          <HStack spacing={1} h="100%">
            {IconComp && (
              <Icon as={IconComp} color={event.treatmentColor || 'gray.500'} boxSize={3} />
            )}
            <Text fontSize="xs" fontWeight="semibold" noOfLines={1}>
              {event.patientName}
            </Text>
          </HStack>
        </Box>
      </Tooltip>
    );
  };

  const formatRange = (start: Date, end: Date) => {
    const s = DateTime.fromJSDate(start, { zone: TZ });
    const e = DateTime.fromJSDate(end, { zone: TZ });
    const sameDay = s.hasSame(e, 'day');
    
    if (sameDay) {
      return `${s.toFormat('ccc, dd LLL yyyy')} • ${s.toFormat('h:mm a')} — ${e.toFormat('h:mm a')}`;
    }
    return `${s.toFormat('ccc, dd LLL yyyy • h:mm a')} → ${e.toFormat('ccc, dd LLL yyyy • h:mm a')}`;
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" h="500px">
        <Spinner size="xl" />
      </Box>
    );
  }

  return (
    <VStack align="stretch" spacing={4} p={4}>
      {/* Header con filtros */}
      <HStack justify="space-between" align="center">
        <HStack spacing={3}>
          <Icon as={RiCalendarScheduleLine} color="blue.500" boxSize={6} />
          <Text fontSize="xl" fontWeight="bold">
            Appointment Calendar
          </Text>
          <Badge colorScheme="blue" fontSize="md" px={3} py={1} borderRadius="full">
            {events.length} events
          </Badge>
        </HStack>
        <HStack spacing={3}>
          <Button
            size="sm"
            leftIcon={<FiRefreshCcw />}
            variant="outline"
            colorScheme="blue"
            onClick={handleRefresh}
            isDisabled={isWorking}
          >
            Refresh
          </Button>
          <ButtonGroup size="sm" isAttached variant="outline">
          <Button
            colorScheme={range === 'prevTwoWeeks' ? 'blue' : 'gray'}
            onClick={() => setRange('prevTwoWeeks')}
          >
            Previous 2 Weeks
          </Button>
          <Button
            colorScheme={range === 'thisWeek' ? 'blue' : 'gray'}
            onClick={() => setRange('thisWeek')}
          >
            This Week
          </Button>
          <Button
            colorScheme={range === 'nextTwoWeeks' ? 'blue' : 'gray'}
            onClick={() => setRange('nextTwoWeeks')}
          >
            Next 2 Weeks
          </Button>
          <Button
            colorScheme={range === 'thisMonth' ? 'blue' : 'gray'}
            onClick={() => setRange('thisMonth')}
          >
            This Month
          </Button>
          </ButtonGroup>
        </HStack>
      </HStack>

      {/* Calendar */}
      <Box
        bg="white"
        borderRadius="xl"
        border="1px solid"
        borderColor="gray.200"
        p={4}
        className="appointment-calendar"
      >
        <DnDCalendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: 600 }}
          views={['month', 'week', 'day']}
          defaultView="week"
          step={15}
          timeslots={4}
          draggableAccessor={() => true}
          resizable
          onEventDrop={handleEventDrop as any}
          onEventResize={handleEventResize as any}
          components={{
            event: EventComponent as any,
          }}
          date={dateRange.start}
          onNavigate={() => {}}
        />
      </Box>

      {/* Confirmation Modal */}
      <Modal isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} isCentered size="lg">
        <ModalOverlay bg="blackAlpha.500" backdropFilter="blur(4px)" />
        <ModalContent>
          <ModalHeader>
            <VStack align="stretch" spacing={1}>
              <Text fontSize="lg" fontWeight="bold">Confirm Date Change</Text>
              <HStack spacing={3} color="gray.600">
                <Text fontSize="sm">{pendingMove?.patientName}</Text>
                <Text fontSize="sm">•</Text>
                <Text fontSize="sm">{formatAusPhoneNumber(pendingMove?.phone || '')}</Text>
              </HStack>
            </VStack>
          </ModalHeader>
          <Divider />
          <ModalBody>
            <VStack align="stretch" spacing={4} pt={2}>
              {/* Fecha anterior y nueva */}
              <Box>
                <Text fontWeight="semibold" mb={2}>Date change:</Text>
                <VStack align="stretch" spacing={2}>
                  <HStack>
                    <Badge colorScheme="red" variant="subtle">Old</Badge>
                    <Text fontSize="sm">
                      {pendingMove && formatRange(pendingMove.oldStart, pendingMove.oldEnd)}
                    </Text>
                  </HStack>
                  <HStack>
                    <Badge colorScheme="green" variant="subtle">New</Badge>
                    <Text fontSize="sm">
                      {pendingMove && formatRange(pendingMove.newStart, pendingMove.newEnd)}
                    </Text>
                  </HStack>
                </VStack>
              </Box>

              <Divider />

              {/* Mode selector */}
              <Box>
                <Text fontWeight="semibold" mb={2}>How would you like to proceed?</Text>
                <RadioGroup value={moveMode} onChange={(v) => setMoveMode(v as any)}>
                  <Stack direction="row" spacing={6}>
                    <Radio value="sms" colorScheme="purple">Consult via SMS</Radio>
                    <Radio value="manual" colorScheme="green">Manual change (no SMS)</Radio>
                  </Stack>
                </RadioGroup>
              </Box>

              {/* SMS branch */}
              {moveMode === 'sms' ? (
                <>
                  <Divider />
                  <Box>
                    <HStack justify="space-between" align="center" mb={2}>
                      <Text fontWeight="semibold">Custom message</Text>
                      <HStack>
                        <Text fontSize="xs" color="gray.600">Choose template:</Text>
                        <ShowTemplateButton
                          category="confirmation"
                          selectedPatient={pendingMove?.appointmentId || ''}
                          calendarSlot={
                            pendingMove
                              ? { startDate: pendingMove.newStart, endDate: pendingMove.newEnd }
                              : undefined
                          }
                          selectedSlot={
                            pendingMove
                              ? {
                                  _id: pendingMove.slotId,
                                  startDate: pendingMove.oldStart,
                                  endDate: pendingMove.oldEnd,
                                }
                              : undefined
                          }
                          onSelectTemplate={(val: string) => setTemplateText(val)}
                          tooltipText="Select template"
                          colorIcon={templateText ? 'green.500' : 'purple.500'}
                          initialTypeFilter="liquid"
                          externalOpenVersion={templateDrawerVersion}
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
                          defaultAppointmentId={pendingMove?.appointmentId}
                          calendarSlot={
                            pendingMove
                              ? { startDate: pendingMove.newStart, endDate: pendingMove.newEnd }
                              : undefined
                          }
                          selectedSlot={
                            pendingMove
                              ? {
                                  _id: pendingMove.slotId,
                                  startDate: pendingMove.oldStart,
                                  endDate: pendingMove.oldEnd,
                                }
                              : undefined
                          }
                          onCreated={() => setTemplateDrawerVersion((v) => v + 1)}
                        />
                      </HStack>
                    </HStack>
                    <Text fontSize="xs" color="gray.500" mb={1}>
                      You can edit the message below before sending.
                    </Text>
                    <Textarea
                      value={templateText}
                      onChange={(e) => setTemplateText(e.target.value)}
                      placeholder="Your message with date/time tokens: :StartDate, :StartTime, :EndTime, etc."
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
                      Manual path selected. No SMS will be sent. The appointment date will be updated
                      directly.
                    </Text>
                  </Box>
                </>
              )}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <HStack spacing={3}>
              <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
                Cancel
              </Button>
              {moveMode === 'sms' ? (
                <Button
                  colorScheme="purple"
                  isDisabled={!templateText || isWorking}
                  onClick={handleConfirmSMS}
                >
                  {isWorking ? <Spinner size="sm" /> : 'Confirm & Send'}
                </Button>
              ) : (
                <Button colorScheme="green" isDisabled={isWorking} onClick={handleConfirmManual}>
                  {isWorking ? <Spinner size="sm" /> : 'Save without SMS'}
                </Button>
              )}
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  );
};

export default AppointmentCalendar;
