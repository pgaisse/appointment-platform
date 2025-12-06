// apps/frontend/src/Components/CustomTemplates/CustomTableApp.tsx
import {
  Box, Table, Thead, Tbody, Tr, Th, Td, Text, Tag, IconButton, HStack, TableContainer,
  Button, Spinner, AlertDialog, AlertDialogBody, AlertDialogContent, AlertDialogFooter,
  AlertDialogHeader, AlertDialogOverlay, Icon, Tooltip, useDisclosure, Input, InputGroup,
  InputLeftElement, InputRightElement, Flex, Avatar, Stack, useBreakpointValue
} from "@chakra-ui/react";
import { EditIcon, SearchIcon, CloseIcon } from "@chakra-ui/icons";
import { ImBin } from "react-icons/im";
import React, { useEffect, useRef, useState } from "react";
import { formatDateWS } from "@/Functions/FormatDateWS";
import { formatAusPhoneNumber } from "@/Functions/formatAusPhoneNumber";
import { formatDateSingle } from "@/Functions/FormatDateSingle";
import { capitalize } from "@/utils/textFormat";
import { useDeleteItem } from "@/Hooks/Query/useDeleteItem";
import { Appointment, Provider, TimeBlock, WeekDay } from "@/types";
import AvailabilityDates2 from "./AvailabilityDates2";
import Pagination from "../Pagination";
import { getIconComponent } from "../CustomIcons";
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

  const getAvatarColors = (color: string) => {
    // Si es un color de Chakra UI (ej: "red", "blue")
    if (color && !color.startsWith('#')) {
      return {
        bg: `${color}.500`,
        color: 'white',
        borderColor: `${color}.700`,
      };
    }

    // Si es un color hexadecimal
    if (color && color.startsWith('#')) {
      const hex = color.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      const yiq = (r * 299 + g * 587 + b * 114) / 1000;
      const textColor = yiq >= 128 ? 'black' : 'white';

      return {
        bg: color,
        color: textColor,
        borderColor: yiq >= 128 ? 'gray.300' : 'whiteAlpha.300',
      };
    }

    // Fallback
    return {
      bg: 'gray.500',
      color: 'white',
      borderColor: 'gray.700',
    };
  };

