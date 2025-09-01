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
import React, { useEffect, useRef, useState } from 'react';
import { Appointment, GroupedAppointment } from '@/types';
import { UpdatePayload, useUpdateItems } from '@/Hooks/Query/useUpdateItems';
import { useQueryClient } from '@tanstack/react-query';
import { iconMap } from '../CustomIcons';
import Pagination from '../Pagination';
import AddPatientButton from '../DraggableCards/AddPatientButton';
import DeleteItemButton from './DeleteItemButton';
import SearchBar, { SearchBarRef } from '../searchBar';

type Props = {
  onCardClick?: (item: Appointment) => void;
  dataAP2: GroupedAppointment[] | undefined
  dataContacts: Appointment[]
  isPlaceholderData: boolean
};

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

// Función para mover item entre columnas actualizando posiciones
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
    // Movimiento dentro de la misma columna
    const newPatients = [...sourceCol.patients];
    // Eliminar item
    const currentIndex = newPatients.findIndex(p => p._id === itemId);
    if (currentIndex === -1) {
      console.warn('⚠️ moveItem: item no encontrado en lista de pacientes de la columna');
      return data;
    }
    newPatients.splice(currentIndex, 1);
    // Insertar item en la nueva posición
    newPatients.splice(toIndex, 0, item);

    // Recalcular posiciones
    sourceCol.patients = newPatients.map((p, idx) => ({ ...p, position: idx }));

  } else {
    // Movimiento entre columnas diferentes
    // Eliminar de columna origen
    sourceCol.patients = sourceCol.patients.filter(p => p._id !== itemId);

    // Insertar en columna destino
    const newPatients = [...destCol.patients];
    newPatients.splice(toIndex, 0, item);

    // Recalcular posiciones en destino
    destCol.patients = newPatients.map((p, idx) => ({ ...p, position: idx }));

  }

  return newData;
}


