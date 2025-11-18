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
  Tag,
  Select,
} from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { CloseIcon, SearchIcon, EditIcon, DeleteIcon } from '@chakra-ui/icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useToast } from '@chakra-ui/react';
import { useGetCollection } from '@/Hooks/Query/useGetCollection';
import { Appointment, MessageTemplate, TemplateToken } from '@/types';
import { applyTemplateTokens } from '@/Functions/applyTemplateTokens';
import { useDeleteItem } from '@/Hooks/Query/useDeleteItem';
import { useQueryClient } from '@tanstack/react-query';
import { AiFillLayout } from 'react-icons/ai';
import CreateLiquidTemplateModal from './CreateLiquidTemplateModal';
import CreateLiquidTemplateForm from './CreateLiquidTemplateForm';
import { useInfiniteMessageTemplates } from '@/Hooks/Query/useInfiniteMessageTemplates';

interface ShowTemplateButtonProps {
  onSelectTemplate: (text: string) => void;
  selectedPatient?: string;
  tooltipText?: string;
  colorIcon?: string; // p.ej. "red.500" | "green.500" | "gray"
  category?: 'confirmation' | 'message';
  initialTypeFilter?: 'all' | 'liquid' | 'colon';
  externalOpenVersion?: number; // when increased, opens drawer
  selectedSlot?: { _id?: string; startDate?: string | Date; endDate?: string | Date };
  calendarSlot?: { startDate?: string | Date; endDate?: string | Date };
}

export type MinimalAppointment = Pick<
  Appointment,
  'nameInput' | 'lastNameInput' | 'phoneInput' | 'selectedAppDates'
>;

