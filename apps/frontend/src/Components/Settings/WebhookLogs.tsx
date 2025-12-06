import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Container,
  Heading,
  HStack,
  VStack,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Text,
  Spinner,
  Select,
  Input,
  InputGroup,
  InputLeftElement,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Code,
  Stat,
  StatLabel,
  StatNumber,
  StatGroup,
  Flex,
  Icon,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
} from '@chakra-ui/react';
import {
  FiSearch,
  FiRefreshCw,
  FiEye,
  FiChevronLeft,
  FiChevronRight,
  FiMoreVertical,
  FiTrash2,
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
} from 'react-icons/fi';
import axios from 'axios';
import { useAuth0 } from '@auth0/auth0-react';

interface WebhookLog {
  _id: string;
  org_id: string;
  eventType: string;
  conversationSid: string;
  messageSid?: string;
  participantSid?: string;
  author?: string;
  body?: string;
  payload: any;
  status: 'success' | 'error' | 'warning';
  error?: string;
  processingTimeMs?: number;
  ipAddress?: string;
  userAgent?: string;
  signatureValid?: boolean;
  createdAt: string;
}

interface WebhookStats {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsByStatus: Record<string, number>;
  recentErrors: Array<{
    eventType: string;
    error: string;
    conversationSid: string;
    createdAt: string;
  }>;
  avgProcessingTimeMs: number;
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

const WebhookLogs: React.FC = () => {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [stats, setStats] = useState<WebhookStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  
  // Filters
  const [eventType, setEventType] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  const toast = useToast();
  const { getAccessTokenSilently } = useAuth0();

  const API_URL = import.meta.env.VITE_API_URL || 'https://dev.letsmarter.com:8443/api';

  // Fetch webhook logs
  const fetchLogs = async () => {
    try {
      setLoading(true);
      const token = await getAccessTokenSilently();
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
      });
      
      if (eventType) params.append('eventType', eventType);
      if (status) params.append('status', status);
      if (search) params.append('search', search);

      const response = await axios.get(`${API_URL}/webhook-logs?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setLogs(response.data.logs);
      setTotalPages(response.data.pagination.pages);
    } catch (error: any) {
      console.error('Error fetching webhook logs:', error);
      toast({
        title: 'Error loading webhook logs',
        description: error.response?.data?.error || error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch webhook stats
  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const token = await getAccessTokenSilently();
      
      const response = await axios.get(`${API_URL}/webhook-logs/stats`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setStats(response.data);
    } catch (error: any) {
      console.error('Error fetching webhook stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  // View log details
  const viewLogDetails = async (logId: string) => {
    try {
      const token = await getAccessTokenSilently();
      
      const response = await axios.get(`${API_URL}/webhook-logs/${logId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setSelectedLog(response.data);
      setIsDetailModalOpen(true);
    } catch (error: any) {
      console.error('Error fetching log details:', error);
      toast({
        title: 'Error loading log details',
        description: error.response?.data?.error || error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // Delete old logs
  const deleteOldLogs = async (days: number) => {
    try {
      const token = await getAccessTokenSilently();
      
      const response = await axios.delete(`${API_URL}/webhook-logs?days=${days}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      toast({
        title: 'Logs deleted successfully',
        description: `Deleted ${response.data.deletedCount} logs older than ${days} days`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      fetchLogs();
      fetchStats();
    } catch (error: any) {
      console.error('Error deleting logs:', error);
      toast({
        title: 'Error deleting logs',
        description: error.response?.data?.error || error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, eventType, status, search]);

  useEffect(() => {
    fetchStats();
  }, []);

  const getStatusBadge = (status: string) => {
    const colors = {
      success: 'green',
      error: 'red',
      warning: 'yellow',
    };
    
    const icons = {
      success: FiCheckCircle,
      error: FiAlertCircle,
      warning: FiClock,
    };

    return (
      <Badge colorScheme={colors[status as keyof typeof colors] || 'gray'} display="flex" alignItems="center" gap={1}>
        <Icon as={icons[status as keyof typeof icons]} boxSize={3} />
        {status}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-AU', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const eventTypes = [
    'onMessageAdded',
    'onMessageUpdated',
    'onMessageRemoved',
    'onConversationAdded',
    'onConversationUpdated',
    'onConversationRemoved',
    'onParticipantAdded',
    'onParticipantRemoved',
    'onDeliveryUpdated',
  ];

  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <Flex justify="space-between" align="center">
          <Heading size="lg">Webhook Logs</Heading>
          <HStack>
            <Button
              leftIcon={<FiRefreshCw />}
              onClick={() => {
                fetchLogs();
                fetchStats();
              }}
              size="sm"
            >
              Refresh
            </Button>
            <Menu>
              <MenuButton
                as={IconButton}
                icon={<FiMoreVertical />}
                variant="outline"
                size="sm"
              />
              <MenuList>
                <MenuItem icon={<FiTrash2 />} onClick={() => deleteOldLogs(7)}>
                  Delete logs older than 7 days
                </MenuItem>
                <MenuItem icon={<FiTrash2 />} onClick={() => deleteOldLogs(30)}>
                  Delete logs older than 30 days
                </MenuItem>
              </MenuList>
            </Menu>
          </HStack>
        </Flex>

        {/* Stats */}
        {!statsLoading && stats && (
          <Box bg="white" p={6} borderRadius="lg" boxShadow="sm">
            <StatGroup>
              <Stat>
                <StatLabel>Total Events (7d)</StatLabel>
                <StatNumber>{stats.totalEvents.toLocaleString()}</StatNumber>
              </Stat>
              <Stat>
                <StatLabel>Success Rate</StatLabel>
                <StatNumber>
                  {stats.totalEvents > 0
                    ? ((stats.eventsByStatus.success || 0) / stats.totalEvents * 100).toFixed(1)
                    : 0}%
                </StatNumber>
              </Stat>
              <Stat>
                <StatLabel>Avg Processing Time</StatLabel>
                <StatNumber>{stats.avgProcessingTimeMs.toFixed(0)}ms</StatNumber>
              </Stat>
              <Stat>
                <StatLabel>Errors (7d)</StatLabel>
                <StatNumber color="red.500">{stats.eventsByStatus.error || 0}</StatNumber>
              </Stat>
            </StatGroup>

            {stats.recentErrors.length > 0 && (
              <Box mt={4} pt={4} borderTop="1px" borderColor="gray.200">
                <Text fontWeight="semibold" mb={2} fontSize="sm" color="red.600">
                  Recent Errors:
                </Text>
                <VStack align="stretch" spacing={1}>
                  {stats.recentErrors.slice(0, 3).map((err, idx) => (
                    <Text key={idx} fontSize="xs" color="gray.600">
                      {formatDate(err.createdAt)} - {err.eventType}: {err.error.substring(0, 80)}
                      {err.error.length > 80 && '...'}
                    </Text>
                  ))}
                </VStack>
              </Box>
            )}
          </Box>
        )}

        {/* Filters */}
        <Box bg="white" p={4} borderRadius="lg" boxShadow="sm">
          <HStack spacing={4}>
            <InputGroup maxW="300px">
              <InputLeftElement pointerEvents="none">
                <FiSearch color="gray" />
              </InputLeftElement>
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </InputGroup>

            <Select
              placeholder="All Event Types"
              value={eventType}
              onChange={(e) => {
                setEventType(e.target.value);
                setPage(1);
              }}
              maxW="250px"
            >
              {eventTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>

            <Select
              placeholder="All Statuses"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              maxW="150px"
            >
              <option value="success">Success</option>
              <option value="error">Error</option>
              <option value="warning">Warning</option>
            </Select>

            {(eventType || status || search) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEventType('');
                  setStatus('');
                  setSearch('');
                  setPage(1);
                }}
              >
                Clear Filters
              </Button>
            )}
          </HStack>
        </Box>

        {/* Table */}
        <Box bg="white" borderRadius="lg" boxShadow="sm" overflowX="auto">
          {loading ? (
            <Flex justify="center" align="center" minH="400px">
              <Spinner size="xl" />
            </Flex>
          ) : logs.length === 0 ? (
            <Flex justify="center" align="center" minH="400px">
              <Text color="gray.500">No webhook logs found</Text>
            </Flex>
          ) : (
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th>Timestamp</Th>
                  <Th>Event Type</Th>
                  <Th>Conversation SID</Th>
                  <Th>Author</Th>
                  <Th>Status</Th>
                  <Th>Processing</Th>
                  <Th>Signature</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {logs.map((log) => (
                  <Tr key={log._id}>
                    <Td fontSize="sm">{formatDate(log.createdAt)}</Td>
                    <Td>
                      <Code fontSize="xs" colorScheme="purple">
                        {log.eventType}
                      </Code>
                    </Td>
                    <Td>
                      <Text fontSize="xs" fontFamily="mono">
                        {log.conversationSid?.substring(0, 12)}...
                      </Text>
                    </Td>
                    <Td fontSize="sm">{log.author || '-'}</Td>
                    <Td>{getStatusBadge(log.status)}</Td>
                    <Td fontSize="sm">
                      {log.processingTimeMs ? `${log.processingTimeMs}ms` : '-'}
                    </Td>
                    <Td>
                      {log.signatureValid === true && (
                        <Badge colorScheme="green" fontSize="xs">✓</Badge>
                      )}
                      {log.signatureValid === false && (
                        <Badge colorScheme="red" fontSize="xs">✗</Badge>
                      )}
                      {log.signatureValid === undefined && '-'}
                    </Td>
                    <Td>
                      <IconButton
                        aria-label="View details"
                        icon={<FiEye />}
                        size="sm"
                        variant="ghost"
                        onClick={() => viewLogDetails(log._id)}
                      />
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </Box>

        {/* Pagination */}
        {totalPages > 1 && (
          <Flex justify="center" align="center" gap={4}>
            <IconButton
              aria-label="Previous page"
              icon={<FiChevronLeft />}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              isDisabled={page === 1}
              size="sm"
            />
            <Text fontSize="sm">
              Page {page} of {totalPages}
            </Text>
            <IconButton
              aria-label="Next page"
              icon={<FiChevronRight />}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              isDisabled={page === totalPages}
              size="sm"
            />
          </Flex>
        )}
      </VStack>

      {/* Detail Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        size="4xl"
      >
        <ModalOverlay />
        <ModalContent maxH="90vh">
          <ModalHeader>Webhook Event Details</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6} overflowY="auto">
            {selectedLog && (
              <VStack align="stretch" spacing={4}>
                <Box>
                  <Text fontWeight="semibold" mb={2}>
                    Event Information
                  </Text>
                  <VStack align="stretch" spacing={2} fontSize="sm">
                    <HStack>
                      <Text fontWeight="medium" w="150px">
                        Event Type:
                      </Text>
                      <Code colorScheme="purple">{selectedLog.eventType}</Code>
                    </HStack>
                    <HStack>
                      <Text fontWeight="medium" w="150px">
                        Status:
                      </Text>
                      {getStatusBadge(selectedLog.status)}
                    </HStack>
                    <HStack>
                      <Text fontWeight="medium" w="150px">
                        Timestamp:
                      </Text>
                      <Text>{new Date(selectedLog.createdAt).toLocaleString()}</Text>
                    </HStack>
                    <HStack>
                      <Text fontWeight="medium" w="150px">
                        Processing Time:
                      </Text>
                      <Text>{selectedLog.processingTimeMs || 0}ms</Text>
                    </HStack>
                    <HStack>
                      <Text fontWeight="medium" w="150px">
                        Signature Valid:
                      </Text>
                      <Text>{selectedLog.signatureValid ? '✓ Yes' : '✗ No'}</Text>
                    </HStack>
                  </VStack>
                </Box>

                {selectedLog.error && (
                  <Box>
                    <Text fontWeight="semibold" mb={2} color="red.600">
                      Error
                    </Text>
                    <Code colorScheme="red" p={3} borderRadius="md" w="full" display="block">
                      {selectedLog.error}
                    </Code>
                  </Box>
                )}

                <Box>
                  <Text fontWeight="semibold" mb={2}>
                    Conversation Details
                  </Text>
                  <VStack align="stretch" spacing={2} fontSize="sm">
                    <HStack>
                      <Text fontWeight="medium" w="150px">
                        Conversation SID:
                      </Text>
                      <Code fontSize="xs">{selectedLog.conversationSid}</Code>
                    </HStack>
                    {selectedLog.messageSid && (
                      <HStack>
                        <Text fontWeight="medium" w="150px">
                          Message SID:
                        </Text>
                        <Code fontSize="xs">{selectedLog.messageSid}</Code>
                      </HStack>
                    )}
                    {selectedLog.author && (
                      <HStack>
                        <Text fontWeight="medium" w="150px">
                          Author:
                        </Text>
                        <Text>{selectedLog.author}</Text>
                      </HStack>
                    )}
                    {selectedLog.body && (
                      <VStack align="stretch">
                        <Text fontWeight="medium">Message Body:</Text>
                        <Box bg="gray.50" p={3} borderRadius="md">
                          <Text fontSize="sm">{selectedLog.body}</Text>
                        </Box>
                      </VStack>
                    )}
                  </VStack>
                </Box>

                <Box>
                  <Text fontWeight="semibold" mb={2}>
                    Request Details
                  </Text>
                  <VStack align="stretch" spacing={2} fontSize="sm">
                    <HStack>
                      <Text fontWeight="medium" w="150px">
                        IP Address:
                      </Text>
                      <Code fontSize="xs">{selectedLog.ipAddress || 'N/A'}</Code>
                    </HStack>
                    <HStack align="start">
                      <Text fontWeight="medium" w="150px">
                        User Agent:
                      </Text>
                      <Text fontSize="xs" flex={1}>
                        {selectedLog.userAgent || 'N/A'}
                      </Text>
                    </HStack>
                  </VStack>
                </Box>

                <Box>
                  <Text fontWeight="semibold" mb={2}>
                    Full Payload
                  </Text>
                  <Box
                    bg="gray.900"
                    color="green.300"
                    p={4}
                    borderRadius="md"
                    fontSize="xs"
                    fontFamily="mono"
                    overflowX="auto"
                    maxH="400px"
                    overflowY="auto"
                  >
                    <pre>{JSON.stringify(selectedLog.payload, null, 2)}</pre>
                  </Box>
                </Box>
              </VStack>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Container>
  );
};

export default WebhookLogs;
