import React from 'react';
import {
  Box,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  HStack,
  Button,
  Text,
  IconButton,
  useColorModeValue,
  Tooltip,
  Switch,
  Input,
  InputGroup,
  InputRightElement,
  CloseButton,
} from '@chakra-ui/react';
import { RepeatIcon } from '@chakra-ui/icons';
import { useConversationHealth } from '@/Hooks/Query/useConversationHealth';
import { useAuthFetch } from '@/api/authFetch';
import { useMutation } from '@tanstack/react-query';

function statusColor(status: string): string {
  switch (status) {
    case 'ok': return 'green';
    case 'invalid': return 'red';
    case 'missing': return 'yellow';
    case 'error': return 'orange';
    default: return 'gray';
  }
}

export default function ChatHealth() {
  const [page, setPage] = React.useState(1);
  const [validate, setValidate] = React.useState(true);
  const [query, setQuery] = React.useState('');
  const [search, setSearch] = React.useState('');
  const limit = 50;

  // Debounce search
  React.useEffect(() => {
    const id = setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(id);
  }, [query]);

  const { data, isFetching, refetch } = useConversationHealth({ page, limit, validate, q: search });
  const items = data?.items ?? [];
  const pagination = data?.pagination;
  const { authFetch } = useAuthFetch();

  // Single repair mutation
  const repairOne = useMutation({
    mutationFn: async (appointmentId: string) => {
      const url = `${import.meta.env.VITE_BASE_URL}/conversations/health/${appointmentId}/repair`;
      return await authFetch(url, { method: 'POST' });
    },
    onSuccess: () => {
      // Refrescar página actual
      refetch();
    }
  });

  // Bulk repair mutation
  const repairAll = useMutation({
    mutationFn: async () => {
      const url = `${import.meta.env.VITE_BASE_URL}/conversations/health/repair-all`;
      return await authFetch(url, { method: 'POST' });
    },
    onSuccess: () => {
      refetch();
    }
  });

  const border = useColorModeValue('gray.200', 'whiteAlpha.200');

  return (
    <Box p={6}>
      <HStack justify="space-between" mb={4}>
        <Heading size="md">Chat Health (Twilio SID validity)</Heading>
        <HStack spacing={4}>
          <InputGroup width="320px">
            <Input
              size="sm"
              placeholder="Search by name, phone, or email"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <InputRightElement h="full">
                <CloseButton size="sm" onClick={() => setQuery('')} />
              </InputRightElement>
            )}
          </InputGroup>
          <HStack>
            <Text fontSize="sm">Validate with Twilio</Text>
            <Switch isChecked={validate} onChange={(e) => setValidate(e.target.checked)} />
          </HStack>
          <Tooltip label="Revalidate current page">
            <IconButton aria-label="Revalidate" icon={<RepeatIcon />} onClick={() => refetch()} isLoading={isFetching} />
          </Tooltip>
          <Tooltip label="Repair all invalid">
            <Button
              size="sm"
              colorScheme="blue"
              onClick={() => repairAll.mutate()}
              isLoading={repairAll.isPending}
              isDisabled={isFetching || repairAll.isPending}
            >
              {repairAll.isPending ? 'Repairing...' : 'Repair All'}
            </Button>
          </Tooltip>
        </HStack>
      </HStack>

      <Box borderWidth="1px" borderColor={border} rounded="md" overflowX="auto">
        <Table size="sm">
          <Thead>
            <Tr>
              <Th>Patient</Th>
              <Th>Phone</Th>
              <Th>SID</Th>
              <Th>Status</Th>
              <Th>Reason</Th>
              <Th>Updated</Th>
              <Th>Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {items.map((it) => {
              // Solo permitir reparar estados 'invalid' (ya no 'missing', ni 'error')
              const canRepair = it.status === 'invalid';
              const rowLoading = repairOne.isPending && repairOne.variables === it.appointmentId;
              return (
                <Tr key={it.appointmentId}>
                  <Td>
                    <Text fontWeight="semibold">{`${it.name} ${it.lastName}`.trim() || 'Unnamed'}</Text>
                    <Text fontSize="xs" color="gray.500">{it.appointmentId}</Text>
                  </Td>
                  <Td>{it.phone || '-'}</Td>
                  <Td><Text fontFamily="mono" fontSize="xs">{it.sid || '-'}</Text></Td>
                  <Td>
                    <Badge colorScheme={statusColor(it.status)} textTransform="none">{it.status}</Badge>
                  </Td>
                  <Td><Text fontSize="sm" noOfLines={2} title={it.reason}>{it.reason || ''}</Text></Td>
                  <Td><Text fontSize="sm">{it.updatedAt ? new Date(it.updatedAt).toLocaleString() : '-'}</Text></Td>
                  <Td>
                    <Button
                      size="xs"
                      colorScheme={canRepair ? 'purple' : 'gray'}
                      variant={canRepair ? 'outline' : 'ghost'}
                      isDisabled={!canRepair || rowLoading}
                      isLoading={rowLoading}
                      onClick={() => repairOne.mutate(it.appointmentId)}
                    >
                      {canRepair ? (rowLoading ? 'Repairing...' : 'Repair') : '—'}
                    </Button>
                  </Td>
                </Tr>
              );
            })}
            {items.length === 0 && (
              <Tr>
                <Td colSpan={7}>
                  <Box py={8} textAlign="center" color="gray.500">No results</Box>
                </Td>
              </Tr>
            )}
          </Tbody>
        </Table>
      </Box>

      <HStack justify="space-between" mt={4}>
        <Button onClick={() => setPage((p) => Math.max(1, p - 1))} isDisabled={page <= 1 || isFetching}>
          Previous
        </Button>
        <Text fontSize="sm">Page {pagination?.page ?? page} of {pagination ? Math.max(1, Math.ceil(pagination.total / (pagination.limit || limit))) : '?'} · Total {pagination?.total ?? 0}</Text>
        <Button onClick={() => setPage((p) => p + 1)} isDisabled={!pagination?.hasMore || isFetching}>
          Next
        </Button>
      </HStack>
    </Box>
  );
}
