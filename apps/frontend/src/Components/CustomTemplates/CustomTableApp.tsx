import {
  Box,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Text,
  Tag,
  IconButton,
  HStack,
  TableContainer,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Spinner,
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Icon,
  Tooltip
} from "@chakra-ui/react";
import { EditIcon } from "@chakra-ui/icons";
import { ImBin } from "react-icons/im";
import { JSX, useRef, useState } from "react";
import { formatDateWS } from "@/Functions/FormatDateWS";
import { formatAusPhoneNumber } from "@/Functions/formatAusPhoneNumber";
import { formatDateSingle } from "@/Functions/FormatDateSingle";
import useEventSelection from "@/Hooks/Handles/useEventSelection";
import useSlotSelection, { DateRange, MarkedEvents } from "@/Hooks/Handles/useSlotSelection";
import { useDeleteItem } from "@/Hooks/Query/useDeleteItem";
import { useGetCollection } from "@/Hooks/Query/useGetCollection";
import { Appointment, TimeBlock, WeekDay } from "@/types";
import AvailabilityDates2 from "./AvailabilityDates2";
import Pagination from "../Pagination";
import CustomEntryForm from "./CustomEntryForm";
import { iconMap } from "../CustomIcons";
import SearchBar, { SearchBarRef } from "../searchBar";
import { useQueryClient } from "@tanstack/react-query";
import { useTriggerEndpoint } from "@/Hooks/Query/useTriggerEndpoint";

interface Query {
  pageSize?: number;
}


