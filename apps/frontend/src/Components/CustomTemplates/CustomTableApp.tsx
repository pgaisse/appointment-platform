import {
  Box, Table, Thead, Tbody, Tr, Th, Td, Text, Tag, IconButton, HStack, TableContainer,
  Button, Spinner, AlertDialog, AlertDialogBody, AlertDialogContent, AlertDialogFooter,
  AlertDialogHeader, AlertDialogOverlay, Icon, Tooltip, useDisclosure
} from "@chakra-ui/react";
import { EditIcon } from "@chakra-ui/icons";
import { ImBin } from "react-icons/im";
import { useRef, useState } from "react";
import { formatDateWS } from "@/Functions/FormatDateWS";
import { formatAusPhoneNumber } from "@/Functions/formatAusPhoneNumber";
import { formatDateSingle } from "@/Functions/FormatDateSingle";
import { useDeleteItem } from "@/Hooks/Query/useDeleteItem";
import { useGetCollection } from "@/Hooks/Query/useGetCollection";
import { Appointment, TimeBlock, WeekDay } from "@/types";
import AvailabilityDates2 from "./AvailabilityDates2";
import Pagination from "../Pagination";
import { iconMap } from "../CustomIcons";
import SearchBar, { SearchBarRef } from "../searchBar";
import { useQueryClient } from "@tanstack/react-query";
import { useTriggerEndpoint } from "@/Hooks/Query/useTriggerEndpoint";
import { useAppointmentEditor } from "@/Hooks/Handles/useAppointmentEditor";
import { useInfoModal } from "@/Hooks/Handles/useInfoModal";

interface Query { pageSize?: number; }

