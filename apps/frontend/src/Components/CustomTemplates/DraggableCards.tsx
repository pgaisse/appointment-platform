// apps/frontend/src/Components/DraggableCards/DraggableColumns.tsx

import { formatDateWS } from '@/Functions/FormatDateWS';
import { formatAusPhoneNumber } from '@/Functions/formatAusPhoneNumber';
import { PhoneIcon, TimeIcon } from '@chakra-ui/icons';
import {
  Box,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Grid,
  GridItem,
  Heading,
  HStack,
  Icon,
  Spinner,
  Text,
  Tooltip,
  useToast,
  Skeleton,
  SkeletonText,
  SkeletonCircle,
  Fade,
  Stack,
  useDisclosure,
  IconButton,
} from '@chakra-ui/react';
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import React, { useEffect, useRef, useState, useCallback, lazy, Suspense } from 'react';
import type { Appointment, GroupedAppointment, ConversationChat } from '@/types';
import { useQueryClient } from '@tanstack/react-query';
import { iconMap } from '../CustomIcons';
import Pagination from '../Pagination';
import AddPatientButton from '../DraggableCards/AddPatientButton';
import SearchBar, { SearchBarRef } from '../searchBar';
import ArchiveItemButton from './ArchiveItemButton';
import DeleteContactButton from './DeleteContactButton';
import { LiaSmsSolid } from 'react-icons/lia';

// ✅ Hook dedicado para Priority List
import { useMovePriorityItems, type PriorityMove } from '@/Hooks/Query/useMovePriorityItems';
// ⛔️ Eliminado: import ChatWindowModal from '../Modal/ChatWindowModal';
// ✅ Lazy load (se carga SOLO cuando se abre)
const ChatWindowModalLazy = lazy(() => import('../Modal/ChatWindowModal'));
import { FaCommentSms } from 'react-icons/fa6';

type Props = {
  onCardClick?: (item: Appointment) => void;
  dataAP2: GroupedAppointment[] | undefined;
  dataContacts: Appointment[];
  isPlaceholderData: boolean;
  dataPending: Appointment[];
};

// ---- Helper: ejecutar callback después del paint (no altera lógica) ----
const AfterPaint: React.FC<{ on: () => void }> = ({ on }) => {
  React.useEffect(() => {
    const id = requestAnimationFrame(() => on());
    return () => cancelAnimationFrame(id);
  }, [on]);
  return null;
};

// ---------- Loaders (solo UI) ----------
const LoadingColumn: React.FC<{ title?: string; color?: string }> = ({ color = 'gray' }) => (
  <Card
    minW="250px"
    flex="0 0 auto"
    minHeight="300px"
    maxHeight="600px"
    border="1px solid #E2E8F0"
    borderRadius="md"
    position="relative"
    bg="gray.50"
    mr={4}
  >
    <CardHeader>
      <Heading size="sm" mb={2} bg={`${color}.100`} p={3} borderRadius="md" width="fit-content">
        <Skeleton height="16px" width="120px" />
      </Heading>
    </CardHeader>
    <CardBody p={3} bg="white">
      <Stack spacing={3}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Box key={i} p={4} borderRadius={10} border="1px" borderColor="gray.50" boxShadow="md" bg="white">
            <Skeleton height="14px" mb={2} />
            <Skeleton height="18px" mb={2} />
            <Skeleton height="14px" />
          </Box>
        ))}
      </Stack>
    </CardBody>
    <CardFooter minH="50px" maxH="50px">
      <HStack w="full" justify="center">
        <Skeleton height="32px" width="80px" />
        <Skeleton height="32px" width="80px" />
        <Skeleton height="32px" width="80px" />
      </HStack>
    </CardFooter>
  </Card>
);

