// apps/frontend/src/Routes/Reports/index.tsx
import React, { useState, useEffect } from 'react';
import { Box, Container, Heading, Tabs, TabList, TabPanels, Tab, TabPanel, Input, HStack, Button, Table, Thead, Tbody, Tr, Th, Td, Spinner, Text, useToast, Menu, MenuButton, MenuList, MenuItem, Select } from '@chakra-ui/react';
import { useAuth0 } from '@auth0/auth0-react';
import { formatAusPhoneNumber } from '@/Functions/formatAusPhoneNumber';
import { useReportsResource, ReportsPage } from '@/Hooks/Query/useReportsResource';

// Helper to capitalize words (Name, Last)
function capWords(v: any) {
  const s = (v ?? '').toString().trim();
  if (!s) return '—';
  return s
    .split(/\s+/)
    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

// Helper to normalize phone numbers to format like 0411710260
function formatPhone(v: any) {
  if (v == null) return '—';
  let digits = String(v).replace(/[^0-9]/g, '');
  if (!digits) return '—';
  // Convert Australian country code +61 mobile (e.g., 614XXXXXXXX) to 04XXXXXXXX
  if (digits.startsWith('61') && digits.length >= 11) {
    // If it is a mobile starting with 614
    if (digits[2] === '4') {
      digits = '0' + digits.slice(2);
    }
  }
  // Ensure leading 0 for 10-digit numbers if missing
  if (digits.length === 9 && digits[0] !== '0') {
    digits = '0' + digits;
  }
  // Truncate to 10 digits if longer accidental data
  if (digits.length > 10 && digits.startsWith('0')) {
    digits = digits.slice(0, 10);
  }
  return digits;
}

// Column map per resource
type ColDef = { key: string; label: string; format?: (v:any,row:any)=>React.ReactNode; csvFormat?: (v:any,row:any)=>string };
const RESOURCE_COLUMNS: Record<string, ColDef[]> = {
  appointments: [
    { key: 'nameInput', label: 'Name', format: (v) => capWords(v), csvFormat: (v)=>{ const s = capWords(v); return s==='—'?'':s; } },
    { key: 'lastNameInput', label: 'Last', format: (v) => capWords(v), csvFormat: (v)=>{ const s = capWords(v); return s==='—'?'':s; } },
    { key: 'phoneInput', label: 'Phone', format: v => formatAusPhoneNumber(String(v ?? '')), csvFormat: v => { const f = formatPhone(v); return f==='—'?'':f; } },
    { key: 'emailInput', label: 'Email' },
    { key: 'sid', label: 'SID', format: v => v ? <Text fontSize='xs' color='gray.600'>{v}</Text> : '—', csvFormat: (v)=> v ? String(v) : '' },
    { key: 'user', label: 'User', format: (_v,row) => row.user ? (row.user.name || row.user.email || '—') : (row.user_id || '—'), csvFormat: (_v,row)=> row.user ? (row.user.name || row.user.email || '') : (row.user_id || '') },
    { key: 'createdAt', label: 'Created', format: v => v ? new Date(v).toLocaleString() : '—', csvFormat: v => v ? new Date(v).toLocaleString() : '' },
  ],
  appointmentSlots: [
    { 
      key: 'startDate', 
      label: 'Date', 
      format: (v) => {
        if (!v) return '—';
        const d = new Date(v);
        return d.toLocaleDateString('en-AU', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
      },
      csvFormat: (v) => v ? new Date(v).toLocaleString() : ''
    },
    { key: 'nameInput', label: 'Patient', format: (v, row) => `${capWords(v)} ${capWords(row.lastNameInput)}`, csvFormat: (v, row) => `${capWords(v)} ${capWords(row.lastNameInput)}`.trim() },
    { key: 'phoneInput', label: 'Phone', format: v => formatAusPhoneNumber(String(v ?? '')), csvFormat: v => { const f = formatPhone(v); return f==='—'?'':f; } },
    { 
      key: 'provider', 
      label: 'Provider', 
      format: (_v, row) => row.provider ? `${capWords(row.provider.firstName)} ${capWords(row.provider.lastName)}` : '—',
      csvFormat: (_v, row) => row.provider ? `${capWords(row.provider.firstName)} ${capWords(row.provider.lastName)}`.trim() : ''
    },
    { 
      key: 'treatment', 
      label: 'Treatment', 
      format: (_v, row) => row.treatment?.name || '—',
      csvFormat: (_v, row) => row.treatment?.name || ''
    },
    { 
      key: 'priority', 
      label: 'Priority', 
      format: (_v, row) => row.priority?.name || '—',
      csvFormat: (_v, row) => row.priority?.name || ''
    },
    { 
      key: 'status', 
      label: 'Status', 
      format: (v) => v || '—',
      csvFormat: (v) => v || ''
    },
  ],
  providers: [
    { key: 'firstName', label: 'First', format: (v) => capWords(v), csvFormat: (v)=>{ const s = capWords(v); return s==='—'?'':s; } },
    { key: 'lastName', label: 'Last', format: (v) => capWords(v), csvFormat: (v)=>{ const s = capWords(v); return s==='—'?'':s; } },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone', format: v => formatAusPhoneNumber(String(v ?? '')), csvFormat: v => { const f = formatPhone(v); return f==='—'?'':f; } },
    { key: 'ahpraNumber', label: 'AHPRA' },
    { key: 'user', label: 'User', format: (_v,row) => row.user ? (row.user.name || row.user.email || '—') : '—', csvFormat: (_v,row)=> row.user ? (row.user.name || row.user.email || '') : '' },
    { key: 'createdAt', label: 'Created', format: v => v ? new Date(v).toLocaleString() : '—', csvFormat: v => v ? new Date(v).toLocaleString() : '' },
  ],
  contacts: [
    { key: 'nameInput', label: 'Name', format: (v) => capWords(v), csvFormat: (v)=>{ const s = capWords(v); return s==='—'?'':s; } },
    { key: 'lastNameInput', label: 'Last', format: (v) => capWords(v), csvFormat: (v)=>{ const s = capWords(v); return s==='—'?'':s; } },
    { key: 'phoneInput', label: 'Phone', format: v => formatAusPhoneNumber(String(v ?? '')), csvFormat: v => { const f = formatPhone(v); return f==='—'?'':f; } },
    { key: 'emailInput', label: 'Email' },
    { key: 'sid', label: 'SID', format: v => v ? <Text fontSize='xs' color='gray.600'>{v}</Text> : '—', csvFormat: (v)=> v ? String(v) : '' },
    { key: 'user', label: 'User', format: (_v,row) => row.user ? (row.user.name || row.user.email || '—') : (row.user_id || '—'), csvFormat: (_v,row)=> row.user ? (row.user.name || row.user.email || '') : (row.user_id || '') },
    { key: 'createdAt', label: 'Created', format: v => v ? new Date(v).toLocaleString() : '—', csvFormat: v => v ? new Date(v).toLocaleString() : '' },
  ],
  treatments: [
    { key: 'name', label: 'Name' },
    { key: 'category', label: 'Category' },
    { key: 'duration', label: 'Duration' },
    { key: 'color', label: 'Color' },
    { key: 'active', label: 'Active', format: v => v ? 'Yes' : 'No', csvFormat: v => v ? 'Yes' : 'No' },
    { key: 'createdAt', label: 'Created', format: v => v ? new Date(v).toLocaleString() : '—', csvFormat: v => v ? new Date(v).toLocaleString() : '' },
  ],
  priorities: [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'description', label: 'Description' },
    { key: 'durationHours', label: 'Hours' },
    { key: 'color', label: 'Color' },
    { key: 'createdAt', label: 'Created', format: v => v ? new Date(v).toLocaleString() : '—', csvFormat: v => v ? new Date(v).toLocaleString() : '' },
  ],
};

const RESOURCES = Object.keys(RESOURCE_COLUMNS);

// Helper to expand appointments into individual date slots
function expandAppointmentSlots(appointments: any[]): any[] {
  const slots: any[] = [];
  for (const apt of appointments) {
    const dates = apt.selectedAppDates;
    if (!Array.isArray(dates) || dates.length === 0) continue;
    
    // Create a row for each date slot
    for (const slot of dates) {
      slots.push({
        ...apt,
        startDate: slot.startDate,
        endDate: slot.endDate,
        status: slot.status,
        slotId: slot._id,
        // Keep original appointment data for patient info
      });
    }
  }
  return slots;
}

function buildCSV(rows: any[], resource: string) {
  if (!rows.length) return 'data:text/csv;charset=utf-8,' + encodeURIComponent('No data');
  const cols = RESOURCE_COLUMNS[resource];
  const header = cols.map(c => c.label).join(',');
  const lines = rows.map(r => cols.map(c => {
    const raw = r[c.key];
    let val: any = raw;
    if (c.csvFormat) val = c.csvFormat(raw, r);
    else if (c.format) {
      const maybe = c.format(raw, r);
      if (typeof maybe === 'string' || typeof maybe === 'number' || typeof maybe === 'boolean') val = maybe as any;
      else val = raw; // avoid React elements in CSV
    }
    if (val == null) val = '';
    const str = String(val);
    // Escape quotes
    return '"' + str.replace(/"/g,'""') + '"';
  }).join(','));
  return 'data:text/csv;charset=utf-8,' + encodeURIComponent([header, ...lines].join('\n'));
}

const Reports: React.FC = () => {
  const [activeIdx, setActiveIdx] = useState(0);
  const resource = RESOURCES[activeIdx];
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const toast = useToast();

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [sortField, setSortField] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  useEffect(() => { setPage(1); }, [resource, debouncedSearch, sortField, sortDir]);

  // For appointmentSlots, fetch from appointments and expand
  const backendResource = resource === 'appointmentSlots' ? 'appointments' : resource;
  const { data: pageData, isLoading, refetch, isFetching } = useReportsResource(backendResource, debouncedSearch, page, limit, sortField, sortDir);
  const { getAccessTokenSilently } = useAuth0();
  
  // Expand appointments into slots if needed
  const rawRows = (pageData as ReportsPage | undefined)?.data || [];
  const rows = resource === 'appointmentSlots' ? expandAppointmentSlots(rawRows) : rawRows;
  const total = (pageData as ReportsPage | undefined)?.meta?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  const [isDownloading, setIsDownloading] = useState(false);
  async function downloadCsv(mode: 'view' | 'all') {
    try {
      setIsDownloading(true);
      if (mode === 'view') {
        const uri = buildCSV(rows, resource);
        const a = document.createElement('a');
        a.href = uri;
        a.download = `${resource}-visible.csv`;
        a.click();
        return;
      }
      // mode === 'all' → fetch every page (ignores current page/limit; respects collection)
      toast({ title: 'Building full CSV…', status: 'info', duration: 1500 });
      let all: any[] = [];
      let p = 1;
      let keep = true;
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });
      const base = import.meta.env.VITE_BASE_URL;
      const fetchResource = resource === 'appointmentSlots' ? 'appointments' : resource;
      while (keep) {
        const params = new URLSearchParams({
          page: String(p),
          limit: '200',
          search: debouncedSearch || '',
          sort: sortField || '',
          dir: sortDir,
        });
        const url = `${base}/reports/${fetchResource}?${params.toString()}`; // respect current filter + order
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`csv_full_fetch_failed:${res.status}:${text}`);
        }
        const json = await res.json();
        all = all.concat(json.data || []);
        const meta = json.meta || {};
        // Prefer hasMore; fallback to total calc if absent
        keep = typeof meta.hasMore === 'boolean' ? meta.hasMore : ((meta.total && meta.limit && meta.page) ? (meta.page * meta.limit < meta.total) : false);
        p = (meta.page || p) + 1;
        if (p > 200) break; // hard safety cutoff
      }
      // Expand if appointmentSlots
      if (resource === 'appointmentSlots') {
        all = expandAppointmentSlots(all);
      }
      const uri = buildCSV(all, resource);
      const a = document.createElement('a');
      a.href = uri;
      a.download = `${resource}-all.csv`;
      a.click();
      toast({ title: 'CSV ready', status: 'success', duration: 2000 });
    } catch (e:any) {
      toast({ title: 'CSV error', description: e.message, status: 'error' });
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <Box minH='100vh' bgGradient='linear(to-br, gray.50, gray.100)' py={8}>
      <Container maxW='full'>
        <Heading size='lg' mb={4}>Reports</Heading>
        <Tabs index={activeIdx} onChange={i => { setActiveIdx(i); setSearch(''); setDebouncedSearch(''); }} variant='enclosed'>
          <TabList>
            {RESOURCES.map(r => {
              if (r === 'appointmentSlots') return <Tab key={r}>Appointment Dates</Tab>;
              return <Tab key={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</Tab>;
            })}
          </TabList>
          <TabPanels>
            {RESOURCES.map(r => {
              const cols = RESOURCE_COLUMNS[r];
              return (
                <TabPanel key={r} px={0}>
                  <HStack mb={3} spacing={3} align='center'>
                    <Input 
                      placeholder={r === 'appointmentSlots' ? 'Search (name, phone, date YYYY-MM-DD)…' : `Search ${r} (multi-field)…`} 
                      value={search} 
                      onChange={e=>setSearch(e.target.value)} 
                      maxW='360px' 
                    />
                    <Button size='sm' onClick={()=>refetch()} isDisabled={isLoading}>Refresh</Button>
                    <Menu>
                      <MenuButton as={Button} size='sm' colorScheme='blue' isDisabled={isDownloading && !rows.length} isLoading={isDownloading}>
                        CSV
                      </MenuButton>
                      <MenuList>
                        <MenuItem onClick={() => downloadCsv('view')} isDisabled={!rows.length}>Download view</MenuItem>
                        <MenuItem onClick={() => downloadCsv('all')}>Download all</MenuItem>
                      </MenuList>
                    </Menu>
                    <HStack spacing={1} ml='auto'>
                      <Text fontSize='xs' color='gray.600' whiteSpace='nowrap'>Rows per page:</Text>
                      <Select
                        size='xs'
                        width='70px'
                        value={limit}
                        onChange={e => { setLimit(parseInt(e.target.value, 10)); setPage(1); }}
                      >
                        <option value="10">10</option>
                        <option value="25">25</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                        <option value="200">200</option>
                      </Select>
                      <Text fontSize='xs' color='gray.600' ml={2}>Page {page} / {totalPages}</Text>
                      <Button size='xs' onClick={()=>setPage(1)} isDisabled={!hasPrev}>«</Button>
                      <Button size='xs' onClick={()=>setPage(p=>Math.max(1,p-1))} isDisabled={!hasPrev}>‹</Button>
                      <Button size='xs' onClick={()=>setPage(p=>hasNext? p+1 : p)} isDisabled={!hasNext}>›</Button>
                      <Button size='xs' onClick={()=>setPage(totalPages)} isDisabled={!hasNext}>»</Button>
                    </HStack>
                  </HStack>
                  <Box borderWidth='1px' borderRadius='lg' bg='white' boxShadow='xl' overflow='hidden'>
                    <Box maxH='65vh' overflowY='auto'>
                      <Table
                        size='sm'
                        variant='striped'
                        colorScheme='gray'
                        sx={{
                          'td, th': { borderColor: 'gray.100' },
                          'tbody tr': { transition: 'background 120ms ease' },
                          'tbody tr:hover td': { bg: 'gray.50' },
                        }}
                      >
                        <Thead position='sticky' top={0} zIndex={1} bg='whiteAlpha.900' backdropFilter='saturate(180%) blur(6px)' boxShadow='sm'>
                          <Tr>
                            {cols.map(c => (
                              <Th
                                key={c.key}
                                cursor='pointer'
                                fontSize='xs'
                                textTransform='uppercase'
                                letterSpacing='widest'
                                color='gray.600'
                                onClick={() => {
                                  if (sortField === c.key) {
                                    setSortDir(d => d === 'asc' ? 'desc' : 'asc');
                                  } else {
                                    setSortField(c.key); setSortDir('asc');
                                  }
                                }}
                              >
                                {c.label}
                                {sortField === c.key && (
                                  <Text as='span' ml={1} fontSize='xs' color='gray.500'>
                                    {sortDir === 'asc' ? '↑' : '↓'}
                                  </Text>
                                )}
                              </Th>
                            ))}
                          </Tr>
                        </Thead>
                        <Tbody>
                          {rows.map((row:any) => (
                            <Tr key={row._id || JSON.stringify(row)} _hover={{ bg: 'gray.50' }}>
                              {cols.map(c => <Td key={c.key}>{c.format ? c.format(row[c.key], row) : (row[c.key] ?? '—')}</Td>)}
                            </Tr>
                          ))}
                          {(isLoading || isFetching) && (
                            <Tr><Td colSpan={cols.length}><Spinner size='sm' /></Td></Tr>
                          )}
                          {!isLoading && !rows.length && (
                            <Tr><Td colSpan={cols.length}><Text color='gray.500'>No data.</Text></Td></Tr>
                          )}
                        </Tbody>
                      </Table>
                    </Box>
                  </Box>
                </TabPanel>
              );
            })}
          </TabPanels>
        </Tabs>
      </Container>
    </Box>
  );
};

export default Reports;