function CustomTableApp({ pageSize }: Query) {
  const query = {};
  const populateFields = [
    { path: "priority", select: "id description notes durationHours name color" },
    { path: "treatment", select: "_id name notes duration icon color minIcon" },
    { path: "selectedDates.days.timeBlocks" }
  ] as const;
  const limit = 200;

  const { data, isLoading, isPlaceholderData, refetch } =
    useGetCollection<Appointment>("Appointment", { query, limit, populate: populateFields });

  const queryClient = useQueryClient();
  const [filteredItems, setFilteredItems] = useState<Appointment[] | null>(null);
  const searchRef = useRef<SearchBarRef>(null);

  const trigger = useTriggerEndpoint("/cleanup-twilio");

  // ✅ edición reutilizable (compacta)
  const { openEditor, AppointmentEditor } = useAppointmentEditor({
    titlePrefix: "Edit Patient",
    onSaved: () => {
      refetch?.();
      queryClient.invalidateQueries({ queryKey: ["Appointment"] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  // ✅ modal de info (nota/fechas) compacto/reutilizable
  const { openInfo, InfoModal } = useInfoModal("Details");

  // 🔴 borrar
  const deleteDisclosure = useDisclosure();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [itemToDelete, setItemToDelete] = useState<string>("");
  const { deleteById } = useDeleteItem({ modelName: "Appointment", refetch });

  const confirmDelete = (id: string) => { setItemToDelete(id); deleteDisclosure.onOpen(); };
  const handleDelete = () => {
    if (deleteById && itemToDelete) deleteById(itemToDelete);
    searchRef.current?.clearInput();
    queryClient.invalidateQueries({ queryKey: ["Appointment"] });
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
    setFilteredItems(null);
    trigger.mutate(); // no esperamos respuesta
    deleteDisclosure.onClose();
  };

  // 📄 paginación
  const [currentPage, setCurrentPage] = useState(1);
  const start = (currentPage - 1) * (pageSize || 0);
  const end = start + (pageSize || 0);
  const source = filteredItems ?? data ?? [];
  const currentItems = pageSize ? source.slice(start, end) : source;
  const totalPages = pageSize ? Math.ceil(source.length / (pageSize || 1)) : 1;

  if (isLoading) {
    return (
      <Box textAlign="center" py={10}>
        <Spinner size="xl" />
        <Text mt={4}>Cargando...</Text>
      </Box>
    );
  }

  return (
    <>
      <Box fontSize="sm" borderWidth="1px" rounded="lg" shadow="md" p={4} bg="white">
        <SearchBar ref={searchRef} data={data || []} onFilter={setFilteredItems} />

        <TableContainer>
          <Table variant="simple" size="md">
            <Thead bg="gray.100">
              <Tr>
                <Th>Name</Th>
                <Th>Availability</Th>
                <Th>Note</Th>
                <Th>Appointment</Th>
                <Th>Priority/Treatment</Th>
                <Th>Phone</Th>
                <Th textAlign="center">Actions</Th>
              </Tr>
            </Thead>

            <Tbody>
              {currentItems.map((item) => (
                <Tr key={item._id} _hover={{ bg: "gray.50" }}>
                  {/* name */}
                  <Td>
                    <HStack spacing={3}>
                      <Tag
                        size="lg"
                        borderRadius="full"
                        colorScheme={item.priority?.color || "gray"}
                        variant="solid"
                        w="36px"
                        h="36px"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        fontWeight="bold"
                      >
                        {`${item.nameInput?.[0] || ""}${item.lastNameInput?.[0] || ""}`.toUpperCase()}
                      </Tag>
                      <Box>
                        <Text fontWeight="semibold">{item.nameInput}</Text>
                        <Text fontSize="sm" color="gray.500">{item.lastNameInput}</Text>
                      </Box>
                    </HStack>
                  </Td>

                  {/* availability */}
                  <Td>
                    <Button
                      size="xs"
                      onClick={() => {
                        const days = Array.isArray(item.selectedDates?.days)
                          ? item.selectedDates.days.reduce((acc, curr) => {
                              acc[curr.weekDay] = curr.timeBlocks;
                              return acc;
                            }, {} as Partial<Record<WeekDay, TimeBlock[]>>)
                          : {};
                        openInfo(
                          <>
                            <AvailabilityDates2
                              modeInput={false}
                              selectedDaysResp={days}
                              setSelectedDaysResp={() => {}}
                            />
                            <Text fontSize="sm" mt={2}>
                              Start: {item.selectedDates?.startDate ? formatDateSingle(item.selectedDates.startDate) : "No start date"}
                            </Text>
                            <Text fontSize="sm" mt={1}>
                              End: {item.selectedDates?.endDate ? formatDateSingle(item.selectedDates.endDate) : "No end date"}
                            </Text>
                          </>
                        );
                      }}
                    >
                      Show Dates
                    </Button>
                  </Td>

                  {/* note */}
                  <Td>
                    <Button size="xs" onClick={() => openInfo(<Text>{item.note || "No note available"}</Text>)}>
                      Note
                    </Button>
                  </Td>

                  {/* appointment */}
                  <Td>
                    <Text>{item.selectedAppDates?.[0] ? formatDateWS(item.selectedAppDates[0]) : "No appointment"}</Text>
                  </Td>

                  {/* priority/treatment */}
                  <Td>
                    <Tag colorScheme={item.priority?.color || "gray.200"} mr={1}>
                      {item.priority?.name || "No Assigned"}
                    </Tag>
                    <Tooltip label={item.treatment?.name} placement="top" fontSize="sm" hasArrow>
                      <Icon as={iconMap[item.treatment?.minIcon]} color={`${item.treatment?.color}.500`} fontSize="24px" />
                    </Tooltip>
                  </Td>

                  {/* phone */}
                  <Td>
                    <Text>{formatAusPhoneNumber(item.phoneInput)}</Text>
                  </Td>

                  {/* actions */}
                  <Td textAlign="center">
                    <HStack spacing={2} justify="center">
                      <IconButton
                        aria-label="Edit"
                        icon={<EditIcon />}
                        size="sm"
                        variant="ghost"
                        colorScheme="blue"
                        onClick={() => openEditor(item)}
                      />
                      <IconButton
                        aria-label="Delete"
                        icon={<ImBin />}
                        size="sm"
                        variant="ghost"
                        colorScheme="red"
                        onClick={() => confirmDelete(item._id)}
                      />
                    </HStack>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableContainer>
      </Box>

      <Box mt={4}>
        <Pagination
          isPlaceholderData={isPlaceholderData}
          totalPages={totalPages}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
        />
      </Box>

      {/* modales reutilizables */}
      <AppointmentEditor />
      <InfoModal />

      {/* confirmación borrar */}
      <AlertDialog isOpen={deleteDisclosure.isOpen} leastDestructiveRef={cancelRef} onClose={deleteDisclosure.onClose}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">Confirm Deletion</AlertDialogHeader>
            <AlertDialogBody>Are you sure? This action cannot be undone.</AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={deleteDisclosure.onClose}>Cancel</Button>
              <Button colorScheme="red" onClick={handleDelete} ml={3}>Delete</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
}

export default CustomTableApp;
