// apps/frontend/src/Components/CustomTemplates/CustomTableContact.tsx
import {
  Box, Table, Thead, Tbody, Tr, Th, Td, Text, Tag, IconButton, HStack, TableContainer,
  Button, Spinner, AlertDialog, AlertDialogBody, AlertDialogContent, AlertDialogFooter,
  AlertDialogHeader, AlertDialogOverlay, Icon, useDisclosure, Input, InputGroup,
  InputLeftElement, InputRightElement, Flex
} from "@chakra-ui/react";
import { EditIcon, SearchIcon, CloseIcon } from "@chakra-ui/icons";
import { ImBin } from "react-icons/im";
import { useEffect, useRef, useState } from "react";
import { formatAusPhoneNumber } from "@/Functions/formatAusPhoneNumber";
import { useDeleteItem } from "@/Hooks/Query/useDeleteItem";
import { Appointment } from "@/types";
import Pagination from "../Pagination";
import { useQueryClient } from "@tanstack/react-query";
import { useAppointmentEditor } from "@/Hooks/Handles/useAppointmentEditor";
import { useInfoModal } from "@/Hooks/Handles/useInfoModal";
import { appointmentsKeys, useAppointmentsPaginated } from "@/Hooks/Query/useAppointmentsPaginated";
import { useAppointmentSearch } from "@/Hooks/Query/useAppointmentSearch";
import { LiaSmsSolid } from "react-icons/lia";
import { CiPhone } from "react-icons/ci";

interface Props { pageSize?: number; }

function useDebouncedValue(v: string, ms = 350) {
  const [val, setVal] = useState(v);
  useEffect(() => {
    const id = setTimeout(() => setVal(v), ms);
    return () => clearTimeout(id);
  }, [v, ms]);
  return val;
}

/**
 * Lista mínima de Appointments
 * No lee ni muestra: appointmentData, treatment, priority, selectedDates, selectedAppDates, providers.
 * Columnas: Name, Note, Phone, Actions.
 */
function CustomTableContact({ pageSize = 20 }: Props) {
  // paginación
  const [currentPage, setCurrentPage] = useState(1);

  // búsqueda
  const [query, setQuery] = useState("");
  const q = useDebouncedValue(query, 350);
  const isSearching = q.trim().length >= 3;

  // data
  const {
    data: pageData,
    isLoading: loadingPage,
    isPlaceholderData,
  refetch: refetchPage,
  } = useAppointmentsPaginated<Appointment>(currentPage, pageSize, {
    sort: { updatedAt: -1 },
  });

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

  // utils
  const queryClient = useQueryClient();
  const hardRefresh = async () => {
    if (isSearching) {
      await queryClient.invalidateQueries({
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
    titlePrefix: "Edit Contact",
    refetcher: async () => {
      return isSearching ? await refetchSearch() : await refetchPage();
    },
    onSaved: async () => {
      await queryClient.invalidateQueries({
        queryKey: appointmentsKeys.root,
        refetchType: "active",
      });
      await queryClient.invalidateQueries({
        predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === "appointments-search",
        refetchType: "active",
      });
      if (isSearching) {
        await refetchSearch();
      } else {
        await refetchPage();
      }
    },
  });

  const { openInfo, InfoModal } = useInfoModal("Details");

  // borrar
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

  useEffect(() => { if (!isSearching) setCurrentPage(1); }, [isSearching]);

  if (loadingPage && !isSearching) {
    return (
      <Box textAlign="center" py={10}>
        <Spinner size="xl" />
        <Text mt={4}>Loading…</Text>
      </Box>
    );
  }

  return (
    <>
      <Box fontSize="sm" borderWidth="1px" rounded="lg" shadow="md" p={4} bg="white">
        {/* buscador */}
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
                <Th>Note</Th>
                <Th>Phone</Th>
                <Th textAlign="center">Actions</Th>
              </Tr>
            </Thead>

            <Tbody>
              {(isSearching ? (loadingSearch ? [] : source) : source).map((item) => (
                <Tr key={item._id} _hover={{ bg: "gray.50" }}>
                  {/* Name */}
                  <Td>
                    <HStack spacing={3}>
                      <Tag
                        size="lg"
                        borderRadius="full"
                        colorScheme="gray"
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

                  {/* Note */}
                  <Td>
                    <Button size="xs" onClick={() => openInfo(<Text>{item.note || "No note available"}</Text>)}>
                      Note
                    </Button>
                  </Td>

                  {/* Phone */}
                  <Td>
                    <HStack>
                      <Text>{formatAusPhoneNumber(item.phoneInput)}</Text>
                      {item.contactPreference && item.contactPreference === "sms"
                        ? <Icon as={LiaSmsSolid} color="yellow.500" fontSize="20px" />
                        : item.contactPreference === "call"
                          ? <Icon as={CiPhone} color="green.500" fontSize="20px" />
                          : null}
                    </HStack>
                  </Td>

                  {/* Actions */}
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

        {isSearching && loadingSearch && (
          <Box textAlign="center" py={6}><Spinner /></Box>
        )}
      </Box>

      {/* paginación para modo lista */}
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

      {/* modales */}
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

export default CustomTableContact;
