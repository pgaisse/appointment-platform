import {
  Box,
  SimpleGrid,
  useDisclosure,
  Skeleton,
  VStack,
  HStack,
  SkeletonText,
  IconButton,
  Tooltip,
  useToast,
} from "@chakra-ui/react";
import { } from "date-fns";
import { useEffect, useState } from "react";
import { WeekDay } from "./AvailabilityDates";
import { Appointment, GroupedAppointment, TimeBlock } from "@/types";
import DraggableCards from "./DraggableCards";
import DateRangeSelector from "../searchBar/DateRangeSelector";
import { useDraggableCards } from "@/Hooks/Query/useDraggableCards";
import { filterAppointmentsByRange, RangeOption } from "@/Functions/filterAppointmentsByRage";
// (range helpers for priority columns retained elsewhere)
import { useGetCollection } from "@/Hooks/Query/useGetCollection";
import { usePendingApprovals } from "@/Hooks/Query/usePendingApprovals";
import { useDeclinedAppointments } from "@/Hooks/Query/useDeclinedAppointments";
import { useArchivedAppointments } from "@/Hooks/Query/useArchivedAppointments";
import AppointmentModal from "../Modal/AppointmentModal";
import { ModalStackProvider } from "@/Components/ModalStack/ModalStackContext"; // 👈 Provider para modal index
import { RepeatIcon } from "@chakra-ui/icons";
import { useQueryClient } from "@tanstack/react-query";

