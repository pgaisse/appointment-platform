import {
  Box,
  SimpleGrid,
  useDisclosure,
  Skeleton,
  VStack,
  HStack,
  SkeletonText,
  useToast,
} from "@chakra-ui/react";
import { useState, useRef, useEffect } from "react";
import { Appointment, GroupedAppointment } from "@/types";
import DraggableCards from "./DraggableCards";
import { useDraggableCards } from "@/Hooks/Query/useDraggableCards";
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
  const [selectedSlotId, setSelectedSlotId] = useState<string | undefined>();
  const queryClient = useQueryClient();
  const toast = useToast();
  
  // Refs para los contenedores con scroll horizontal
  const prioritiesScrollRef = useRef<HTMLDivElement>(null);
  const additionalScrollRef = useRef<HTMLDivElement>(null);

  const { data: dataAP2, isPlaceholderData, isLoading } = useDraggableCards();
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
  const dataPending = (pendingRaw ?? []).filter((apt) => {
    if (!Array.isArray((apt as any)?.selectedAppDates)) return false;
    
    const now = new Date();
    return (apt as any).selectedAppDates.some((s: any) => {
      const status = String(s?.status || '').toLowerCase();
      if (status !== 'pending') return false;
      
      // Only include if appointment date hasn't passed
      const startDate = s?.startDate ? new Date(s.startDate) : null;
      return startDate ? startDate >= now : false;
    });
  });
  const dataDeclined = (declinedRaw ?? []).filter((apt) => {
    const s = latestStatus(apt.selectedAppDates as any[]);
    return s === 'declined' || s === 'rejected';
  });

  const templateCoumns = {
    base: "repeat(1, minmax(150px, 1fr))",
    sm: "repeat(1, minmax(150px, 2fr))",
    lg: "repeat(2, minmax(150px, 2fr))",
    xl: "repeat(4, minmax(150px, 1fr))",
    "2xl": "repeat(4, minmax(150px, 1fr))",
    "5xl": "repeat(4, minmax(150px, 1fr))",
  };

  const handleCardClick = (item: Appointment, slotId?: string) => {
    setSelectedItem(item);
    setSelectedSlotId(slotId);
    onOpen();
  };

  // Efecto para manejar scroll horizontal con mouse (vertical y horizontal)
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const container = e.currentTarget as HTMLDivElement;
      // Solo si hay scroll horizontal disponible
      if (container.scrollWidth > container.clientWidth) {
        e.preventDefault();
        // Soporte para scroll vertical (deltaY) y horizontal (deltaX) del mouse
        const scrollAmount = e.deltaX !== 0 ? e.deltaX : e.deltaY;
        container.scrollLeft += scrollAmount;
      }
    };

    const prioritiesContainer = prioritiesScrollRef.current;
    const additionalContainer = additionalScrollRef.current;

    if (prioritiesContainer) {
      prioritiesContainer.addEventListener('wheel', handleWheel, { passive: false });
    }

    if (additionalContainer) {
      additionalContainer.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      if (prioritiesContainer) {
        prioritiesContainer.removeEventListener('wheel', handleWheel);
      }
      if (additionalContainer) {
        additionalContainer.removeEventListener('wheel', handleWheel);
      }
    };
  }, []);

  // Skeleton component for loading state
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
        <Box px={4}>
          {isOpen && selectedItem && (
            <AppointmentModal 
              id={selectedItem._id ?? ""} 
              isOpen={isOpen} 
              onClose={() => {
                onClose();
                setSelectedSlotId(undefined);
              }}
              initialSlotId={selectedSlotId}
            />
          )}
        </Box>

        {isLoading || !dataAP2 ? (
          <CardsSkeleton />
        ) : (
          <VStack spacing={4} align="stretch" width="100%">
            {/* Primera fila: Columnas de prioridades */}
            <HStack
              ref={prioritiesScrollRef}
              spacing={0}
              align="stretch"
              overflowX="auto"
              overflowY="hidden"
              width="100%"
              pb={4}
              css={{
                '&::-webkit-scrollbar': {
                  height: '8px',
                },
                '&::-webkit-scrollbar-track': {
                  background: '#f1f1f1',
                  borderRadius: '10px',
                },
                '&::-webkit-scrollbar-thumb': {
                  background: '#888',
                  borderRadius: '10px',
                },
                '&::-webkit-scrollbar-thumb:hover': {
                  background: '#555',
                },
              }}
            >
              <DraggableCards
                isPlaceholderData={isPlaceholderData}
                dataAP2={dataAP2 ?? []}
                dataContacts={dataContacts ? dataContacts : []}
                dataPending={dataPending ?? []}
                dataDeclined={dataDeclined ?? []}
                dataArchived={dataArchived ? dataArchived : []}
                onCardClick={handleCardClick}
              />
            </HStack>

            {/* Segunda fila: Columnas adicionales (Contacts, Pending, Declined, Archived) */}
            <HStack
              ref={additionalScrollRef}
              spacing={0}
              align="stretch"
              overflowX="auto"
              overflowY="hidden"
              width="100%"
              pb={4}
              css={{
                '&::-webkit-scrollbar': {
                  height: '8px',
                },
                '&::-webkit-scrollbar-track': {
                  background: '#f1f1f1',
                  borderRadius: '10px',
                },
                '&::-webkit-scrollbar-thumb': {
                  background: '#888',
                  borderRadius: '10px',
                },
                '&::-webkit-scrollbar-thumb:hover': {
                  background: '#555',
                },
              }}
            >
              <DraggableCards
                isPlaceholderData={isPlaceholderData}
                dataAP2={dataAP2 ?? []}
                dataContacts={dataContacts ? dataContacts : []}
                dataPending={dataPending ?? []}
                dataDeclined={dataDeclined ?? []}
                dataArchived={dataArchived ? dataArchived : []}
                onCardClick={handleCardClick}
                renderAdditionalColumns
              />
            </HStack>
          </VStack>
        )}
      </>
    </ModalStackProvider>
  );
};

export default CustomTableAppColumnV;
