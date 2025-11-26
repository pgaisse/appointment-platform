import React from 'react';
import { Container, Box, Heading, Text, VStack } from '@chakra-ui/react';
import GoogleCalendarSync from '@/Components/GoogleCalendarSync';

/**
 * Example page showing how to use the GoogleCalendarSync component
 * 
 * To use this component in your app:
 * 1. Add this route to your router configuration
 * 2. Make sure the Google Client ID is correct
 * 3. Enable Google Calendar API in Google Cloud Console
 * 4. Add authorized redirect URIs in Google Cloud Console
 */
const GoogleCalendarPage: React.FC = () => {
  // Your Google OAuth Client ID
  const GOOGLE_CLIENT_ID = '166372210240-a77jsm4cj8ha28j85jl5ph0fdh5u4e39.apps.googleusercontent.com';

  return (
    <Container maxW="container.lg" py={8}>
      <VStack spacing={6} align="stretch">
        <Box>
          <Heading size="lg" mb={2}>
            Google Calendar Integration
          </Heading>
          <Text color="gray.600">
            Sync your appointments to Google Calendar automatically. Sign in with your Google
            account and choose which date range to sync.
          </Text>
        </Box>

        <GoogleCalendarSync 
          clientId={GOOGLE_CLIENT_ID}
          defaultView="month"
        />

        <Box bg="gray.50" p={4} borderRadius="md">
          <Heading size="sm" mb={3}>
            How it works
          </Heading>
          <VStack align="stretch" spacing={2} fontSize="sm">
            <Text>
              • <strong>Sign in:</strong> Authenticate with your Google account to enable calendar
              access
            </Text>
            <Text>
              • <strong>Select range:</strong> Choose today, this week, or this month to filter
              appointments
            </Text>
            <Text>
              • <strong>Sync:</strong> Click "Sync All Appointments" to create calendar events
            </Text>
            <Text>
              • <strong>Auto-sync:</strong> Enable auto-sync to automatically update Google Calendar
              when appointments change
            </Text>
          </VStack>
        </Box>

        <Box bg="orange.50" p={4} borderRadius="md" borderLeft="4px solid" borderColor="orange.500">
          <Heading size="sm" mb={2} color="orange.700">
            ⚠️ Authorization Required
          </Heading>
          <VStack align="stretch" spacing={2} fontSize="sm">
            <Text fontWeight="bold" color="orange.700">
              Current Origin: <code style={{ background: '#fff', padding: '2px 6px', borderRadius: '3px' }}>{window.location.origin}</code>
            </Text>
            <Text>
              If you see "Not a valid origin" error, follow these steps:
            </Text>
            <Text>
              1. Go to{' '}
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#c05621', textDecoration: 'underline', fontWeight: 'bold' }}
              >
                Google Cloud Console - Credentials
              </a>
            </Text>
            <Text>2. Click on your OAuth 2.0 Client ID</Text>
            <Text>3. Under "Authorized JavaScript origins", click "+ ADD URI"</Text>
            <Text>
              4. Add: <code style={{ background: '#fff', padding: '2px 6px', borderRadius: '3px', fontWeight: 'bold' }}>{window.location.origin}</code>
            </Text>
            <Text>5. Click "Save" and wait 1-2 minutes for changes to propagate</Text>
            <Text fontSize="xs" color="gray.600" mt={2}>
              💡 Tip: Make sure to include the port number if present (e.g., :8443)
            </Text>
          </VStack>
        </Box>

        <Box bg="blue.50" p={4} borderRadius="md" borderLeft="4px solid" borderColor="blue.500">
          <Heading size="sm" mb={2}>
            Setup Instructions (First Time)
          </Heading>
          <VStack align="stretch" spacing={2} fontSize="sm">
            <Text>
              1. Go to{' '}
              <a
                href="https://console.cloud.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'blue', textDecoration: 'underline' }}
              >
                Google Cloud Console
              </a>
            </Text>
            <Text>2. Enable the Google Calendar API for your project</Text>
            <Text>3. Create OAuth 2.0 Client ID (Web application)</Text>
            <Text>
              4. Add your domain to "Authorized JavaScript origins" (include protocol and port)
            </Text>
            <Text>5. No need to add redirect URIs for this integration</Text>
          </VStack>
        </Box>
      </VStack>
    </Container>
  );
};

export default GoogleCalendarPage;
