import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  VStack,
  HStack,
  Text,
  useToast,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Spinner,
  Badge,
  Divider,
  Heading,
  Card,
  CardHeader,
  CardBody,
  Switch,
  FormControl,
  FormLabel,
  Tooltip,
  Icon,
} from '@chakra-ui/react';
import { FcGoogle } from 'react-icons/fc';
import { MdSync, MdCheckCircle, MdError, MdInfo } from 'react-icons/md';
import { useGoogleCalendar, AppointmentEvent } from '@/Hooks/useGoogleCalendar';
import { useAppointmentsByRange } from '@/Hooks/Query/useAppointmentsByRange';
import { Views, View } from 'react-big-calendar';

interface GoogleCalendarSyncProps {
  clientId: string;
  defaultView?: 'month' | 'week' | 'day';
}

export const GoogleCalendarSync: React.FC<GoogleCalendarSyncProps> = ({
  clientId,
  defaultView = 'month',
}) => {
  const [autoSync, setAutoSync] = useState(false);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [currentView, setCurrentView] = useState<View>(
    defaultView === 'day' ? Views.DAY : 
    defaultView === 'week' ? Views.WEEK : 
    Views.MONTH
  );

  const toast = useToast();

  // Initialize Google Calendar hook
  const {
    isInitialized,
    isAuthenticated,
    isLoading: googleLoading,
    error: googleError,
    initializeGapi,
    signIn,
    signOut,
    syncAppointments,
    syncSingleAppointment,
  } = useGoogleCalendar(clientId);

  // Fetch appointments from the system using the correct API
  const {
    data: appointments,
    isLoading: appointmentsLoading,
    refetch: refetchAppointments,
  } = useAppointmentsByRange({
    date: currentDate,
    view: currentView,
    populate: ['priority', 'treatment'],
    limit: 500,
  });

  // Initialize Google API on mount
  useEffect(() => {
    if (!isInitialized) {
      initializeGapi();
    }
  }, [isInitialized, initializeGapi]);

  // Auto-sync when authenticated and enabled
  useEffect(() => {
    if (autoSync && isAuthenticated && appointments && appointments.length > 0) {
      handleSyncAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSync, isAuthenticated, appointments]);

  const handleSyncAll = async () => {
    if (!appointments || appointments.length === 0) {
      toast({
        title: 'No appointments to sync',
        description: 'There are no appointments in the selected range',
        status: 'info',
        duration: 3000,
      });
      return;
    }

    try {
      // Transform appointments to the format expected by the hook
      const appointmentEvents: AppointmentEvent[] = appointments.map((apt: any) => ({
        _id: apt._id,
        nameInput: apt.nameInput || '',
        lastNameInput: apt.lastNameInput || '',
        phoneInput: apt.phoneInput,
        emailInput: apt.emailInput,
        selectedAppDates: apt.selectedAppDates || [],
        treatment: apt.treatment,
        priority: apt.priority,
        note: apt.note,
        textAreaInput: apt.textAreaInput,
      }));

      await syncAppointments(appointmentEvents);
    } catch (err) {
      console.error('Sync failed:', err);
    }
  };

  const handleRangeChange = (range: 'today' | 'week' | 'month') => {
    const now = new Date();
    let newView: View;

    switch (range) {
      case 'today':
        newView = Views.DAY;
        break;
      case 'week':
        newView = Views.WEEK;
        break;
      case 'month':
        newView = Views.MONTH;
        break;
      default:
        return;
    }

    setCurrentDate(now);
    setCurrentView(newView);

    // Refetch will happen automatically due to queryKey change
    setTimeout(() => refetchAppointments(), 100);
  };

  const getStatusColor = () => {
    if (googleError) return 'red';
    if (!isInitialized) return 'gray';
    if (isAuthenticated) return 'green';
    return 'orange';
  };

  const getStatusText = () => {
    if (googleError) return 'Error';
    if (!isInitialized) return 'Not initialized';
    if (isAuthenticated) return 'Connected';
    return 'Not connected';
  };

  const appointmentCount = appointments?.length || 0;
  const totalSlots = appointments?.reduce(
    (acc: number, apt: any) => acc + (apt.selectedAppDates?.length || 0),
    0
  ) || 0;

  return (
    <Card>
      <CardHeader>
        <HStack justify="space-between">
          <HStack spacing={3}>
            <Icon as={FcGoogle} boxSize={8} />
            <Heading size="md">Google Calendar Sync</Heading>
          </HStack>
          <Badge colorScheme={getStatusColor()} fontSize="md" px={3} py={1}>
            {getStatusText()}
          </Badge>
        </HStack>
      </CardHeader>

      <CardBody>
        <VStack spacing={4} align="stretch">
          {/* Error Alert */}
          {googleError && (
            <Alert status="error" borderRadius="md">
              <AlertIcon as={MdError} />
              <Box flex="1">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{googleError}</AlertDescription>
              </Box>
            </Alert>
          )}

          {/* Info Alert */}
          {!isAuthenticated && !googleError && (
            <Alert status="info" borderRadius="md">
              <AlertIcon as={MdInfo} />
              <Box flex="1">
                <AlertTitle>Authentication Required</AlertTitle>
                <AlertDescription>
                  Sign in with Google to sync your appointments to Google Calendar
                </AlertDescription>
              </Box>
            </Alert>
          )}

          {/* Authentication Section */}
          <Box>
            <FormControl display="flex" alignItems="center" mb={4}>
              <FormLabel htmlFor="auto-sync" mb="0">
                Auto-sync appointments
              </FormLabel>
              <Switch
                id="auto-sync"
                isChecked={autoSync}
                onChange={(e) => setAutoSync(e.target.checked)}
                isDisabled={!isAuthenticated}
              />
            </FormControl>

            <HStack spacing={3}>
              {!isAuthenticated ? (
                <Button
                  leftIcon={<FcGoogle />}
                  onClick={signIn}
                  isLoading={googleLoading}
                  loadingText="Connecting..."
                  colorScheme="blue"
                  size="lg"
                  isDisabled={!isInitialized}
                >
                  Sign in with Google
                </Button>
              ) : (
                <Button
                  onClick={signOut}
                  isLoading={googleLoading}
                  variant="outline"
                  colorScheme="gray"
                >
                  Sign out
                </Button>
              )}
            </HStack>
          </Box>

          <Divider />

          {/* Date Range Selection */}
          <Box>
            <Text fontWeight="semibold" mb={2}>
              Select Date Range
            </Text>
            <HStack spacing={2}>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleRangeChange('today')}
              >
                Today
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleRangeChange('week')}
              >
                This Week
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleRangeChange('month')}
              >
                This Month
              </Button>
            </HStack>
            <Text fontSize="sm" color="gray.600" mt={2}>
              {currentView === Views.DAY && 'Today: '}
              {currentView === Views.WEEK && 'This Week: '}
              {currentView === Views.MONTH && 'This Month: '}
              {currentDate.toLocaleDateString('en-US', { 
                month: 'long', 
                year: 'numeric',
                ...(currentView === Views.DAY ? { day: 'numeric' } : {})
              })}
            </Text>
          </Box>

          <Divider />

          {/* Appointment Stats */}
          <Box>
            <Text fontWeight="semibold" mb={2}>
              Appointments to Sync
            </Text>
            {appointmentsLoading ? (
              <HStack>
                <Spinner size="sm" />
                <Text>Loading appointments...</Text>
              </HStack>
            ) : (
              <HStack spacing={6}>
                <VStack align="start" spacing={0}>
                  <Text fontSize="2xl" fontWeight="bold">
                    {appointmentCount}
                  </Text>
                  <Text fontSize="sm" color="gray.600">
                    Appointments
                  </Text>
                </VStack>
                <VStack align="start" spacing={0}>
                  <Text fontSize="2xl" fontWeight="bold">
                    {totalSlots}
                  </Text>
                  <Text fontSize="sm" color="gray.600">
                    Event Slots
                  </Text>
                </VStack>
              </HStack>
            )}
          </Box>

          <Divider />

          {/* Sync Actions */}
          <Box>
            <Tooltip
              label={
                !isAuthenticated
                  ? 'Please sign in with Google first'
                  : appointmentCount === 0
                  ? 'No appointments to sync'
                  : ''
              }
              isDisabled={isAuthenticated && appointmentCount > 0}
            >
              <Button
                leftIcon={<Icon as={MdSync} />}
                onClick={handleSyncAll}
                isLoading={googleLoading || appointmentsLoading}
                loadingText="Syncing..."
                colorScheme="green"
                size="lg"
                width="full"
                isDisabled={!isAuthenticated || appointmentCount === 0}
              >
                Sync All Appointments
              </Button>
            </Tooltip>
            <Text fontSize="xs" color="gray.500" mt={2} textAlign="center">
              This will create {totalSlots} event{totalSlots !== 1 ? 's' : ''} in your Google
              Calendar
            </Text>
          </Box>

          {/* Success Message */}
          {isAuthenticated && (
            <Alert status="success" borderRadius="md">
              <AlertIcon as={MdCheckCircle} />
              <Box flex="1">
                <AlertDescription>
                  Connected to Google Calendar. Your appointments will sync automatically if
                  auto-sync is enabled.
                </AlertDescription>
              </Box>
            </Alert>
          )}
        </VStack>
      </CardBody>
    </Card>
  );
};

export default GoogleCalendarSync;
