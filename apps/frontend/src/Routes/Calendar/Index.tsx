import { Box } from '@chakra-ui/react';
import AppointmentCalendar from '@/Components/Calendar/AppointmentCalendar';

const CalendarPage = () => {
  return (
    <Box minH="100vh" bg="gray.50">
      <AppointmentCalendar />
    </Box>
  );
};

export default CalendarPage;
