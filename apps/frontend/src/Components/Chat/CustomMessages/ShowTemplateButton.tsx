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
  Icon,
  usePrefersReducedMotion,
  useToken, // ⬅️ nuevo
} from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
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
  colorIcon?: string; // p.ej. "red.500" | "green.500" | "gray"
  category?: 'confirmation' | 'message';
}

export type MinimalAppointment = Pick<
  Appointment,
  'nameInput' | 'lastNameInput' | 'phoneInput' | 'selectedAppDates'
>;

// ───────────────── Parpadeo suave por tono (interpolación real) ─────────────────
const tonePulse = keyframes`
  from { color: var(--blink-from); }
  to   { color: var(--blink-to);   }
`;

export default function ShowTemplateButton({
  onSelectTemplate,
  selectedPatient,
  tooltipText = 'Custom messages',
  colorIcon = 'gray',
  category = 'message',
}: ShowTemplateButtonProps) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const queryClient = useQueryClient();
  const deleteDisclosure = useDisclosure();
  const [itemToDelete, setItemToDelete] = useState<string>('');
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  // Resuelve los hex de tema (más suave para interpolar)
  const [red500, red300] = useToken('colors', ['red.500', 'red.300']);

  const shouldBlink = !prefersReducedMotion && /^red(\.|$)/.test(colorIcon);
  const iconBlinkAnimation = shouldBlink
    ? `${tonePulse} 1.6s ease-in-out infinite alternate`
    : 'none';

  // ───────────────── tokens (igual) ─────────────────
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
      const parts = String(field).split('+').map((f) => f.trim());
      parts.forEach((part) => {
        const match = part.match(/^(\w+)\.0(\..+)?$/);
        if (match) {
          projection[match[1]] = { $slice: 1 };
        } else {
          projection[part] = 1;
        }
      });
    });
    // Ensure patient color is available for UI uses
    projection["color"] = 1;
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
    enabled: isOpen,
    fields: 'title,content',
  });

  const allTemplates: MessageTemplate[] = data?.pages.flatMap((p) => p.items) ?? [];

  // ───────────────── Detectar si es un contacto y filtrar plantillas ─────────────────
  const isContact = useMemo(() => {
    if (!patientInfo || patientInfo.length === 0) return false;
    const patient = patientInfo[0];
    // Un contacto tiene solo campos básicos y no tiene selectedAppDates
    const hasSelectedAppDates = patient?.selectedAppDates && 
      Array.isArray(patient.selectedAppDates) && 
      patient.selectedAppDates.length > 0;
    
    return !hasSelectedAppDates;
  }, [patientInfo]);

  // Obtener los fields básicos de contacto desde los tokens de BD
  const contactAllowedFields = useMemo(() => {
    return ['firstName', 'lastName', 'phone', 'nameInput', 'lastNameInput', 'phoneInput', 'org_name', null];
  }, []);

  // Filtrar plantillas: para contactos, solo mostrar las que usen tokens básicos
  const filteredTemplates = useMemo(() => {
    if (!isContact || !tokens) return allTemplates;

    // Obtener todos los tokens básicos permitidos (field en contactAllowedFields)
    const allowedTokenStrings = tokens
      .filter(t => contactAllowedFields.includes(t.field))
      .map(t => t.key);

    console.log('🔍 Filtrado de plantillas para contacto:', {
      isContact,
      allowedTokens: allowedTokenStrings,
      totalTemplates: allTemplates.length,
    });

    return allTemplates.filter((template) => {
      const variablesUsed = template.variablesUsed || [];
      
      // Si no usa variables, es válida para todos
      if (variablesUsed.length === 0) return true;

      // Verificar que TODAS las variables usadas estén en los tokens permitidos
      const isAllowed = variablesUsed.every((varToken) => {
        return allowedTokenStrings.includes(varToken);
      });

      if (!isAllowed) {
        console.log('❌ Plantilla rechazada:', template.title, 'Tokens:', variablesUsed);
      }

      return isAllowed;
    });
  }, [isContact, allTemplates, tokens, contactAllowedFields]);

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
    if (!patientInfo || patientInfo.length === 0) return;
    const filledMessage = applyTemplateTokens(
      template.content, 
      patientInfo[0], 
      tokens ?? []
    );
    onSelectTemplate(filledMessage);
    onClose();
  };

  const confirmDelete = (id: string) => {
    setItemToDelete(id);
    deleteDisclosure.onOpen();
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

  const loadingInitial =
    templatesStatus === 'pending' || isLoadingTokens || isLoadingPatient;

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
              // variables para la animación suave + hint de perf
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
          onClick={onOpen}
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
    </>
  );
}
