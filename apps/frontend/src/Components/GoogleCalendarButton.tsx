import React from 'react';
import {
  Button,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  useToast,
  Tooltip,
} from '@chakra-ui/react';
import { FcGoogle } from 'react-icons/fc';
import { ChevronDownIcon } from '@chakra-ui/icons';
import { useGoogleCalendar, AppointmentEvent } from '@/Hooks/useGoogleCalendar';

interface GoogleCalendarButtonProps {
  clientId: string;
  appointment?: AppointmentEvent;
  appointments?: AppointmentEvent[];
  variant?: 'button' | 'icon' | 'menu';
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Simple button component to sync appointments to Google Calendar
 * Can be easily integrated into existing components
 * 
 * Usage:
 * 
 * // Sync single appointment
 * <GoogleCalendarButton 
 *   clientId="YOUR_CLIENT_ID"
 *   appointment={appointment}
 *   variant="icon"
 * />
 * 
 * // Sync multiple appointments
 * <GoogleCalendarButton 
 *   clientId="YOUR_CLIENT_ID"
 *   appointments={appointments}
 *   variant="menu"
 * />
 */
export const GoogleCalendarButton: React.FC<GoogleCalendarButtonProps> = ({
  clientId,
  appointment,
  appointments,
  variant = 'button',
  size = 'md',
}) => {
  const toast = useToast();
  const {
    isInitialized,
    isAuthenticated,
    isLoading,
    initializeGapi,
    signIn,
    syncSingleAppointment,
    syncAppointments,
  } = useGoogleCalendar(clientId);

  // Initialize on mount
  React.useEffect(() => {
    if (!isInitialized) {
      initializeGapi();
    }
  }, [isInitialized, initializeGapi]);

  const handleSyncSingle = async () => {
    if (!appointment) {
      toast({
        title: 'No appointment selected',
        status: 'warning',
        duration: 2000,
      });
      return;
    }

    if (!isAuthenticated) {
      await signIn();
      return;
    }

    try {
      await syncSingleAppointment(appointment);
    } catch (err) {
      console.error('Sync error:', err);
    }
  };

  const handleSyncAll = async () => {
    if (!appointments || appointments.length === 0) {
      toast({
        title: 'No appointments to sync',
        status: 'warning',
        duration: 2000,
      });
      return;
    }

    if (!isAuthenticated) {
      await signIn();
      return;
    }

    try {
      await syncAppointments(appointments);
    } catch (err) {
      console.error('Sync error:', err);
    }
  };

  const handleSignIn = async () => {
    try {
      await signIn();
    } catch (err) {
      console.error('Sign in error:', err);
    }
  };

  // Icon button variant
  if (variant === 'icon') {
    return (
      <Tooltip
        label={
          !isAuthenticated
            ? 'Sign in to sync with Google Calendar'
            : 'Sync to Google Calendar'
        }
      >
        <IconButton
          aria-label="Sync to Google Calendar"
          icon={<FcGoogle />}
          onClick={handleSyncSingle}
          isLoading={isLoading}
          size={size}
          variant="ghost"
          isDisabled={!isInitialized}
        />
      </Tooltip>
    );
  }

  // Menu variant (for multiple options)
  if (variant === 'menu') {
    return (
      <Menu>
        <MenuButton
          as={Button}
          rightIcon={<ChevronDownIcon />}
          leftIcon={<FcGoogle />}
          size={size}
          isLoading={isLoading}
          isDisabled={!isInitialized}
        >
          Google Calendar
        </MenuButton>
        <MenuList>
          {!isAuthenticated ? (
            <MenuItem onClick={handleSignIn}>Sign in with Google</MenuItem>
          ) : (
            <>
              {appointment && (
                <MenuItem onClick={handleSyncSingle}>Sync This Appointment</MenuItem>
              )}
              {appointments && appointments.length > 0 && (
                <MenuItem onClick={handleSyncAll}>
                  Sync All ({appointments.length})
                </MenuItem>
              )}
            </>
          )}
        </MenuList>
      </Menu>
    );
  }

  // Default button variant
  return (
    <Button
      leftIcon={<FcGoogle />}
      onClick={isAuthenticated ? handleSyncSingle : handleSignIn}
      isLoading={isLoading}
      size={size}
      colorScheme={isAuthenticated ? 'blue' : 'gray'}
      variant={isAuthenticated ? 'solid' : 'outline'}
      isDisabled={!isInitialized}
    >
      {!isAuthenticated ? 'Sign in with Google' : 'Sync to Calendar'}
    </Button>
  );
};

export default GoogleCalendarButton;