const LoadingContactsPanel: React.FC = () => (
  <Card
    minW="250px"
    flex="0 0 auto"
    minHeight="300px"
    maxHeight="600px"
    border="1px solid #E2E8F0"
    borderRadius="md"
    position="relative"
    bg="gray.50"
    mr={4}
  >
    <CardHeader>
      <Heading size="sm" mb={2} bg="red.100" p={3} borderRadius="md" width="fit-content">
        <Skeleton height="16px" width="100px" />
      </Heading>
    </CardHeader>
    <CardBody p={3} bg="white">
      <Skeleton height="38px" borderRadius="md" mb={3} />
      <Stack spacing={3}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Box key={i} p={4} borderRadius={10} border="1px" borderColor="gray.50" boxShadow="md" bg="white">
            <HStack spacing={3} mb={2}>
              <SkeletonCircle size="6" />
              <Skeleton height="18px" width="60%" />
            </HStack>
            <SkeletonText noOfLines={2} spacing="2" />
          </Box>
        ))}
      </Stack>
    </CardBody>
    <CardFooter minH="50px" maxH="50px">
      <HStack w="full" justify="center">
        <Skeleton height="32px" width="80px" />
        <Skeleton height="32px" width="80px" />
        <Skeleton height="32px" width="80px" />
      </HStack>
    </CardFooter>
  </Card>
);

// ---------- Sortable ----------
function SortableItem({
  id,
  children,
  color,
  onClick,
  item,
}: {
  id: string;
  children: React.ReactNode;
  color?: string;
  onClick?: (item: Appointment) => void;
  item?: Appointment;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition,
    zIndex: isDragging ? 999 : 'auto',
    position: isDragging ? 'relative' : 'static',
    opacity: isDragging ? 0 : 1,
  };

  return (
    <Box
      ref={setNodeRef}
      userSelect="none"
      p={4}
      borderRadius={10}
      border="1px"
      borderColor="gray.50"
      w="full"
      my={2}
      cursor="default"
      boxShadow="md"
      bg="white"
      _hover={{ borderColor: color }}
      onClick={(e) => {
        e.stopPropagation();
        if (item) onClick?.(item);
      }}
      style={style}
      {...attributes}
      {...listeners}
    >
      {children}
    </Box>
  );
}

// ---------- Util: mover items (con ajuste de índice intra-columna) ----------
function moveItem(
  data: GroupedAppointment[],
  itemId: string,
  fromColumnId: string,
  toColumnId: string,
  toIndex: number
): GroupedAppointment[] {
  const newData = [...data];
  const sourceCol = newData.find(col => col._id === fromColumnId);
  const destCol = newData.find(col => col._id === toColumnId);
  if (!sourceCol || !destCol) {
    console.warn('⚠️ moveItem: columna origen o destino no encontrada');
    return data;
  }
  const item = sourceCol.patients.find(p => p._id === itemId);
  if (!item) {
    console.warn('⚠️ moveItem: item no encontrado en columna origen');
    return data;
  }

  if (fromColumnId === toColumnId) {
    const newPatients = [...sourceCol.patients];
    const currentIndex = newPatients.findIndex(p => p._id === itemId);
    if (currentIndex === -1) {
      console.warn('⚠️ moveItem: item no encontrado en lista de pacientes de la columna');
      return data;
    }
    // 👇 ajuste cuando arrastras hacia abajo: después de remover, el índice objetivo baja 1
    const insertIndex =
      currentIndex < toIndex ? Math.max(0, toIndex - 1) : toIndex;

    newPatients.splice(currentIndex, 1);
    newPatients.splice(insertIndex, 0, item);
    sourceCol.patients = newPatients.map((p, idx) => ({ ...p, position: idx }));
  } else {
    sourceCol.patients = sourceCol.patients.filter(p => p._id !== itemId);
    const newPatients = [...destCol.patients];
    newPatients.splice(toIndex, 0, item);
    destCol.patients = newPatients.map((p, idx) => ({ ...p, position: idx }));
  }
  return newData;
}