// Helper: detect Liquid templates
const isLiquid = (text: string) => /{{|{%/g.test(text);

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
  initialTypeFilter = 'all',
  externalOpenVersion = 0,
  selectedSlot,
  calendarSlot,
}: ShowTemplateButtonProps) {
  const toast = useToast();
  const { getAccessTokenSilently } = useAuth0();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const queryClient = useQueryClient();
  const deleteDisclosure = useDisclosure();
  const [itemToDelete, setItemToDelete] = useState<string>('');
  const [editItem, setEditItem] = useState<MessageTemplate | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const [previewMap, setPreviewMap] = useState<Record<string, string>>({});
  // Per-template loading state for on-demand preview rendering
  const [previewLoadingById, setPreviewLoadingById] = useState<Record<string, boolean>>({});
  const AUDIENCE = (window as any).__ENV__?.AUTH0_AUDIENCE ?? import.meta.env.VITE_AUTH0_AUDIENCE;

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
  const [typeFilter, setTypeFilter] = useState<'all' | 'liquid' | 'colon'>(initialTypeFilter);
  // keep initialTypeFilter on reopen
  useEffect(() => {
    if (isOpen) setTypeFilter(initialTypeFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Imperative open trigger from parent
  useEffect(() => {
    if (externalOpenVersion > 0) {
      setTypeFilter(initialTypeFilter);
      onOpen();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalOpenVersion]);
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

  // Classification helper: detects colon tokens and Liquid tags
  const classifyTemplate = (content: string): 'mixed' | 'liquid' | 'colon' | 'plain' => {
    const hasLiquid = isLiquid(content);
    const hasColon = /:[A-Za-z][A-Za-z0-9_]*/.test(content);
    if (hasLiquid && hasColon) return 'mixed';
    if (hasLiquid) return 'liquid';
    if (hasColon) return 'colon';
    return 'plain';
  };

  const displayedTemplates = useMemo(() => {
    if (typeFilter === 'all') return filteredTemplates;
    if (typeFilter === 'liquid') {
      // Show both Liquid and colon (and mixed) so user can reutilize colon in Liquid context
      return filteredTemplates.filter(t => classifyTemplate(t.content) !== 'plain')
        .sort((a, b) => {
          // Order: mixed > liquid > colon
          const order = { mixed: 0, liquid: 1, colon: 2, plain: 3 };
          return order[classifyTemplate(a.content)] - order[classifyTemplate(b.content)];
        });
    }
    // colon filter only colon (excluding pure Liquid)
    return filteredTemplates.filter(t => classifyTemplate(t.content) === 'colon');
  }, [filteredTemplates, typeFilter]);

  // Extract colon tokens
  const extractColonTokens = (content: string): string[] => {
    const matches = content.match(/:[A-Za-z][A-Za-z0-9_]*/g) || [];
    return Array.from(new Set(matches.map(m => m.trim())));
  };

  // On-demand preview rendering: only when user clicks a template preview box
  const renderPreview = async (template: MessageTemplate) => {
    const id = template._id;
    if (previewMap[id] || previewLoadingById[id]) return; // already rendered or loading
    setPreviewLoadingById(m => ({ ...m, [id]: true }));
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: AUDIENCE ? { audience: AUDIENCE } : undefined,
      }).catch(() => null);
      if (!token) throw new Error('No auth token');
      const res = await fetch('/api/tokens/unified/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ template: template.content, appointmentId: selectedPatient, selectedSlot, calendarSlot }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text);
      let data: any = {}; try { data = JSON.parse(text); } catch {}
      const rendered = data.rendered || data.result || text || '';
      setPreviewMap(m => ({ ...m, [id]: rendered }));
    } catch (_) {
      // Fallback local colon substitution
      const local = patientInfo?.[0] || {};
      const fallback = applyTemplateTokens(template.content, local, tokens ?? []);
      setPreviewMap(m => ({ ...m, [id]: fallback }));
    } finally {
      setPreviewLoadingById(m => ({ ...m, [id]: false }));
    }
  };

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


  const handleSelectTemplate = async (template: MessageTemplate) => {
    try {
      // Always use unified render (Liquid first then colon); fallback local colon on error
      const token = await getAccessTokenSilently({
        authorizationParams: AUDIENCE ? { audience: AUDIENCE } : undefined,
      });

      const res = await fetch('/api/tokens/unified/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ template: template.content, appointmentId: selectedPatient, selectedSlot, calendarSlot }),
      });
      const text = await res.text();
      if (!res.ok) {
        // Fallback local colon substitution
        try {
          const j = JSON.parse(text);
          toast({ title: 'Render error', description: j?.message || j?.error || `${res.status}`, status: 'warning' });
        } catch (_) {
          toast({ title: 'Render error', description: text, status: 'warning' });
        }
        const local = patientInfo?.[0];
        const fallback = applyTemplateTokens(template.content, local || {}, tokens ?? []);
        onSelectTemplate(fallback);
      } else {
        let data: any = {};
        try { data = JSON.parse(text); } catch {}
        const rendered = data.rendered || data.result || text || '';
        onSelectTemplate(rendered);
      }
    } catch (e: any) {
      toast({ title: 'Template apply failed', description: e?.message, status: 'error' });
    } finally {
      onClose();
    }
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
  console.log("tooltipText", tooltipText)
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
              <CreateLiquidTemplateModal
                trigger={<Button size="sm" colorScheme="purple" variant="outline">New Template</Button>}
                defaultCategory={category}
                defaultAppointmentId={selectedPatient}
                selectedSlot={selectedSlot}
                calendarSlot={calendarSlot}
              />
            </HStack>
          </DrawerHeader>

          <DrawerBody ref={drawerBodyRef}>
            {/* Buscador */}
            <HStack mb={3} spacing={2} align="stretch">
              <InputGroup size="sm">
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
              <Select size="sm" w="44%" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)}>
                <option value="all">All</option>
                <option value="liquid">Liquid</option>
                <option value="colon">Colon</option>
              </Select>
            </HStack>

            {/* User hint for on-demand preview */}
            {!loadingInitial && (
              <Box mb={2} fontSize="xs" color="gray.600">
                Tip: Click the gray preview box to render the message with current patient data and slot.
              </Box>
            )}
            {loadingInitial ? (
              <Spinner mt={4} />
            ) : (
              <>
                {displayedTemplates.length === 0 && !isFetching ? (
                  <Box mt={4} color="gray.500" fontSize="sm">
                    {isContact ? 'No templates available for contacts with basic info.' : 'No templates found.'}
                  </Box>
                ) : (
                  <VStack spacing={4} align="stretch">
                    {displayedTemplates.map((template) => {
                      const isLoadingPreview = !!previewLoadingById[template._id];
                      const rendered = previewMap[template._id];
                      return (
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
                        <HStack justify="space-between" align="center" mb={1} spacing={2}>
                          <Text fontWeight="semibold" noOfLines={1}>{template.title}</Text>
                          <HStack spacing={1}>
                            <IconButton
                              aria-label="Edit template"
                              icon={<EditIcon />}
                              size="xs"
                              variant="ghost"
                              colorScheme="yellow"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditItem(template);
                              }}
                            />
                            <IconButton
                              aria-label="Delete template"
                              icon={<DeleteIcon />}
                              size="xs"
                              variant="ghost"
                              colorScheme="red"
                              onClick={(e) => {
                                e.stopPropagation();
                                confirmDelete(template._id);
                              }}
                            />
                          </HStack>
                        </HStack>
                        <Text fontSize="sm" color="gray.600" noOfLines={2}>
                          {template.content}
                        </Text>
                        {/* Colon tokens badges */}
                        {(() => {
                          const kind = classifyTemplate(template.content);
                          if (kind === 'colon' || kind === 'mixed') {
                            const toks = extractColonTokens(template.content).slice(0, 6);
                            if (toks.length === 0) return null;
                            return (
                              <HStack mt={2} spacing={1} wrap="wrap">
                                {toks.map(t => (
                                  <Tag key={t} size="xs" colorScheme="gray" variant="subtle">{t}</Tag>
                                ))}
                                {extractColonTokens(template.content).length > 6 && (
                                  <Tag size="xs" colorScheme="gray" variant="outline">+{extractColonTokens(template.content).length - 6}</Tag>
                                )}
                              </HStack>
                            );
                          }
                          return null;
                        })()}
                        {/* On-demand preview box */}
                        <Box
                          mt={2}
                          p={2}
                          bg="gray.100"
                          borderRadius="sm"
                          fontSize="xs"
                          fontFamily="mono"
                          maxH="64px"
                          overflow="hidden"
                          whiteSpace="pre-wrap"
                          cursor="pointer"
                          _hover={{ bg: 'gray.200' }}
                          onClick={(e) => { e.stopPropagation(); renderPreview(template); }}
                          title="Click to render preview"
                        >
                          <Text color="gray.700" noOfLines={3}>
                            {rendered ? rendered : (isLoadingPreview ? 'Rendering…' : 'Click here to render preview')}
                          </Text>
                        </Box>
                      </Box>
                      );
                    })}
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
      {/* Edit Modal */}
      <Drawer isOpen={!!editItem} placement="left" onClose={() => setEditItem(null)} size="xl">
        <DrawerOverlay />
        <DrawerContent>
          <DrawerHeader borderBottomWidth="1px">Edit Template</DrawerHeader>
          <DrawerBody>
            {editItem && (
              <CreateLiquidTemplateForm
                mode="EDITION"
                initialData={editItem as any}
                onCreated={() => { refetch(); setEditItem(null); }}
                onClose={() => setEditItem(null)}
                defaultCategory={category}
                defaultAppointmentId={selectedPatient}
                selectedSlot={selectedSlot}
                calendarSlot={calendarSlot}
              />
            )}
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  );
}
