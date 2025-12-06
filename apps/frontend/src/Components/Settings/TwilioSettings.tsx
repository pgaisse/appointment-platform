import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  VStack,
  HStack,
  Text,
  useToast,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Spinner,
  Switch,
  InputGroup,
  InputRightElement,
  IconButton,
  Code,
  Collapse,
  Badge,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
} from '@chakra-ui/react';
import { ViewIcon, ViewOffIcon, CheckCircleIcon, WarningIcon } from '@chakra-ui/icons';
import { AxiosError } from 'axios';
import { useAuthFetch } from '@/api/authFetch';
import WebhookLogsTab from './WebhookLogsTab';

const TwilioSettings = () => {
  const toast = useToast();
  const { authFetch } = useAuthFetch();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // Form state
  const [accountSid, setAccountSid] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [fromNumber, setFromNumber] = useState('');
  const [messagingServiceSid, setMessagingServiceSid] = useState('');
  const [conversationsServiceSid, setConversationsServiceSid] = useState('');

  // Settings state
  const [configured, setConfigured] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [validated, setValidated] = useState(false);
  const [lastValidatedAt, setLastValidatedAt] = useState(null);
  
  // Current configuration (read-only display)
  const [currentAccountSid, setCurrentAccountSid] = useState('');

  // UI state
  const [showAuthToken, setShowAuthToken] = useState(false);
  const [showTestSection, setShowTestSection] = useState(false);
  const [showCredentialsForm, setShowCredentialsForm] = useState(false);
  const [testNumber, setTestNumber] = useState('');
  const [testMessage, setTestMessage] = useState('Test message from Twilio');

  // Load settings
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await authFetch('/api/twilio-config/settings');
      const data = response;

      setConfigured(data.configured);
      setEnabled(data.enabled);
      setValidated(data.validated);
      setFromNumber(data.fromNumber || '');
      setMessagingServiceSid(data.messagingServiceSid || '');
      setConversationsServiceSid(data.conversationsServiceSid || '');
      setLastValidatedAt(data.lastValidatedAt);
      setCurrentAccountSid(data.accountSid || '');
      
      // Show form only if not configured
      setShowCredentialsForm(!data.configured);
    } catch (error) {
      console.error('Error loading Twilio settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load Twilio settings',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!accountSid || !authToken || !fromNumber) {
      toast({
        title: 'Validation Error',
        description: 'Account SID, Auth Token, and From Number are required',
        status: 'warning',
        duration: 5000,
      });
      return;
    }

    // Validate phone number format
    if (!/^\+[1-9]\d{1,14}$/.test(fromNumber)) {
      toast({
        title: 'Invalid Phone Number',
        description: 'Please use E.164 format (e.g., +61412345678)',
        status: 'warning',
        duration: 5000,
      });
      return;
    }

    try {
      setSaving(true);
      await authFetch('/api/twilio-config/settings', {
        method: 'POST',
        body: JSON.stringify({
          accountSid,
          authToken,
          fromNumber,
          messagingServiceSid: messagingServiceSid || null,
          conversationsServiceSid: conversationsServiceSid || null,
        }),
      });

      toast({
        title: 'Success',
        description: 'Twilio settings saved and validated successfully',
        status: 'success',
        duration: 5000,
      });

      // Reload settings
      await loadSettings();

      // Clear sensitive fields
      setAccountSid('');
      setAuthToken('');
    } catch (error) {
      console.error('Error saving Twilio settings:', error);
      const axiosError = error as AxiosError<{ error?: string }>;
      toast({
        title: 'Error',
        description: axiosError.response?.data?.error || 'Failed to save Twilio settings',
        status: 'error',
        duration: 7000,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async () => {
    try {
      await authFetch('/api/twilio-config/settings/toggle', {
        method: 'PUT',
        body: JSON.stringify({
          enabled: !enabled,
        }),
      });

      setEnabled(!enabled);

      toast({
        title: 'Success',
        description: `Twilio ${!enabled ? 'enabled' : 'disabled'} successfully`,
        status: 'success',
        duration: 3000,
      });
    } catch (error) {
      console.error('Error toggling Twilio:', error);
      toast({
        title: 'Error',
        description: 'Failed to toggle Twilio settings',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const handleTestSMS = async () => {
    if (!testNumber || !testMessage) {
      toast({
        title: 'Validation Error',
        description: 'Test number and message are required',
        status: 'warning',
        duration: 5000,
      });
      return;
    }

    try {
      setTesting(true);
      await authFetch('/api/twilio-config/test/sms', {
        method: 'POST',
        body: JSON.stringify({
          to: testNumber,
          body: testMessage,
        }),
      });

      toast({
        title: 'Success',
        description: 'Test SMS sent successfully',
        status: 'success',
        duration: 5000,
      });
    } catch (error) {
      console.error('Error sending test SMS:', error);
      const axiosError = error as AxiosError<{ error?: string }>;
      toast({
        title: 'Error',
        description: axiosError.response?.data?.error || 'Failed to send test SMS',
        status: 'error',
        duration: 7000,
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <Box textAlign="center" py={10}>
        <Spinner size="xl" />
        <Text mt={4}>Loading Twilio settings...</Text>
      </Box>
    );
  }

  return (
    <Box maxW="1200px" mx="auto" p={6}>
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <Box>
          <Text fontSize="2xl" fontWeight="bold" mb={2}>
            Twilio Configuration
          </Text>
          <Text color="gray.600">
            Configure your Twilio account and monitor webhook events.
          </Text>
        </Box>

        {/* Tabs */}
        <Tabs colorScheme="purple" variant="enclosed">
          <TabList>
            <Tab>Configuration</Tab>
            <Tab>Webhook Logs</Tab>
          </TabList>

          <TabPanels>
            {/* Configuration Tab */}
            <TabPanel px={0}>
              <VStack spacing={6} align="stretch">

        {/* Current Configuration Display */}
        {configured && (
          <Box borderWidth="1px" borderRadius="lg" p={6} bg="blue.50">
            <HStack justify="space-between" mb={4}>
              <Text fontSize="lg" fontWeight="semibold">
                Current Configuration
              </Text>
              <Button
                size="sm"
                colorScheme="blue"
                variant="outline"
                onClick={() => setShowCredentialsForm(!showCredentialsForm)}
              >
                {showCredentialsForm ? 'Hide Form' : 'Edit Credentials'}
              </Button>
            </HStack>
            <VStack spacing={3} align="stretch">
              {currentAccountSid && (
                <HStack>
                  <Text fontWeight="medium" minW="200px">Account SID:</Text>
                  <Code fontSize="sm">{currentAccountSid}</Code>
                </HStack>
              )}
              {fromNumber && (
                <HStack>
                  <Text fontWeight="medium" minW="200px">From Number:</Text>
                  <Code fontSize="sm">{fromNumber}</Code>
                </HStack>
              )}
              {messagingServiceSid && (
                <HStack>
                  <Text fontWeight="medium" minW="200px">Messaging Service SID:</Text>
                  <Code fontSize="sm">{messagingServiceSid}</Code>
                </HStack>
              )}
              {conversationsServiceSid && (
                <HStack>
                  <Text fontWeight="medium" minW="200px">Conversations Service SID:</Text>
                  <Code fontSize="sm">{conversationsServiceSid}</Code>
                </HStack>
              )}
              {lastValidatedAt && (
                <HStack>
                  <Text fontWeight="medium" minW="200px">Last Validated:</Text>
                  <Text fontSize="sm">{new Date(lastValidatedAt).toLocaleString()}</Text>
                </HStack>
              )}
            </VStack>
          </Box>
        )}

        {/* Status Alert */}
        {configured && validated && (
          <Alert status="success" borderRadius="md">
            <AlertIcon />
            <Box flex="1">
              <AlertTitle>Twilio is Active!</AlertTitle>
              <AlertDescription>
                Your Twilio integration is configured and validated.
                {lastValidatedAt && (
                  <Text fontSize="sm" mt={1}>
                    Last validated: {new Date(lastValidatedAt).toLocaleString()}
                  </Text>
                )}
              </AlertDescription>
            </Box>
          </Alert>
        )}

        {/* Credentials Form */}
        {(!configured || showCredentialsForm) && (
          <Box borderWidth="1px" borderRadius="lg" p={6} bg="white">
            <Text fontSize="lg" fontWeight="semibold" mb={4}>
              {configured ? 'Edit Credentials' : 'Credentials'}
            </Text>

            <VStack spacing={4}>
            <FormControl isRequired>
              <FormLabel>Account SID</FormLabel>
              <Input
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={accountSid}
                onChange={(e) => setAccountSid(e.target.value)}
                type="text"
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Found in your Twilio Console dashboard
              </Text>
            </FormControl>

            <FormControl isRequired>
              <FormLabel>Auth Token</FormLabel>
              <InputGroup>
                <Input
                  placeholder="Enter your Twilio Auth Token"
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  type={showAuthToken ? 'text' : 'password'}
                />
                <InputRightElement>
                  <IconButton
                    icon={showAuthToken ? <ViewOffIcon /> : <ViewIcon />}
                    onClick={() => setShowAuthToken(!showAuthToken)}
                    variant="ghost"
                    size="sm"
                    aria-label="Toggle auth token visibility"
                  />
                </InputRightElement>
              </InputGroup>
              <Text fontSize="xs" color="gray.500" mt={1}>
                Keep this secret and secure
              </Text>
            </FormControl>

            <FormControl isRequired>
              <FormLabel>From Number</FormLabel>
              <Input
                placeholder="+61412345678"
                value={fromNumber}
                onChange={(e) => setFromNumber(e.target.value)}
                type="tel"
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                E.164 format (e.g., +61412345678)
              </Text>
            </FormControl>

            <FormControl>
              <FormLabel>Messaging Service SID (Optional)</FormLabel>
              <Input
                placeholder="MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={messagingServiceSid}
                onChange={(e) => setMessagingServiceSid(e.target.value)}
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                If using Twilio Messaging Service
              </Text>
            </FormControl>

            <FormControl>
              <FormLabel>Conversations Service SID (Optional)</FormLabel>
              <Input
                placeholder="ISxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={conversationsServiceSid}
                onChange={(e) => setConversationsServiceSid(e.target.value)}
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Required for webhook configuration
              </Text>
            </FormControl>

            <Button
              colorScheme="blue"
              width="full"
              onClick={handleSave}
              isLoading={saving}
              loadingText="Validating & Saving..."
              leftIcon={<CheckCircleIcon />}
            >
              Save & Validate Credentials
            </Button>
          </VStack>
        </Box>
        )}

        {/* Test Section */}
        {configured && validated && (
          <Box borderWidth="1px" borderRadius="lg" p={6} bg="white">
            <HStack justify="space-between" mb={4} cursor="pointer" onClick={() => setShowTestSection(!showTestSection)}>
              <Text fontSize="lg" fontWeight="semibold">
                Test SMS
              </Text>
              <Button size="sm" variant="ghost">
                {showTestSection ? 'Hide' : 'Show'}
              </Button>
            </HStack>

            <Collapse in={showTestSection}>
              <VStack spacing={4}>
                <FormControl>
                  <FormLabel>Test Phone Number</FormLabel>
                  <Input
                    placeholder="+61412345678"
                    value={testNumber}
                    onChange={(e) => setTestNumber(e.target.value)}
                    type="tel"
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Test Message</FormLabel>
                  <Input
                    placeholder="Enter test message"
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                  />
                </FormControl>

                <Button
                  colorScheme="green"
                  width="full"
                  onClick={handleTestSMS}
                  isLoading={testing}
                  loadingText="Sending..."
                >
                  Send Test SMS
                </Button>
              </VStack>
            </Collapse>
          </Box>
        )}

        {/* Help Section */}
        <Box borderWidth="1px" borderRadius="lg" p={6} bg="blue.50">
          <Text fontSize="md" fontWeight="semibold" mb={2}>
            <WarningIcon mr={2} color="blue.500" />
            Need Help?
          </Text>
          <VStack align="start" spacing={2} fontSize="sm">
            <Text>
              1. Go to{' '}
              <Text as="span" fontWeight="semibold" color="blue.600">
                Twilio Console
              </Text>{' '}
              to find your credentials
            </Text>
            <Text>
              2. Copy Account SID and Auth Token from the dashboard
            </Text>
            <Text>
              3. Use a Twilio phone number in E.164 format (+country code + number)
            </Text>
            <Text>
              4. For webhook configuration, make sure your Conversations Service SID is correct
            </Text>
          </VStack>
        </Box>
              </VStack>
            </TabPanel>

            {/* Webhook Logs Tab */}
            <TabPanel px={0}>
              <WebhookLogsTab />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </VStack>
    </Box>
  );
};

export default TwilioSettings;
