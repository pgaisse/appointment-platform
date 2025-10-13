import React, { useState } from "react";
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
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import { useMeta } from "@/Hooks/Query/useMeta";
import { PrioritiesManager } from "../../Components/admin/MetaPriorities";
import { TreatmentsManager } from "../../Components/admin/MetaTreatments";
import ProviderManager from "@/Components/admin/ProviderManager";

const MotionCard = motion(Card);

export default function MetaManagerTabs() {
  const [tab, setTab] = useState(0);

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
            </TabPanels>

            
          </Tabs>
        </CardBody>
      </MotionCard>
    </Stack>
  );
}