function CustomTableApp({ pageSize }: Query) {
  const query = {};
  const populateFields = [
    { path: "priority", select: "id description notes durationHours name color" },
    { path: "treatment", select: "_id name notes duration icon color minIcon" },
    { path: "selectedDates.days.timeBlocks" }
  ];
  const limit = 100;
  const { data, isLoading, isPlaceholderData, refetch } = useGetCollection<Appointment>("Appointment", {
    query,
    limit,
    populate: populateFields
  });
  const queryClient = useQueryClient();
  const toastInfo = { title: "Patient edited", description: "The patient was edited successfully" };
  const [, setSelectedDays] = useState<Partial<Record<WeekDay, TimeBlock[]>>>({});
  const [markedEvents] = useState<MarkedEvents>([]);
  const [selectedAppDates, setSelectedAppDates] = useState<DateRange[]>([]);
  const [markedAppEvents, setMarkedAppEvents] = useState<MarkedEvents>([]);
  const { handleSelectSlot: handleAppSelectSlot } = useSlotSelection(false, selectedAppDates, setSelectedAppDates, markedAppEvents, setMarkedAppEvents);
  const { handleSelectEvent: handleAppSelectEvent } = useEventSelection(setSelectedAppDates, setMarkedAppEvents, markedAppEvents);
  const [filteredItems, setFilteredItems] = useState<Appointment[] | null>(null);

  const deleteDisclosure = useDisclosure();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [itemToDelete, setItemToDelete] = useState<string>("");
  const trigger = useTriggerEndpoint("/cleanup-twilio");
  const searchRef = useRef<SearchBarRef>(null);

  const { deleteById } = useDeleteItem({
    modelName: "Appointment", // o "treatments", "prioritylist", etc.
    refetch, // puedes pasarlo si usas un useQuery y quieres que se actualice
  });

  const confirmDelete = (id: string) => {
    setItemToDelete(id);
    deleteDisclosure.onOpen();
  };
  const handleDelete = () => {
    if (deleteById && itemToDelete)
      deleteById(itemToDelete);
    searchRef.current?.clearInput(); // ✅ limpiar campo visual y restaurar datos
    queryClient.invalidateQueries({ queryKey: ["Appointment"] });
    setFilteredItems(null); // 👉 Esto forza que se use el nuevo `data` al volver a renderizar

    trigger.mutate(); // 🔥 Llama el endpoint sin esperar respuesta

    
    deleteDisclosure.onClose();
  };



  const [currentPage, setCurrentPage] = useState(1);
  const start = (currentPage - 1) * (pageSize ? pageSize : 0);
  const end = start + (pageSize ? pageSize : 0);
  const paginatedSource = filteredItems ?? data;
  const currentItems = paginatedSource ? paginatedSource.slice(start, end) : [];
  const totalPages = paginatedSource ? Math.ceil(paginatedSource.length / (pageSize || 1)) : 0;

  const [modalContent, setModalContent] = useState<JSX.Element | null>(null);
  const modalDisclosure = useDisclosure();

  return (
    <>
      {isLoading ? (
        <Box textAlign="center" py={10}>
          <Spinner size="xl" />
          <Text mt={4}>Cargando...</Text>
        </Box>
      ) : (
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
                    <Tr key={item._id} _hover={{ bg: "gray.50" }}

                    >
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
                      <Td>
                        <Button size="xs" onClick={() => {
                          setModalContent(
                            <>
                              <AvailabilityDates2
                                modeInput={false}
                                selectedDaysResp={
                                  Array.isArray(item.selectedDates?.days)
                                    ? item.selectedDates.days.reduce((acc, curr) => {
                                      acc[curr.weekDay] = curr.timeBlocks;
                                      return acc;
                                    }, {} as Partial<Record<WeekDay, TimeBlock[]>>)
                                    : {}
                                }
                                setSelectedDaysResp={setSelectedDays}
                              />
                              <Text fontSize="sm" mt={2}>Start: {item.selectedDates?.startDate ? formatDateSingle(item.selectedDates.startDate) : "No start date"}</Text>
                              <Text fontSize="sm" mt={2}>End: {item.selectedDates?.endDate ? formatDateSingle(item.selectedDates.endDate) : "No end date"}</Text>
                            </>
                          );
                          modalDisclosure.onOpen();
                        }}>Show Dates</Button>
                      </Td>
                      <Td>
                        <Button size="xs" onClick={() => {
                          setModalContent(<Text>{item.note || "No note available"}</Text>);
                          modalDisclosure.onOpen();
                        }}>Note</Button>
                      </Td>
                      <Td>
                        <Text>{item.selectedAppDates[0] ? formatDateWS(item.selectedAppDates[0]) : "No appointment"}</Text>
                      </Td>
                      <Td>
                        <Tag colorScheme={item.priority?.color || "gray.200"} mr={1}>
                          {item.priority?.name || "No Assigned"}
                        </Tag>

                        <Tooltip label={item.treatment?.name} placement="top" fontSize="sm" hasArrow >
                          <Icon as={iconMap[item.treatment?.minIcon]} color={`${item.treatment?.color}.500`} fontSize="24px" />
                        </Tooltip>


                      </Td>
                      <Td>
                        <Text>{formatAusPhoneNumber(item.phoneInput)}</Text>
                      </Td>
                      <Td textAlign="center">
                        <HStack spacing={2} justify="center">
                          <IconButton aria-label="Edit" icon={<EditIcon />} size="sm" variant="ghost" colorScheme="blue" onClick={() => {
                            setModalContent(
                              <CustomEntryForm
                                rfetchPl={refetch}
                                onClose_1={modalDisclosure.onClose}
                                title={`Edit Patient ${item.nameInput}`}
                                btnName="Update"
                                mode="EDITION"
                                markedEvents={markedEvents}
                                handleAppSelectEvent={handleAppSelectEvent}
                                handleAppSelectSlot={handleAppSelectSlot}
                                markedAppEvents={markedAppEvents}
                                nameVal={item.nameInput}
                                lastNameVal={item.lastNameInput}
                                phoneVal={item.phoneInput}
                                emailVal={item.emailInput}
                                reschedule={item.reschedule}
                                priorityVal={item.priority}
                                note={item.note}
                                datesSelected={item.selectedDates}
                                idVal={item._id}
                                refetch_list={refetch}
                                toastInfo={toastInfo}
                                dates={item.selectedDates}
                                datesApp={selectedAppDates}
                                setDatesApp={setSelectedAppDates}
                                datesAppSelected={item.selectedAppDates}
                                treatmentBack={item.treatment}
                              />
                            );
                            modalDisclosure.onOpen();
                          }} />
                          <IconButton aria-label="Delete" icon={<ImBin />} size="sm" variant="ghost" colorScheme="red" onClick={() => confirmDelete(item._id)} />
                        </HStack>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableContainer>
          </Box>
          <Box mt={4}>
            <Pagination isPlaceholderData={isPlaceholderData} totalPages={totalPages} currentPage={currentPage} onPageChange={setCurrentPage} />
          </Box>
          <Modal isOpen={modalDisclosure.isOpen} onClose={modalDisclosure.onClose} size="6xl">
            <ModalOverlay />
            <ModalContent>
              <ModalHeader>Details</ModalHeader>
              <ModalBody>{modalContent}</ModalBody>
              <ModalFooter>
                <Button onClick={modalDisclosure.onClose}>Close</Button>
              </ModalFooter>
            </ModalContent>
          </Modal>
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
      )
      }
    </>
  );
}

export default CustomTableApp;
