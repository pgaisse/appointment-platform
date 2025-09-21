import EventCards from '@/Components/CustomTemplates/EventCards';
import CustomCalendar, { Data } from '@/Components/Scheduler/CustomCalendar';
import CustomMinCalendar from '@/Components/Scheduler/CustomMinCalendar';
import { createEvents } from '@/Functions/CreateEvents';
import { useGetCollection } from '@/Hooks/Query/useGetCollection';
import { Appointment } from '@/types';
import { isEqual, isSameDay, startOfDay } from 'date-fns';
import {
  Box,
  Grid,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  useColorModeValue
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { View, Views } from 'react-big-calendar';
import PremiumAppointmentModal from '@/Components/Modal/AppointmentModal';
import AppointmentModal from '@/Components/Modal/AppointmentModal';

const AssignedAppointments = () => {
  const [markedEvents, setMarkedEvents] = useState<Data[]>();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<Appointment | undefined>(undefined);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [calendarView, setCalendarView] = useState<View>(Views.WEEK);

  const query = {};
  const populateFields = [
    { path: "priority", select: "id description notes durationHours name color" },
    { path: "treatment", select: "_id name notes duration icon color minIcon" },
    { path: "selectedDates.days.timeBlocks" }
  ];
  const limit = 100;
  const { data, isLoading, isPlaceholderData, refetch, isFetching } = useGetCollection<Appointment>("Appointment", {
    query,
    limit,
    populate: populateFields
  });

  useEffect(() => {
    if (!isFetching && Array.isArray(data) && data.length > 0) {
      const events = createEvents(data);
      setMarkedEvents(events);
    }
  }, [data, isFetching]);



  const eventDates = markedEvents?.map(e => new Date(e.start).toDateString());

  const handleNavigate = (date: Date) => {
    setCurrentDate(date);
  };


  const handleSelectEvent = (event: Data) => {
    const result = data?.find((item) => item._id === event._id);

    setSelectedEvent(result);
    onOpen();
  };

  const modalBg = useColorModeValue("white", "gray.800");


  const handleViewChange = (view: View) => {
    setCalendarView(view);
    setCurrentDate(new Date()); // o simplemente mantén la fecha actual
  };

  const handleNavigateCalendar = (newDate: Date, view: View) => {
    setCurrentDate(newDate);
    setCalendarView(view);
  };
  const filteredEvents = markedEvents?.filter((event) => {
    if (calendarView === Views.DAY) {
      return isEqual(startOfDay(new Date(event.start)), startOfDay(currentDate));
    }
    return true;
  });


  return (
    <>
      <Grid
        templateColumns={{ base: "100%", md: "80% 20%" }}
        templateRows="auto auto"
        gap={4}
        width="100%"
      >
        <Box p={4}>
          <Box mb={4}>
            <CustomCalendar
              onView={handleViewChange}
              height="100vh"
              calView={calendarView}
              setDate={setCurrentDate}
              selectable={false}
              date={currentDate}
              onSelectEvent={handleSelectEvent}
              isFetching={isFetching}
              events={filteredEvents}
              onNavigate={handleNavigateCalendar}
              step={15}
            />
          </Box>
        </Box>

        <Box p={4} display={{ base: "none", md: "block" }}>
          <Box mb={4}>
            <CustomMinCalendar
              height="250px"
              width="200px"
              step={15}
              onSelectSlot={() => { }}
              calView={Views.MONTH}
              onNavigate={handleNavigate}
              eventDates={eventDates}
            />
          </Box>
        </Box>


      </Grid>

      {/* Modal Premium */}
      <Modal isOpen={isOpen} onClose={onClose} size="xl" isCentered motionPreset="scale">
        <ModalOverlay
          bg="blackAlpha.500"
          backdropFilter="blur(4px)"
        />
        <ModalContent
          bg={modalBg}
          borderRadius="2xl"
          boxShadow="2xl"
          p={2}
        >
          <ModalHeader fontWeight="bold" fontSize="2xl" textAlign="center">
            Detalles del Evento
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>

            {selectedEvent && (
                <AppointmentModal id={selectedEvent._id?? ""} isOpen={isOpen} onClose={onClose} />
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
};

export default AssignedAppointments;