function CustomTableApp({ pageSize = 20 }: Props) {
  // ─────────── estado paginación
  const [currentPage, setCurrentPage] = useState(1);

  // ─────────── estado búsqueda
  const [query, setQuery] = useState("");
  const q = useDebouncedValue(query, 350);
  const isSearching = q.trim().length >= 3;

  // ─────────── estado expansión de notas y slots
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [expandedSlots, setExpandedSlots] = useState<Record<string, boolean>>({});

  const isCompactLayout = useBreakpointValue({ base: true, md: false }) ?? false;

  const handleShowDates = (item: Appointment) => {
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
  };

  const toggleNoteExpansion = (id: string) => {
    setExpandedNotes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const renderNoteBlock = (item: Appointment, clampWidth = "200px") => {
    const noteText = item.note || "";
    const isLongNote = noteText.length > 30 || noteText.includes('\n');
    const isExpanded = !!expandedNotes[item._id];

    if (!noteText) {
      return <Text fontSize="xs" color="gray.400">No note</Text>;
    }

    return (
      <Box>
        <HStack spacing={1} align="center">
          <Text
            fontSize="sm"
            noOfLines={isExpanded ? undefined : 1}
            maxW={isExpanded ? "100%" : clampWidth}
            whiteSpace={isExpanded ? "pre-wrap" : "nowrap"}
            overflow="hidden"
            textOverflow="ellipsis"
            flex={1}
          >
            {noteText}
          </Text>
          {isLongNote && !isExpanded && (
            <Button
              size="xs"
              variant="link"
              colorScheme="blue"
              onClick={() => toggleNoteExpansion(item._id)}
              flexShrink={0}
            >
              more
            </Button>
          )}
        </HStack>
        {isExpanded && isLongNote && (
          <Button
            size="xs"
            variant="link"
            colorScheme="blue"
            onClick={() => toggleNoteExpansion(item._id)}
            mt={1}
          >
            less
          </Button>
        )}
      </Box>
    );
  };

  const toggleSlotExpansion = (id: string) => {
    setExpandedSlots((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const renderSlotsBlock = (item: Appointment) => {
    const slots = item.selectedAppDates || [];
    const showAll = !!expandedSlots[item._id];

    if (slots.length === 0) {
      if (!item.priority && !item.treatment) {
        return <Text fontSize="xs" color="gray.500">No appointments</Text>;
      }
      return (
        <HStack spacing={2} flexWrap="wrap">
          <Text fontSize="xs" color="gray.500">No date</Text>
          {item.priority && (
            <Tag colorScheme={item.priority.color || "gray"} size="sm">
              {item.priority.name}
            </Tag>
          )}
          {item.treatment && (
            <Tooltip label={item.treatment.name} placement="top" fontSize="sm" hasArrow>
              <Icon
                as={getIconComponent(item.treatment.minIcon) || getIconComponent('md:MdHealthAndSafety')}
                color={`${item.treatment.color}.500`}
                fontSize="20px"
              />
            </Tooltip>
          )}
        </HStack>
      );
    }

    const displaySlots = showAll ? slots : slots.slice(0, 1);

    return (
      <Flex direction="column" gap={1}>
        {displaySlots.map((slot: any, idx: number) => {
          const status = slot.status;
          const statusScheme = status === "Confirmed" ? "green" : status === "Pending" ? "yellow" : "gray";
          const priority = slot.priority || item.priority;
          const treatment = slot.treatment || item.treatment;

          return (
            <HStack key={idx} spacing={2} flexWrap="wrap">
              <Tag colorScheme={statusScheme} size="sm">
                {formatDateWS(slot as any)}
              </Tag>

              {priority && (
                <Tag colorScheme={priority.color || "gray"} size="sm">
                  {priority.name || "No Assigned"}
                </Tag>
              )}

              {treatment && (
                <Tooltip label={treatment.name} placement="top" fontSize="sm" hasArrow>
                  <Icon
                    as={getIconComponent(treatment.minIcon) || getIconComponent('md:MdHealthAndSafety')}
                    color={`${treatment.color}.500`}
                    fontSize="18px"
                  />
                </Tooltip>
              )}
            </HStack>
          );
        })}

        {slots.length > 1 && (
          <Button
            size="xs"
            variant="link"
            colorScheme="blue"
            onClick={() => toggleSlotExpansion(item._id)}
            mt={1}
          >
            {showAll ? `Show less` : `+${slots.length - 1} more`}
          </Button>
        )}
      </Flex>
    );
  };

  const renderContactPreferenceIcon = (item: Appointment) => {
    if (item.contactPreference === "sms") {
      return <Icon as={LiaSmsSolid} color="yellow.500" fontSize="20px" />;
    }
    if (item.contactPreference === "call") {
      return <Icon as={CiPhone} color="green.500" fontSize="20px" />;
    }
    return null;
  };

  const renderPhoneBlock = (item: Appointment) => {
    if (item.representative?.appointment) {
      const rep = item.representative.appointment;
      return (
        <HStack>
          <Tooltip
            label={`Represented by ${capitalize(rep.nameInput)} ${capitalize(rep.lastNameInput)} (${item.representative?.relationship})`}
            fontSize="sm"
            hasArrow
            placement="top"
          >
            <RiParentFill />
          </Tooltip>
          <Text>{formatAusPhoneNumber(rep.phoneInput || "")}</Text>
          {renderContactPreferenceIcon(item)}
        </HStack>
      );
    }

    return (
      <HStack>
        <Text>{formatAusPhoneNumber(item.phoneInput || "")}</Text>
        {renderContactPreferenceIcon(item)}
      </HStack>
    );
  };

  const renderActionButtons = (item: Appointment, justify: "center" | "flex-end" = "center") => (
    <HStack spacing={2} justify={justify}>
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
  );

  const renderMobileCards = () => {
    if (!visibleItems.length) {
      if (isSearching && loadingSearch) {
        return (
          <Box textAlign="center" py={6}>
            <Spinner />
          </Box>
        );
      }
      return (
        <Text textAlign="center" color="gray.500" py={6}>
          No appointments found
        </Text>
      );
    }

    return (
      <Stack spacing={4} mt={4}>
        {visibleItems.map((item) => (
          <Box key={item._id} borderWidth="1px" rounded="lg" p={4} shadow="sm" bg="white">
            <Flex
              direction={{ base: "column", sm: "row" }}
              justify="space-between"
              align={{ base: "flex-start", sm: "flex-start" }}
              gap={3}
            >
              <HStack spacing={3} align="flex-start">
                <Avatar
                  name={item.nameInput?.[0] || ""}
                  {...getAvatarColors(item.color)}
                  width="36px"
                  height="36px"
                  fontWeight="bold"
                  boxShadow="0 1px 4px rgba(0,0,0,0.1)"
                />
                <Box>
                  <Text fontWeight="semibold">{capitalize(item.nameInput)}</Text>
                  <Text fontSize="sm" color="gray.500">{capitalize(item.lastNameInput)}</Text>
                </Box>
              </HStack>
              <Box w="full">
                {renderActionButtons(item, "flex-end")}
              </Box>
            </Flex>

            <Stack spacing={3} mt={3} fontSize="sm">
              <Flex justify="space-between" align="center">
                <Text fontWeight="medium">Availability</Text>
                <Button size="xs" onClick={() => handleShowDates(item)}>
                  Show Dates
                </Button>
              </Flex>

              {renderSlotsBlock(item)}

              <Box>
                <Text fontSize="xs" color="gray.500" mb={1}>Note</Text>
                {renderNoteBlock(item, "100%")}
              </Box>

              <Box>
                <Text fontSize="xs" color="gray.500" mb={1}>Phone</Text>
                {renderPhoneBlock(item)}
              </Box>

              {item.providers?.length ? (
                <Box>
                  <Text fontSize="xs" color="gray.500" mb={1}>Providers</Text>
                  <HStack spacing={2} flexWrap="wrap">
                    {item.providers.map((prov: Provider) => (
                      <Tag
                        key={String(prov._id ?? prov._id)}
                        size="sm"
                        borderRadius="md"
                        mr={0}
                        mb={2}
                      >
                        {capitalize(prov.firstName)} {capitalize(prov.lastName)}
                      </Tag>
                    ))}
                  </HStack>
                </Box>
              ) : null}
            </Stack>
          </Box>
        ))}
      </Stack>
    );
  };

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

  const visibleItems: Appointment[] = isSearching
    ? (loadingSearch ? [] : source)
    : source;

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

    // Además, invalida/cancela todas las queries relacionadas con appointments
    // para mantener sincronizados otros hooks (rangos, mini-calendarios, etc.).
    await queryClient.cancelQueries({
      // Cancela cualquier variante de useAppointmentsByRange
      predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === "appointments-range",
    });
    await queryClient.cancelQueries({ queryKey: ["appointments-month-days"] });
    await queryClient.cancelQueries({ queryKey: ["Appointment"] });

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["appointments-range"] }),
      queryClient.invalidateQueries({ queryKey: ["appointments-month-days"] }),
      queryClient.invalidateQueries({ queryKey: ["Appointment"] }),
    ]);
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

  const { deleteByIdAsync } = useDeleteItem({
    modelName: "Appointment",
    refetch: isSearching ? refetchSearch : refetchPage,
  });

  const [deleteError, setDeleteError] = useState<string>("");

  const confirmDelete = (id: string) => { 
    setItemToDelete(id); 
    setDeleteError("");
    deleteDisclosure.onOpen(); 
  };
  
  const handleDelete = async () => {
    if (!deleteByIdAsync || !itemToDelete) return;

    try {
      await deleteByIdAsync(itemToDelete);
      setQuery("");
      await hardRefresh();
      setDeleteError("");
      deleteDisclosure.onClose();
    } catch (error: any) {
      console.error("❌ Error deleting appointment:", error);
      
      // Axios coloca la respuesta del servidor en error.response.data
      const responseData = error?.response?.data;
      const statusCode = error?.response?.status;
      const errorName = responseData?.name || responseData?.error || error?.name || "";
      const errorMessage = responseData?.message || responseData?.details || error?.message || String(error);
      
      console.log("📋 Error details:", { 
        statusCode, 
        errorName, 
        errorMessage, 
        responseData,
        fullError: error 
      });
      
      // Detectar si es un error 409 de representante/dependiente
      if (
        statusCode === 409 ||
        errorName === "DependentConstraintError" || 
        errorMessage.includes("representante de dependientes") ||
        errorMessage.includes("representative") || 
        errorMessage.includes("dependent") ||
        errorMessage.includes("Reasigna o desvincula")
      ) {
        setDeleteError(
          "This patient cannot be deleted because they are currently representing another patient. " +
          "Please remove the representative link from their dependents before deleting this patient."
        );
      } else {
        setDeleteError(errorMessage || "An error occurred while deleting the patient.");
      }
      // NO cerramos el modal - el usuario ve el error en el mismo diálogo
    }
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

        {isCompactLayout ? (
          renderMobileCards()
        ) : (
          <TableContainer overflowX="auto">
            <Table variant="simple" size="md" minWidth="960px">
              <Thead bg="gray.100">
                <Tr>
                  <Th>Name</Th>
                  <Th>Availability</Th>
                  <Th>Note</Th>
                  <Th>Provider</Th>
                  <Th>Date/Priority/Treatment</Th>
                  <Th>Phone</Th>
                  <Th
                    textAlign="center"
                    position="sticky"
                    right={0}
                    bg="gray.100"
                    zIndex={1}
                  >
                    Actions
                  </Th>
                </Tr>
              </Thead>

              <Tbody>
                {visibleItems.map((item) => (
                  <Tr key={item._id} _hover={{ bg: "gray.50" }}>
                    <Td>
                      <HStack spacing={3}>
                        <Avatar
                          name={item.nameInput?.[0] || ""}
                          {...getAvatarColors(item.color)}
                          width="36px"
                          height="36px"
                          fontWeight="bold"
                          boxShadow="0 1px 4px rgba(0,0,0,0.1)"
                        />
                        <Box>
                          <Text fontWeight="semibold">{capitalize(item.nameInput)}</Text>
                          <Text fontSize="sm" color="gray.500">{capitalize(item.lastNameInput)}</Text>
                        </Box>
                      </HStack>
                    </Td>

                    <Td>
                      <Button size="xs" onClick={() => handleShowDates(item)}>
                        Show Dates
                      </Button>
                    </Td>

                    <Td>{renderNoteBlock(item)}</Td>

                    <Td>
                      {item.providers && item.providers.length ? (
                        <HStack spacing={2} flexWrap="wrap">
                          {item.providers.map((prov: Provider) => (
                            <Tag
                              key={String(prov._id ?? prov._id)}
                              size="sm"
                              borderRadius="md"
                              mr={2}
                              mb={2}
                            >
                              {capitalize(prov.firstName)} {capitalize(prov.lastName)}
                            </Tag>
                          ))}
                        </HStack>
                      ) : (
                        "-"
                      )}
                    </Td>

                    <Td>{renderSlotsBlock(item)}</Td>

                    <Td>{renderPhoneBlock(item)}</Td>

                    <Td
                      textAlign="center"
                      position="sticky"
                      right={0}
                      bg="white"
                      zIndex={1}
                      boxShadow="inset 1px 0 0 var(--chakra-colors-gray-200)"
                    >
                      {renderActionButtons(item)}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>
        )}

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
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              {deleteError ? "Cannot Delete Patient" : "Confirm Deletion"}
            </AlertDialogHeader>
            <AlertDialogBody>
              {deleteError ? (
                <Box>
                  <Text color="red.500" fontWeight="semibold" mb={2}>
                    {deleteError}
                  </Text>
                  <Text fontSize="sm" color="gray.600">
                    To delete this patient, you must first:
                  </Text>
                  <Box as="ul" pl={4} mt={2} fontSize="sm" color="gray.600">
                    <li>Remove the representative link from their dependents, or</li>
                    <li>Assign a different representative to their dependents</li>
                  </Box>
                </Box>
              ) : (
                "Are you sure? This action cannot be undone."
              )}
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button 
                ref={cancelRef} 
                onClick={() => {
                  setDeleteError("");
                  deleteDisclosure.onClose();
                }}
              >
                {deleteError ? "Close" : "Cancel"}
              </Button>
              {!deleteError && (
                <Button colorScheme="red" onClick={handleDelete} ml={3}>
                  Delete
                </Button>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
}

export default CustomTableApp;
