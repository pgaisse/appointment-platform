// apps/frontend/src/Components/Dashboard/ReviewsDetailsModal.tsx
import React, { useState, useMemo } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  VStack,
  HStack,
  Text,
  Badge,
  Input,
  InputGroup,
  InputLeftElement,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Skeleton,
  Box,
  Select,
  Avatar,
} from '@chakra-ui/react';
import { FiSearch } from 'react-icons/fi';
import { FaStar } from 'react-icons/fa';
import { useAllGoogleReviewRequests } from '@/Hooks/Query/useGoogleReviews';
import { format } from 'date-fns';

interface ReviewsDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAppointmentClick?: (appointmentId: string) => void;
}

const statusColorMap: Record<string, string> = {
  pending: 'gray',
  sent: 'blue',
  delivered: 'green',
  clicked: 'purple',
  reviewed: 'yellow',
  failed: 'red',
};

export const ReviewsDetailsModal: React.FC<ReviewsDetailsModalProps> = ({
  isOpen,
  onClose,
  onAppointmentClick,
}) => {
  const { data: requests = [], isLoading } = useAllGoogleReviewRequests();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredRequests = useMemo(() => {
    let filtered = [...requests];

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter((req: any) => req.status === statusFilter);
    }

    // Filter by search query (name, phone, email)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((req: any) => {
        const patientName = `${req.patient?.name || ''} ${req.patient?.lastName || ''}`.toLowerCase();
        const phone = (req.patient?.phone || '').toLowerCase();
        const email = (req.patient?.email || '').toLowerCase();
        const appointmentName = req.appointment 
          ? `${req.appointment.nameInput || ''} ${req.appointment.lastNameInput || ''}`.toLowerCase()
          : '';
        
        return (
          patientName.includes(query) ||
          phone.includes(query) ||
          email.includes(query) ||
          appointmentName.includes(query)
        );
      });
    }

    return filtered;
  }, [requests, searchQuery, statusFilter]);

  const handleRowClick = (request: any) => {
    if (onAppointmentClick && request.appointment?._id) {
      onAppointmentClick(request.appointment._id);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="6xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Google Reviews Sent</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            {/* Search and Filter */}
            <HStack spacing={3}>
              <InputGroup flex={1}>
                <InputLeftElement pointerEvents="none">
                  <FiSearch color="gray.300" />
                </InputLeftElement>
                <Input
                  placeholder="Search by name, phone, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </InputGroup>
              <Select
                width="200px"
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

            {/* Results count */}
            <Text fontSize="sm" color="gray.600">
              Showing {filteredRequests.length} of {requests.length} review requests
            </Text>

            {/* Table */}
            {isLoading ? (
              <VStack spacing={2}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} height="60px" width="100%" />
                ))}
              </VStack>
            ) : (
              <Box overflowX="auto">
                <Table size="sm" variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Patient</Th>
                      <Th>Phone</Th>
                      <Th>Status</Th>
                      <Th>Rating</Th>
                      <Th>Requested</Th>
                      <Th>Sent</Th>
                      <Th>Reviewed</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {filteredRequests.length === 0 ? (
                      <Tr>
                        <Td colSpan={7}>
                          <Text textAlign="center" color="gray.500" py={8}>
                            {searchQuery || statusFilter !== 'all'
                              ? 'No reviews match your search criteria'
                              : 'No review requests have been sent yet'}
                          </Text>
                        </Td>
                      </Tr>
                    ) : (
                      filteredRequests.map((request: any) => {
                        const patientName = request.appointment
                          ? `${request.appointment.nameInput || ''} ${request.appointment.lastNameInput || ''}`.trim()
                          : `${request.patient?.name || ''} ${request.patient?.lastName || ''}`.trim();
                        
                        const displayName = patientName || '—';
                        const phone = request.patient?.phone || request.appointment?.phoneInput || '—';
                        
                        return (
                          <Tr
                            key={request._id}
                            _hover={{ bg: 'gray.50' }}
                            cursor="pointer"
                            onClick={() => handleRowClick(request)}
                          >
                            <Td>
                              <HStack spacing={2}>
                                <Avatar size="sm" name={displayName} />
                                <Text fontWeight="medium" textTransform="capitalize">
                                  {displayName}
                                </Text>
                              </HStack>
                            </Td>
                            <Td>
                              <Text fontSize="sm">{phone}</Text>
                            </Td>
                            <Td>
                              <Badge
                                colorScheme={statusColorMap[request.status] || 'gray'}
                                variant="subtle"
                                textTransform="uppercase"
                                fontSize="xs"
                              >
                                {request.status}
                              </Badge>
                            </Td>
                            <Td>
                              {request.reviewRating ? (
                                <HStack spacing={1}>
                                  <FaStar color="gold" size={14} />
                                  <Text fontWeight="bold">{request.reviewRating}</Text>
                                </HStack>
                              ) : (
                                <Text color="gray.400">—</Text>
                              )}
                            </Td>
                            <Td>
                              <Text fontSize="sm">
                                {request.requestedAt
                                  ? format(new Date(request.requestedAt), 'MMM dd, yyyy')
                                  : '—'}
                              </Text>
                            </Td>
                            <Td>
                              <Text fontSize="sm">
                                {request.sentAt
                                  ? format(new Date(request.sentAt), 'MMM dd, yyyy')
                                  : '—'}
                              </Text>
                            </Td>
                            <Td>
                              <Text fontSize="sm">
                                {request.reviewedAt
                                  ? format(new Date(request.reviewedAt), 'MMM dd, yyyy')
                                  : '—'}
                              </Text>
                            </Td>
                          </Tr>
                        );
                      })
                    )}
                  </Tbody>
                </Table>
              </Box>
            )}
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};
