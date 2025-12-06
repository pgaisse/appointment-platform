// apps/frontend/src/Components/GoogleReviews/GoogleReviewsSettings.tsx
import { useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  FormControl,
  FormLabel,
  FormHelperText,
  Select,
  Switch,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Divider,
  useToast,
  useColorModeValue,
  Spinner,
  Badge,
  Code,
} from '@chakra-ui/react';
import { Save, RefreshCw, MapPin } from 'lucide-react';
import { useAuth0 } from '@auth0/auth0-react';
import { useGoogleLocations, useSyncGoogleReviews } from '@/Hooks/Query/useGoogleReviews';

export const GoogleReviewsSettings = () => {
  const toast = useToast();
  const { getAccessTokenSilently } = useAuth0();
  const [autoSync, setAutoSync] = useState(false);
  const [syncFrequency, setSyncFrequency] = useState('daily');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  const { data: locationsData, isLoading: locationsLoading } = useGoogleLocations();
  const { mutate: syncReviews, isPending: isSyncing } = useSyncGoogleReviews();

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  
  // Extract locations array and metadata
  const locations = locationsData?.locations || [];
  const isQuotaExceeded = locationsData?.quotaExceeded || false;
  const isCached = locationsData?.cached || false;
  const cacheAge = locationsData?.cacheAge || 0;

  const handleConnectAccount = async () => {
    try {
      setIsConnecting(true);
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        },
      });

      const apiUrl = import.meta.env.VITE_API_URL || 'https://dev.letsmarter.com:8443';
      const connectUrl = `${apiUrl}/api/google-reviews/connect-google?token=${encodeURIComponent(token)}`;
      
      // Redirect to Google OAuth flow
      window.location.href = connectUrl;
    } catch (error) {
      console.error('Error initiating Google OAuth:', error);
      toast({
        title: 'Connection failed',
        description: 'Failed to connect to Google My Business. Please try again.',
        status: 'error',
        duration: 5000,
      });
      setIsConnecting(false);
    }
  };

  const handleSyncNow = () => {
    if (!selectedLocation) {
      toast({
        title: 'Select a location',
        description: 'Please select a Google My Business location first',
        status: 'warning',
        duration: 3000,
      });
      return;
    }

    syncReviews(selectedLocation);
  };

  const handleSaveSettings = () => {
    // TODO: Implement settings save to backend
    toast({
      title: 'Settings saved',
      description: 'Your Google Reviews settings have been updated',
      status: 'success',
      duration: 3000,
    });
  };

  if (locationsLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minH="400px">
        <Spinner size="xl" color="blue.500" />
      </Box>
    );
  }

  return (
    <VStack spacing={6} align="stretch">
      {/* Connection Status */}
      <Box
        bg={cardBg}
        p={6}
        borderRadius="lg"
        borderWidth="1px"
        borderColor={borderColor}
      >
        <Text fontSize="lg" fontWeight="semibold" mb={4}>
          Google My Business Connection
        </Text>

        {/* Quota exceeded warning */}
        {isQuotaExceeded && (
          <Alert status="warning" borderRadius="md" mb={4}>
            <AlertIcon />
            <Box flex={1}>
              <AlertTitle>API Quota Exceeded</AlertTitle>
              <AlertDescription>
                Google My Business API quota exceeded. {isCached ? `Showing cached data from ${cacheAge}s ago.` : 'Please wait a few minutes and try again.'}
              </AlertDescription>
            </Box>
          </Alert>
        )}

        {locations && locations.length > 0 ? (
          <VStack spacing={3} align="stretch">
            <Alert status="success" borderRadius="md">
              <AlertIcon />
              <Box flex={1}>
                <AlertTitle>Connected</AlertTitle>
                <AlertDescription>
                  Your Google My Business account is connected with {locations.length} location(s)
                  {isCached && !isQuotaExceeded && (
                    <Badge ml={2} colorScheme="blue" fontSize="xs">
                      Cached ({cacheAge}s ago)
                    </Badge>
                  )}
                </AlertDescription>
              </Box>
            </Alert>
          </VStack>
        ) : (
          <Alert status="warning" borderRadius="md">
            <AlertIcon />
            <Box flex={1}>
              <AlertTitle>Not Connected</AlertTitle>
              <AlertDescription>
                Please connect your Google My Business account to sync reviews
              </AlertDescription>
            </Box>
            <Button 
              colorScheme="orange" 
              size="sm" 
              ml={3}
              onClick={handleConnectAccount}
              isLoading={isConnecting}
              loadingText="Connecting..."
            >
              Connect Account
            </Button>
          </Alert>
        )}
      </Box>

      {/* Location Selection */}
      {locations && locations.length > 0 && (
        <Box
          bg={cardBg}
          p={6}
          borderRadius="lg"
          borderWidth="1px"
          borderColor={borderColor}
        >
          <Text fontSize="lg" fontWeight="semibold" mb={4}>
            Location Settings
          </Text>

          <VStack spacing={4} align="stretch">
            <FormControl>
              <FormLabel display="flex" alignItems="center" gap={2}>
                <MapPin size={16} />
                Active Location
              </FormLabel>
              <Select
                placeholder="Select location"
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
              >
                {locations.map((loc) => (
                  <option key={loc.name} value={loc.name}>
                    {loc.title}
                  </option>
                ))}
              </Select>
              <FormHelperText>
                Reviews will be synced from this location
              </FormHelperText>
            </FormControl>

            {selectedLocation && (
              <Box p={3} bg="blue.50" borderRadius="md">
                <Text fontSize="sm" fontWeight="medium" color="blue.800" mb={1}>
                  Selected Location Details:
                </Text>
                <Code fontSize="xs" p={2} borderRadius="md" display="block">
                  {selectedLocation}
                </Code>
              </Box>
            )}
          </VStack>
        </Box>
      )}

      {/* Sync Settings */}
      <Box
        bg={cardBg}
        p={6}
        borderRadius="lg"
        borderWidth="1px"
        borderColor={borderColor}
      >
        <Text fontSize="lg" fontWeight="semibold" mb={4}>
          Sync Settings
        </Text>

        <VStack spacing={4} align="stretch">
          <FormControl display="flex" alignItems="center" justifyContent="space-between">
            <Box>
              <FormLabel mb={0}>Automatic Sync</FormLabel>
              <FormHelperText mt={1}>
                Automatically sync reviews on a schedule
              </FormHelperText>
            </Box>
            <Switch
              size="lg"
              colorScheme="blue"
              isChecked={autoSync}
              onChange={(e) => setAutoSync(e.target.checked)}
            />
          </FormControl>

          {autoSync && (
            <FormControl>
              <FormLabel>Sync Frequency</FormLabel>
              <Select
                value={syncFrequency}
                onChange={(e) => setSyncFrequency(e.target.value)}
              >
                <option value="hourly">Every Hour</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </Select>
              <FormHelperText>
                How often to check for new reviews
              </FormHelperText>
            </FormControl>
          )}

          <Divider />

          <FormControl>
            <Button
              leftIcon={<RefreshCw size={16} />}
              colorScheme="blue"
              onClick={handleSyncNow}
              isLoading={isSyncing}
              isDisabled={!selectedLocation}
              size="lg"
              width="full"
            >
              Sync Now
            </Button>
            <FormHelperText>
              Manually sync reviews from Google My Business
            </FormHelperText>
          </FormControl>
        </VStack>
      </Box>

      {/* Notification Settings */}
      <Box
        bg={cardBg}
        p={6}
        borderRadius="lg"
        borderWidth="1px"
        borderColor={borderColor}
      >
        <Text fontSize="lg" fontWeight="semibold" mb={4}>
          Notification Settings
        </Text>

        <VStack spacing={4} align="stretch">
          <FormControl display="flex" alignItems="center" justifyContent="space-between">
            <Box>
              <FormLabel mb={0}>New Review Notifications</FormLabel>
              <FormHelperText mt={1}>
                Get notified when you receive a new review
              </FormHelperText>
            </Box>
            <Switch size="lg" colorScheme="blue" defaultChecked />
          </FormControl>

          <FormControl display="flex" alignItems="center" justifyContent="space-between">
            <Box>
              <FormLabel mb={0}>Low Rating Alerts</FormLabel>
              <FormHelperText mt={1}>
                Get alerted for reviews with 2 stars or less
              </FormHelperText>
            </Box>
            <Switch size="lg" colorScheme="blue" defaultChecked />
          </FormControl>

          <FormControl display="flex" alignItems="center" justifyContent="space-between">
            <Box>
              <FormLabel mb={0}>Response Reminders</FormLabel>
              <FormHelperText mt={1}>
                Remind me to respond to reviews after 24 hours
              </FormHelperText>
            </Box>
            <Switch size="lg" colorScheme="blue" />
          </FormControl>
        </VStack>
      </Box>

      {/* Save Button */}
      <HStack justify="flex-end">
        <Button
          leftIcon={<Save size={16} />}
          colorScheme="blue"
          size="lg"
          onClick={handleSaveSettings}
        >
          Save Settings
        </Button>
      </HStack>
    </VStack>
  );
};
