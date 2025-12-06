// apps/frontend/src/Components/GoogleReviews/GoogleReviewsList.tsx
import { useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  Button,
  IconButton,
  Badge,
  Avatar,
  Textarea,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
  Icon,
  Tooltip,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Checkbox,
  Stack,
  Divider,
  Spinner,
  Alert,
  AlertIcon,
  useColorModeValue,
} from '@chakra-ui/react';
import { 
  Search, 
  Filter, 
  Star, 
  MessageSquare, 
  MoreVertical,
  Flag,
  Archive,
  Tag as TagIcon,
  FileText,
  X
} from 'lucide-react';
import {
  useGoogleReviewsList,
  useUpdateReviewMetadata,
  useReplyToReview,
  useDeleteReviewReply,
  type GoogleReview,
  type ReviewFilters
} from '@/Hooks/Query/useGoogleReviews';

export const GoogleReviewsList = () => {
  const [filters, setFilters] = useState<ReviewFilters>({
    page: 0,
    limit: 20,
    archived: false
  });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReview, setSelectedReview] = useState<GoogleReview | null>(null);
  const [replyText, setReplyText] = useState('');
  const [notesText, setNotesText] = useState('');
  
  const replyModal = useDisclosure();
  const notesModal = useDisclosure();
  
  const { data, isLoading } = useGoogleReviewsList(filters);
  const { mutate: updateMetadata, isPending: isUpdating } = useUpdateReviewMetadata();
  const { mutate: postReply, isPending: isReplying } = useReplyToReview();
  const { mutate: deleteReply, isPending: isDeleting } = useDeleteReviewReply();

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  const handleSearch = () => {
    setFilters({ ...filters, search: searchTerm, page: 0 });
  };

  const handleFilterChange = (key: keyof ReviewFilters, value: any) => {
    setFilters({ ...filters, [key]: value, page: 0 });
  };

  const handleReply = (review: GoogleReview) => {
    setSelectedReview(review);
    setReplyText(review.reviewReply?.comment || '');
    replyModal.onOpen();
  };

  const handleNotes = (review: GoogleReview) => {
    setSelectedReview(review);
    setNotesText(review.notes || '');
    notesModal.onOpen();
  };

  const submitReply = () => {
    if (!selectedReview || !replyText.trim()) return;
    
    const reviewName = `accounts/*/locations/*/reviews/${selectedReview.reviewId}`;
    
    postReply(
      { 
        reviewId: selectedReview.reviewId, 
        reviewName, 
        comment: replyText 
      },
      {
        onSuccess: () => {
          replyModal.onClose();
          setReplyText('');
          setSelectedReview(null);
        },
      }
    );
  };

  const submitNotes = () => {
    if (!selectedReview) return;
    
    updateMetadata(
      { 
        reviewId: selectedReview.reviewId, 
        updates: { notes: notesText } 
      },
      {
        onSuccess: () => {
          notesModal.onClose();
          setNotesText('');
          setSelectedReview(null);
        },
      }
    );
  };

  const toggleFlag = (review: GoogleReview) => {
    updateMetadata({
      reviewId: review.reviewId,
      updates: { flagged: !review.flagged },
    });
  };

  const toggleArchive = (review: GoogleReview) => {
    updateMetadata({
      reviewId: review.reviewId,
      updates: { archived: !review.archived },
    });
  };

  const removeReply = (review: GoogleReview) => {
    const reviewName = `accounts/*/locations/*/reviews/${review.reviewId}`;
    deleteReply({ reviewId: review.reviewId, reviewName });
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 4) return 'green';
    if (rating >= 3) return 'yellow';
    return 'red';
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minH="400px">
        <Spinner size="xl" color="blue.500" />
      </Box>
    );
  }

  return (
    <VStack spacing={6} align="stretch">
      {/* Filters and Search */}
      <Box
        bg={cardBg}
        p={4}
        borderRadius="lg"
        borderWidth="1px"
        borderColor={borderColor}
      >
        <VStack spacing={4}>
          <HStack width="full" spacing={3}>
            <InputGroup>
              <InputLeftElement pointerEvents="none">
                <Icon as={Search} color="gray.400" />
              </InputLeftElement>
              <Input
                placeholder="Search reviews..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </InputGroup>
            <Button colorScheme="blue" onClick={handleSearch}>
              Search
            </Button>
          </HStack>

          <HStack width="full" spacing={3} flexWrap="wrap">
            <Select
              placeholder="All ratings"
              maxW="150px"
              value={filters.rating || ''}
              onChange={(e) => handleFilterChange('rating', e.target.value || undefined)}
            >
              <option value="FIVE">5 stars</option>
              <option value="FOUR">4 stars</option>
              <option value="THREE">3 stars</option>
              <option value="TWO">2 stars</option>
              <option value="ONE">1 star</option>
            </Select>

            <Checkbox
              isChecked={filters.hasComment === true}
              onChange={(e) => handleFilterChange('hasComment', e.target.checked || undefined)}
            >
              With Comments
            </Checkbox>

            <Checkbox
              isChecked={filters.hasReply === true}
              onChange={(e) => handleFilterChange('hasReply', e.target.checked || undefined)}
            >
              With Replies
            </Checkbox>

            <Checkbox
              isChecked={filters.flagged === true}
              onChange={(e) => handleFilterChange('flagged', e.target.checked || undefined)}
            >
              Flagged
            </Checkbox>

            <Checkbox
              isChecked={filters.archived === true}
              onChange={(e) => handleFilterChange('archived', e.target.checked || undefined)}
            >
              Archived
            </Checkbox>
          </HStack>
        </VStack>
      </Box>

      {/* Reviews List */}
      {data?.reviews && data.reviews.length > 0 ? (
        <>
          <VStack spacing={4} align="stretch">
            {data.reviews.map((review) => (
              <Box
                key={review._id}
                bg={cardBg}
                p={6}
                borderRadius="lg"
                borderWidth="1px"
                borderColor={borderColor}
                boxShadow="sm"
                opacity={review.archived ? 0.6 : 1}
              >
                {/* Header */}
                <HStack justify="space-between" mb={3}>
                  <HStack spacing={3}>
                    <Avatar
                      size="sm"
                      name={review.reviewer.displayName}
                      src={review.reviewer.profilePhotoUrl}
                    />
                    <VStack align="start" spacing={0}>
                      <HStack>
                        <Text fontWeight="semibold">
                          {review.reviewer.isAnonymous ? 'Anonymous' : review.reviewer.displayName}
                        </Text>
                        {review.flagged && (
                          <Icon as={Flag} color="orange.500" boxSize={4} />
                        )}
                        {review.archived && (
                          <Icon as={Archive} color="gray.500" boxSize={4} />
                        )}
                      </HStack>
                      <Text fontSize="xs" color="gray.500">
                        {new Date(review.createTime).toLocaleString()}
                      </Text>
                    </VStack>
                  </HStack>

                  <HStack>
                    <Badge colorScheme={getRatingColor(review.numericRating)} fontSize="md" px={2}>
                      {review.numericRating} ★
                    </Badge>
                    <Menu>
                      <MenuButton
                        as={IconButton}
                        icon={<MoreVertical size={16} />}
                        variant="ghost"
                        size="sm"
                        isDisabled={isUpdating}
                      />
                      <MenuList>
                        <MenuItem icon={<MessageSquare size={16} />} onClick={() => handleReply(review)}>
                          {review.reviewReply ? 'Edit Reply' : 'Reply'}
                        </MenuItem>
                        {review.reviewReply && (
                          <MenuItem 
                            icon={<X size={16} />} 
                            onClick={() => removeReply(review)}
                            isDisabled={isDeleting}
                          >
                            Remove Reply
                          </MenuItem>
                        )}
                        <MenuItem icon={<FileText size={16} />} onClick={() => handleNotes(review)}>
                          {review.notes ? 'Edit Notes' : 'Add Notes'}
                        </MenuItem>
                        <MenuItem icon={<Flag size={16} />} onClick={() => toggleFlag(review)}>
                          {review.flagged ? 'Unflag' : 'Flag'}
                        </MenuItem>
                        <MenuItem icon={<Archive size={16} />} onClick={() => toggleArchive(review)}>
                          {review.archived ? 'Unarchive' : 'Archive'}
                        </MenuItem>
                      </MenuList>
                    </Menu>
                  </HStack>
                </HStack>

                {/* Comment */}
                {review.comment && (
                  <Box mb={3}>
                    <Text>{review.comment}</Text>
                  </Box>
                )}

                {/* Reply */}
                {review.reviewReply && (
                  <Box
                    bg="blue.50"
                    p={3}
                    borderRadius="md"
                    borderLeftWidth="3px"
                    borderLeftColor="blue.500"
                    mt={3}
                  >
                    <HStack mb={1}>
                      <Icon as={MessageSquare} color="blue.600" boxSize={4} />
                      <Text fontSize="sm" fontWeight="semibold" color="blue.800">
                        Business Response
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        {new Date(review.reviewReply.updateTime).toLocaleDateString()}
                      </Text>
                    </HStack>
                    <Text fontSize="sm" color="gray.700">
                      {review.reviewReply.comment}
                    </Text>
                  </Box>
                )}

                {/* Notes */}
                {review.notes && (
                  <Box mt={3} p={2} bg="gray.50" borderRadius="md">
                    <Text fontSize="sm" color="gray.600">
                      <strong>Notes:</strong> {review.notes}
                    </Text>
                  </Box>
                )}

                {/* Tags */}
                {review.tags && review.tags.length > 0 && (
                  <HStack mt={3} spacing={2}>
                    <Icon as={TagIcon} boxSize={4} color="gray.500" />
                    {review.tags.map((tag, idx) => (
                      <Badge key={idx} variant="subtle">
                        {tag}
                      </Badge>
                    ))}
                  </HStack>
                )}
              </Box>
            ))}
          </VStack>

          {/* Pagination */}
          <HStack justify="space-between">
            <Text fontSize="sm" color="gray.600">
              Showing {data.reviews.length} of {data.total} reviews
            </Text>
            <HStack>
              <Button
                size="sm"
                onClick={() => setFilters({ ...filters, page: (filters.page || 0) - 1 })}
                isDisabled={(filters.page || 0) === 0}
              >
                Previous
              </Button>
              <Text fontSize="sm">
                Page {(filters.page || 0) + 1} of {data.totalPages}
              </Text>
              <Button
                size="sm"
                onClick={() => setFilters({ ...filters, page: (filters.page || 0) + 1 })}
                isDisabled={(filters.page || 0) >= data.totalPages - 1}
              >
                Next
              </Button>
            </HStack>
          </HStack>
        </>
      ) : (
        <Alert status="info" borderRadius="md">
          <AlertIcon />
          No reviews found. Try adjusting your filters or sync your reviews.
        </Alert>
      )}

      {/* Reply Modal */}
      <Modal isOpen={replyModal.isOpen} onClose={replyModal.onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {selectedReview?.reviewReply ? 'Edit Reply' : 'Reply to Review'}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              {selectedReview && (
                <Box p={3} bg="gray.50" borderRadius="md">
                  <HStack mb={2}>
                    <Badge colorScheme={getRatingColor(selectedReview.numericRating)}>
                      {selectedReview.numericRating} ★
                    </Badge>
                    <Text fontWeight="medium">
                      {selectedReview.reviewer.displayName}
                    </Text>
                  </HStack>
                  <Text fontSize="sm">{selectedReview.comment}</Text>
                </Box>
              )}
              <Textarea
                placeholder="Write your response..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={6}
              />
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={replyModal.onClose}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              onClick={submitReply}
              isLoading={isReplying}
              isDisabled={!replyText.trim()}
            >
              Post Reply
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Notes Modal */}
      <Modal isOpen={notesModal.isOpen} onClose={notesModal.onClose} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {selectedReview?.notes ? 'Edit Notes' : 'Add Notes'}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Textarea
              placeholder="Add internal notes about this review..."
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              rows={6}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={notesModal.onClose}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              onClick={submitNotes}
              isLoading={isUpdating}
            >
              Save Notes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  );
};
