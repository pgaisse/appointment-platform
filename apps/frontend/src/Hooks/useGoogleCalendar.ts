import { useState, useCallback } from 'react';
import { useToast } from '@chakra-ui/react';

// Google Calendar API configuration
const SCOPES = 'https://www.googleapis.com/auth/calendar.events';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';

// Access global gapi and google (for GIS)
declare const gapi: any;
declare const google: any;

export interface AppointmentEvent {
  _id: string;
  nameInput: string;
  lastNameInput: string;
  phoneInput?: string;
  emailInput?: string;
  selectedAppDates: Array<{
    _id: string;
    startDate: Date | string;
    endDate: Date | string;
    status?: string;
  }>;
  treatment?: {
    name: string;
  };
  priority?: {
    name: string;
  };
  note?: string;
  textAreaInput?: string;
}

export interface GoogleCalendarEvent {
  summary: string;
  description: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  attendees?: Array<{
    email: string;
  }>;
  reminders: {
    useDefault: boolean;
  };
}

interface UseGoogleCalendarReturn {
  isInitialized: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  initializeGapi: () => Promise<void>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  syncAppointments: (appointments: AppointmentEvent[]) => Promise<void>;
  syncSingleAppointment: (appointment: AppointmentEvent) => Promise<void>;
}

export const useGoogleCalendar = (clientId: string): UseGoogleCalendarReturn => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenClient, setTokenClient] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const toast = useToast();

  // Initialize Google API with new GIS (Google Identity Services)
  const initializeGapi = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load Google Identity Services (GIS)
      await new Promise<void>((resolve, reject) => {
        const existingGsiScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
        if (existingGsiScript) {
          resolve();
          return;
        }

        const gsiScript = document.createElement('script');
        gsiScript.src = 'https://accounts.google.com/gsi/client';
        gsiScript.async = true;
        gsiScript.defer = true;
        gsiScript.onload = () => resolve();
        gsiScript.onerror = () => reject(new Error('Failed to load Google Identity Services'));
        document.body.appendChild(gsiScript);
      });

      // Load Google API Platform Library
      await new Promise<void>((resolve, reject) => {
        const existingApiScript = document.querySelector('script[src="https://apis.google.com/js/api.js"]');
        if (existingApiScript) {
          resolve();
          return;
        }

        const apiScript = document.createElement('script');
        apiScript.src = 'https://apis.google.com/js/api.js';
        apiScript.async = true;
        apiScript.defer = true;
        apiScript.onload = () => resolve();
        apiScript.onerror = () => reject(new Error('Failed to load Google API'));
        document.body.appendChild(apiScript);
      });

      // Wait for gapi to be ready
      await new Promise<void>((resolve) => {
        const checkGapi = () => {
          if (typeof gapi !== 'undefined' && gapi.load) {
            resolve();
          } else {
            setTimeout(checkGapi, 100);
          }
        };
        checkGapi();
      });

      // Load the Calendar API
      await new Promise<void>((resolve) => {
        gapi.load('client', () => resolve());
      });

      await gapi.client.init({
        discoveryDocs: [DISCOVERY_DOC],
      });

      // Wait for google.accounts to be ready
      await new Promise<void>((resolve) => {
        const checkGoogle = () => {
          if (typeof google !== 'undefined' && google.accounts) {
            resolve();
          } else {
            setTimeout(checkGoogle, 100);
          }
        };
        checkGoogle();
      });

      // Initialize the token client for OAuth 2.0
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: (response: any) => {
          if (response.error) {
            console.error('Token error:', response);
            setError(response.error);
            setIsAuthenticated(false);
            return;
          }
          
          setAccessToken(response.access_token);
          setIsAuthenticated(true);
          
          toast({
            title: 'Signed in successfully',
            status: 'success',
            duration: 2000,
            isClosable: true,
          });
        },
      });

      setTokenClient(client);
      setIsInitialized(true);

      toast({
        title: 'Google Calendar ready',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    } catch (err: any) {
      let errorMsg = 'Failed to initialize Google Calendar';
      let detailedMsg = '';

      if (err && typeof err === 'object') {
        if (err.error === 'idpiframe_initialization_failed') {
          errorMsg = 'Origin not authorized';
          detailedMsg = `Your domain (${window.location.origin}) is not authorized in Google Cloud Console. Please add it to "Authorized JavaScript origins" in your OAuth 2.0 Client ID settings.`;
        } else if (err.details) {
          detailedMsg = err.details;
        } else if (err.message) {
          errorMsg = err.message;
        }
      } else if (err instanceof Error) {
        errorMsg = err.message;
      }

      setError(errorMsg);
      console.error('Google Calendar initialization error:', err);
      
      toast({
        title: errorMsg,
        description: detailedMsg || 'Check console for details',
        status: 'error',
        duration: 10000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  }, [clientId, toast]);

  // Sign in to Google using new GIS
  const signIn = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      if (!isInitialized) {
        await initializeGapi();
        return;
      }

      if (!tokenClient) {
        throw new Error('Token client not initialized');
      }

      // Request access token
      tokenClient.requestAccessToken({ prompt: 'consent' });
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to sign in';
      setError(errorMsg);
      toast({
        title: 'Sign In Error',
        description: errorMsg,
        status: 'error',
        duration: 5000,
      });
      setIsLoading(false);
    }
  }, [isInitialized, tokenClient, initializeGapi, toast]);

  // Sign out from Google
  const signOut = useCallback(async () => {
    try {
      setIsLoading(true);
      
      if (accessToken) {
        // Revoke the token
        google.accounts.oauth2.revoke(accessToken, () => {
          console.log('Token revoked');
        });
      }
      
      setAccessToken(null);
      setIsAuthenticated(false);
      
      toast({
        title: 'Signed out successfully',
        status: 'info',
        duration: 2000,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to sign out';
      setError(errorMsg);
      toast({
        title: 'Sign Out Error',
        description: errorMsg,
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, toast]);

  // Convert appointment to Google Calendar event format
  const convertToGoogleEvent = useCallback((
    appointment: AppointmentEvent,
    slot: { startDate: Date | string; endDate: Date | string }
  ): GoogleCalendarEvent => {
    const startDate = typeof slot.startDate === 'string' ? new Date(slot.startDate) : slot.startDate;
    const endDate = typeof slot.endDate === 'string' ? new Date(slot.endDate) : slot.endDate;

    const fullName = `${appointment.nameInput} ${appointment.lastNameInput}`.trim();
    const treatment = appointment.treatment?.name || 'Appointment';
    const priority = appointment.priority?.name || '';
    
    let description = `Patient: ${fullName}\n`;
    if (appointment.phoneInput) description += `Phone: ${appointment.phoneInput}\n`;
    if (appointment.emailInput) description += `Email: ${appointment.emailInput}\n`;
    if (priority) description += `Priority: ${priority}\n`;
    if (appointment.note || appointment.textAreaInput) {
      description += `\nNotes: ${appointment.note || appointment.textAreaInput}`;
    }

    const event: GoogleCalendarEvent = {
      summary: `${treatment} - ${fullName}`,
      description,
      start: {
        dateTime: startDate.toISOString(),
        timeZone: 'Australia/Sydney',
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: 'Australia/Sydney',
      },
      reminders: {
        useDefault: true,
      },
    };

    // Add email as attendee if available
    if (appointment.emailInput && appointment.emailInput.includes('@')) {
      event.attendees = [{
        email: appointment.emailInput,
      }];
    }

    return event;
  }, []);

  // Sync a single appointment to Google Calendar
  const syncSingleAppointment = useCallback(async (appointment: AppointmentEvent) => {
    try {
      if (!isAuthenticated) {
        throw new Error('Not authenticated with Google Calendar');
      }

      setIsLoading(true);
      setError(null);

      if (!accessToken) {
        throw new Error('Not authenticated');
      }

      // Set the access token for gapi
      gapi.client.setToken({ access_token: accessToken });

      const eventsCreated: string[] = [];

      // Create an event for each appointment slot
      for (const slot of appointment.selectedAppDates || []) {
        const googleEvent = convertToGoogleEvent(appointment, slot);

        const response = await gapi.client.calendar.events.insert({
          calendarId: 'primary',
          resource: googleEvent,
        });

        if (response.result.id) {
          eventsCreated.push(response.result.htmlLink || '');
        }
      }

      toast({
        title: 'Appointment synced',
        description: `Created ${eventsCreated.length} event(s) in Google Calendar`,
        status: 'success',
        duration: 3000,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to sync appointment';
      setError(errorMsg);
      toast({
        title: 'Sync Error',
        description: errorMsg,
        status: 'error',
        duration: 5000,
      });
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, convertToGoogleEvent, toast]);

  // Sync multiple appointments to Google Calendar
  const syncAppointments = useCallback(async (appointments: AppointmentEvent[]) => {
    try {
      if (!isAuthenticated) {
        throw new Error('Not authenticated with Google Calendar');
      }

      setIsLoading(true);
      setError(null);

      if (!accessToken) {
        throw new Error('Not authenticated');
      }

      // Set the access token for gapi
      gapi.client.setToken({ access_token: accessToken });

      let totalEvents = 0;
      let successCount = 0;
      let failCount = 0;

      for (const appointment of appointments) {
        try {
          for (const slot of appointment.selectedAppDates || []) {
            totalEvents++;
            const googleEvent = convertToGoogleEvent(appointment, slot);

            await gapi.client.calendar.events.insert({
              calendarId: 'primary',
              resource: googleEvent,
            });

            successCount++;
          }
        } catch (err) {
          failCount++;
          console.error('Failed to sync appointment:', appointment._id, err);
        }
      }

      toast({
        title: 'Sync completed',
        description: `Successfully synced ${successCount} of ${totalEvents} events`,
        status: successCount === totalEvents ? 'success' : 'warning',
        duration: 5000,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to sync appointments';
      setError(errorMsg);
      toast({
        title: 'Sync Error',
        description: errorMsg,
        status: 'error',
        duration: 5000,
      });
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, convertToGoogleEvent, toast]);

  return {
    isInitialized,
    isAuthenticated,
    isLoading,
    error,
    initializeGapi,
    signIn,
    signOut,
    syncAppointments,
    syncSingleAppointment,
  };
};