const CustomTableAppColumnV = () => {

  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedItem, setSelectedItem] = useState<Appointment>();
  const [] = useState<Partial<Record<WeekDay, TimeBlock[]>>>({});
  const queryClient = useQueryClient();
  const toast = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: dataAP2, isPlaceholderData, isLoading } = useDraggableCards();
  
  // 🔍 FASE 1: DIAGNÓSTICO - Estructura de datos
  console.log("📦 dataAP2 from backend:", {
    totalGroups: dataAP2?.length,
    totalPatients: dataAP2?.reduce((sum, g) => sum + (g.patients?.length || 0), 0),
    groups: dataAP2?.map(g => ({
      priority: g.priorityName || 'Unknown',
      count: g.patients?.length || 0,
      sampleDates: g.patients?.[0]?.selectedAppDates?.map(d => ({
        start: d.startDate,
        end: d.endDate
      }))
    }))
  });
  
  console.log("🔍 Structure Analysis:", {
    totalGroups: dataAP2?.length,
    sampleAppointment: dataAP2?.[0]?.patients?.[0] ? {
      _id: dataAP2[0].patients[0]._id,
      nameInput: dataAP2[0].patients[0].nameInput,
      hasRootTreatment: !!(dataAP2[0].patients[0] as any).treatment,
      hasRootPriority: !!(dataAP2[0].patients[0] as any).priority,
      hasRootProviders: !!(dataAP2[0].patients[0] as any).providers,
      selectedAppDatesCount: dataAP2[0].patients[0].selectedAppDates?.length || 0
    } : null,
    sampleSlots: dataAP2?.[0]?.patients?.[0]?.selectedAppDates?.map((s: any) => ({
      status: s.status,
      hasTreatment: !!s.treatment,
      hasPriority: !!s.priority,
      hasProviders: !!s.providers,
      treatmentType: typeof s.treatment,
      priorityType: typeof s.priority,
      providersType: typeof s.providers,
      treatmentValue: s.treatment?._id ? 'populated' : s.treatment ? 'id' : 'null',
      priorityValue: s.priority?._id ? 'populated' : s.priority ? 'id' : 'null'
    })) || []
  });
  //const { data: dataCategories } = useTreatments();
  const [filteredData, setFilteredData] = useState<GroupedAppointment[]>(dataAP2 ? dataAP2 : []);
  // Pending/Declined panels show all items irrespective of date range; we derive them from the raw queries.
  // Contacts: appointments without any scheduled slots (no selectedAppDates) – keep logic
  const query = {
    $and: [
      { unknown: false },
      {
        $or: [
          { selectedAppDates: { $exists: false } },
          { selectedAppDates: null },
          { selectedAppDates: { $size: 0 } },
        ],
      },
    ],
  };

  // Pending Approvals via dedicated hook (stable query key for easy invalidation)

  // Archived via dedicated hook (stable query key)

  const limit = 100;
  const { data: dataContacts } = useGetCollection<Appointment>("Appointment", {
    mongoQuery: query,
    limit,
  });

  const { data: pendingRaw } = usePendingApprovals({ limit });
  console.log("pendingRaw",pendingRaw)

  // Declined and Archived via dedicated hooks (stable keys)
  const { data: declinedRaw } = useDeclinedAppointments({ limit });
  const { data: dataArchived } = useArchivedAppointments({ limit });
  // Refina Declined por último slot; Para Pending incluimos si CUALQUIER slot es Pending
  const latestStatus = (slots: any[]): string | undefined => {
    if (!Array.isArray(slots) || !slots.length) return undefined;
    // sort by ObjectId timestamp DESC then by original index DESC
    const withIndex = slots.map((s, idx) => ({ s, idx }));
    withIndex.sort((a, b) => {
      const ta = String(a.s?._id || '').slice(0,8);
      const tb = String(b.s?._id || '').slice(0,8);
      const sa = parseInt(ta,16) || 0;
      const sb = parseInt(tb,16) || 0;
      if (sb !== sa) return sb - sa;
      return b.idx - a.idx;
    });
    return String((withIndex[0].s as any)?.status || '').toLowerCase();
  };
  const dataPending = (pendingRaw ?? []).filter((apt) =>
    Array.isArray((apt as any)?.selectedAppDates) &&
    (apt as any).selectedAppDates.some((s: any) => String(s?.status || '').toLowerCase() === 'pending')
  );
  const dataDeclined = (declinedRaw ?? []).filter((apt) => {
    const s = latestStatus(apt.selectedAppDates as any[]);
    return s === 'declined' || s === 'rejected';
  });
  const handleRangeChange = (
    range: RangeOption,
    customStart?: Date,
    customEnd?: Date
  ) => {
    const result = filterAppointmentsByRange(
      dataAP2 ?? [],
      range,
      customStart,
      customEnd
    );
    setFilteredData(result);
    // Nota: Pending y Declined NO se filtran por rango; siempre muestran el último estado por inserción
  };

  const templateCoumns = {
    base: "repeat(1, minmax(150px, 1fr))",
    sm: "repeat(1, minmax(150px, 2fr))",
    lg: "repeat(2, minmax(150px, 2fr))",
    xl: "repeat(4, minmax(150px, 1fr))",
    "2xl": "repeat(4, minmax(150px, 1fr))",
    "5xl": "repeat(4, minmax(150px, 1fr))",
  };
  // ✅ Al montar, aplicar automáticamente el rango "week" (This Week default)
  useEffect(() => {
    handleRangeChange("week");
  }, [dataAP2]); // <-- importante: asegúrate de que 'data' esté cargada

  const handleCardClick = (item: Appointment) => {
    setSelectedItem(item);
    onOpen();
  };

  // Skeleton component for loading state
  const DateRangeSkeleton = () => (
    <Box px={4} mb={4}>
      <Box
        w="full"
        bg="white"
        p={4}
        borderRadius="xl"
        border="2px"
        borderColor="gray.200"
        boxShadow="sm"
      >
        <VStack spacing={3} align="stretch">
          <HStack justify="space-between">
            <HStack spacing={2}>
              <Skeleton width="20px" height="20px" borderRadius="md" />
              <SkeletonText noOfLines={1} width="150px" skeletonHeight="4" />
              <Skeleton width="100px" height="24px" borderRadius="full" />
            </HStack>
            <Skeleton width="32px" height="32px" borderRadius="md" />
          </HStack>
          <Skeleton height="60px" borderRadius="lg" />
        </VStack>
      </Box>
    </Box>
  );

  const CardsSkeleton = () => (
    <SimpleGrid spacing={6} templateColumns={templateCoumns}>
      {[1, 2, 3, 4].map((i) => (
        <Box key={i} w="full">
          <VStack spacing={4} align="stretch">
            <HStack justify="space-between" mb={2}>
              <SkeletonText noOfLines={1} width="120px" skeletonHeight="4" />
              <Skeleton width="40px" height="24px" borderRadius="full" />
            </HStack>
            {[1, 2, 3].map((j) => (
              <Box
                key={j}
                p={4}
                borderRadius="lg"
                border="2px solid"
                borderColor="gray.200"
                bg="white"
              >
                <VStack spacing={3} align="stretch">
                  <HStack justify="space-between">
                    <SkeletonText noOfLines={1} width="60%" skeletonHeight="3" />
                    <Skeleton width="60px" height="20px" borderRadius="md" />
                  </HStack>
                  <SkeletonText noOfLines={2} spacing="2" skeletonHeight="2" />
                  <HStack spacing={2} mt={2}>
                    <Skeleton width="80px" height="28px" borderRadius="md" />
                    <Skeleton width="80px" height="28px" borderRadius="md" />
                  </HStack>
                </VStack>
              </Box>
            ))}
          </VStack>
        </Box>
      ))}
    </SimpleGrid>
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['DraggableCards'] }),
        queryClient.invalidateQueries({ queryKey: ['appointments'] }),
        queryClient.invalidateQueries({ queryKey: ['appointments-search'] }),
        queryClient.invalidateQueries({ queryKey: ['Appointment'] }),
      ]);
      await queryClient.refetchQueries({ queryKey: ['DraggableCards'] });
      toast({
        title: 'Refreshed',
        description: 'Priority list has been updated.',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Error refreshing',
        description: 'Could not refresh the priority list.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <ModalStackProvider>
      <>
        <Box px={4} mb={4}>
          {isLoading || !dataAP2 ? (
            <DateRangeSkeleton />
          ) : (
            <DateRangeSelector 
              onFilterRange={handleRangeChange} 
              onRefresh={handleRefresh}
              isRefreshing={isRefreshing}
            />
          )}
        </Box>
        <Box px={4}>
          {isOpen && selectedItem && (
            <AppointmentModal id={selectedItem._id ?? ""} isOpen={isOpen} onClose={onClose} />
          )}
        </Box>

        {isLoading || !dataAP2 ? (
          <CardsSkeleton />
        ) : (
          <SimpleGrid spacing={6} templateColumns={templateCoumns}>
            <DraggableCards
              isPlaceholderData={isPlaceholderData}
              dataAP2={filteredData ? filteredData : []}
              dataContacts={dataContacts ? dataContacts : []}
              dataPending={dataPending ?? []}
              dataDeclined={dataDeclined ?? []}
              dataArchived={dataArchived ? dataArchived : []}
              onCardClick={handleCardClick}
            />
          </SimpleGrid>
        )}
      </>
    </ModalStackProvider>
  );
};

export default CustomTableAppColumnV;
