// components/Chat/CustomMessages/ShowTemplateButtonWithData.tsx
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
  Icon,
  usePrefersReducedMotion,
  useToken,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
} from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { CloseIcon, SearchIcon, EditIcon } from '@chakra-ui/icons';
import { useEffect, useRef, useState, useMemo } from 'react';
import { useGetCollection } from '@/Hooks/Query/useGetCollection';
import { Appointment, MessageTemplate, TemplateToken } from '@/types';
import { applyTemplateTokens } from '@/Functions/applyTemplateTokens';
import { useDeleteItem } from '@/Hooks/Query/useDeleteItem';
import { useQueryClient } from '@tanstack/react-query';
import { AiFillLayout } from 'react-icons/ai';
import { useInfiniteMessageTemplates } from '@/Hooks/Query/useInfiniteMessageTemplates';
import CreateCustomMessageForm2 from './CreateCustomMessageForm2';

interface ShowTemplateButtonWithDataProps {
  onSelectTemplate: (text: string) => void;
  /** Objeto con los datos del formulario para aplicar tokens */
  dataForTokens: Partial<Appointment> & Record<string, any>;
  /** Getter opcional para obtener datos frescos justo antes de abrir */
  getDataForTokens?: () => (Partial<Appointment> & Record<string, any>);
  tooltipText?: string;
  colorIcon?: string; // p.ej. "red.500" | "green.500" | "gray"
  category?: 'confirmation' | 'message';
  enableEdit?: boolean; // Habilitar edición de plantillas
}

// ───────────────── Parpadeo suave por tono (interpolación real) ─────────────────
const tonePulse = keyframes`
  from { color: var(--blink-from); }
  to   { color: var(--blink-to);   }
`;

