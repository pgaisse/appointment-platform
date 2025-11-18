import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  HStack,
  Input,
  Select,
  Spinner,
  Text,
  Textarea,
  VStack,
  useToast,
  IconButton,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Tag,
  Badge,
} from '@chakra-ui/react';
import { useAuth0 } from '@auth0/auth0-react';
import { TemplateToken } from '@/types';
import { DeleteIcon, EditIcon } from '@chakra-ui/icons';

export default function LiquidTokenManager() {
  const toast = useToast();
  const { getAccessTokenSilently } = useAuth0();
  const AUDIENCE = (window as any).__ENV__?.AUTH0_AUDIENCE ?? import.meta.env.VITE_AUTH0_AUDIENCE;

  const [items, setItems] = useState<TemplateToken[]>([] as any);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [keyVal, setKeyVal] = useState('');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [field, setField] = useState<string>('');
  const [secondLevelField, setSecondLevelField] = useState<string>('');
  const [typeVal, setTypeVal] = useState<'string' | 'date' | 'time' | 'phone' | 'custom'>('string');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const resetForm = () => {
    setEditingId(null);
    setKeyVal('');
    setLabel('');
    setDescription('');
    setField('');
    setSecondLevelField('');
    setTypeVal('string');
    setErrors({});
  };

  const fetchRegistry = async () => {
    try {
      setLoading(true);
      const token = await getAccessTokenSilently({
        authorizationParams: AUDIENCE ? { audience: AUDIENCE } : undefined,
      });
      const res = await fetch('/api/tokens/registry', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || res.statusText);
      setItems(body.items || []);
    } catch (e: any) {
      toast({ title: 'Failed to load tokens', description: e?.message, status: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validate = () => {
    const errs: Record<string, string> = {};
    const k = (keyVal || '').trim();
    if (!k) errs.key = 'Key is required';
    if (k && !k.startsWith(':')) errs.key = 'Key must start with : (e.g., :Name)';
    if (!label.trim()) errs.label = 'Label is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    try {
      setSaving(true);
      const token = await getAccessTokenSilently({
        authorizationParams: AUDIENCE ? { audience: AUDIENCE } : undefined,
      });
      const payload = {
        key: keyVal.trim(),
        label: label.trim(),
        description: description.trim(),
        field: field.trim() || null,
        secondLevelField: secondLevelField.trim() || null,
        type: typeVal,
      };
      const res = await fetch(editingId ? `/api/tokens/${editingId}` : '/api/tokens', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body?.ok === false) {
        const msg = body?.error || body?.message || res.statusText;
        throw new Error(msg);
      }
      toast({ title: editingId ? 'Token updated' : 'Token created', status: 'success' });
      resetForm();
      await fetchRegistry();
    } catch (e: any) {
      toast({ title: 'Save failed', description: e?.message, status: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (t: any) => {
    setEditingId(String(t._id));
    setKeyVal(t.key || '');
    setLabel(t.label || '');
    setDescription(t.description || '');
    setField(t.field || '');
    setSecondLevelField(t.secondLevelField || '');
    setTypeVal((t.type as any) || 'string');
    setErrors({});
  };

  const doDelete = async (id: string) => {
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: AUDIENCE ? { audience: AUDIENCE } : undefined,
      });
      const res = await fetch(`/api/tokens/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Delete failed');
      toast({ title: 'Token deleted', status: 'info' });
      await fetchRegistry();
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e?.message, status: 'error' });
    }
  };

  return (
    <Box>
      <Text fontWeight="semibold" mb={2}>Token Registry (Liquid/Colon)</Text>
      <Text fontSize="sm" color="gray.600" mb={3}>
        Crea y gestiona tokens para el sistema de plantillas. Para Colon, usa la <b>key</b> (e.g., <code>:Name</code>). Para Liquid, generalmente no necesitas registrarlos, pero puedes mapear <b>field</b> y <b>secondLevelField</b> como referencia.
      </Text>

      {/* Form */}
      <VStack align="stretch" spacing={3} p={3} borderWidth="1px" rounded="md" mb={4}>
        <HStack>
          <FormControl isInvalid={!!errors.key} maxW="220px">
            <FormLabel>Key</FormLabel>
            <Input placeholder=":Name" value={keyVal} onChange={(e) => setKeyVal(e.target.value)} />
            {errors.key && <FormErrorMessage>{errors.key}</FormErrorMessage>}
          </FormControl>
          <FormControl isInvalid={!!errors.label}>
            <FormLabel>Label</FormLabel>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} />
            {errors.label && <FormErrorMessage>{errors.label}</FormErrorMessage>}
          </FormControl>
          <FormControl maxW="220px">
            <FormLabel>Type</FormLabel>
            <Select value={typeVal} onChange={(e) => setTypeVal(e.target.value as any)}>
              <option value="string">string</option>
              <option value="date">date</option>
              <option value="time">time</option>
              <option value="phone">phone</option>
              <option value="custom">custom</option>
            </Select>
          </FormControl>
        </HStack>
        <FormControl>
          <FormLabel>Description</FormLabel>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </FormControl>
        <HStack>
          <FormControl>
            <FormLabel>Field</FormLabel>
            <Input placeholder="e.g., nameInput or selectedAppDates.0.startDate" value={field} onChange={(e) => setField(e.target.value)} />
          </FormControl>
          <FormControl>
            <FormLabel>Second Level Field</FormLabel>
            <Input placeholder="Optional sub-field" value={secondLevelField} onChange={(e) => setSecondLevelField(e.target.value)} />
          </FormControl>
        </HStack>
        <HStack justify="flex-end">
          {editingId && (
            <Button variant="ghost" onClick={resetForm}>Cancel</Button>
          )}
          <Button colorScheme="blue" onClick={submit} isLoading={saving}>
            {editingId ? 'Update' : 'Create'}
          </Button>
        </HStack>
      </VStack>

      {/* List */}
      <Box borderWidth="1px" rounded="md" overflow="hidden">
        <Flex p={2} justify="space-between" align="center" borderBottomWidth="1px">
          <Text fontWeight="semibold">Registered Tokens</Text>
          {loading && <Spinner size="sm" />}
        </Flex>
        <Box maxH="360px" overflowY="auto">
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>Key</Th>
                <Th>Label</Th>
                <Th>Type</Th>
                <Th>Field</Th>
                <Th>Second</Th>
                <Th>Description</Th>
                <Th isNumeric>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {items.map((t: any) => (
                <Tr key={t._id} _hover={{ bg: 'gray.50' }}>
                  <Td><Tag>{t.key}</Tag></Td>
                  <Td>{t.label}</Td>
                  <Td><Badge>{t.type || 'string'}</Badge></Td>
                  <Td>{t.field || <Text color="gray.400">—</Text>}</Td>
                  <Td>{t.secondLevelField || <Text color="gray.400">—</Text>}</Td>
                  <Td maxW="300px"><Text noOfLines={2}>{t.description}</Text></Td>
                  <Td isNumeric>
                    <HStack justify="flex-end" spacing={2}>
                      <IconButton aria-label="Edit" size="xs" icon={<EditIcon />} onClick={() => startEdit(t)} />
                      <IconButton aria-label="Delete" size="xs" colorScheme="red" icon={<DeleteIcon />} onClick={() => doDelete(String(t._id))} />
                    </HStack>
                  </Td>
                </Tr>
              ))}
              {items.length === 0 && !loading && (
                <Tr>
                  <Td colSpan={7}>
                    <Text p={3} color="gray.500">No tokens yet. Create one above.</Text>
                  </Td>
                </Tr>
              )}
            </Tbody>
          </Table>
        </Box>
      </Box>
    </Box>
  );
}