export default function DraggableColumns({ onCardClick, dataAP2, dataContacts, isPlaceholderData, dataPending }: Props) {
  const toast = useToast();
  const searchRef = useRef<SearchBarRef>(null);
  const { mutate: moveMutate } = useMovePriorityItems(); // ✅ hook dedicado
  const [activeItem, setActiveItem] = useState<Appointment | null>(null);
  const [optimisticData, setOptimisticData] = useState<GroupedAppointment[] | null>(null);
  const [sourceCol, setSourceCol] = useState<GroupedAppointment | undefined>();
  const [columnPages, setColumnPages] = useState<Record<string, number>>({});
  const queryClient = useQueryClient();

  // 👉 bandera de “último col pintado”
  const [lastColPainted, setLastColPainted] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // ---------- Chat modal global (fuera de loops) ----------
  const { isOpen: isChatOpen, onOpen: onChatOpen, onClose: onChatClose } = useDisclosure();
  const [chatToOpen, setChatToOpen] = useState<ConversationChat | undefined>(undefined);
  // ✅ Estado para montar/desmontar realmente el modal (lazy)
  const [shouldMountChat, setShouldMountChat] = useState(false);

  const openChatForItem = useCallback((item: Appointment) => {
    setChatToOpen({
      conversationId: item.sid,
      lastMessage: {
        author: item.nameInput || "",
        body: "",
        conversationId: item.sid || "",
        createdAt: new Date().toISOString(),
        direction: "outbound",
        media: [],
        sid: "temp-lastmessage",
        status: "delivered",
        updatedAt: new Date().toISOString(),
      },
      owner: {
        email: item.emailInput,
        lastName: item.lastNameInput,
        name: item.nameInput,
        org_id: item.org_id,
        phone: item.phoneInput,
        unknown: false,
        _id: item._id,
      },
    });
    // 👇 Monta y abre SOLO al hacer click
    setShouldMountChat(true);
    onChatOpen();
  }, [onChatOpen]);

  // Inicializar optimisticData con data de la query
  useEffect(() => {
    setOptimisticData(dataAP2 ?? null);
  }, [dataAP2]);

  // Reset bandera cuando cambie la cantidad de columnas o el estado de carga
  const cols = optimisticData ?? [];
  const lastIndex = cols.length - 1;
  useEffect(() => {
    setLastColPainted(false);
  }, [cols.length, isPlaceholderData]);

  // ---------- Handlers memoizados ----------
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const id = active.id as string;
    if (!dataAP2) return;

    const item = dataAP2.flatMap(col => col.patients).find(p => p._id === id) ?? null;
    setActiveItem(item);

    const originCol = dataAP2.find(col => col.patients.some(p => p._id === id));
    setSourceCol(originCol);

    if (!optimisticData) setOptimisticData(dataAP2);
  }, [dataAP2, optimisticData]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !optimisticData || !sourceCol) {
      setActiveItem(null);
      setSourceCol(undefined);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    const destinationCol =
      optimisticData.find(col => col.patients.some(p => p._id === overId)) ||
      optimisticData.find(col => `placeholder-${col._id}` === overId);

    if (!destinationCol) {
      console.warn('⚠️ Drag end: no se encontró columna destino');
      setActiveItem(null);
      setSourceCol(undefined);
      return;
    }

    const fromId = sourceCol._id;
    const toId = destinationCol._id;
    if (!fromId || !toId) {
      console.warn('⚠️ Drag end: fromId o toId inválidos');
      setActiveItem(null);
      setSourceCol(undefined);
      return;
    }

    const overIndex = destinationCol.patients.findIndex(p => p._id === overId);
    const index = overIndex === -1 ? destinationCol.patients.length : overIndex;

    // ✨ update optimista en memoria (con moveItem que ajusta índice intra-columna)
    const updatedData = moveItem(optimisticData, activeId, fromId, toId, index);
    setOptimisticData(updatedData);
    queryClient.setQueryData(['DraggableCards'], updatedData);

    // 🔁 construir MOVES (reenviamos columnas afectadas)
    const updatedSource = updatedData.find(col => col._id === fromId);
    const updatedDest = updatedData.find(col => col._id === toId);

    const moves: PriorityMove[] = [];
    if (updatedSource) {
      updatedSource.patients.forEach((p, i) => {
        moves.push({ id: p._id, position: i, priority: updatedSource._id ?? undefined });
      });
    }
    if (updatedDest && updatedDest._id !== fromId) {
      updatedDest.patients.forEach((p, i) => {
        moves.push({ id: p._id, position: i, priority: updatedDest._id ?? undefined });
      });
    }

    if (moves.length === 0) {
      setSourceCol(undefined);
      setActiveItem(null);
      return;
    }

    moveMutate(moves, {
      onSuccess: (response: any) => {
        const failed = response?.results?.filter((r: { status: string }) => r.status === 'failed');
        if (failed?.length > 0) {
          toast({
            title: 'Some updates failed',
            description: `${failed.length} updates could not be applied.`,
            status: 'warning',
            duration: 5000,
            isClosable: true,
          });
        } else {
          toast({
            title: 'Update successful',
            description: 'All changes have been saved.',
            status: 'success',
            duration: 3000,
            isClosable: true,
          });
        }
      },
      onSettled: () => {
        setSourceCol(undefined);
        setActiveItem(null);
      },
      onError: (error: any) => {
        console.error('❌ Move error:', error);
        toast({
          title: 'Error al mover cita',
          description: error?.message || 'No se pudo guardar el reordenamiento.',
          status: 'error',
          duration: 2000,
          isClosable: true,
        });
        queryClient.invalidateQueries({ queryKey: ['DraggableCards'] });
        setOptimisticData(null);
      },
    });
  }, [optimisticData, sourceCol, queryClient, moveMutate, toast]);

  const handleDragCancel = useCallback(() => {
    setActiveItem(null);
    setSourceCol(undefined);
  }, []);

  const handlePageChange = (colId: string, page: number) => {
    setColumnPages((prev) => ({ ...prev, [colId]: page }));
  };

  const pageSize = 10;
  const [filteredItems, setFilteredItems] = useState<Appointment[] | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const start = (currentPage - 1) * (pageSize ? pageSize : 0);
  const end = start + (pageSize ? pageSize : 0);
  const paginatedSource = filteredItems ?? dataContacts;
  const currentItems = paginatedSource ? paginatedSource.slice(start, end) : [];
  const totalPages = paginatedSource ? Math.ceil(paginatedSource.length / (pageSize || 1)) : 0;

  const [filteredPending, setFilteredPending] = useState<Appointment[] | null>(null);
  const [currentPagePending, setCurrentPagePending] = useState(1);

  const startPending = (currentPagePending - 1) * (pageSize ? pageSize : 0);
  const endPending = startPending + (pageSize ? pageSize : 0);

  const paginatedPending = filteredPending ?? dataPending;
  const currentPending = paginatedPending ? paginatedPending.slice(startPending, endPending) : [];

  const totalPagesPending = paginatedPending ? Math.ceil(paginatedPending.length / (pageSize || 1)) : 0;

  // --------- Estados de carga visual (sin tocar lógica de datos) ----------
  const isLoadingColumns = !optimisticData || isPlaceholderData;
  const isLoadingContacts = isPlaceholderData && (!dataContacts || dataContacts.length === 0);
  const isLoadingPending = isPlaceholderData && (!dataPending || dataPending.length === 0);

  // FIX: siempre pasar handlers al DndContext, incluso en loading
  if (!optimisticData) {
    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <LoadingColumn color="blue" />
        <LoadingColumn color="green" />
        <LoadingColumn color="purple" />
        <LoadingContactsPanel />
      </DndContext>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {(optimisticData ?? []).map((col, idx) => {
        const patients = Array.isArray(col.patients) ? col.patients : [];
        const sorted = [...patients].sort((a, b) => Number(a.position) - Number(b.position));

        const pageSize = 5;
        const colCurrentPage = columnPages[col._id || ""] || 1;
        const colTotalPages = Math.ceil(sorted.length / pageSize);
        const startIndex = (colCurrentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedPatients = sorted.slice(startIndex, endIndex);

        // 🔧 Muy importante: items debe coincidir con lo que se renderiza
        const items = paginatedPatients.length > 0 ? paginatedPatients.map(d => d._id) : [`placeholder-${col._id}`];

        const isLast = idx === lastIndex;
        return (
          <Fade in key={col._id}>
            <Card
              minW="250px"
              flex="0 0 auto"
              minHeight="300px"
              height="500px"
              maxHeight="600px"
              border="1px solid #E2E8F0"
              borderRadius="md"
              position="relative"
              bg="gray.50"
              mr={4}
            >
              {isPlaceholderData && (
                <Box
                  position="absolute"
                  inset={0}
                  bg="whiteAlpha.700"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  zIndex={2}
                  pointerEvents="none"
                >
                  <Spinner thickness="3px" size="md" />
                </Box>
              )}

              <CardHeader>
                <Heading
                  size="sm"
                  mb={2}
                  bg={`${col.priorityColor}.100`}
                  p={3}
                  borderRadius="md"
                  width="fit-content"
                  display="flex"
                  alignItems="center"
                  gap={2}
                >
                  {col.priorityName}
                </Heading>
              </CardHeader>

              <CardBody
                p={3}
                w="100%"
                maxW="100vw"
                overflowY="auto"
                bg="white"
                h="100%"
                position="relative"
              >
                {isLoadingColumns ? (
                  <Stack spacing={3}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Box key={i} p={4} borderRadius={10} border="1px" borderColor="gray.50" boxShadow="md" bg="white">
                        <HStack mb={2}>
                          <SkeletonCircle size="4" />
                          <Skeleton height="14px" width="40%" />
                        </HStack>
                        <Skeleton height="18px" mb={2} />
                        <Skeleton height="14px" />
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <SortableContext items={items} strategy={verticalListSortingStrategy}>
                    {paginatedPatients.length > 0 ? (
                      paginatedPatients.map((item) => (
                        <SortableItem
                          key={item._id}
                          id={item._id}
                          color={col.priorityColor}
                          onClick={onCardClick}
                          item={item}
                        >
                          <Box position="relative">
                            <Box
                              position="absolute"
                              top="2"
                              right="2"
                              zIndex={2}
                              onClick={(e) => e.stopPropagation()}
                              onPointerDown={(e) => e.stopPropagation()}
                            >
                              <ArchiveItemButton id={item._id} modelName="Appointment" />
                            </Box>

                            <Grid templateColumns="1fr" templateRows="auto" w="100%">
                              <GridItem>
                                <HStack>
                                  <Icon as={TimeIcon} color="green" />
                                  <Text color="gray.500">
                                    {formatDateWS(item.selectedAppDates?.[0])}
                                  </Text>
                                </HStack>
                              </GridItem>
                              <GridItem>
                                <HStack>
                                  <Text fontWeight="bold">
                                    {item.nameInput} {item.lastNameInput}
                                  </Text>
                                  <Tooltip label={item.treatment?.name} placement="top" fontSize="sm" hasArrow >
                                    <Icon as={iconMap[item.treatment?.minIcon]} color={item.treatment?.color} fontSize="24px" />
                                  </Tooltip>

                                </HStack>
                              </GridItem>
                              <GridItem>
                                <HStack>
                                  <Tooltip
                                    label={
                                      item.selectedAppDates[0]?.status === "Pending"
                                        ? "Pending"
                                        : item.selectedAppDates[0]?.status === "Confirmed"
                                          ? "Confirmed"
                                          : item.selectedAppDates[0].status === 'Rejected'
                                            ? "Rejected"
                                            : "NoContacted"
                                    }
                                    placement="top"
                                    fontSize="sm"
                                    hasArrow
                                  >
                                    <Icon
                                      as={LiaSmsSolid}
                                      color={
                                        item.selectedAppDates[0].status === "Pending"
                                          ? "yellow.500"
                                          : item.selectedAppDates[0].status === "Confirmed"
                                            ? "green.500"
                                            : item.selectedAppDates[0].status === 'Rejected'
                                              ? "red.500"
                                              : "blackAlpha.400"
                                      }
                                    />
                                  </Tooltip>
                                  <Icon as={PhoneIcon} color="green" />
                                  <Text color="gray.500">
                                    {formatAusPhoneNumber(item.phoneInput)}
                                  </Text>

                                  {/* Botón para abrir Chat Modal */}
                                  <Tooltip label="Open chat" hasArrow>
                                    <IconButton
                                      aria-label="Open chat"
                                      icon={<FaCommentSms size={20} color='green'/>}
                                      size="sm"
                                      variant="ghost"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openChatForItem(item);
                                      }}
                                    />
                                  </Tooltip>
                                </HStack>
                              </GridItem>
                            </Grid></Box>
                        </SortableItem>
                      ))
                    ) : (
                      <SortableItem id={`placeholder-${col._id}`}>
                        <Box textAlign="center" color="gray.400" fontStyle="italic">
                          (Drop items here)
                        </Box>
                      </SortableItem>
                    )}
                  </SortableContext>
                )}
              </CardBody>

              <Box pr={4} pt={1} bg="transparent" zIndex={1}>
                {isPlaceholderData ? (
                  <Skeleton height="36px" width="140px" borderRadius="md" />
                ) : (
                  <AddPatientButton key={col._id} priority={col.priority} formProps={{ typeButonVisible: false }} />
                )}
              </Box>

              <CardFooter minH="50px" maxH="50px">
                {isPlaceholderData ? (
                  <HStack w="full" justify="center">
                    <Skeleton height="32px" width="80px" />
                    <Skeleton height="32px" width="80px" />
                    <Skeleton height="32px" width="80px" />
                  </HStack>
                ) : (
                  <Pagination
                    isPlaceholderData={isPlaceholderData}
                    totalPages={colTotalPages}
                    currentPage={colCurrentPage}
                    onPageChange={(page) => handlePageChange(col._id || "", page)}
                  />
                )}
              </CardFooter>
            </Card>

            {/* Marca tras el paint SOLO en el último col y cuando no hay skeleton */}
            {!isLoadingColumns && isLast && (
              <AfterPaint on={() => setLastColPainted(true)} />
            )}
          </Fade>
        );
      })}

      {/* Panel de Contacts */}
      {lastColPainted && (
        <Fade in>
          <Card
            minW="250px"
            flex="0 0 auto"
            minHeight="300px"
            height="500px"
            maxHeight="600px"
            border="1px solid #E2E8F0"
            borderRadius="md"
            position="relative"
            bg="gray.50"
            mr={4}
          >
            {isLoadingContacts && (
              <Box
                position="absolute"
                inset={0}
                bg="whiteAlpha.700"
                display="flex"
                alignItems="center"
                justifyContent="center"
                zIndex={2}
                pointerEvents="none"
              >
                <Spinner thickness="3px" size="md" />
              </Box>
            )}

            <CardHeader>
              <Heading
                size="sm"
                mb={2}
                bg={`red.100`}
                p={3}
                borderRadius="md"
                width="fit-content"
                display="flex"
                alignItems="center"
                gap={2}
              >
                {'Contacts'}
              </Heading>
            </CardHeader>

            <CardBody
              p={3}
              w="100%"
              maxW="100vw"
              overflowY="auto"
              bg="white"
              h="100%"
              position="relative"
            >
              {isPlaceholderData ? (
                <Skeleton height="38px" borderRadius="md" mb={3} />
              ) : (
                <SearchBar ref={searchRef} data={dataContacts || []} onFilter={setFilteredItems} who="contact" />
              )}

              {isPlaceholderData && currentItems.length === 0 ? (
                <Stack spacing={3}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Box key={i} p={4} borderRadius={10} border="1px" borderColor="gray.50" boxShadow="md" bg="white">
                      <HStack spacing={3} mb={2}>
                        <SkeletonCircle size="6" />
                        <Skeleton height="18px" width="60%" />
                      </HStack>
                      <SkeletonText noOfLines={2} spacing="2" />
                    </Box>
                  ))}
                </Stack>
              ) : (
                currentItems.length > 0 &&
                currentItems.map((item) => (
                  <Box
                    key={`${item._id}-box`}
                    userSelect="none"
                    p={4}
                    borderRadius={10}
                    border="1px"
                    borderColor="gray.50"
                    w="full"
                    my={2}
                    cursor="default"
                    boxShadow="md"
                    bg="white"
                    _hover={{ borderColor: 'black', cursor: 'pointer' }}
                  >
                    <Grid templateColumns="1fr" templateRows="auto" w="100%">
                      <GridItem />
                      <GridItem>
                        <HStack>
                          <Text fontWeight="bold">
                            {item.nameInput} {item.lastNameInput}
                          </Text>
                          <DeleteContactButton item={item} modelName="Appointment" />
                        </HStack>
                      </GridItem>
                      <GridItem>
                        <HStack>
                          <Icon as={PhoneIcon} color="green" />
                          <Text color="gray.500">
                            {formatAusPhoneNumber(item.phoneInput)}
                          </Text>
                        </HStack>
                      </GridItem>
                    </Grid>
                  </Box>
                ))
              )}
            </CardBody>

            <Box pr={4} pt={1} bg="transparent" zIndex={1}>
              {isPlaceholderData ? (
                <Skeleton height="36px" width="140px" borderRadius="md" />
              ) : (
                <AddPatientButton onlyPatient={true} label="New Contact" formProps={{ typeButonVisible: false }} />
              )}
            </Box>

            <CardFooter minH="50px" maxH="50px">
              {isPlaceholderData ? (
                <HStack w="full" justify="center">
                  <Skeleton height="32px" width="80px" />
                  <Skeleton height="32px" width="80px" />
                  <Skeleton height="32px" width="80px" />
                </HStack>
              ) : (
                <Pagination
                  isPlaceholderData={isPlaceholderData}
                  totalPages={totalPages}
                  currentPage={currentPage}
                  onPageChange={setCurrentPage}
                />
              )}
            </CardFooter>
          </Card>
        </Fade>
      )}

      {/* Panel de Pending Approvals */}
      {lastColPainted && (
        <Fade in >
          <Card
            minW="250px"
            flex="0 0 auto"
            minHeight="300px"
            height="500px"
            maxHeight="600px"
            border="1px solid #E2E8F0"
            borderRadius="md"
            position="relative"
            bg="gray.50"
            mr={4}
          >
            {isLoadingPending && (
              <Box
                position="absolute"
                inset={0}
                bg="whiteAlpha.700"
                display="flex"
                alignItems="center"
                justifyContent="center"
                zIndex={2}
                pointerEvents="none"
              >
                <Spinner thickness="3px" size="md" />
              </Box>
            )}

            <CardHeader>
              <Heading
                size="sm"
                mb={2}
                bg={`green.100`}
                p={3}
                borderRadius="md"
                width="fit-content"
                display="flex"
                alignItems="center"
                gap={2}
              >
                {'Pending Approvals'}
              </Heading>
            </CardHeader>

            <CardBody
              p={3}
              w="100%"
              maxW="100vw"
              overflowY="auto"
              bg="white"
              h="100%"
              position="relative"
            >
              {isPlaceholderData ? (
                <Skeleton height="38px" borderRadius="md" mb={3} />
              ) : (
                <SearchBar ref={searchRef} data={dataPending || []} onFilter={setFilteredPending} who="contact" />
              )}

              {isPlaceholderData && currentPending.length === 0 ? (
                <Stack spacing={3}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Box key={i} p={4} borderRadius={10} border="1px" borderColor="gray.50" boxShadow="md" bg="white" >
                      <HStack spacing={3} mb={2}>
                        <SkeletonCircle size="6" />
                        <Skeleton height="18px" width="60%" />
                      </HStack>
                      <SkeletonText noOfLines={2} spacing="2" />
                    </Box>
                  ))}
                </Stack>
              ) : (
                currentPending.length > 0 &&
                currentPending.map((item) => (
                  <Box
                    onClick={() => onCardClick?.(item)}
                    key={`${item._id}-box`}
                    userSelect="none"
                    p={4}
                    borderRadius={10}
                    border="1px"
                    borderColor="gray.50"
                    w="full"
                    my={2}
                    cursor="default"
                    boxShadow="md"
                    bg="white"
                    _hover={{ borderColor: 'black', cursor: 'pointer' }}
                  >
                    <Grid templateColumns="1fr" templateRows="auto" w="100%">
                      <GridItem />
                      <GridItem>
                        <HStack>
                          <Text fontWeight="bold">
                            {item.nameInput} {item.lastNameInput}
                          </Text>

                        </HStack>
                      </GridItem>
                      <GridItem>
                        <HStack>
                          <Icon as={PhoneIcon} color="green" />
                          <Text color="gray.500">
                            {formatAusPhoneNumber(item.phoneInput)}
                          </Text>
                        </HStack>
                      </GridItem>
                    </Grid>
                  </Box>
                ))
              )}
            </CardBody>

            <CardFooter minH="50px" maxH="50px">
              {isPlaceholderData ? (
                <HStack w="full" justify="center">
                  <Skeleton height="32px" width="80px" />
                  <Skeleton height="32px" width="80px" />
                  <Skeleton height="32px" width="80px" />
                </HStack>
              ) : (
                <Pagination
                  isPlaceholderData={isPlaceholderData}
                  totalPages={totalPagesPending}
                  currentPage={currentPagePending}
                  onPageChange={setCurrentPagePending}
                />
              )}
            </CardFooter>
          </Card>
        </Fade>
      )}

      {/* === Modal global del chat === */}
      {shouldMountChat && isChatOpen && (
        <Suspense
          fallback={
            <Box position="fixed" inset={0} bg="blackAlpha.600" display="flex" alignItems="center" justifyContent="center" zIndex={2000}>
              <Spinner size="xl" thickness="4px" />
            </Box>
          }
        >
          <ChatWindowModalLazy
            onOpen={onChatOpen}
            isOpen={isChatOpen}
            onClose={() => { onChatClose(); setShouldMountChat(false); }}
            trigger={<IconButton aria-label="Open chat" icon={<FaCommentSms  />} variant="ghost" />}
            initial={{ appId: chatToOpen?.owner._id }}
            contact={chatToOpen}
          />
        </Suspense>
      )}

      <DragOverlay>
        {activeItem && (
          <Box
            p={4}
            borderRadius={10}
            border="1px"
            borderColor="gray.200"
            w="250px"
            boxShadow="lg"
            bg="white"
          >
            <Grid templateColumns="1fr" templateRows="auto" w="100%">
              <GridItem>
                <HStack>
                  <Icon as={TimeIcon} color="green" />
                  <Text color="gray.500">
                    {formatDateWS(activeItem.selectedAppDates?.[0])}
                  </Text>
                </HStack>
              </GridItem>
              <GridItem>
                <Text fontWeight="bold">
                  {activeItem.nameInput} {activeItem.lastNameInput}
                </Text>
              </GridItem>
              <GridItem>
                <HStack>
                  <Icon as={PhoneIcon} color="green" />
                  <Text color="gray.500">
                    {formatAusPhoneNumber(activeItem.phoneInput)}
                  </Text>
                </HStack>
              </GridItem>
            </Grid>
          </Box>
        )}
      </DragOverlay>
    </DndContext>
  );
}
