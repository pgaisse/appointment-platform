// apps/frontend/src/Components/GoogleReviews/GoogleReviewsOverview.tsx
import {
  Box,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Icon,
  HStack,
  VStack,
  Text,
  Heading,
  Button,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Progress,
  Badge,
  useColorModeValue,
} from '@chakra-ui/react';
import { 
  Star, 
  MessageSquare, 
  TrendingUp, 
  Users, 
  Clock,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { 
  useGoogleReviewStats, 
  useGoogleReviewsList,
  useSyncGoogleReviews,
  useGoogleLocations 
} from '@/Hooks/Query/useGoogleReviews';

interface GoogleReviewsOverviewProps {
  onNavigateToTab: (index: number) => void;
}

export const GoogleReviewsOverview = ({ onNavigateToTab }: GoogleReviewsOverviewProps) => {
  const { data: stats, isLoading: statsLoading } = useGoogleReviewStats();
  const { data: reviewsData } = useGoogleReviewsList({ limit: 5, archived: false });
  const { data: locations } = useGoogleLocations();
  const { mutate: syncReviews, isPending: isSyncing } = useSyncGoogleReviews();

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  const handleSync = () => {
    const location = locations?.locations?.[0];
    if (location?.name) {
      syncReviews(location.name);
    }
  };

  if (statsLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minH="400px">
        <Spinner size="xl" color="blue.500" />
      </Box>
    );
  }

  if (!stats) {
    return (
      <Alert status="warning" borderRadius="md">
        <AlertIcon />
        <AlertTitle>No data available</AlertTitle>
        <AlertDescription>
          Please connect your Google My Business account and sync your reviews.
        </AlertDescription>
      </Alert>
    );
  }

  const ratingPercentages = {
    FIVE: stats.totalReviews > 0 ? (stats.ratingDistribution.FIVE / stats.totalReviews) * 100 : 0,
    FOUR: stats.totalReviews > 0 ? (stats.ratingDistribution.FOUR / stats.totalReviews) * 100 : 0,
    THREE: stats.totalReviews > 0 ? (stats.ratingDistribution.THREE / stats.totalReviews) * 100 : 0,
    TWO: stats.totalReviews > 0 ? (stats.ratingDistribution.TWO / stats.totalReviews) * 100 : 0,
    ONE: stats.totalReviews > 0 ? (stats.ratingDistribution.ONE / stats.totalReviews) * 100 : 0,
  };

  return (
    <VStack spacing={6} align="stretch">
      {/* Action Bar */}
      <HStack justify="space-between">
        <Text fontSize="sm" color="gray.600">
          Last synced: {locations ? 'Connected' : 'Not connected'}
        </Text>
        <Button
          leftIcon={<RefreshCw size={16} />}
          colorScheme="blue"
          size="sm"
          onClick={handleSync}
          isLoading={isSyncing}
          isDisabled={!locations?.locations?.length}
        >
          Sync Now
        </Button>
      </HStack>

      {/* Key Metrics */}
      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6}>
        <Box
          bg={cardBg}
          p={6}
          borderRadius="xl"
          borderWidth="1px"
          borderColor={borderColor}
          boxShadow="sm"
        >
          <Stat>
            <HStack mb={2}>
              <Icon as={Star} color="yellow.500" boxSize={5} />
              <StatLabel>Average Rating</StatLabel>
            </HStack>
            <StatNumber fontSize="3xl">{stats.averageRating}</StatNumber>
            <StatHelpText>
              <HStack spacing={1}>
                {[1, 2, 3, 4, 5].map((star) => {
                  const avgRating = typeof stats.averageRating === 'number' 
                    ? stats.averageRating 
                    : parseFloat(String(stats.averageRating));
                  return (
                    <Icon
                      key={star}
                      as={Star}
                      boxSize={4}
                      fill={star <= Math.round(avgRating) ? 'yellow.500' : 'transparent'}
                      color={star <= Math.round(avgRating) ? 'yellow.500' : 'gray.300'}
                    />
                  );
                })}
              </HStack>
            </StatHelpText>
          </Stat>
        </Box>

        <Box
          bg={cardBg}
          p={6}
          borderRadius="xl"
          borderWidth="1px"
          borderColor={borderColor}
          boxShadow="sm"
        >
          <Stat>
            <HStack mb={2}>
              <Icon as={Users} color="blue.500" boxSize={5} />
              <StatLabel>Total Reviews</StatLabel>
            </HStack>
            <StatNumber fontSize="3xl">{stats.totalReviews}</StatNumber>
            <StatHelpText>
              <StatArrow type="increase" />
              {stats.recentReviews} in last 7 days
            </StatHelpText>
          </Stat>
        </Box>

        <Box
          bg={cardBg}
          p={6}
          borderRadius="xl"
          borderWidth="1px"
          borderColor={borderColor}
          boxShadow="sm"
        >
          <Stat>
            <HStack mb={2}>
              <Icon as={MessageSquare} color="green.500" boxSize={5} />
              <StatLabel>Response Rate</StatLabel>
            </HStack>
            <StatNumber fontSize="3xl">{stats.responseRate}%</StatNumber>
            <StatHelpText>
              {stats.withReplies} of {stats.totalReviews} replied
            </StatHelpText>
          </Stat>
        </Box>

        <Box
          bg={cardBg}
          p={6}
          borderRadius="xl"
          borderWidth="1px"
          borderColor={borderColor}
          boxShadow="sm"
        >
          <Stat>
            <HStack mb={2}>
              <Icon as={TrendingUp} color="purple.500" boxSize={5} />
              <StatLabel>With Comments</StatLabel>
            </HStack>
            <StatNumber fontSize="3xl">{stats.withComments}</StatNumber>
            <StatHelpText>
              {stats.totalReviews > 0 
                ? Math.round((stats.withComments / stats.totalReviews) * 100) 
                : 0}% of total
            </StatHelpText>
          </Stat>
        </Box>
      </SimpleGrid>

      {/* Rating Distribution */}
      <Box
        bg={cardBg}
        p={6}
        borderRadius="xl"
        borderWidth="1px"
        borderColor={borderColor}
        boxShadow="sm"
      >
        <Heading size="md" mb={4}>
          Rating Distribution
        </Heading>
        <VStack spacing={3} align="stretch">
          {[5, 4, 3, 2, 1].map((rating) => {
            const key = ['FIVE', 'FOUR', 'THREE', 'TWO', 'ONE'][5 - rating] as 'FIVE' | 'FOUR' | 'THREE' | 'TWO' | 'ONE';
            const count = stats.ratingDistribution[key];
            const percentage = ratingPercentages[key as keyof typeof ratingPercentages];

            return (
              <HStack key={rating} spacing={4}>
                <HStack spacing={1} minW="100px">
                  <Text fontSize="sm" fontWeight="medium">
                    {rating}
                  </Text>
                  <Icon as={Star} boxSize={4} color="yellow.500" />
                </HStack>
                <Box flex="1">
                  <Progress
                    value={percentage}
                    colorScheme={rating >= 4 ? 'green' : rating >= 3 ? 'yellow' : 'red'}
                    borderRadius="full"
                    size="sm"
                  />
                </Box>
                <Text fontSize="sm" minW="60px" textAlign="right">
                  {count} ({percentage.toFixed(1)}%)
                </Text>
              </HStack>
            );
          })}
        </VStack>
      </Box>

      {/* Alerts */}
      {stats.flagged > 0 && (
        <Alert status="warning" borderRadius="md" variant="left-accent">
          <AlertIcon as={AlertTriangle} />
          <Box flex="1">
            <AlertTitle>Flagged Reviews</AlertTitle>
            <AlertDescription>
              You have {stats.flagged} flagged review{stats.flagged > 1 ? 's' : ''} that need attention.
            </AlertDescription>
          </Box>
          <Button size="sm" colorScheme="orange" onClick={() => onNavigateToTab(1)}>
            View
          </Button>
        </Alert>
      )}

      {(typeof stats.responseRate === 'number' ? stats.responseRate : parseFloat(String(stats.responseRate))) < 50 && stats.totalReviews > 10 && (
        <Alert status="info" borderRadius="md" variant="left-accent">
          <AlertIcon as={Clock} />
          <Box flex="1">
            <AlertTitle>Low Response Rate</AlertTitle>
            <AlertDescription>
              Your response rate is {stats.responseRate}%. Responding to reviews improves customer trust.
            </AlertDescription>
          </Box>
          <Button size="sm" colorScheme="blue" onClick={() => onNavigateToTab(1)}>
            Reply to Reviews
          </Button>
        </Alert>
      )}

      {/* Recent Reviews Preview */}
      {reviewsData?.reviews && reviewsData.reviews.length > 0 && (
        <Box
          bg={cardBg}
          p={6}
          borderRadius="xl"
          borderWidth="1px"
          borderColor={borderColor}
          boxShadow="sm"
        >
          <HStack justify="space-between" mb={4}>
            <Heading size="md">Recent Reviews</Heading>
            <Button size="sm" variant="ghost" colorScheme="blue" onClick={() => onNavigateToTab(1)}>
              View All
            </Button>
          </HStack>
          <VStack spacing={4} align="stretch">
            {reviewsData.reviews.slice(0, 3).map((review) => (
              <Box
                key={review._id}
                p={4}
                borderWidth="1px"
                borderColor={borderColor}
                borderRadius="lg"
              >
                <HStack justify="space-between" mb={2}>
                  <HStack>
                    <Text fontWeight="medium">
                      {review.reviewer.isAnonymous ? 'Anonymous' : review.reviewer.displayName}
                    </Text>
                    <Badge colorScheme={review.numericRating >= 4 ? 'green' : review.numericRating >= 3 ? 'yellow' : 'red'}>
                      {review.numericRating} ★
                    </Badge>
                  </HStack>
                  <Text fontSize="xs" color="gray.500">
                    {new Date(review.createTime).toLocaleDateString()}
                  </Text>
                </HStack>
                {review.comment && (
                  <Text fontSize="sm" color="gray.600" noOfLines={2}>
                    {review.comment}
                  </Text>
                )}
                {!review.reviewReply && (
                  <Badge colorScheme="orange" mt={2}>
                    No reply yet
                  </Badge>
                )}
              </Box>
            ))}
          </VStack>
        </Box>
      )}
    </VStack>
  );
};
