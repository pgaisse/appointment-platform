import { formatDateWS } from '@/Functions/FormatDateWS';
import { formatAusPhoneNumber } from '@/Functions/formatAusPhoneNumber';
import { PhoneIcon, TimeIcon } from '@chakra-ui/icons';
import { LiaSmsSolid } from 'react-icons/lia';
import {
  Box,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
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
  Grid,
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
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Appointment, GroupedAppointment } from '@/types';
import { UpdatePayload, useUpdateItems } from '@/Hooks/Query/useUpdateItems';
import { useQueryClient } from '@tanstack/react-query';
import { iconMap } from '../CustomIcons';
import Pagination from '../Pagination';
import AddPatientButton from '../DraggableCards/AddPatientButton';
import DeleteItemButton from './DeleteItemButton';
import SearchBar, { SearchBarRef } from '../searchBar';
import ArchiveItemButton from './ArchiveItemButton';
import DeleteContactButton from './DeleteContactButton';

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
const LoadingColumn: React.FC<{ title?: string; color?: string }> = ({ title = 'Loading…', color = 'gray' }) => (
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
    opacity: isDragging ? 0.4 : 1,
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

// ---------- Util: mover items ----------
function moveItem(
  data: GroupedAppointment[],
  itemId: string,
  fromColumnId: string,
  toColumnId: string,
  toIndex: number
): GroupedAppointment[] {
  const newData = data.map(col => ({ ...col, patients: [...(col.patients || [])] }));
  const sourceCol = newData.find(col => col._id === fromColumnId);
  const destCol = newData.find(col => col._id === toColumnId);
  if (!sourceCol || !destCol) {
    console.warn('⚠️ moveItem: columna origen o destino no encontrada');
    return data;
  }
  const currentIndex = sourceCol.patients.findIndex(p => p._id === itemId);
  if (currentIndex === -1) {
    console.warn('⚠️ moveItem: item no encontrado en columna origen');
    return data;
  }
  const [item] = sourceCol.patients.splice(currentIndex, 1);

  if (fromColumnId === toColumnId) {
    sourceCol.patients.splice(toIndex, 0, item);
    sourceCol.patients = sourceCol.patients.map((p, idx) => ({ ...p, position: idx }));
  } else {
    destCol.patients.splice(toIndex, 0, item);
    sourceCol.patients = sourceCol.patients.map((p, idx) => ({ ...p, position: idx }));
    destCol.patients = destCol.patients.map((p, idx) => ({ ...p, position: idx }));
  }
  return newData;
}

export default function DraggableColumns({ onCardClick, dataAP2, dataContacts, isPlaceholderData, dataPending }: Props) {
  const toast = useToast();
  const searchRef = useRef<SearchBarRef>(null);
  const { mutate } = useUpdateItems();
  const [activeItem, setActiveItem] = useState<Appointment | null>(null);
  const [optimisticData, setOptimisticData] = useState<GroupedAppointment[] | null>(null);
  const [sourceCol, setSourceCol] = useState<GroupedAppointment | undefined>();
  const [columnPages, setColumnPages] = useState<Record<string, number>>({});
  const queryClient = useQueryClient();

  // snapshot para revertir en error
  const prevSnapshotRef = useRef<GroupedAppointment[] | null>(null);

  // 👉 bandera de “último col pintado”
  const [lastColPainted, setLastColPainted] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

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
    const id = String(active.id);
    if (!dataAP2) return;

    const item = dataAP2.flatMap(col => col.patients || []).find(p => p._id === id) ?? null;
    setActiveItem(item);

    const originCol = dataAP2.find(col => (col.patients || []).some(p => p._id === id));
    setSourceCol(originCol);

    if (!optimisticData) setOptimisticData(dataAP2);

    // snapshot pre-move
    prevSnapshotRef.current = optimisticData ? JSON.parse(JSON.stringify(optimisticData)) : (dataAP2 ? JSON.parse(JSON.stringify(dataAP2)) : null);
  }, [dataAP2, optimisticData]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !optimisticData || !sourceCol) {
      setActiveItem(null);
      setSourceCol(undefined);
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);

    const destinationCol =
      optimisticData.find(col => (col.patients || []).some(p => p._id === overId)) ||
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

    // índice de drop relativo al arreglo completo del destino
    const overIndex = (destinationCol.patients || []).findIndex(p => p._id === overId);
    const toIndex = overIndex === -1 ? (destinationCol.patients?.length || 0) : overIndex;

    // snapshot antes de mover para calcular deltas
    const beforeData = prevSnapshotRef.current ?? optimisticData;
    const beforeSource = beforeData.find(c => c._id === fromId);
    const beforeDest = beforeData.find(c => c._id === toId);

    // aplicar movimiento en memoria
    const updatedData = moveItem(optimisticData, activeId, fromId, toId, toIndex);

    // construir payload SOLO con cambios reales (position / priority)
    const payload: UpdatePayload[] = [];
    const updatedSource = updatedData.find(col => col._id === fromId);
    const updatedDest = updatedData.find(col => col._id === toId);

    const pushDeltas = (
      beforeCol: GroupedAppointment | undefined,
      afterCol: GroupedAppointment | undefined
    ) => {
      if (!afterCol) return;
      const beforeMap = new Map<string, { position?: number; priority?: any }>(
        (beforeCol?.patients || []).map(p => [p._id, { position: Number(p.position ?? 0), priority: beforeCol?.priority }])
      );

      (afterCol.patients || []).forEach((p, idx) => {
        const prev = beforeMap.get(p._id) || { position: Number(p.position ?? 0), priority: beforeCol?.priority };
        const nextPosition = idx;
        const nextPriority = afterCol.priority; // ✅ usar la CLAVE de prioridad real, NO el _id del grupo

        const positionChanged = Number(prev.position ?? 0) !== nextPosition;
        const priorityChanged = prev.priority !== nextPriority;

        if (positionChanged || priorityChanged) {
          payload.push({
            table: 'Appointment',
            id_field: '_id',
            id_value: p._id,
            data: {
              ...(positionChanged ? { position: nextPosition } : {}),
              ...(priorityChanged ? { priority: nextPriority } : {}),
            },
          });
        }
      });
    };

    // deltas en source y dest
    pushDeltas(beforeSource, updatedSource);
    if (toId !== fromId) {
      pushDeltas(beforeDest, updatedDest);
    }

    // actualizar UI optimista
    queryClient.setQueryData(['DraggableCards'], updatedData);
    setOptimisticData(updatedData);

    // si no hay cambios reales, no golpeamos backend
    if (payload.length === 0) {
      setSourceCol(undefined);
      setActiveItem(null);
      return;
    }

    mutate(payload, {
      onSuccess: (response: any) => {
        const failed = response?.results?.filter((r: { status: string }) => r.status === 'failed') || [];
        if (failed.length > 0) {
          // revertir sólo los que fallaron
          const failedIds = new Set(failed.map((f: any) => f.id_value || f.id || f._id));
          const revert = prevSnapshotRef.current;
          if (revert) {
            // reconstruimos tomando del snapshot previo los afectados
            const repaired = updatedData.map(col => ({
              ...col,
              patients: col.patients.map(p => (failedIds.has(p._id)
                ? (revert.find(rc => rc._id === col._id)?.patients.find(rp => rp._id === p._id) ?? p)
                : p)),
            }));
            setOptimisticData(repaired);
            queryClient.setQueryData(['DraggableCards'], repaired);
          }
          toast({
            title: 'Some updates failed',
            description: `${failed.length} cambios no se aplicaron.`,
            status: 'warning',
            duration: 5000,
            isClosable: true,
          });
        } else {
          toast({
            title: 'Update successful',
            description: 'All changes have been saved.',
            status: 'success',
            duration: 2000,
            isClosable: true,
          });
        }
      },
      onSettled: () => {
        setSourceCol(undefined);
        setActiveItem(null);
        prevSnapshotRef.current = null;
      },
      onError: (error: any) => {
        console.error('❌ Mutate error:', error);
        // revert total
        const snap = prevSnapshotRef.current;
        if (snap) {
          setOptimisticData(snap);
          queryClient.setQueryData(['DraggableCards'], snap);
        }
        toast({
          title: 'Error al mover cita',
          description: error?.message || 'No se pudo guardar el reordenamiento.',
          status: 'error',
          duration: 2500,
          isClosable: true,
        });
      },
    });
  }, [optimisticData, sourceCol, queryClient, mutate, toast]);

  const handleDragCancel = useCallback(() => {
    // revert si hay snapshot
    const snap = prevSnapshotRef.current;
    if (snap) {
      setOptimisticData(snap);
      queryClient.setQueryData(['DraggableCards'], snap);
    }
    setActiveItem(null);
    setSourceCol(undefined);
    prevSnapshotRef.current = null;
  }, [queryClient]);

  const handlePageChange = (colId: string, page: number) => {
    setColumnPages((prev) => ({ ...prev, [colId]: page }));
  };

  const pageSizeGlobal = 10;
  const [filteredItems, setFilteredItems] = useState<Appointment[] | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const start = (currentPage - 1) * pageSizeGlobal;
  const end = start + pageSizeGlobal;
  const paginatedSource = filteredItems ?? dataContacts;
  const currentItems = paginatedSource ? paginatedSource.slice(start, end) : [];
  const totalPages = paginatedSource ? Math.ceil(paginatedSource.length / pageSizeGlobal) : 0;

  const [filteredPending, setFilteredPending] = useState<Appointment[] | null>(null);
  const [currentPagePending, setCurrentPagePending] = useState(1);
  const startPending = (currentPagePending - 1) * pageSizeGlobal;
  const endPending = startPending + pageSizeGlobal;
  const paginatedPending = filteredPending ?? dataPending;
  const currentPending = paginatedPending ? paginatedPending.slice(startPending, endPending) : [];
  const totalPagesPending = paginatedPending ? Math.ceil(paginatedPending.length / pageSizeGlobal) : 0;

  // --------- Estados de carga visual ----------
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
        const sorted = [...patients].sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0));

        const pageSize = 5;
        const colCurrentPage = columnPages[col._id || ''] || 1;
        const colTotalPages = Math.ceil(sorted.length / pageSize);
        const startIndex = (colCurrentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedPatients = sorted.slice(startIndex, endIndex);

        // ✅ Dnd-kit: los items deben coincidir con los hijos renderizados
        const items = paginatedPatients.length > 0
          ? paginatedPatients.map(d => d._id)
          : [`placeholder-${col._id}`];

        const isLast = idx === (optimisticData.length - 1);

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
                          <Grid templateColumns="1fr" templateRows="auto" w="100%">
                            <div />
                            <div>
                              <HStack>
                                <Icon as={TimeIcon} color="green" />
                                <Text color="gray.500">
                                  {formatDateWS(item.selectedAppDates?.[0])}
                                </Text>
                              </HStack>
                            </div>
                            <div>
                              <HStack>
                                <Text fontWeight="bold">
                                  {item.nameInput} {item.lastNameInput}
                                </Text>
                                <Tooltip label={item.treatment?.name} placement="top" fontSize="sm" hasArrow >
                                  <Icon as={iconMap[item.treatment?.minIcon as keyof typeof iconMap]} color={item.treatment?.color} fontSize="24px" />
                                </Tooltip>
                                <ArchiveItemButton id={item._id} modelName="Appointment" />
                              </HStack>
                            </div>
                            <div>
                              <HStack>
                                <Tooltip
                                  label={
                                    item.selectedAppDates?.[0]?.status === 'Pending'
                                      ? 'Pending'
                                      : item.selectedAppDates?.[0]?.status === 'Confirmed'
                                      ? 'Confirmed'
                                      : item.selectedAppDates?.[0]?.status === 'Rejected'
                                      ? 'Rejected'
                                      : 'NoContacted'
                                  }
                                  placement="top"
                                  fontSize="sm"
                                  hasArrow
                                >
                                  <Icon
                                    as={LiaSmsSolid}
                                    color={
                                      item.selectedAppDates?.[0]?.status === 'Pending'
                                        ? 'yellow.500'
                                        : item.selectedAppDates?.[0]?.status === 'Confirmed'
                                        ? 'green.500'
                                        : item.selectedAppDates?.[0]?.status === 'Rejected'
                                        ? 'red.500'
                                        : 'blackAlpha.400'
                                    }
                                  />
                                </Tooltip>
                                <Icon as={PhoneIcon} color="green" />
                                <Text color="gray.500">
                                  {formatAusPhoneNumber(item.phoneInput)}
                                </Text>
                              </HStack>
                            </div>
                          </Grid>
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
                    onPageChange={(page) => handlePageChange(col._id || '', page)}
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

      {/* Contacts */}
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
                      <div />
                      <div>
                        <HStack>
                          <Text fontWeight="bold">
                            {item.nameInput} {item.lastNameInput}
                          </Text>
                          <DeleteContactButton item={item} modelName="Appointment" />
                        </HStack>
                      </div>
                      <div>
                        <HStack>
                          <Icon as={PhoneIcon} color="green" />
                          <Text color="gray.500">
                            {formatAusPhoneNumber(item.phoneInput)}
                          </Text>
                        </HStack>
                      </div>
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

      {/* Pending Approvals */}
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
                      <div />
                      <div>
                        <HStack>
                          <Text fontWeight="bold">
                            {item.nameInput} {item.lastNameInput}
                          </Text>
                        </HStack>
                      </div>
                      <div>
                        <HStack>
                          <Icon as={PhoneIcon} color="green" />
                          <Text color="gray.500">
                            {formatAusPhoneNumber(item.phoneInput)}
                          </Text>
                        </HStack>
                      </div>
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
              <div>
                <HStack>
                  <Icon as={TimeIcon} color="green" />
                  <Text color="gray.500">
                    {formatDateWS(activeItem.selectedAppDates?.[0])}
                  </Text>
                </HStack>
              </div>
              <div>
                <Text fontWeight="bold">
                  {activeItem.nameInput} {activeItem.lastNameInput}
                </Text>
              </div>
              <div>
                <HStack>
                  <Icon as={PhoneIcon} color="green" />
                  <Text color="gray.500">
                    {formatAusPhoneNumber(activeItem.phoneInput)}
                  </Text>
                </HStack>
              </div>
            </Grid>
          </Box>
        )}
      </DragOverlay>
    </DndContext>
  );
}
