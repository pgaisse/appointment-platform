import React, { useState, useEffect } from "react";
import {
  Box,
  Card,
  CardBody,
  CardHeader,
  HStack,
  Heading,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  useToast,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import { useMeta } from "@/Hooks/Query/useMeta";
import { PrioritiesManager } from "../../Components/admin/MetaPriorities";
import { TreatmentsManager } from "../../Components/admin/MetaTreatments";
import ProviderManager from "@/Components/admin/ProviderManager";
import UserManager from "@/Components/admin/UserManager";
import { GoogleReviewsManager } from "@/Components/admin/GoogleReviewsManager";
import GoogleReviewsManagerNew from "@/Routes/Admin/GoogleReviewsManager";
import TwilioSettings from "@/Components/Settings/TwilioSettings";
import { useAuthZ } from "@/auth/authz";

const MotionCard = motion(Card);

export default function MetaManagerTabs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const { hasRole } = useAuthZ();
  
  // Check if redirected from OAuth with success
  const connected = searchParams.get('connected');
  const error = searchParams.get('error');
  
  // Check if user has support role to show Twilio tab
  const canAccessTwilio = hasRole('support');
  
  // Google Reviews tab is at index 4, Reviews Manager at index 5 (0: Priorities, 1: Treatments, 2: Providers, 3: Users, 4: Google Reviews, 5: Reviews Manager, 6: Twilio if support)
  const [tab, setTab] = useState(connected === 'true' ? 5 : 0);
  
  useEffect(() => {
    if (connected === 'true') {
      toast({
        title: 'Google Account Connected',
        description: 'Your Google My Business account has been successfully connected.',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      // Clean up URL params
      searchParams.delete('connected');
      setSearchParams(searchParams, { replace: true });
    } else if (error) {
      toast({
        title: 'Connection Failed',
        description: 'Failed to connect Google My Business account. Please try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      // Clean up URL params
      searchParams.delete('error');
      setSearchParams(searchParams, { replace: true });
    }
  }, [connected, error]);

  const {
    priorities,
    treatments,
    isLoadingPriorities,
    isLoadingTreatments,
    suggestedPriorityId,
    createPriority,
    updatePriority,
    deletePriority,
    createTreatment,
    updateTreatment,
    deleteTreatment,
  } = useMeta();

  return (
    <Stack spacing={6}>
      <MotionCard
        rounded="2xl"
        shadow="xl"
        whileHover={{ y: -2 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
      >
        <CardHeader pb={2}>
          <HStack justify="space-between" align="center">
            <Box>
              <Heading size="lg">Priorities & Treatments</Heading>
              <Text color="gray.600">
                Manage key metadata for scheduling and classification
              </Text>
            </Box>
          </HStack>
        </CardHeader>

        <CardBody pt={2}>
          <Tabs index={tab} onChange={setTab} variant="enclosed" rounded="xl">
            <TabList>
              <Tab roundedTop="xl">Priorities</Tab>
              <Tab roundedTop="xl">Treatments</Tab>
              <Tab roundedTop="xl">Providers</Tab>
              <Tab roundedTop="xl">Users</Tab>
              <Tab roundedTop="xl">Google Reviews</Tab>
              <Tab roundedTop="xl">Reviews Manager</Tab>
              {canAccessTwilio && <Tab roundedTop="xl">Twilio</Tab>}
            </TabList>
            <TabPanels>
              <TabPanel px={0}>
                <PrioritiesManager
                  data={priorities || []}
                  isLoading={isLoadingPriorities}
                  suggestedId={suggestedPriorityId}
                  onCreate={createPriority}
                  onUpdate={updatePriority}
                  onDelete={deletePriority}
                />
              </TabPanel>

              <TabPanel px={0}>
                <TreatmentsManager
                  data={treatments || []}
                  isLoading={isLoadingTreatments}
                  onCreate={createTreatment}
                  onUpdate={updateTreatment}
                  onDelete={deleteTreatment}
                />
              </TabPanel>

              <TabPanel px={0}>
                <ProviderManager/>
              </TabPanel>

              <TabPanel px={0}>
                <UserManager/>
              </TabPanel>

              <TabPanel px={0}>
                <GoogleReviewsManager/>
              </TabPanel>

              <TabPanel px={0}>
                <GoogleReviewsManagerNew/>
              </TabPanel>

              {canAccessTwilio && (
                <TabPanel px={0}>
                  <TwilioSettings/>
                </TabPanel>
              )}
            </TabPanels>

            
          </Tabs>
        </CardBody>
      </MotionCard>
    </Stack>
  );
}