export default function ShowTemplateButtonWithData({
  onSelectTemplate,
  dataForTokens,
  getDataForTokens,
  tooltipText = 'Custom messages',
  colorIcon = 'gray',
  category = 'message',
  enableEdit = false,
}: ShowTemplateButtonWithDataProps) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  // Mantener un snapshot efectivo para rellenar tokens - solo se actualiza cuando se abre el drawer
  const [effectiveData, setEffectiveData] = useState<Partial<Appointment> & Record<string, any>>(() => dataForTokens);

  const btnRef = useRef<HTMLButtonElement | null>(null);
  const queryClient = useQueryClient();
  const deleteDisclosure = useDisclosure();
  const editDisclosure = useDisclosure();
  const [itemToDelete, setItemToDelete] = useState<string>('');
  const [itemToEdit, setItemToEdit] = useState<MessageTemplate | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  // Resuelve los hex de tema (más suave para interpolar)
  const [red500, red300] = useToken('colors', ['red.500', 'red.300']);

  const shouldBlink = !prefersReducedMotion && /^red(\.|$)/.test(colorIcon);
  const iconBlinkAnimation = shouldBlink
    ? `${tonePulse} 1.6s ease-in-out infinite alternate`
    : 'none';

  // ───────────────── tokens ─────────────────
  const { data: tokens, isLoading: isLoadingTokens } =
    useGetCollection<TemplateToken>('TemplateToken', { mongoQuery: {} });

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
    enabled: isOpen,
    fields: 'title,content',
  });

  const allTemplates: MessageTemplate[] = data?.pages.flatMap((p) => p.items) ?? [];

  // ───────────────── Detectar si es un contacto y filtrar plantillas ─────────────────
  // OPTIMIZACIÓN: Solo calcular cuando el drawer está abierto
  const isContact = useMemo(() => {
    if (!isOpen) return false;
    // Un contacto tiene solo campos básicos y no tiene selectedAppDates
    const hasSelectedAppDates = effectiveData?.selectedAppDates && 
      Array.isArray(effectiveData.selectedAppDates) && 
      effectiveData.selectedAppDates.length > 0;
    
    return !hasSelectedAppDates;
  }, [isOpen, effectiveData?.selectedAppDates]);

  // Obtener los fields básicos de contacto desde los tokens de BD
  const contactAllowedFields = useMemo(() => {
    if (!isOpen) return [];
    return ['firstName', 'lastName', 'phone', 'nameInput', 'lastNameInput', 'phoneInput', 'org_name', null];
  }, [isOpen]);

  // Filtrar plantillas: para contactos, solo mostrar las que usen tokens básicos
  const filteredTemplates = useMemo(() => {
    if (!isOpen) return allTemplates;
    if (!isContact || !tokens) return allTemplates;

    // Obtener todos los tokens básicos permitidos (field en contactAllowedFields)
    const allowedTokenStrings = tokens
      .filter(t => contactAllowedFields.includes(t.field))
      .map(t => t.key);

    return allTemplates.filter((template) => {
      const variablesUsed = template.variablesUsed || [];
      
      // Si no usa variables, es válida para todos
      if (variablesUsed.length === 0) return true;

      // Verificar que TODAS las variables usadas estén en los tokens permitidos
      const isAllowed = variablesUsed.every((varToken) => {
        return allowedTokenStrings.includes(varToken);
      });

      return isAllowed;
    });
  }, [isOpen, isContact, allTemplates, tokens, contactAllowedFields]);

  // Sentinel + observer
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
    // ✅ Usamos los datos del formulario directamente (sin ir a BD)
    const filledMessage = applyTemplateTokens(
      template.content, 
      effectiveData, 
      tokens ?? []
    );
    onSelectTemplate(filledMessage);
    onClose();
  };

  const handleOpen = () => {
    // Si hay getter, usarlo para forzar datos frescos al abrir
    if (getDataForTokens) {
      try {
        const fresh = getDataForTokens();
        setEffectiveData(fresh);
      } catch (e) {
        // fallback silencioso
      }
    }
    onOpen();
  };

  const confirmDelete = (id: string) => {
    setItemToDelete(id);
    deleteDisclosure.onOpen();
  };

  const handleEdit = (template: MessageTemplate) => {
    setItemToEdit(template);
    editDisclosure.onOpen();
  };

  const { deleteById } = useDeleteItem({ modelName: 'MessageTemplate' });

  const handleDelete = async () => {
    if (deleteById && itemToDelete) {
      await deleteById(itemToDelete);
    }
    queryClient.invalidateQueries({ queryKey: ['message-templates'] });
    queryClient.invalidateQueries({ queryKey: ['MessageTemplate'] });
    deleteDisclosure.onClose();
    refetch();
  };

  const handleEditClose = () => {
    editDisclosure.onClose();
    setItemToEdit(null);
    queryClient.invalidateQueries({ queryKey: ['message-templates'] });
    queryClient.invalidateQueries({ queryKey: ['MessageTemplate'] });
    refetch();
  };

  const loadingInitial = templatesStatus === 'pending' || isLoadingTokens;

  return (
    <>
      <Tooltip label={tooltipText} hasArrow>
        <IconButton
          ref={btnRef}
          aria-label="Show custom messages"
          icon={
            <Icon
              as={AiFillLayout}
              color={colorIcon}
              animation={iconBlinkAnimation}
              sx={
                shouldBlink
                  ? {
                      '--blink-from': red500,
                      '--blink-to': red300,
                      willChange: 'color',
                    }
                  : undefined
              }
            />
          }
          onClick={handleOpen}
          variant="ghost"
          size="lg"
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
                {filteredTemplates.length === 0 && !isFetching ? (
                  <Box mt={4} color="gray.500" fontSize="sm">
                    {isContact ? 'No templates available for contacts with basic info.' : 'No templates found.'}
                  </Box>
                ) : (
                  <VStack spacing={4} align="stretch">
                    {filteredTemplates.map((template) => (
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
                        <HStack position="absolute" top={2} right={2} spacing={1}>
                          {enableEdit && (
                            <IconButton
                              icon={<EditIcon />}
                              size="sm"
                              aria-label="Edit"
                              variant="ghost"
                              colorScheme="blue"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(template);
                              }}
                            />
                          )}
                          <IconButton
                            icon={<CloseIcon />}
                            size="sm"
                            aria-label="Delete"
                            variant="ghost"
                            colorScheme="red"
                            onClick={(e) => {
                              e.stopPropagation();
                              confirmDelete(template._id);
                            }}
                          />
                        </HStack>
                        <Text fontWeight="semibold" pr={enableEdit ? 20 : 10}>{template.title}</Text>
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
                        <Text fontSize="sm" color="gray.600">
                          Loading more…
                        </Text>
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
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Confirm Deletion
            </AlertDialogHeader>
            <AlertDialogBody>Are you sure? This action cannot be undone.</AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={deleteDisclosure.onClose}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleDelete} ml={3}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* Modal de edición */}
      {enableEdit && itemToEdit && (
        <Modal isOpen={editDisclosure.isOpen} onClose={handleEditClose} size="xl" isCentered>
          <ModalOverlay />
          <ModalContent borderRadius="xl" p={2}>
            <ModalHeader textAlign="center">Edit Template</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <CreateCustomMessageForm2
                onClose={handleEditClose}
                mode="EDITION"
                patientId={Object.keys(effectiveData).length > 0 ? (effectiveData._id as string) || '' : ''}
                initialData={itemToEdit}
              />
            </ModalBody>
            <ModalFooter>
              <Button onClick={handleEditClose} variant="ghost">
                Cancel
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
    </>
  );
}
