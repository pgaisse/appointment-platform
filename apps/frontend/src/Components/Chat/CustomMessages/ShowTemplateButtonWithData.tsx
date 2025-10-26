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
} from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { CloseIcon, SearchIcon } from '@chakra-ui/icons';
import { useEffect, useRef, useState } from 'react';
import { useGetCollection } from '@/Hooks/Query/useGetCollection';
import { Appointment, MessageTemplate, TemplateToken } from '@/types';
import { applyTemplateTokens } from '@/Functions/applyTemplateTokens';
import { useDeleteItem } from '@/Hooks/Query/useDeleteItem';
import { useQueryClient } from '@tanstack/react-query';
import { AiFillLayout } from 'react-icons/ai';
import { useInfiniteMessageTemplates } from '@/Hooks/Query/useInfiniteMessageTemplates';

interface ShowTemplateButtonWithDataProps {
  onSelectTemplate: (text: string) => void;
  /** Objeto con los datos del formulario para aplicar tokens */
  dataForTokens: Partial<Appointment> & Record<string, any>;
  /** Getter opcional para obtener datos frescos justo antes de abrir */
  getDataForTokens?: () => (Partial<Appointment> & Record<string, any>);
  tooltipText?: string;
  colorIcon?: string; // p.ej. "red.500" | "green.500" | "gray"
  category?: 'confirmation' | 'message';
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
}: ShowTemplateButtonWithDataProps) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  // Mantener un snapshot efectivo para rellenar tokens
  const [effectiveData, setEffectiveData] = useState<Partial<Appointment> & Record<string, any>>(dataForTokens);
  useEffect(() => {
    setEffectiveData(dataForTokens);
  }, [dataForTokens]);

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
    const filledMessage = applyTemplateTokens(template.content, effectiveData, tokens ?? []);
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
