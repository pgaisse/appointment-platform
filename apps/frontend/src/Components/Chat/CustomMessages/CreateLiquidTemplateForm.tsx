import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Textarea,
  VStack,
  Heading,
  useToast,
  HStack,
  Text,
  Select,
  FormErrorMessage,
  Badge,
  Flex,
  Input,
  Spinner,
  SimpleGrid,
  GridItem,
  Divider,
  Tag,
} from '@chakra-ui/react';
import { Tooltip } from '@chakra-ui/react';
import { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import DOMPurify from 'dompurify';
import CustomInputN from '@/Components/Form/CustomInputN';
import { messageTemplateSchema, ScheaMessageTemplate } from '@/schemas/MessageTemplateSchema';
import { FormMode } from '@/types';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MdOutlineTitle } from 'react-icons/md';
import { useCreateMessageTemplate } from '@/Hooks/Query/useCreateMessageTemplate';
import { useAuth0 } from '@auth0/auth0-react';
// LiquidTokenPalette no se usa en esta pantalla cuando solo se muestran tokens ":". Dejamos el import fuera.
import { useGetCollection } from '@/Hooks/Query/useGetCollection';
import { TemplateToken } from '@/types';
import LiquidTokenManagerModal from './LiquidTokenManagerModal';

type Props = {
  onClose?: () => void;
  onCreated?: () => void;
  mode?: FormMode; // 'CREATION' | 'EDITION'
  defaultCategory?: 'message' | 'confirmation';
  defaultAppointmentId?: string; // prefill preview context
  initialData?: ScheaMessageTemplate & { _id?: string }; // for edition
  selectedSlot?: { _id?: string; startDate?: string | Date; endDate?: string | Date };
  calendarSlot?: { startDate?: string | Date; endDate?: string | Date };
};

import { useUpdateItems } from '@/Hooks/Query/useUpdateItems';