export default function DraggableColumns({ onCardClick, dataAP2, dataContacts, isPlaceholderData }: Props) {
  const toast = useToast();

  const searchRef = useRef<SearchBarRef>(null);
  const { mutate } = useUpdateItems();
  const [activeItem, setActiveItem] = useState<Appointment | null>(null);
  const [optimisticData, setOptimisticData] = useState<GroupedAppointment[] | null>(null);
  const [sourceCol, setSourceCol] = useState<GroupedAppointment | undefined>();
  const [columnPages, setColumnPages] = useState<Record<string, number>>({});
  const queryClient = useQueryClient();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );


  // Inicializar optimisticData con data de la query
  useEffect(() => {
    setOptimisticData(dataAP2 ?? null);
  }, [dataAP2]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const id = active.id as string;

    if (!dataAP2) return;

    const item = dataAP2.flatMap(col => col.patients).find(p => p._id === id) ?? null;
    setActiveItem(item);

    const originCol = dataAP2.find(col =>
      col.patients.some(p => p._id === id)
    );
    setSourceCol(originCol);

    if (!optimisticData) {
      setOptimisticData(dataAP2);
    }

  };

  const handleDragCancel = () => {
    setActiveItem(null);
    setSourceCol(undefined);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;


    if (!over || active.id === over.id || !optimisticData || !sourceCol) {
      setActiveItem(null);
      setSourceCol(undefined);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    const destinationCol = optimisticData.find(col =>
      col.patients.some(p => p._id === overId)
    ) || optimisticData.find(col => `placeholder-${col._id}` === overId);

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


    const updatedData = moveItem(optimisticData, activeId, fromId, toId, index);



    setOptimisticData(updatedData);

    // Generar payload para backend
    const updatedSource = updatedData.find(col => col._id === fromId);
    const updatedDest = updatedData.find(col => col._id === toId);

    const payload: UpdatePayload[] = [];

    if (updatedSource) {
      updatedSource.patients.forEach((p, i) => {
        payload.push({
          table: 'Appointment',
          id_field: '_id',
          id_value: p._id,
          data: {
            position: i,
            priority: updatedSource._id,
          },
        });
      });
    }

    if (updatedDest && updatedDest._id !== fromId) {
      updatedDest.patients.forEach((p, i) => {
        payload.push({
          table: 'Appointment',
          id_field: '_id',
          id_value: p._id,
          data: {
            position: i,
            priority: updatedDest._id,
          },
        });
      });
    }


    // Actualizar cache local para renderizar inmediatamente
    queryClient.setQueryData(['DraggableCards'], updatedData);
    setOptimisticData(updatedData);

    // Persistencia backend (opcional, si quieres probar sin backend comenta mutate)
    mutate(payload, {
      onSuccess: (response) => {
        const failed = response.results?.filter((r: { status: string; }) => r.status === "failed");
        if (failed.length > 0) {
          toast({
            title: "Some updates failed",
            description: `${failed.length} updates could not be applied.`,
            status: "warning",
            duration: 5000,
            isClosable: true,
          });
        } else {
          toast({
            title: "Update successful",
            description: "All changes have been saved.",
            status: "success",
            duration: 3000,
            isClosable: true,
          });
        }

      },
      onSettled: () => {
        setSourceCol(undefined);
        setActiveItem(null);
      },
      onError: (error) => {
        console.error('❌ Mutate error:', error);
        toast({
          title: 'Error al mover cita',
          description: error.message,
          status: 'error',
          duration: 2000,
          isClosable: true,
        });
        queryClient.invalidateQueries({ queryKey: ['DraggableCards'] });
        setOptimisticData(null);
      },
    });
  };

  const handlePageChange = (colId: string, page: number) => {
    setColumnPages((prev) => ({
      ...prev,
      [colId]: page,
    }));
  };

  const pageSize = 10
  const [filteredItems, setFilteredItems] = useState<Appointment[] | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const start = (currentPage - 1) * (pageSize ? pageSize : 0);
  const end = start + (pageSize ? pageSize : 0);
  const paginatedSource = filteredItems ?? dataContacts;
  const currentItems = paginatedSource ? paginatedSource.slice(start, end) : [];
  const totalPages = paginatedSource ? Math.ceil(paginatedSource.length / (pageSize || 1)) : 0;


  if (!optimisticData) return
  <>
    <Box textAlign="center" py={10}>
      <Spinner size="xl" />
      <Text mt={4}>Cargando...</Text>
    </Box>;
  </>
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {(optimisticData ?? []).map((col) => {
        const patients = Array.isArray(col.patients) ? col.patients : [];
        const sorted = [...patients].sort((a, b) => Number(a.position) - Number(b.position));

        const pageSize = 5;
        const currentPage = columnPages[col._id || ""] || 1;
        const totalPages = Math.ceil(sorted.length / pageSize);
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedPatients = sorted.slice(startIndex, endIndex);
        const items = sorted.length > 0
          ? sorted.map(d => d._id)
          : [`placeholder-${col._id}`];

        return (

          <Card
            key={col._id}
            minW="250px"
            flex="0 0 auto"
            minHeight="300px"
            maxHeight="600px"
            border="1px solid #E2E8F0"
            borderRadius="md"
            position={"relative"}
            bg="gray.50"
            mr={4}
          >
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
              h="100%"         // 👈 ocupa siempre el 100% de alto disponible
              position="relative"
            >

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

                            <DeleteItemButton
                              id={item._id}
                              modelName="Appointment"
                            />

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

            </CardBody>
            <Box
              pr={4}
              pt={1}
              alignContent={"end"}
              bg="transparent"
              zIndex={1}   // 👈 asegura que quede encima del contenido
            >
              <AddPatientButton key={col._id} priority={col.priority}  formProps={{typeButonVisible:false}} />
            </Box>
            <CardFooter minH="50px"
              maxH="50px">

              <Pagination
                isPlaceholderData={isPlaceholderData}
                totalPages={totalPages}
                currentPage={currentPage}
                onPageChange={(page) => handlePageChange(col._id || "", page)}
              />

            </CardFooter>
          </Card>
        );
      })}

      <Card
        minW="250px"
        flex="0 0 auto"
        minHeight="300px"
        maxHeight="600px"
        border="1px solid #E2E8F0"
        borderRadius="md"
        position={"relative"}
        bg="gray.50"
        mr={4}
      >
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
            {"Contacts"}
          </Heading>
        </CardHeader>

        <CardBody
          p={3}
          w="100%"
          maxW="100vw"
          overflowY="auto"
          bg="white"
          h="100%"         // 👈 ocupa siempre el 100% de alto disponible
          position="relative"
        >
          <SearchBar ref={searchRef} data={dataContacts || []} onFilter={setFilteredItems} who='contact' />


          {currentItems.length > 0 &&
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
                _hover={{ borderColor: "black", cursor: "pointer" }}

              >

                <Grid templateColumns="1fr" templateRows="auto" w="100%">

                  <GridItem>

                  </GridItem>
                  <GridItem>
                    <HStack>
                      <Text fontWeight="bold">
                        {item.nameInput} {item.lastNameInput}
                      </Text>


                      <DeleteItemButton
                        id={item._id}
                        modelName="Appointment"
                      />

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
          }


        </CardBody>

        <Box
          pr={4}
          pt={1}
          alignContent={"end"}
          bg="transparent"
          zIndex={1}   // 👈 asegura que quede encima del contenido
        >          
            <AddPatientButton onlyPatient={true} label='New Contact'formProps={{typeButonVisible:false}} />
          
        </Box>

        <CardFooter minH="50px"
          maxH="50px">



          <Pagination isPlaceholderData={isPlaceholderData} totalPages={totalPages} currentPage={currentPage} onPageChange={setCurrentPage} />


        </CardFooter>
      </Card>


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
    </DndContext >
  );
}
