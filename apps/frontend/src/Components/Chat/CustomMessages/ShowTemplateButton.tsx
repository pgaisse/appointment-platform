// components/ShowTemplateButton.tsx
import {
  IconButton,
  Tooltip,
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  VStack,
  Box,
  Text,
  Spinner,
  useDisclosure,
  AlertDialog,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogBody,
  AlertDialogFooter,
  Button,
  Input,
  InputGroup,
  InputRightElement,
  HStack,
} from '@chakra-ui/react';
import { CloseIcon, SearchIcon } from '@chakra-ui/icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useGetCollection } from '@/Hooks/Query/useGetCollection';
import { Appointment, MessageTemplate, TemplateToken } from '@/types';
import { applyTemplateTokens } from '@/Functions/applyTemplateTokens';
import { useDeleteItem } from '@/Hooks/Query/useDeleteItem';
import { useQueryClient } from '@tanstack/react-query';
import { AiFillLayout } from 'react-icons/ai';
import { useInfiniteMessageTemplates } from '@/Hooks/Query/useInfiniteMessageTemplates';

interface ShowTemplateButtonProps {
  onSelectTemplate: (text: string) => void;
  selectedPatient?: string;
  tooltipText?: string;
  colorIcon?: string;
  category?: 'confirmation' | 'message'
}

export type MinimalAppointment = Pick<Appointment, 'nameInput' | 'lastNameInput' | 'phoneInput' | 'selectedAppDates'>;

