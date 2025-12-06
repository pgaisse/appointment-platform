// apps/frontend/src/Routes/Admin/GoogleReviewsManager.tsx
import { useState } from 'react';
import {
  Box,
  Heading,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Container,
  useColorModeValue,
} from '@chakra-ui/react';
import { GoogleReviewsOverview } from '@/Components/GoogleReviews/GoogleReviewsOverview';
import { GoogleReviewsList } from '@/Components/GoogleReviews/GoogleReviewsList';
import { GoogleReviewsAnalytics } from '@/Components/GoogleReviews/GoogleReviewsAnalytics';
import { GoogleReviewsSettings } from '@/Components/GoogleReviews/GoogleReviewsSettings';

export default function GoogleReviewsManager() {
  const [tabIndex, setTabIndex] = useState(0);
  const bgColor = useColorModeValue('gray.50', 'gray.900');
  const cardBg = useColorModeValue('white', 'gray.800');

  return (
    <Box minH="100vh" bg={bgColor} py={8}>
      <Container maxW="container.xl">
        <Heading size="lg" mb={6}>
          Google Reviews Manager
        </Heading>

        <Box bg={cardBg} borderRadius="xl" boxShadow="sm" p={6}>
          <Tabs index={tabIndex} onChange={setTabIndex} colorScheme="blue" variant="soft-rounded">
            <TabList mb={6}>
              <Tab>Overview</Tab>
              <Tab>Reviews</Tab>
              <Tab>Analytics</Tab>
              <Tab>Settings</Tab>
            </TabList>

            <TabPanels>
              <TabPanel px={0}>
                <GoogleReviewsOverview onNavigateToTab={(index) => setTabIndex(index)} />
              </TabPanel>
              
              <TabPanel px={0}>
                <GoogleReviewsList />
              </TabPanel>
              
              <TabPanel px={0}>
                <GoogleReviewsAnalytics />
              </TabPanel>
              
              <TabPanel px={0}>
                <GoogleReviewsSettings />
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Box>
      </Container>
    </Box>
  );
}
