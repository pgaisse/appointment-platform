// apps/frontend/src/Components/CustomTemplates/CustomTableApp.tsx
import {
  Box, Table, Thead, Tbody, Tr, Th, Td, Text, Tag, IconButton, HStack, TableContainer,
  Button, Spinner, AlertDialog, AlertDialogBody, AlertDialogContent, AlertDialogFooter,
  AlertDialogHeader, AlertDialogOverlay, Icon, Tooltip, useDisclosure, Input, InputGroup,
  InputLeftElement, InputRightElement, Flex
} from "@chakra-ui/react";
import { EditIcon, SearchIcon, CloseIcon } from "@chakra-ui/icons";
import { ImBin } from "react-icons/im";
import { useEffect, useRef, useState } from "react";
import { formatDateWS } from "@/Functions/FormatDateWS";
import { formatAusPhoneNumber } from "@/Functions/formatAusPhoneNumber";
import { formatDateSingle } from "@/Functions/FormatDateSingle";
import { useDeleteItem } from "@/Hooks/Query/useDeleteItem";
import { Appointment, Provider, TimeBlock, WeekDay } from "@/types";
import AvailabilityDates2 from "./AvailabilityDates2";
import Pagination from "../Pagination";
import { iconMap } from "../CustomIcons";
import { useQueryClient } from "@tanstack/react-query";
import { useAppointmentEditor } from "@/Hooks/Handles/useAppointmentEditor";
import { useInfoModal } from "@/Hooks/Handles/useInfoModal";
import { appointmentsKeys, useAppointmentsPaginated } from "@/Hooks/Query/useAppointmentsPaginated";
import { useAppointmentSearch } from "@/Hooks/Query/useAppointmentSearch";
import { LiaSmsSolid } from "react-icons/lia";
import { CiPhone } from "react-icons/ci";
import { RiParentFill } from "react-icons/ri";

interface Props { pageSize?: number; }

function useDebouncedValue(v: string, ms = 350) {
  const [val, setVal] = useState(v);
  useEffect(() => {
    const id = setTimeout(() => setVal(v), ms);
    return () => clearTimeout(id);
  }, [v, ms]);
  return val;
}