export default function CreateLiquidTemplateForm({ onClose, onCreated, defaultCategory = 'message', defaultAppointmentId, mode = 'CREATION', initialData, selectedSlot, calendarSlot }: Props) {
  const toast = useToast();
  const { getAccessTokenSilently } = useAuth0();
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const { mutate, isPending } = useCreateMessageTemplate();
  const { mutateAsync: updateItemsAsync, isPending: isUpdating } = useUpdateItems();
  const [isRendering, setIsRendering] = useState(false);
  const [isLinting, setIsLinting] = useState(false);
  const [appointmentId, setAppointmentId] = useState<string>(defaultAppointmentId ?? '');
  const [rendered, setRendered] = useState('');
  const [autoRendering, setAutoRendering] = useState(false);
  const [lintDiagnostics, setLintDiagnostics] = useState<any>(null);
  const { data: registryTokens } = useGetCollection<TemplateToken>('TemplateToken', { mongoQuery: {} });
  // Augment registry tokens with synthetic slot tokens if backend didn't append them
  const augmentedTokens = useMemo<TemplateToken[]>(() => {
    const base = registryTokens || [];
    const keys = new Set(base.map(t => t.key));
    const synthetic: TemplateToken[] = [];
    const addSyn = (key: string, label: string, description: string, type: 'string' | 'date' | 'time') => {
      synthetic.push({
        _id: `${key}-synthetic`,
        key,
        label,
        description,
        field: null,
        secondLevelField: null,
        type,
        org_id: '',
        synthetic: true,
      } as TemplateToken);
    };
    // Selected base slot tokens
    if (!keys.has(':SelectedSlotDate')) addSyn(':SelectedSlotDate', 'Selected Slot Date', 'Fecha (inicio) del slot base elegido', 'date');
    if (!keys.has(':SelectedSlotRange')) addSyn(':SelectedSlotRange', 'Selected Slot Range', 'Rango completo del slot base elegido', 'string');
    // Calendar selection tokens
    if (!keys.has(':CalendarSlotDate')) addSyn(':CalendarSlotDate', 'Calendar Slot Date', 'Fecha inicial del rango seleccionado en el calendario', 'date');
    if (!keys.has(':CalendarSlotRange')) addSyn(':CalendarSlotRange', 'Calendar Slot Range', 'Rango completo seleccionado en el calendario', 'string');
    if (!keys.has(':CalendarSlotStartTime')) addSyn(':CalendarSlotStartTime', 'Calendar Slot Start Time', 'Hora inicio del rango calendario', 'time');
    if (!keys.has(':CalendarSlotEndTime')) addSyn(':CalendarSlotEndTime', 'Calendar Slot End Time', 'Hora fin del rango calendario', 'time');
    return base.concat(synthetic);
  }, [registryTokens]);

  const {
    register,
    handleSubmit,
    control,
    getValues,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ScheaMessageTemplate>({
    resolver: zodResolver(messageTemplateSchema as any),
    defaultValues: initialData ? {
      category: initialData.category as any || defaultCategory,
      title: initialData.title || '',
      content: initialData.content || '',
      variablesUsed: initialData.variablesUsed || [],
    } : {
      category: defaultCategory,
      title: '',
      content: '',
      variablesUsed: [],
    },
    mode: 'onChange',
  });

  const disabled = isPending || isSubmitting || isUpdating;
  const AUDIENCE = (window as any).__ENV__?.AUTH0_AUDIENCE ?? import.meta.env.VITE_AUTH0_AUDIENCE;

  // Sync external defaultAppointmentId changes (e.g. when opening edit modal for a specific patient)
  useEffect(() => {
    if (defaultAppointmentId && defaultAppointmentId !== appointmentId) {
      setAppointmentId(defaultAppointmentId);
    }
  }, [defaultAppointmentId]);

  const sanitize = (data: ScheaMessageTemplate): ScheaMessageTemplate => ({
    ...data,
    title: DOMPurify.sanitize(data.title ?? '', { ALLOWED_TAGS: [] }),
    content: DOMPurify.sanitize(data.content ?? '', { ALLOWED_TAGS: [] }),
    category: data.category
      ? (DOMPurify.sanitize(data.category, { ALLOWED_TAGS: [] }) as any)
      : 'message',
    variablesUsed: [], // Liquid no requiere variablesUsed; backend extrae colon si existiera
  });

  const onSubmit = async (raw: ScheaMessageTemplate) => {
    const cleaned = sanitize(raw);
    if (mode === 'CREATION') {
      mutate(cleaned, {
        onSuccess: () => {
          toast({ title: 'Template created.', status: 'success', duration: 2500, isClosable: true });
          onCreated?.();
          onClose?.();
        },
        onError: (error: any) => {
          toast({ title: 'Error saving template', description: error?.response?.data?.message || 'Unexpected error', status: 'error' });
        },
      });
    } else if (mode === 'EDITION') {
      if (!initialData?._id) {
        toast({ title: 'Missing template id for edit.', status: 'error' });
        return;
      }
      try {
        await updateItemsAsync([{
          table: 'MessageTemplate',
          id_field: '_id',
          id_value: initialData._id,
          data: {
            title: cleaned.title,
            content: cleaned.content,
            category: cleaned.category,
            variablesUsed: [],
          },
        }]);
        toast({ title: 'Template updated.', status: 'success', duration: 2000 });
        onCreated?.();
        onClose?.();
      } catch (e: any) {
        toast({ title: 'Update failed', description: e?.message, status: 'error' });
      }
    }
  };

  // Watch content for auto preview (placed early for syntax memo dependencies)
  const content = watch('content');

  // Helpers to detect syntax (transparent to user)
  const hasLiquid = useCallback((s: string) => /({{|{%)/.test(s), []);
  const hasColon = useCallback((s: string) => /:[A-Za-z][A-Za-z0-9_]*/.test(s), []);
  const syntaxKind = useMemo(() => {
    const c = getValues('content') || '';
    const l = hasLiquid(c);
    const col = hasColon(c);
    if (l && col) return 'mixed';
    if (l) return 'liquid';
    if (col) return 'colon';
    return 'plain';
  }, [content, hasLiquid, hasColon]);

  // Manual preview (force render) with silent fallback: unified → colon-only → raw
  const handleRender = useCallback(async () => {
    try {
      setIsRendering(true);
      setRendered('');
      const token = await getAccessTokenSilently({
        authorizationParams: AUDIENCE ? { audience: AUDIENCE } : undefined,
      });
      let res = await fetch('/api/tokens/unified/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ template: getValues('content'), appointmentId: appointmentId || undefined, selectedSlot, calendarSlot }),
      });
      const text = await res.text();
      if (!res.ok) {
        // Fallback colon-only render if unified failed
        try {
          res = await fetch('/api/tokens/render', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ content: getValues('content'), appointmentId: appointmentId || undefined }),
          });
          const t2 = await res.text();
          if (!res.ok) {
            setRendered(getValues('content'));
            return;
          }
          let d2: any = {}; try { d2 = JSON.parse(t2); } catch {}
          setRendered(d2.rendered || d2.result || t2 || '');
          return;
        } catch (_) {
          setRendered(getValues('content'));
          return;
        }
      }
      let data: any = {};
      try { data = JSON.parse(text); } catch {}
      setRendered(data.rendered || data.result || text || '');
    } catch (e: any) {
      // Silent error: show raw content so user doesn't see failure
      setRendered(getValues('content'));
    } finally {
      setIsRendering(false);
    }
  }, [AUDIENCE, appointmentId, getAccessTokenSilently, getValues, toast]);

  // Lint function (renamed from erroneous second handleRender)
  const handleLint = useCallback(async () => {
    try {
      setIsLinting(true);
      const token = await getAccessTokenSilently({
        authorizationParams: AUDIENCE ? { audience: AUDIENCE } : undefined,
      });
      const res = await fetch('/api/tokens/unified/lint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ template: getValues('content') }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = body?.message || `Lint failed (${body?.kind || res.status})`;
        toast({ title: 'Lint error', description: msg, status: 'warning' });
        setLintDiagnostics(body);
      } else {
        setLintDiagnostics(body);
        toast({ title: 'Lint OK', status: 'success' });
      }
    } catch (e: any) {
      toast({ title: 'Lint failed', description: e?.message, status: 'error' });
    } finally {
      setIsLinting(false);
    }
  }, [AUDIENCE, getAccessTokenSilently, getValues, toast]);

  const contentLen = (getValues('content') || '').length;

  // Removed insertSnippet helper; inline snippet insertion implemented in LiquidTokenPalette onInsert

  // Debounced auto-render when content or appointmentId changes with transparent fallback
  useEffect(() => {
    if (!content) return;
    setAutoRendering(true);
    const id = setTimeout(async () => {
      try {
        const token = await getAccessTokenSilently({
          authorizationParams: AUDIENCE ? { audience: AUDIENCE } : undefined,
        });
        let res = await fetch('/api/tokens/unified/render', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ template: content, appointmentId: appointmentId || undefined, selectedSlot, calendarSlot }),
        });
        const text = await res.text();
        if (!res.ok) {
          // Fallback colon-only
          try {
            res = await fetch('/api/tokens/render', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ content, appointmentId: appointmentId || undefined }),
            });
            const t2 = await res.text();
            if (!res.ok) {
              setRendered(content);
              return;
            }
            let d2: any = {}; try { d2 = JSON.parse(t2); } catch {}
            setRendered(d2.rendered || d2.result || t2 || '');
            return;
          } catch (_) {
            setRendered(content);
            return;
          }
        }
        let data: any = {};
        try { data = JSON.parse(text); } catch {}
        setRendered(data.rendered || data.result || text || '');
      } catch (e: any) {
        // Show raw content silently
        setRendered(content);
      } finally {
        setAutoRendering(false);
      }
    }, 500); // debounce 500ms
    return () => clearTimeout(id);
  }, [content, appointmentId, getAccessTokenSilently, AUDIENCE]);

  // Removed old ad-hoc snippets in favor of LiquidTokenPalette

  // Derived diagnostics
  const extractedColonTokens: string[] = lintDiagnostics?.colon?.used || [];
  const unknownColonTokens: string[] = lintDiagnostics?.colon?.unknown || [];
  const unknownLiquidVars: string[] = lintDiagnostics?.liquid?.unknownVariables || [];
  const syntaxError: string | null = lintDiagnostics?.liquid?.syntaxError || null;
  const lintIssues: string[] = [
    ...(syntaxError ? [syntaxError] : []),
    ...(unknownColonTokens.length ? [`Unknown colon: ${unknownColonTokens.join(', ')}`] : []),
    ...(unknownLiquidVars.length ? [`Unknown Liquid: ${unknownLiquidVars.join(', ')}`] : []),
  ];
  const isSaving = disabled;
  const isPreviewing = isRendering;
  const livePreview = rendered;
  const classificationBadge = (kind: string) => {
    const map: Record<string, { label: string; color: string }> = {
      mixed: { label: 'Mixed', color: 'orange' },
      liquid: { label: 'Liquid', color: 'purple' },
      colon: { label: 'Colon', color: 'gray' },
      plain: { label: 'Plain', color: 'blue' },
    };
    const cfg = map[kind] || map.plain;
    return <Badge colorScheme={cfg.color}>{cfg.label}</Badge>;
  };
  const handleForcePreview = handleRender;

  return (
    <Box fontSize="sm" borderWidth="1px" rounded="xl" shadow="sm" maxWidth={1200} w="full" mx="auto" p={6} bg="white">
      <Flex align="center" justify="space-between" mb={5} flexWrap="wrap" gap={4}>
        <Heading size="md">{mode === 'EDITION' ? 'Edit Template' : 'New Template'}</Heading>
        <HStack spacing={2}>
          <Button size="sm" variant="outline" onClick={handleLint} isLoading={isLinting}>Lint</Button>
          {/* Preview button removed (redundant due to auto-preview) */}
          <LiquidTokenManagerModal trigger={<Button size="sm" variant="outline">Tokens</Button>} />
          <Button size="sm" colorScheme="blue" onClick={handleSubmit(onSubmit)} isLoading={isSaving}>{mode === 'EDITION' ? 'Update' : 'Save'}</Button>
        </HStack>
      </Flex>

      <SimpleGrid templateColumns={{ base: '1fr', xl: '2fr 3fr' }} gap={8} alignItems="start">
        {/* Left column: meta + palette */}
        <GridItem>
          <VStack align="stretch" spacing={4}>
            <Flex gap={4} flexWrap="wrap">
              <FormControl isInvalid={!!errors.category} minW="160px" maxW="200px">
                <FormLabel fontSize="xs">Category</FormLabel>
                <Controller
                  name="category"
                  control={control}
                  defaultValue={defaultCategory}
                  render={({ field }) => (
                    <Select {...field} isDisabled={disabled} size="sm" borderRadius="md">
                      <option value="message">Message</option>
                      <option value="confirmation">Confirmation</option>
                    </Select>
                  )}
                />
                {errors.category && <FormErrorMessage>{(errors as any).category?.message}</FormErrorMessage>}
              </FormControl>
              <FormControl isInvalid={!!errors.title} flex={1} minW="220px">
                <FormLabel fontSize="xs">Title</FormLabel>
                <CustomInputN
                  isPending={disabled}
                  type="text"
                  name="title"
                  placeholder="Template title"
                  register={register}
                  error={errors.title}
                  ico={<MdOutlineTitle color="gray.300" />}
                />
                {errors.title && <FormErrorMessage>{errors.title.message}</FormErrorMessage>}
              </FormControl>
              <FormControl minW="240px">
                <FormLabel fontSize="xs">Appointment ID (preview)</FormLabel>
                <Input
                  size="sm"
                  placeholder="Optional context"
                  value={appointmentId}
                  onChange={(e) => setAppointmentId(e.target.value)}
                  borderRadius="md"
                />
              </FormControl>
            </Flex>
            <Divider />
            <Box>
              <Heading as="h3" size="xs" mb={3} fontWeight="semibold" color="gray.600">
                Tokens (:Token only)
              </Heading>
              <Box maxH="260px" overflowY="auto" pr={1}>
                <SimpleGrid columns={{ base: 2, md: 2, lg: 3 }} spacing={2} minChildWidth="180px">
                  {(augmentedTokens || [])
                    .filter(t => typeof t?.key === 'string' && t.key.startsWith(':'))
                    .sort((a, b) => a.key.localeCompare(b.key))
                    .map((t) => (
                      <Box
                        key={t._id}
                        p={2}
                        borderWidth="1px"
                        rounded="md"
                        bg="gray.50"
                        _hover={{ bg: 'gray.100', borderColor: 'gray.300' }}
                        display="flex"
                        flexDirection="column"
                        gap={2}
                      >
                        <HStack spacing={1} flexWrap="wrap" align="center">
                          <Tag colorScheme="gray" maxW="100%">{t.key}</Tag>
                          {t.label && <Tag maxW="100%">{t.label}</Tag>}
                          {t.synthetic && <Tag colorScheme="purple" variant="subtle">synthetic</Tag>}
                        </HStack>
                        {t.description && (
                          <Tooltip label={t.description} placement="top" hasArrow>
                            <Text fontSize="xs" noOfLines={1} color="gray.600" cursor="help">
                              {t.description}
                            </Text>
                          </Tooltip>
                        )}
                        <Button
                          size="xs"
                          variant="solid"
                          colorScheme="blue"
                          onClick={() => {
                            const v = getValues('content') || '';
                            const next = v ? `${v}${v.endsWith(' ') ? '' : ' '}${t.key}` : t.key;
                            setValue('content', next);
                          }}
                        >
                          Insert
                        </Button>
                      </Box>
                    ))}
                </SimpleGrid>
                {(!augmentedTokens || augmentedTokens.filter(t => t.key?.startsWith(':')).length === 0) && (
                  <Text fontSize="xs" color="gray.500" mt={2}>No tokens registered.</Text>
                )}
              </Box>
            </Box>
          </VStack>
        </GridItem>
        {/* Right column: editor (top) + live preview (bottom) */}
        <GridItem position="relative">
          {/* Editor */}
          <FormControl isInvalid={!!errors.content} mb={3}>
            <Flex justify="space-between" align="center" mb={1}>
              <FormLabel m={0} fontSize="xs">Template content</FormLabel>
              <Badge colorScheme="gray">{contentLen} chars</Badge>
            </Flex>
            <Controller
              name="content"
              control={control}
              render={({ field }) => (
                <Textarea
                  {...field}
                  ref={(el) => {
                    inputRef.current = el;
                    field.ref(el);
                  }}
                  resize="vertical"
                  minH="240px"
                  fontFamily="mono"
                  fontSize="sm"
                  borderRadius="md"
                  placeholder="Write your template (Liquid or colon tokens)"
                />
              )}
            />
            {errors.content && <Text fontSize="xs" color="red.500">{errors.content.message}</Text>}
          </FormControl>
          <HStack spacing={2} mb={4}>
            <Button size="xs" variant="outline" onClick={handleLint} isLoading={isLinting}>Lint</Button>
            <Button size="xs" variant="outline" onClick={handleForcePreview} isLoading={isPreviewing}>Force Preview</Button>
          </HStack>

          {/* Live preview */}
          <Box
            border="1px solid"
            borderColor="gray.200"
            bg="white"
            p={4}
            borderRadius="xl"
            boxShadow="sm"
            position="sticky"
            top="12px"
          >
            <HStack justify="space-between" mb={3}>
              <Heading as="h3" size="xs" fontWeight="semibold" color="gray.600">
                Live preview
              </Heading>
              {classificationBadge(syntaxKind)}
            </HStack>
            <Box
              border="1px solid"
              borderColor="gray.100"
              bg="gray.50"
              p={3}
              borderRadius="lg"
              fontFamily="mono"
              fontSize="sm"
              whiteSpace="pre-wrap"
              minH="200px"
              position="relative"
            >
              {autoRendering && (
                <HStack position="absolute" top={2} right={2} spacing={2}>
                  <Spinner size="xs" />
                  <Text fontSize="xs" color="gray.500">Rendering…</Text>
                </HStack>
              )}
              <Text>{livePreview || 'Preview will appear here...'}</Text>
            </Box>
            <VStack mt={3} align="start" spacing={1}>
              {extractedColonTokens.length > 0 && (
                <HStack wrap="wrap" spacing={1}>
                  {extractedColonTokens.map(t => (
                    <Tag key={t} size="xs" colorScheme="gray" variant="subtle">{t}</Tag>
                  ))}
                </HStack>
              )}
              {unknownColonTokens.length > 0 && (
                <Text fontSize="xs" color="orange.600">Unknown colon tokens: {unknownColonTokens.join(', ')}</Text>
              )}
              {unknownLiquidVars.length > 0 && (
                <Text fontSize="xs" color="orange.600">Unknown Liquid vars: {unknownLiquidVars.join(', ')}</Text>
              )}
              {syntaxError && (
                <Text fontSize="xs" color="red.600">Syntax error: {syntaxError}</Text>
              )}
              {lintIssues.length > 0 && !syntaxError && (
                <Text fontSize="xs" color="orange.500">Issues: {lintIssues.join(' | ')}</Text>
              )}
            </VStack>
          </Box>
        </GridItem>
      </SimpleGrid>
    </Box>
  );
}