export default function ShowTemplateButton({
  onSelectTemplate,
  selectedPatient,
  tooltipText = "Custom messages",
  colorIcon = "gray",
  category='message'
}: ShowTemplateButtonProps) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const queryClient = useQueryClient();
  const deleteDisclosure = useDisclosure();
  const [itemToDelete, setItemToDelete] = useState<string>("");
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  // ───────────────── tokens (se mantiene igual) ─────────────────
  const { data: tokens, isLoading: isLoadingTokens } =
    useGetCollection<TemplateToken>('TemplateToken', { mongoQuery: {} });

  const [tokensWithField] = useMemo(() => {
    if (!tokens) return [{}];
    const withField: Record<string, string> = {};
    tokens.forEach((token) => {
      if (token.field) {
        withField[token.key] = token.field;
      }
    });
    return [withField];
  }, [tokens]);

  const patientProjection = useMemo(() => {
    const projection: Record<string, any> = {};
    Object.values(tokensWithField).forEach((field) => {
      const parts = String(field).split('+').map(f => f.trim());
      parts.forEach((part) => {
        const match = part.match(/^(\w+)\.0(\..+)?$/);
        if (match) {
          projection[match[1]] = { $slice: 1 };
        } else {
          projection[part] = 1;
        }
      });
    });
    return projection;
  }, [tokensWithField]);

  const { data: patientInfo, isLoading: isLoadingPatient } =
    useGetCollection<Appointment>('Appointment', {
      mongoQuery: { _id: selectedPatient },
      projection: patientProjection,
    });

  // ───────────────── buscador + infinito ─────────────────
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status: templatesStatus,
    isFetching,
    refetch,
  } = useInfiniteMessageTemplates({
    category,
    q: debouncedSearch || undefined,
    limit: 20,
    enabled: isOpen, // solo cuando el Drawer está abierto
    fields: 'title,content',
  });

  const allTemplates: MessageTemplate[] =
    data?.pages.flatMap((p) => p.items) ?? [];

  // Sentinel + observer en el contenedor scroll del Drawer
  const drawerBodyRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const root = drawerBodyRef.current;
    const target = loadMoreRef.current;
    if (!root || !target) return;

    const io = new IntersectionObserver(
      (entries) => {
        const [e] = entries;
        if (e.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { root, rootMargin: '300px' }
    );

    io.observe(target);
    return () => io.disconnect();
  }, [isOpen, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // ───────────────── selección y borrado ─────────────────
  const handleSelectTemplate = (template: MessageTemplate) => {
    if (!patientInfo || patientInfo.length === 0) return;
    const filledMessage = applyTemplateTokens(template.content, patientInfo[0], tokens ?? []);
    onSelectTemplate(filledMessage);
    onClose();
  };

  const confirmDelete = (id: string) => {
    setItemToDelete(id);
    deleteDisclosure.onOpen();
  };

  const { deleteById } = useDeleteItem({ modelName: "MessageTemplate" });

  const handleDelete = async () => {
    if (deleteById && itemToDelete) {
      await deleteById(itemToDelete);
    }
    // Invalida ambas claves, por si usas otras vistas
    queryClient.invalidateQueries({ queryKey: ["message-templates"] });
    queryClient.invalidateQueries({ queryKey: ["MessageTemplate"] });
    deleteDisclosure.onClose();
    // Opcional: refrescar la primera página para mantener consistencia
    refetch();
  };

  const loadingInitial =
    templatesStatus === 'pending' || isLoadingTokens || isLoadingPatient;

  return (
    <>
      <Tooltip label={tooltipText} hasArrow>
        <IconButton
          ref={btnRef}
          aria-label="Show custom messages"
          icon={<AiFillLayout color={colorIcon} size={20} />}
          onClick={onOpen}
          variant="ghost"
          size="sm"
        />
      </Tooltip>

      <Drawer isOpen={isOpen} placement="right" onClose={onClose} finalFocusRef={btnRef}>
        <DrawerOverlay />
        <DrawerContent maxW="360px">
          <DrawerHeader borderBottomWidth="1px">
            <HStack>
              <Text flex="1">Personalized Messages</Text>
            </HStack>
          </DrawerHeader>

          <DrawerBody ref={drawerBodyRef}>
            {/* Buscador */}
            <InputGroup size="sm" mb={3}>
              <Input
                placeholder="Search by title or content…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              <InputRightElement>
                {searchInput ? (
                  <IconButton
                    aria-label="Clear"
                    icon={<CloseIcon boxSize={2.5} />}
                    size="xs"
                    variant="ghost"
                    onClick={() => setSearchInput('')}
                  />
                ) : (
                  <SearchIcon />
                )}
              </InputRightElement>
            </InputGroup>

            {loadingInitial ? (
              <Spinner mt={4} />
            ) : (
              <>
                {allTemplates.length === 0 && !isFetching ? (
                  <Box mt={4} color="gray.500" fontSize="sm">
                    No templates found.
                  </Box>
                ) : (
                  <VStack spacing={4} align="stretch">
                    {allTemplates.map((template) => (
                      <Box
                        cursor="pointer"
                        key={template._id}
                        position="relative"
                        p={3}
                        borderWidth="1px"
                        borderRadius="md"
                        _hover={{ bg: 'gray.50' }}
                        onClick={() => handleSelectTemplate(template)}
                      >
                        <IconButton
                          icon={<CloseIcon />}
                          size="sm"
                          aria-label="Delete"
                          position="absolute"
                          top={2}
                          right={2}
                          variant="ghost"
                          colorScheme="red"
                          onClick={(e) => {
                            e.stopPropagation();
                            confirmDelete(template._id);
                          }}
                        />
                        <Text fontWeight="semibold">{template.title}</Text>
                        <Text fontSize="sm" color="gray.600" noOfLines={2}>
                          {template.content}
                        </Text>
                      </Box>
                    ))}
                    {/* Sentinel para cargar más */}
                    <Box ref={loadMoreRef} h="1px" />
                    {isFetchingNextPage && (
                      <HStack justify="center" py={3}>
                        <Spinner />
                        <Text fontSize="sm" color="gray.600">Loading more…</Text>
                      </HStack>
                    )}
                  </VStack>
                )}
              </>
            )}
          </DrawerBody>
        </DrawerContent>
      </Drawer>
      {/* Confirmación de borrado */}
      <AlertDialog
        isOpen={deleteDisclosure.isOpen}
        leastDestructiveRef={cancelRef}
        onClose={deleteDisclosure.onClose}
      >
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