function CustomTableApp({ pageSize = 20 }: Props) {
  // ─────────── estado paginación
  const [currentPage, setCurrentPage] = useState(1);

  // ─────────── estado búsqueda
  const [query, setQuery] = useState("");
  const q = useDebouncedValue(query, 350);
  const isSearching = q.trim().length >= 3;

  // ─────────── data: paginado o búsqueda
  const {
    data: pageData,
    isLoading: loadingPage,
    isPlaceholderData,
    refetch: refetchPage,
  } = useAppointmentsPaginated<Appointment>(currentPage, pageSize, {
    sort: { updatedAt: -1 },
  });
  console.log("pageData", pageData)

  const {
    data: searchData,
    isLoading: loadingSearch,
    refetch: refetchSearch,
  } = useAppointmentSearch<Appointment>(q, 200);

  const source: Appointment[] = isSearching
    ? (searchData?.items || [])
    : (pageData?.items || []);

  const totalPages = isSearching ? 1 : (pageData?.pagination?.totalPages || 1);
  const totalCount = isSearching ? (searchData?.total || 0) : (pageData?.pagination?.total || 0);

  // ─────────── utilitarios
  const queryClient = useQueryClient();
  const hardRefresh = async () => {
    if (isSearching) {
      await queryClient.invalidateQueries({
        // ensure all search variants are invalidated (q, limit, exact)
        predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === "appointments-search",
      });
      await refetchSearch();
    } else {
      await queryClient.invalidateQueries({ queryKey: ["appointments"] });
      await refetchPage();
    }
  };

  const { openEditor, AppointmentEditor } = useAppointmentEditor({
    refetchPage,
    titlePrefix: "Edit Patient",
    // Let the editor trigger a refetch based on current mode
    refetcher: async () => {
      return isSearching ? await refetchSearch() : await refetchPage();
    },
    onSaved: async () => {
      // Invalida TODO lo relacionado a appointments (listas/paginación)
      await queryClient.invalidateQueries({
        queryKey: appointmentsKeys.root,
        refetchType: "active",
      });

      // Invalida cualquier búsqueda activa de appointments
      await queryClient.invalidateQueries({
        // cubre ["appointments-search"] y variantes con parámetros (e.g., ["appointments-search", q])
        predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === "appointments-search",
        refetchType: "active",
      });

      // Refresca data visible según el modo actual
      if (isSearching) {
        await refetchSearch();
      } else {
        await refetchPage();
      }
    },
  });

  const { openInfo, InfoModal } = useInfoModal("Details");

  // ─────────── borrar
  const deleteDisclosure = useDisclosure();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [itemToDelete, setItemToDelete] = useState<string>("");

  const { deleteById } = useDeleteItem({
    modelName: "Appointment",
    refetch: isSearching ? refetchSearch : refetchPage,
  });

  const confirmDelete = (id: string) => { setItemToDelete(id); deleteDisclosure.onOpen(); };
  const handleDelete = async () => {
    if (deleteById && itemToDelete) {
      await deleteById(itemToDelete);
    }
    setQuery("");
    await hardRefresh();
    deleteDisclosure.onClose();
  };

  // Si cambia modo búsqueda, resetea página
  useEffect(() => { if (!isSearching) setCurrentPage(1); }, [isSearching]);

  // loading inicial (lista paginada)
  if (loadingPage && !isSearching) {
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
        {/* Buscador con debounce */}
        <InputGroup mb={4} size="md">
          <InputLeftElement pointerEvents="none">
            <SearchIcon color="gray.400" />
          </InputLeftElement>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, last name or phone (type 3+ chars)…"
            aria-label="Search appointments"
          />
          {query && (
            <InputRightElement>
              <IconButton
                aria-label="Clear search"
                icon={<CloseIcon boxSize={2.5} />}
                size="sm"
                variant="ghost"
                onClick={() => setQuery("")}
              />
            </InputRightElement>
          )}
        </InputGroup>

        {/* Estado del buscador */}
        {isSearching && (
          <Flex justify="space-between" mb={2}>
            <Text color="gray.600">
              {loadingSearch ? "Searching…" : `Found ${totalCount} result${totalCount === 1 ? "" : "s"}`}
            </Text>
            <Button size="sm" variant="ghost" onClick={() => setQuery("")}>
              Exit search
            </Button>
          </Flex>
        )}

        <TableContainer>
          <Table variant="simple" size="md">
            <Thead bg="gray.100">
              <Tr>
                <Th>Name</Th>
                <Th>Availability</Th>
                <Th>Note</Th>
                <Th>Appointment</Th>
                <Th>Provider</Th>
                <Th>Priority/Treatment</Th>
                <Th>Phone</Th>
                <Th textAlign="center">Actions</Th>
              </Tr>
            </Thead>

            <Tbody>
              {(isSearching ? (loadingSearch ? [] : source) : source).map((item) => (
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
                        <Text fontWeight="semibold" textTransform="capitalize">{item.nameInput}</Text>
                        <Text fontSize="sm" color="gray.500" textTransform="capitalize">{item.lastNameInput}</Text>
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
                              setSelectedDaysResp={() => { }}
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
                    <Tag colorScheme={item.selectedAppDates?.[0]?.status === "Confirmed" ? "green" : item.selectedAppDates?.[0]?.status === "Pending" ? "yellow" : "gray"} mr={1}>
                      {item.selectedAppDates?.[0] ? formatDateWS(item.selectedAppDates[0]) : "No appointment"}
                    </Tag>
                  </Td>


                  <Td>
                    {item.providers ? item.providers.map((prov: Provider) => (
                      <Tag
                        key={String(prov._id ?? prov._id)}
                        size="sm"
                        borderRadius="md"
                        mr={2}
                        mb={2}
                        textTransform="capitalize"
                      >
                        {prov.firstName} {prov.lastName}
                      </Tag>
                    )) : "-"

                    }

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
                    <HStack>
                      {item.representative?.appointment ? <><Tooltip label={`Represented by 
                        ${item.representative?.appointment.nameInput} 
                        ${item.representative.appointment.lastNameInput} (${item.representative.relationship})`} fontSize="sm" hasArrow placement="top">
                        <RiParentFill /></Tooltip><Text> {formatAusPhoneNumber(item.representative?.appointment.phoneInput || "")}</Text></> : <Text>{formatAusPhoneNumber(item.phoneInput || "")}</Text>}
                      {item.contactPreference && item.contactPreference === "sms" ? <Icon as={LiaSmsSolid} color="yellow.500" fontSize="20px" /> : item.contactPreference === "call" ? <Icon as={CiPhone} color="green.500" fontSize="20px" /> : null}
                    </HStack>
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
                        onClick={async () => {
                          console.log(item)
                          openEditor(item);

                        }}
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

        {isSearching && loadingSearch && (
          <Box textAlign="center" py={6}><Spinner /></Box>
        )}
      </Box>

      {/* paginación solo en modo lista */}
      {!isSearching && (
        <Box mt={4}>
          <Pagination
            isPlaceholderData={!!isPlaceholderData}
            totalPages={totalPages}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
          <Text mt={2} color="gray.500" fontSize="sm">
            Total: {totalCount} • Page {currentPage} / {totalPages}
          </Text>
        </Box>
      )}

      {/* modales reutilizables */}
      {AppointmentEditor}
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
