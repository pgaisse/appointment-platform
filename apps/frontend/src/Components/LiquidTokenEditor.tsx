import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Flex,
  HStack,
  Input,
  Select,
  Spinner,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Tag,
  Text,
  Textarea,
  Tooltip,
  VStack,
  useToast,
} from '@chakra-ui/react';
import { useAuth0 } from '@auth0/auth0-react';
import { useGetCollection } from '@/Hooks/Query/useGetCollection';
import { TemplateToken } from '@/types';
import LiquidTokenPalette from '@/Components/Chat/CustomMessages/LiquidTokenPalette';

/**
 * Lightweight editor to try new token system (colon and Liquid) without touching scheduler.
 * - Lists TemplateToken registry and lets you insert tokens in the textarea
 * - Renders server-side using /api/tokens/render (colon) or /api/tokens/liquid/render (liquid)
 */
interface LiquidTokenEditorProps {
  calendarSlot?: { startDate?: Date; endDate?: Date } | null;
}

export default function LiquidTokenEditor({ calendarSlot }: LiquidTokenEditorProps) {
  const toast = useToast();
  const { getAccessTokenSilently } = useAuth0();
  const [mode, setMode] = useState<'colon' | 'liquid'>('liquid');
  const [appointmentId, setAppointmentId] = useState('');
  const [template, setTemplate] = useState('Hello {{ patient.nameInput | default: "Patient" }}');
  const [rendered, setRendered] = useState<string>('');
  const [isRendering, setIsRendering] = useState(false);
  const [isLinting, setIsLinting] = useState(false);
  const [lintIssues, setLintIssues] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const { data: tokens, isLoading } = useGetCollection<TemplateToken>('TemplateToken', {
    mongoQuery: {},
  });
  // Augment tokens with calendar slot synthetic tokens if missing
  const augmentedTokens = useMemo<TemplateToken[]>(() => {
    const base = tokens || [];
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
    if (!keys.has(':CalendarSlotDate')) addSyn(':CalendarSlotDate', 'Calendar Slot Date', 'Fecha inicial seleccionada en el calendario', 'date');
    if (!keys.has(':CalendarSlotRange')) addSyn(':CalendarSlotRange', 'Calendar Slot Range', 'Rango completo seleccionado en el calendario', 'string');
    if (!keys.has(':CalendarSlotStartTime')) addSyn(':CalendarSlotStartTime', 'Calendar Slot Start Time', 'Hora de inicio del rango calendario', 'time');
    if (!keys.has(':CalendarSlotEndTime')) addSyn(':CalendarSlotEndTime', 'Calendar Slot End Time', 'Hora de fin del rango calendario', 'time');
    return base.concat(synthetic);
  }, [tokens]);

  const filteredTokens = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || !augmentedTokens) return augmentedTokens ?? [];
    return augmentedTokens.filter(t =>
      t.key.toLowerCase().includes(q) ||
      (t.label || '').toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q)
    );
  }, [augmentedTokens, search]);

  const insert = useCallback((text: string) => {
    setTemplate(prev => {
      const before = prev || '';
      const next = (before.trimEnd() + ' ' + text + ' ').trimStart();
      setTimeout(() => {
        const el = inputRef.current;
        if (el) {
          el.focus();
          const len = next.length;
          el.setSelectionRange(len, len);
        }
      }, 0);
      return next;
    });
  }, []);

  const handleRender = useCallback(async () => {
    try {
      setIsRendering(true);
      setRendered('');
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: (window as any).__ENV__?.AUTH0_AUDIENCE ?? import.meta.env.VITE_AUTH0_AUDIENCE },
      });

      // Unified endpoint: always send { template }
      const url = '/api/tokens/unified/render';
      const body: any = { template, appointmentId: appointmentId || undefined };
      if (calendarSlot && (calendarSlot.startDate || calendarSlot.endDate)) {
        body.calendarSlot = {
          startDate: calendarSlot.startDate?.toISOString?.() || calendarSlot.startDate,
          endDate: calendarSlot.endDate?.toISOString?.() || calendarSlot.endDate,
        };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      if (!res.ok) {
        // Try to parse JSON error to surface message
        try {
          const j = JSON.parse(text);
          throw new Error(j?.message || j?.error || `${res.status}`);
        } catch (_) {
          throw new Error(`${res.status} ${text}`);
        }
      }
      let data: any = {};
      try { data = JSON.parse(text); } catch {}
      setRendered(data.rendered || data.result || text || '');
    } catch (e: any) {
      toast({ title: 'Render failed', description: e?.message, status: 'error' });
    } finally {
      setIsRendering(false);
    }
  }, [appointmentId, getAccessTokenSilently, mode, template, toast]);

  const handleLint = useCallback(async () => {
    try {
      setIsLinting(true);
      setLintIssues([]);
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: (window as any).__ENV__?.AUTH0_AUDIENCE ?? import.meta.env.VITE_AUTH0_AUDIENCE },
      });

  const url = '/api/tokens/unified/lint';
  const body = { template };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.message || data?.error || res.statusText;
        throw new Error(msg);
      }

      const issues: string[] = [];
      // Unified diagnostics
      if (data?.liquid?.syntaxError) issues.push(`Liquid sintaxis: ${data.liquid.syntaxError}`);
      if (Array.isArray(data?.liquid?.unknownVariables) && data.liquid.unknownVariables.length) {
        issues.push(`Liquid variables desconocidas: ${data.liquid.unknownVariables.join(', ')}`);
      }
      if (Array.isArray(data?.colon?.unknown) && data.colon.unknown.length) {
        issues.push(`Tokens colon no registrados: ${data.colon.unknown.join(', ')}`);
      }

      if (issues.length) {
        setLintIssues(issues);
        toast({
          title: 'Lint detectó problemas',
          description: issues.slice(0, 3).join(' • ') + (issues.length > 3 ? ` (+${issues.length - 3} más)` : ''),
          status: 'warning',
          duration: 5000,
          isClosable: true,
        });
      } else {
  toast({ title: 'Lint OK', description: 'Sintaxis Liquid y tokens colon válidos', status: 'success' });
      }
    } catch (e: any) {
      toast({ title: 'Lint failed', description: e?.message, status: 'error' });
    } finally {
      setIsLinting(false);
    }
  }, [getAccessTokenSilently, template, mode, toast]);

  return (
    <Box p={3} borderWidth="1px" rounded="md" mt={4}>
      <Flex justify="space-between" align="center" mb={3}>
        <Text fontWeight="semibold">Token Editor (Liquid & Colon)</Text>
        <HStack>
          <Select size="sm" value={mode} onChange={(e) => setMode(e.target.value as any)} w="auto">
            <option value="liquid">Liquid</option>
            <option value="colon">Colon (:Token)</option>
          </Select>
          <Input
            size="sm"
            placeholder="Appointment ID (optional)"
            value={appointmentId}
            onChange={(e) => setAppointmentId(e.target.value)}
            w="320px"
          />
          <Button size="sm" onClick={handleLint} isLoading={isLinting} variant="outline">
            Lint
          </Button>
          <Button size="sm" colorScheme="blue" onClick={handleRender} isLoading={isRendering}>
            Render
          </Button>
        </HStack>
      </Flex>

      <Tabs variant="enclosed" colorScheme="blue">
        <TabList>
          <Tab>Template</Tab>
          <Tab>Tokens</Tab>
          <Tab>Result</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <Textarea
              ref={inputRef}
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              minH="140px"
              fontFamily="mono"
            />
            <Text mt={2} fontSize="sm" color="gray.600">
              Liquid example: {"{{ patient.nameInput | default: \"Patient\" }}"} — Colon example: {":Name"}
            </Text>
            {lintIssues.length > 0 && (
              <VStack align="start" mt={3} spacing={1}>
                {lintIssues.map((msg, i) => (
                  <Text key={i} color="orange.600">• {msg}</Text>
                ))}
              </VStack>
            )}
          </TabPanel>
          <TabPanel>
            {mode === 'liquid' ? (
              <Box>
                <LiquidTokenPalette onInsert={(code) => insert(code)} size="sm" />
              </Box>
            ) : (
              <>
                <HStack mb={2}>
                  <Input size="sm" placeholder="Search tokens…" value={search} onChange={(e) => setSearch(e.target.value)} />
                  {isLoading && <Spinner size="sm" />}
                </HStack>
                <VStack align="stretch" spacing={2} maxH="220px" overflowY="auto">
                  {(filteredTokens || []).map((t) => (
                    <Flex key={t._id} justify="space-between" align="center" p={2} borderWidth="1px" rounded="md">
                      <HStack>
                        <Tag colorScheme="gray">{t.key}</Tag>
                        {t.label && <Tag>{t.label}</Tag>}
                        {t.synthetic && <Tag colorScheme="purple" variant="subtle">synthetic</Tag>}
                      </HStack>
                      <HStack>
                        <Tooltip label="Insert token">
                          <Button size="xs" onClick={() => insert(t.key)}>
                            Insert
                          </Button>
                        </Tooltip>
                      </HStack>
                    </Flex>
                  ))}
                  {!isLoading && (!filteredTokens || filteredTokens.length === 0) && (
                    <Text fontSize="sm" color="gray.500">No tokens found.</Text>
                  )}
                </VStack>
              </>
            )}
          </TabPanel>
          <TabPanel>
            <Box p={2} borderWidth="1px" rounded="md" bg="gray.50" fontFamily="mono" whiteSpace="pre-wrap">
              {rendered || <Text color="gray.500">No result yet. Click Render.</Text>}
            </Box>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
}
