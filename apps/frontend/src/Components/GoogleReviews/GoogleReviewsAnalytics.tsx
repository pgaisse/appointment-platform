// apps/frontend/src/Components/GoogleReviews/GoogleReviewsAnalytics.tsx
import { useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Select,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Progress,
  Badge,
  Divider,
  Alert,
  AlertIcon,
  Spinner,
  useColorModeValue,
} from '@chakra-ui/react';
import {
  Star,
  MessageSquare,
  Clock,
  ThumbsUp,
} from 'lucide-react';
import { useGoogleReviewStats } from '@/Hooks/Query/useGoogleReviews';

const TIME_RANGES = {
  '7d': { label: 'Last 7 days', days: 7 },
  '30d': { label: 'Last 30 days', days: 30 },
  '90d': { label: 'Last 90 days', days: 90 },
  '1y': { label: 'Last year', days: 365 },
  'all': { label: 'All time', days: null },
};

export const GoogleReviewsAnalytics = () => {
  const [timeRange, setTimeRange] = useState<keyof typeof TIME_RANGES>('30d');

  const currentRange = TIME_RANGES[timeRange];
  const startDate = currentRange.days
    ? new Date(Date.now() - currentRange.days * 24 * 60 * 60 * 1000).toISOString()
    : undefined;

  const { data: stats, isLoading: statsLoading } = useGoogleReviewStats(startDate);

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const statBg = useColorModeValue('gray.50', 'gray.700');

  // Calculate trends (compare with previous period)
  const previousStartDate = currentRange.days
    ? new Date(Date.now() - 2 * currentRange.days * 24 * 60 * 60 * 1000).toISOString()
    : undefined;
  
  const { data: previousStats } = useGoogleReviewStats(
    previousStartDate,
    currentRange.days ? startDate : undefined
  );

  const calculateTrend = (current?: number, previous?: number) => {
    if (!current || !previous || previous === 0) return null;
    const change = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(change).toFixed(1),
      isPositive: change > 0,
    };
  };

  const avgRatingTrend = calculateTrend(
    typeof stats?.averageRating === 'string' ? parseFloat(stats.averageRating) : stats?.averageRating,
    typeof previousStats?.averageRating === 'string' ? parseFloat(previousStats.averageRating) : previousStats?.averageRating
  );
  const totalReviewsTrend = calculateTrend(stats?.totalReviews, previousStats?.totalReviews);
  const responseRateTrend = calculateTrend(
    typeof stats?.responseRate === 'string' ? parseFloat(stats.responseRate) : stats?.responseRate,
    typeof previousStats?.responseRate === 'string' ? parseFloat(previousStats.responseRate) : previousStats?.responseRate
  );

  if (statsLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minH="400px">
        <Spinner size="xl" color="blue.500" />
      </Box>
    );
  }

  if (!stats) {
    return (
      <Alert status="info">
        <AlertIcon />
        No analytics data available. Please sync your reviews first.
      </Alert>
    );
  }

  return (
    <VStack spacing={6} align="stretch">
      {/* Time Range Selector */}
      <HStack justify="space-between">
        <Text fontSize="lg" fontWeight="semibold">
          Analytics Dashboard
        </Text>
        <Select
          maxW="200px"
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value as keyof typeof TIME_RANGES)}
        >
          {Object.entries(TIME_RANGES).map(([key, { label }]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
      </HStack>

      {/* Key Metrics with Trends */}
      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
        <Box bg={cardBg} p={6} borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
          <Stat>
            <StatLabel display="flex" alignItems="center" gap={2}>
              <Star size={16} />
              Average Rating
            </StatLabel>
            <StatNumber fontSize="3xl">
              {stats.averageRating.toFixed(1)} ★
            </StatNumber>
            {avgRatingTrend && (
              <StatHelpText>
                <StatArrow type={avgRatingTrend.isPositive ? 'increase' : 'decrease'} />
                {avgRatingTrend.value}% vs previous period
              </StatHelpText>
            )}
          </Stat>
        </Box>

        <Box bg={cardBg} p={6} borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
          <Stat>
            <StatLabel display="flex" alignItems="center" gap={2}>
              <MessageSquare size={16} />
              Total Reviews
            </StatLabel>
            <StatNumber fontSize="3xl">{stats.totalReviews}</StatNumber>
            {totalReviewsTrend && (
              <StatHelpText>
                <StatArrow type={totalReviewsTrend.isPositive ? 'increase' : 'decrease'} />
                {totalReviewsTrend.value}% vs previous period
              </StatHelpText>
            )}
          </Stat>
        </Box>

        <Box bg={cardBg} p={6} borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
          <Stat>
            <StatLabel display="flex" alignItems="center" gap={2}>
              <ThumbsUp size={16} />
              Response Rate
            </StatLabel>
            <StatNumber fontSize="3xl">{stats.responseRate.toFixed(0)}%</StatNumber>
            {responseRateTrend && (
              <StatHelpText>
                <StatArrow type={responseRateTrend.isPositive ? 'increase' : 'decrease'} />
                {responseRateTrend.value}% vs previous period
              </StatHelpText>
            )}
          </Stat>
        </Box>

        <Box bg={cardBg} p={6} borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
          <Stat>
            <StatLabel display="flex" alignItems="center" gap={2}>
              <Clock size={16} />
              With Comments
            </StatLabel>
            <StatNumber fontSize="3xl">{stats.withComments}</StatNumber>
            <StatHelpText>
              {stats.totalReviews > 0
                ? ((stats.withComments / stats.totalReviews) * 100).toFixed(0)
                : 0}
              % of reviews
            </StatHelpText>
          </Stat>
        </Box>
      </SimpleGrid>

      {/* Rating Distribution */}
      <Box bg={cardBg} p={6} borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
        <Text fontSize="lg" fontWeight="semibold" mb={4}>
          Rating Distribution
        </Text>
        <VStack spacing={3} align="stretch">
          {[5, 4, 3, 2, 1].map((rating) => {
            const count = stats.ratingDistribution[rating as keyof typeof stats.ratingDistribution] || 0;
            const percentage = stats.totalReviews > 0 ? (count / stats.totalReviews) * 100 : 0;
            
            let colorScheme = 'gray';
            if (rating === 5 || rating === 4) colorScheme = 'green';
            else if (rating === 3) colorScheme = 'yellow';
            else if (rating === 2 || rating === 1) colorScheme = 'red';

            return (
              <HStack key={rating} spacing={3}>
                <HStack minW="80px">
                  <Text fontWeight="medium">{rating}</Text>
                  <Star size={16} fill="currentColor" />
                </HStack>
                <Progress
                  value={percentage}
                  flex={1}
                  colorScheme={colorScheme}
                  borderRadius="full"
                  size="sm"
                />
                <HStack minW="100px" justify="flex-end">
                  <Text fontSize="sm" fontWeight="medium">
                    {count}
                  </Text>
                  <Text fontSize="sm" color="gray.500">
                    ({percentage.toFixed(0)}%)
                  </Text>
                </HStack>
              </HStack>
            );
          })}
        </VStack>
      </Box>

      {/* Review Insights */}
      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
        {/* Positive vs Negative */}
        <Box bg={cardBg} p={6} borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
          <Text fontSize="lg" fontWeight="semibold" mb={4}>
            Review Sentiment
          </Text>
          <VStack spacing={4} align="stretch">
            <Box>
              <HStack justify="space-between" mb={2}>
                <HStack>
                  <Badge colorScheme="green">Positive</Badge>
                  <Text fontSize="sm" color="gray.600">
                    (4-5 stars)
                  </Text>
                </HStack>
                <Text fontWeight="bold">
                  {(stats.ratingDistribution[5] || 0) + (stats.ratingDistribution[4] || 0)}
                </Text>
              </HStack>
              <Progress
                value={
                  stats.totalReviews > 0
                    ? (((stats.ratingDistribution[5] || 0) + (stats.ratingDistribution[4] || 0)) /
                        stats.totalReviews) *
                      100
                    : 0
                }
                colorScheme="green"
                borderRadius="full"
              />
            </Box>

            <Box>
              <HStack justify="space-between" mb={2}>
                <HStack>
                  <Badge colorScheme="yellow">Neutral</Badge>
                  <Text fontSize="sm" color="gray.600">
                    (3 stars)
                  </Text>
                </HStack>
                <Text fontWeight="bold">{stats.ratingDistribution[3] || 0}</Text>
              </HStack>
              <Progress
                value={
                  stats.totalReviews > 0
                    ? ((stats.ratingDistribution[3] || 0) / stats.totalReviews) * 100
                    : 0
                }
                colorScheme="yellow"
                borderRadius="full"
              />
            </Box>

            <Box>
              <HStack justify="space-between" mb={2}>
                <HStack>
                  <Badge colorScheme="red">Negative</Badge>
                  <Text fontSize="sm" color="gray.600">
                    (1-2 stars)
                  </Text>
                </HStack>
                <Text fontWeight="bold">
                  {(stats.ratingDistribution[2] || 0) + (stats.ratingDistribution[1] || 0)}
                </Text>
              </HStack>
              <Progress
                value={
                  stats.totalReviews > 0
                    ? (((stats.ratingDistribution[2] || 0) + (stats.ratingDistribution[1] || 0)) /
                        stats.totalReviews) *
                      100
                    : 0
                }
                colorScheme="red"
                borderRadius="full"
              />
            </Box>
          </VStack>
        </Box>

        {/* Engagement Metrics */}
        <Box bg={cardBg} p={6} borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
          <Text fontSize="lg" fontWeight="semibold" mb={4}>
            Engagement Metrics
          </Text>
          <VStack spacing={4} align="stretch">
            <Box bg={statBg} p={4} borderRadius="md">
              <HStack justify="space-between">
                <Text fontSize="sm" fontWeight="medium">
                  Reviews with Comments
                </Text>
                <Badge colorScheme="blue" fontSize="md">
                  {stats.withComments} / {stats.totalReviews}
                </Badge>
              </HStack>
              <Progress
                value={
                  stats.totalReviews > 0 ? (stats.withComments / stats.totalReviews) * 100 : 0
                }
                colorScheme="blue"
                size="sm"
                mt={2}
              />
            </Box>

            <Box bg={statBg} p={4} borderRadius="md">
              <HStack justify="space-between">
                <Text fontSize="sm" fontWeight="medium">
                  Response Rate
                </Text>
                <Badge
                  colorScheme={stats.responseRate >= 80 ? 'green' : stats.responseRate >= 50 ? 'yellow' : 'red'}
                  fontSize="md"
                >
                  {stats.responseRate.toFixed(0)}%
                </Badge>
              </HStack>
              <Progress
                value={stats.responseRate}
                colorScheme={stats.responseRate >= 80 ? 'green' : stats.responseRate >= 50 ? 'yellow' : 'red'}
                size="sm"
                mt={2}
              />
            </Box>

            <Divider />

            <VStack spacing={2} align="stretch">
              <HStack justify="space-between">
                <Text fontSize="sm">Replied Reviews</Text>
                <Text fontSize="sm" fontWeight="bold">
                  {stats.repliedReviews}
                </Text>
              </HStack>
              <HStack justify="space-between">
                <Text fontSize="sm">Unreplied Reviews</Text>
                <Text fontSize="sm" fontWeight="bold">
                  {stats.totalReviews - stats.repliedReviews}
                </Text>
              </HStack>
            </VStack>
          </VStack>
        </Box>
      </SimpleGrid>

      {/* Recommendations */}
      {stats.totalReviews > 0 && (
        <Box bg={cardBg} p={6} borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
          <Text fontSize="lg" fontWeight="semibold" mb={4}>
            Recommendations
          </Text>
          <VStack spacing={3} align="stretch">
            {stats.responseRate < 50 && (
              <Alert status="warning" borderRadius="md">
                <AlertIcon />
                <Box flex={1}>
                  <Text fontWeight="medium">Low Response Rate</Text>
                  <Text fontSize="sm">
                    Consider replying to more reviews to improve engagement. Aim for at least 80%.
                  </Text>
                </Box>
              </Alert>
            )}

            {((stats.ratingDistribution[1] || 0) + (stats.ratingDistribution[2] || 0)) >
              stats.totalReviews * 0.2 && (
              <Alert status="error" borderRadius="md">
                <AlertIcon />
                <Box flex={1}>
                  <Text fontWeight="medium">High Negative Review Rate</Text>
                  <Text fontSize="sm">
                    More than 20% of your reviews are negative. Consider addressing common concerns.
                  </Text>
                </Box>
              </Alert>
            )}

            {stats.averageRating >= 4.5 && stats.responseRate >= 80 && (
              <Alert status="success" borderRadius="md">
                <AlertIcon />
                <Box flex={1}>
                  <Text fontWeight="medium">Excellent Performance!</Text>
                  <Text fontSize="sm">
                    Your average rating is {stats.averageRating.toFixed(1)} with a {stats.responseRate.toFixed(0)}% response rate. Keep up the great work!
                  </Text>
                </Box>
              </Alert>
            )}

            {stats.totalReviews - stats.repliedReviews > 10 && (
              <Alert status="info" borderRadius="md">
                <AlertIcon />
                <Box flex={1}>
                  <Text fontWeight="medium">Pending Replies</Text>
                  <Text fontSize="sm">
                    You have {stats.totalReviews - stats.repliedReviews} reviews without replies. Consider responding to engage with your customers.
                  </Text>
                </Box>
              </Alert>
            )}
          </VStack>
        </Box>
      )}
    </VStack>
  );
};
