import {
  Box,
  SimpleGrid,
  useDisclosure,
  Skeleton,
  VStack,
  HStack,
  SkeletonText,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { WeekDay } from "./AvailabilityDates";
import { Appointment, GroupedAppointment, TimeBlock } from "@/types";
import DraggableCards from "./DraggableCards";
import DateRangeSelector from "../searchBar/DateRangeSelector";
import { useDraggableCards } from "@/Hooks/Query/useDraggableCards";
import { filterAppointmentsByRange, RangeOption } from "@/Functions/filterAppointmentsByRage";
import { useGetCollection } from "@/Hooks/Query/useGetCollection";
import AppointmentModal from "../Modal/AppointmentModal";
import { ModalStackProvider } from "@/Components/ModalStack/ModalStackContext"; // 👈 Provider para modal index

const CustomTableAppColumnV = () => {

  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedItem, setSelectedItem] = useState<Appointment>();
  const [] = useState<Partial<Record<WeekDay, TimeBlock[]>>>({});

  const { data: dataAP2, isPlaceholderData, isLoading } = useDraggableCards();
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
  //const { data: dataCategories } = useTreatments();
  const [filteredData, setFilteredData] = useState<GroupedAppointment[]>(dataAP2 ? dataAP2 : []);
  const query = {
    $and: [
      { unknown: false },           // ← obligatorio
      {
        $or: [
          { selectedAppDates: { $exists: false } },
          { selectedAppDates: null },
          { selectedAppDates: { $size: 0 } },
          { selectedDates: { $exists: false } },
          // (opcional) si también quieres selectedDates vacío:
          // { selectedDates: { $size: 0 } },
        ],
      },
    ],
  };

  const query2 = {
    $and: [{ unknown: false },      {"selectedAppDates.status": "Pending" }    ],
  };

  const query3 = {
    $and: [{ unknown: false }, { position: -1 }],
  };

  const limit = 100;
  const { data: dataContacts } = useGetCollection<Appointment>("Appointment", {
    mongoQuery: query,
    limit,
  });

  const { data: dataPending } = useGetCollection<Appointment>("Appointment", {
    mongoQuery: query2,
    limit,
  });

  const { data: dataArchived } = useGetCollection<Appointment>("Appointment", {
    mongoQuery: query3,
    limit,
  });
  console.log("dataPending",dataPending)
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

  };

  const templateCoumns = {
    base: "repeat(1, minmax(150px, 1fr))",
    sm: "repeat(1, minmax(150px, 2fr))",
    lg: "repeat(2, minmax(150px, 2fr))",
    xl: "repeat(4, minmax(150px, 1fr))",
    "2xl": "repeat(4, minmax(150px, 1fr))",
    "5xl": "repeat(4, minmax(150px, 1fr))",
  };
  // ✅ Al montar, aplicar automáticamente el rango "2weeks"
  useEffect(() => {
    handleRangeChange("2weeks");
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

  return (
    <ModalStackProvider>
      <>
        <Box px={4} mb={4}>
          {isLoading || !dataAP2 ? (
            <DateRangeSkeleton />
          ) : (
            <DateRangeSelector onFilterRange={handleRangeChange} />
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
              dataPending={dataPending ? dataPending : []}
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
