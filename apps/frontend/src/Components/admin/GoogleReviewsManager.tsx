// apps/frontend/src/Components/admin/GoogleReviewsManager.tsx
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Stack,
  FormControl,
  FormLabel,
  FormHelperText,
  Input,
  Textarea,
  Switch,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Button,
  Link,
  Text,
  Alert,
  AlertIcon,
  Spinner,
  HStack,
  Icon,
  Divider,
  Code,
  VStack,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Select,
  useToast,
  Card,
  CardBody,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  SimpleGrid,
} from '@chakra-ui/react';
import { ExternalLinkIcon, CheckCircleIcon, InfoIcon } from '@chakra-ui/icons';
import { FaStar, FaChartLine, FaClock, FaCheckCircle } from 'react-icons/fa';
import {
  useGoogleReviewSettings,
  useUpdateGoogleReviewSettings,
  useGoogleReviewHistory,
  useGoogleReviewAnalytics,
} from '@/Hooks/Query/useGoogleReviews';
import { format } from 'date-fns';

// Status badge component
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const statusConfig = {
    pending: { color: 'gray', label: 'Pending' },
    sent: { color: 'blue', label: 'Sent' },
    delivered: { color: 'green', label: 'Delivered' },
    clicked: { color: 'purple', label: 'Clicked' },
    reviewed: { color: 'yellow', label: 'Reviewed' },
    failed: { color: 'red', label: 'Failed' },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;

  return <Badge colorScheme={config.color}>{config.label}</Badge>;
};

export const GoogleReviewsManager: React.FC = () => {
  const toast = useToast();
  const { data: settings, isLoading, error, refetch } = useGoogleReviewSettings();
  const { mutate: updateSettings, isPending } = useUpdateGoogleReviewSettings();
  const { data: analytics, isLoading: analyticsLoading } = useGoogleReviewAnalytics();
  const [searchParams] = useSearchParams();
  
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { data: historyData, isLoading: historyLoading } = useGoogleReviewHistory({
    status: statusFilter === 'all' ? undefined : statusFilter,
  });

  const [formData, setFormData] = useState({
    enabled: false,
    reviewUrl: '',
    clinicName: '',
    messageTemplate: '',
    preventDuplicateDays: 30,
    autoSendAfterConfirmed: false,
    delayHours: 24,
  });

  // Refetch settings when redirected from OAuth
  useEffect(() => {
    const connected = searchParams.get('connected');
    if (connected === 'true') {
      console.log('🔄 OAuth callback detected, refetching settings...');
      refetch();
    }
  }, [searchParams, refetch]);

  useEffect(() => {
    if (settings) {
      setFormData({
        enabled: settings.enabled,
        reviewUrl: settings.reviewUrl || '',
        clinicName: settings.clinicName || '',
        messageTemplate: settings.messageTemplate,
        preventDuplicateDays: settings.preventDuplicateDays || 30,
        autoSendAfterConfirmed: settings.autoSendAfterConfirmed,
        delayHours: settings.delayHours,
      });
    }
  }, [settings]);

  const handleSave = () => {
    updateSettings(formData, {
      onSuccess: () => {
        toast({
          title: 'Settings saved',
          description: 'Google Reviews settings updated successfully',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      },
      onError: () => {
        toast({
          title: 'Error',
          description: 'Failed to save settings',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      },
    });
  };

  const hasChanges = () => {
    if (!settings) return false;
    return (
      formData.enabled !== settings.enabled ||
      formData.reviewUrl !== (settings.reviewUrl || '') ||
      formData.clinicName !== (settings.clinicName || '') ||
      formData.messageTemplate !== settings.messageTemplate ||
      formData.preventDuplicateDays !== (settings.preventDuplicateDays || 30) ||
      formData.autoSendAfterConfirmed !== settings.autoSendAfterConfirmed ||
      formData.delayHours !== settings.delayHours
    );
  };

  if (isLoading) {
    return (
      <Box textAlign="center" py={8}>
        <Spinner size="lg" color="blue.500" />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert status="error" rounded="md">
        <AlertIcon />
        Failed to load Google Review settings. Please try again later.
      </Alert>
    );
  }

  return (
    <Box>
      <Tabs colorScheme="blue" variant="enclosed">
        <TabList>
          <Tab>
            <Icon as={FaStar} mr={2} />
            Settings
          </Tab>
          <Tab>
            <Icon as={FaClock} mr={2} />
            History
          </Tab>
          <Tab>
            <Icon as={FaChartLine} mr={2} />
            Analytics
          </Tab>
        </TabList>

        <TabPanels>
          {/* Settings Tab */}
          <TabPanel>
            <Stack spacing={6}>
              {/* Info Alert */}
              <Alert status="info" borderRadius="md">
                <AlertIcon />
                <Box flex="1">
                  <Text fontWeight="bold" mb={1}>How to get your Review URL:</Text>
                  <VStack align="flex-start" spacing={1} fontSize="sm">
                    <Text><strong>Option 1 (Recommended - Short URL):</strong></Text>
                    <Text>1. Go to <Link href="https://business.google.com" isExternal color="blue.500">Google Business Profile <ExternalLinkIcon mx="2px" /></Link></Text>
                    <Text>2. Click "Get more reviews" or "Share review form"</Text>
                    <Text>3. Copy the short link (e.g., https://g.page/r/ABC123/review)</Text>
                    <Divider my={2} />
                    <Text><strong>Option 2 (Full URL):</strong></Text>
                    <Text>Use: https://search.google.com/local/writereview?placeid=YOUR_PLACE_ID</Text>
                  </VStack>
                </Box>
              </Alert>

              {/* Current Configuration Display */}
              {settings && (
                <Card bg={settings.enabled ? 'green.50' : 'gray.50'} borderWidth="1px">
                  <CardBody>
                    <VStack align="stretch" spacing={3}>
                      <HStack justify="space-between">
                        <Text fontWeight="bold" fontSize="lg">Current Configuration</Text>
                        <Badge colorScheme={settings.enabled ? 'green' : 'gray'} fontSize="sm">
                          {settings.enabled ? 'ENABLED' : 'DISABLED'}
                        </Badge>
                      </HStack>
                      <Divider />
                      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                        <Box>
                          <Text fontSize="sm" color="gray.600" fontWeight="semibold">Clinic Name:</Text>
                          <Text fontSize="md">{settings.clinicName || 'Not set'}</Text>
                        </Box>
                        <Box>
                          <Text fontSize="sm" color="gray.600" fontWeight="semibold">Review URL:</Text>
                          <Text fontSize="sm" isTruncated maxW="300px">
                            {settings.reviewUrl ? (
                              <Link href={settings.reviewUrl} isExternal color="blue.500">
                                {settings.reviewUrl} <ExternalLinkIcon mx="2px" />
                              </Link>
                            ) : (
                              'Not set'
                            )}
                          </Text>
                        </Box>
                        <Box>
                          <Text fontSize="sm" color="gray.600" fontWeight="semibold">Duplicate Prevention:</Text>
                          <Text fontSize="md">
                            {settings.preventDuplicateDays === 0 
                              ? 'No restriction' 
                              : `${settings.preventDuplicateDays} days`}
                          </Text>
                        </Box>
                        <Box>
                          <Text fontSize="sm" color="gray.600" fontWeight="semibold">Auto-send:</Text>
                          <Text fontSize="md">
                            {settings.autoSendAfterConfirmed 
                              ? `Yes (after ${settings.delayHours}h)` 
                              : 'No'}
                          </Text>
                        </Box>
                      </SimpleGrid>
                      {settings.messageTemplate && (
                        <>
                          <Divider />
                          <Box>
                            <Text fontSize="sm" color="gray.600" fontWeight="semibold" mb={1}>Message Template:</Text>
                            <Text fontSize="sm" p={2} bg="white" borderRadius="md" borderWidth="1px">
                              {settings.messageTemplate}
                            </Text>
                          </Box>
                        </>
                      )}
                    </VStack>
                  </CardBody>
                </Card>
              )}

              <Divider />

              {/* Enable/Disable */}
              <FormControl display="flex" alignItems="center">
                <FormLabel htmlFor="enabled" mb={0}>
                  Enable Google Reviews
                </FormLabel>
                <Switch
                  id="enabled"
                  isChecked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  colorScheme="green"
                />
              </FormControl>

              <Divider />

              {/* Clinic Name */}
              <FormControl isRequired>
                <FormLabel>Clinic Name</FormLabel>
                <Input
                  value={formData.clinicName}
                  onChange={(e) => setFormData({ ...formData, clinicName: e.target.value })}
                  placeholder="Your Clinic Name"
                  isDisabled={!formData.enabled}
                />
                <FormHelperText>
                  Will be used in the message template as {'{clinicName}'}
                </FormHelperText>
              </FormControl>

              {/* Review URL */}
              <FormControl isRequired>
                <FormLabel>Review URL</FormLabel>
                <Input
                  value={formData.reviewUrl}
                  onChange={(e) => setFormData({ ...formData, reviewUrl: e.target.value })}
                  placeholder="https://g.page/r/ABC123/review"
                  isDisabled={!formData.enabled}
                />
                <FormHelperText>
                  Your Google review page link. Short URLs (https://g.page/r/...) are recommended for SMS.{' '}
                  Get it from{' '}
                  <Link href="https://business.google.com" isExternal color="blue.500">
                    Google Business Profile <ExternalLinkIcon mx="2px" />
                  </Link>
                </FormHelperText>
              </FormControl>

              {/* Message Template */}
              <FormControl isRequired>
                <FormLabel>SMS Message Template</FormLabel>
                <Textarea
                  value={formData.messageTemplate}
                  onChange={(e) => setFormData({ ...formData, messageTemplate: e.target.value })}
                  placeholder="Hi {firstName}, thank you for visiting {clinicName}..."
                  rows={5}
                  isDisabled={!formData.enabled}
                />
                <FormHelperText>
                  <VStack align="flex-start" spacing={1}>
                    <Text>Available variables:</Text>
                    <HStack spacing={2} wrap="wrap">
                      <Code fontSize="xs">{'{firstName}'}</Code>
                      <Code fontSize="xs">{'{lastName}'}</Code>
                      <Code fontSize="xs">{'{clinicName}'}</Code>
                      <Code fontSize="xs">{'{reviewLink}'}</Code>
                    </HStack>
                  </VStack>
                </FormHelperText>
              </FormControl>

              {/* Prevent Duplicate Days */}
              <FormControl>
                <FormLabel>Prevent Duplicate Requests</FormLabel>
                <NumberInput
                  value={formData.preventDuplicateDays}
                  onChange={(_, value) => setFormData({ ...formData, preventDuplicateDays: value })}
                  min={0}
                  max={365}
                  isDisabled={!formData.enabled}
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
                <FormHelperText>
                  Days to wait before sending another request to the same patient. Set to 0 to allow unlimited requests (no time restriction).
                </FormHelperText>
              </FormControl>

              <Divider />

              {/* Auto-send after confirmation */}
              <FormControl display="flex" alignItems="center">
                <FormLabel htmlFor="autoSend" mb={0}>
                  Auto-send after appointment confirmation
                </FormLabel>
                <Switch
                  id="autoSend"
                  isChecked={formData.autoSendAfterConfirmed}
                  onChange={(e) =>
                    setFormData({ ...formData, autoSendAfterConfirmed: e.target.checked })
                  }
                  colorScheme="blue"
                  isDisabled={!formData.enabled}
                />
              </FormControl>

              {/* Delay Hours */}
              {formData.autoSendAfterConfirmed && (
                <FormControl>
                  <FormLabel>Delay (hours)</FormLabel>
                  <NumberInput
                    value={formData.delayHours}
                    onChange={(_, value) => setFormData({ ...formData, delayHours: value })}
                    min={0}
                    max={168}
                    isDisabled={!formData.enabled}
                  >
                    <NumberInputField />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                  <FormHelperText>Hours to wait after confirmation before sending SMS</FormHelperText>
                </FormControl>
              )}

              {/* Save Button */}
              <HStack justify="flex-end" pt={4}>
                <Button
                  leftIcon={<Icon as={FaStar} />}
                  colorScheme="yellow"
                  onClick={handleSave}
                  isLoading={isPending}
                  isDisabled={!hasChanges()}
                >
                  Save Settings
                </Button>
              </HStack>

              {/* Info Alert */}
              <Alert status="info" rounded="md">
                <AlertIcon />
                <VStack align="flex-start" spacing={1}>
                  <Text fontWeight="semibold">How it works:</Text>
                  <Text fontSize="sm">
                    1. Configure your clinic name and Google review URL above
                  </Text>
                  <Text fontSize="sm">
                    2. Customize the SMS message template with patient variables
                  </Text>
                  <Text fontSize="sm">
                    3. Use the review button in appointment cards to send requests
                  </Text>
                  <Text fontSize="sm">
                    4. Track click rates and reviews in the Analytics tab
                  </Text>
                </VStack>
              </Alert>
            </Stack>
          </TabPanel>

          {/* History Tab */}
          <TabPanel>
            <VStack spacing={4} align="stretch">
              <HStack justify="space-between">
                <Text fontSize="lg" fontWeight="semibold">
                  Review Request History
                </Text>
                <Select
                  maxW="200px"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="sent">Sent</option>
                  <option value="delivered">Delivered</option>
                  <option value="clicked">Clicked</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="failed">Failed</option>
                </Select>
              </HStack>

              {historyLoading ? (
                <Box textAlign="center" py={8}>
                  <Spinner size="lg" color="blue.500" />
                </Box>
              ) : historyData && historyData.history.length > 0 ? (
                <Box overflowX="auto">
                  <Table variant="simple" size="sm">
                    <Thead>
                      <Tr>
                        <Th>Patient</Th>
                        <Th>Phone</Th>
                        <Th>Status</Th>
                        <Th>Requested</Th>
                        <Th>Sent</Th>
                        <Th>Clicked</Th>
                        <Th>Reviewed</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {historyData.history.map((request: any) => (
                        <Tr key={request._id}>
                          <Td>
                            <Text fontWeight="medium">
                              {request.patient.name} {request.patient.lastName}
                            </Text>
                          </Td>
                          <Td>
                            <Text fontSize="sm" color="gray.600">
                              {request.patient.phone}
                            </Text>
                          </Td>
                          <Td>
                            <StatusBadge status={request.status} />
                          </Td>
                          <Td>
                            <Text fontSize="sm">
                              {format(new Date(request.requestedAt), 'MMM dd, yyyy HH:mm')}
                            </Text>
                          </Td>
                          <Td>
                            {request.sentAt ? (
                              <HStack spacing={1}>
                                <Icon as={CheckCircleIcon} color="green.500" boxSize={3} />
                                <Text fontSize="sm">
                                  {format(new Date(request.sentAt), 'HH:mm')}
                                </Text>
                              </HStack>
                            ) : (
                              <Text fontSize="sm" color="gray.400">
                                -
                              </Text>
                            )}
                          </Td>
                          <Td>
                            {request.clickedAt ? (
                              <HStack spacing={1}>
                                <Icon as={InfoIcon} color="purple.500" boxSize={3} />
                                <Text fontSize="sm">
                                  {format(new Date(request.clickedAt), 'HH:mm')}
                                </Text>
                              </HStack>
                            ) : (
                              <Text fontSize="sm" color="gray.400">
                                -
                              </Text>
                            )}
                          </Td>
                          <Td>
                            {request.reviewedAt ? (
                              <HStack spacing={1}>
                                <Icon as={FaStar} color="yellow.500" boxSize={3} />
                                <Text fontSize="sm">
                                  {format(new Date(request.reviewedAt), 'HH:mm')}
                                </Text>
                                {request.reviewRating && (
                                  <Badge colorScheme="yellow" ml={1}>
                                    {request.reviewRating}★
                                  </Badge>
                                )}
                              </HStack>
                            ) : (
                              <Text fontSize="sm" color="gray.400">
                                -
                              </Text>
                            )}
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>

                  <HStack justify="space-between" mt={4}>
                    <Text fontSize="sm" color="gray.600">
                      Showing {historyData.history.length} of {historyData.total} requests
                    </Text>
                  </HStack>
                </Box>
              ) : (
                <Alert status="info" rounded="md">
                  <AlertIcon />
                  No review requests found
                </Alert>
              )}
            </VStack>
          </TabPanel>

          {/* Analytics Tab */}
          <TabPanel>
            <VStack spacing={6} align="stretch">
              <Text fontSize="lg" fontWeight="semibold">
                Performance Analytics
              </Text>

              {analyticsLoading ? (
                <Box textAlign="center" py={8}>
                  <Spinner size="lg" color="blue.500" />
                </Box>
              ) : analytics ? (
                <>
                  <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
                    <Card>
                      <CardBody>
                        <Stat>
                          <StatLabel>Total Requests</StatLabel>
                          <StatNumber>{analytics.total}</StatNumber>
                          <StatHelpText>
                            <Icon as={FaClock} mr={1} />
                            All time
                          </StatHelpText>
                        </Stat>
                      </CardBody>
                    </Card>

                    <Card>
                      <CardBody>
                        <Stat>
                          <StatLabel>Sent Successfully</StatLabel>
                          <StatNumber color="green.500">{analytics.sent}</StatNumber>
                          <StatHelpText>
                            <Icon as={FaCheckCircle} mr={1} />
                            {analytics.sentRate}%
                          </StatHelpText>
                        </Stat>
                      </CardBody>
                    </Card>

                    <Card>
                      <CardBody>
                        <Stat>
                          <StatLabel>Clicked</StatLabel>
                          <StatNumber color="purple.500">{analytics.clicked}</StatNumber>
                          <StatHelpText>
                            <Icon as={InfoIcon} mr={1} />
                            {analytics.clickRate}% of delivered
                          </StatHelpText>
                        </Stat>
                      </CardBody>
                    </Card>

                    <Card>
                      <CardBody>
                        <Stat>
                          <StatLabel>Reviews Completed</StatLabel>
                          <StatNumber color="yellow.500">{analytics.reviewed}</StatNumber>
                          <StatHelpText>
                            <Icon as={FaStar} mr={1} />
                            {analytics.reviewRate}% of clicked
                          </StatHelpText>
                        </Stat>
                      </CardBody>
                    </Card>
                  </SimpleGrid>

                  <Card>
                    <CardBody>
                      <VStack align="stretch" spacing={3}>
                        <Text fontWeight="semibold">Conversion Funnel</Text>
                        <HStack justify="space-between">
                          <Text fontSize="sm">Sent → Delivered</Text>
                          <Badge colorScheme="green">{analytics.deliveredRate}%</Badge>
                        </HStack>
                        <HStack justify="space-between">
                          <Text fontSize="sm">Delivered → Clicked</Text>
                          <Badge colorScheme="purple">{analytics.clickRate}%</Badge>
                        </HStack>
                        <HStack justify="space-between">
                          <Text fontSize="sm">Clicked → Reviewed</Text>
                          <Badge colorScheme="yellow">{analytics.reviewRate}%</Badge>
                        </HStack>
                        <Divider />
                        <HStack justify="space-between">
                          <Text fontWeight="semibold">Overall Conversion</Text>
                          <Badge colorScheme="blue" fontSize="md">
                            {analytics.overallConversionRate}%
                          </Badge>
                        </HStack>
                      </VStack>
                    </CardBody>
                  </Card>

                  {analytics.avgRating > 0 && (
                    <Card>
                      <CardBody>
                        <Stat>
                          <StatLabel>Average Rating</StatLabel>
                          <StatNumber>
                            <HStack>
                              <Icon as={FaStar} color="yellow.500" />
                              <Text>{analytics.avgRating.toFixed(1)}</Text>
                            </HStack>
                          </StatNumber>
                        </Stat>
                      </CardBody>
                    </Card>
                  )}

                  {analytics.failed > 0 && (
                    <Alert status="warning" rounded="md">
                      <AlertIcon />
                      <VStack align="flex-start" spacing={0}>
                        <Text fontWeight="semibold">Failed Requests</Text>
                        <Text fontSize="sm">
                          {analytics.failed} request(s) failed to send. Check the History tab for details.
                        </Text>
                      </VStack>
                    </Alert>
                  )}
                </>
              ) : (
                <Alert status="info" rounded="md">
                  <AlertIcon />
                  No analytics data available yet
                </Alert>
              )}
            </VStack>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
};
