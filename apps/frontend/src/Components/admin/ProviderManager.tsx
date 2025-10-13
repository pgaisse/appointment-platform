// ------------------------------------------------------------------------------------
import React, { lazy, Suspense, useMemo, useState } from "react";
import {
  Box,
  Card, CardHeader, CardBody,
  Heading,
  HStack, VStack,
  Button,
  Input, InputGroup, InputLeftElement,
  Tag,
  Table, Thead, Tbody, Tr, Th, Td,
  Badge,
  Drawer, DrawerOverlay, DrawerContent, DrawerHeader, DrawerBody, DrawerFooter,
  Tabs, TabList, TabPanels, Tab, TabPanel,
  FormControl, FormLabel, FormErrorMessage, Switch, NumberInput, NumberInputField,
  useToast,
  SimpleGrid,
  Divider,
  Tooltip,
  Select,
  Popover, PopoverTrigger, PopoverContent, PopoverBody,
  Checkbox,
  CloseButton,
  Kbd,
  Spinner,
  Text,
  Skeleton,
  useColorModeValue,
  Spacer,
} from "@chakra-ui/react";
import {
  SearchIcon, AddIcon, TimeIcon, CalendarIcon, EditIcon,
  InfoOutlineIcon, EmailIcon, PhoneIcon,
} from "@chakra-ui/icons";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";

import {
  useProvidersList,
  useCreateProvider,
  useUpdateProvider,
  useUpsertProviderSchedule,
  useCreateProviderTimeOff,
  DayKey, DayBlock, Weekly,
  formatSydneyLabel,
  useProviderAvailability,
  useProviderSchedule,
  useUpdateProviderTimeOff,
  useDeleteProviderTimeOff,
} from "@/Hooks/Query/useProviders";
import { useMeta, Treatment } from "@/Hooks/Query/useMeta";
import { Provider } from "@/types";

// 👇 importamos los time off actuales (solo UI, la lógica ya existe)
import { useProviderTimeOff, type TimeOffItem } from "@/Hooks/Query/useProviderAppointments";
import SmartCalendar, { CalendarEvent } from "../Scheduler/SmartCalendar";
import { ModalStackProvider } from "../ModalStack/ModalStackContext";

type HHMM = `${number}${number}:${number}${number}`;
function normalizeHHMM(v: string): HHMM {
  const m = /^(\d{1,2}):(\d{1,2})$/.exec(v.trim());
  let h = 0, min = 0;
  if (m) {
    h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
    min = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  }
  const HH = String(h).padStart(2, "0");
  const MM = String(min).padStart(2, "0");
  return `${HH}:${MM}` as HHMM;
}
const LazyProviderSummaryModal = lazy(() => import("@/Components/Provider/ProviderSummaryModal"));
export const preloadProviderSummaryModal = () => import("@/Components/Provider/ProviderSummaryModal");

// ------------------------------------------------------------
// Small helpers
const emptyWeekly = (): Weekly => ({ mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] });

const dayLabels: Record<DayKey, string> = {
  mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun",
};

function LabelWithHelp({ label, help }: { label: string; help: string }) {
  return (
    <FormLabel display="flex" alignItems="center" gap={2}>
      {label}
      <Tooltip label={help} hasArrow placement="top">
        <Box as={InfoOutlineIcon} color="gray.500" />
      </Tooltip>
    </FormLabel>
  );
}

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const h = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${y}-${m}-${day}T${h}:${min}`;
}

// ------------------------------------------------------------
// Lightweight Chakra-only MultiSelect (no external libs)
type Option = { value: string; label: string };

function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  isLoading,
  maxBadges = 3,
}: {
  options: Option[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  isLoading?: boolean;
  maxBadges?: number;
}) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, search]);

  const map = useMemo(() => {
    const m = new Map<string, string>();
    options.forEach((o) => m.set(o.value, o.label));
    return m;
  }, [options]);

  const selectedLabels = value
    .map((v) => ({ v, label: map.get(v) }))
    .filter((x): x is { v: string; label: string } => !!x.label);

  const toggle = (v: string) => {
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else onChange([...value, v]);
  };

  const checkAll = () => onChange(filtered.map((f) => f.value));
  const clear = () => onChange([]);

  return (
    <Popover isOpen={isOpen} onClose={() => setIsOpen(false)} placement="bottom-start" matchWidth>
      <PopoverTrigger>
        <Button
          onClick={() => setIsOpen((s) => !s)}
          variant="outline"
          w="full"
          justifyContent="flex-start"
          rightIcon={isLoading ? <Spinner size="sm" /> : undefined}
        >
          {selectedLabels.length === 0 ? (
            <Box color="gray.500">{placeholder}</Box>
          ) : (
            <HStack spacing={2} wrap="wrap">
              {selectedLabels.slice(0, maxBadges).map((s) => (
                <Tag key={s.v} size="sm" borderRadius="md">
                  {s.label}
                </Tag>
              ))}
              {selectedLabels.length > maxBadges && (
                <Tag size="sm" borderRadius="md">+{selectedLabels.length - maxBadges}</Tag>
              )}
            </HStack>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent w="full">
        <PopoverBody>
          <VStack align="stretch" spacing={2}>
            <InputGroup>
              <InputLeftElement pointerEvents="none">
                <SearchIcon />
              </InputLeftElement>
              <Input
                autoFocus
                placeholder="Search treatments…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </InputGroup>
            <HStack justify="space-between">
              <HStack>
                <Button size="xs" variant="ghost" onClick={checkAll} isDisabled={filtered.length === 0}>
                  Select all
                </Button>
                <Button size="xs" variant="ghost" onClick={clear} isDisabled={value.length === 0}>
                  Clear
                </Button>
              </HStack>
              <Kbd>Esc</Kbd>
            </HStack>

            <VStack
              align="stretch"
              spacing={1}
              maxH="240px"
              overflowY="auto"
              border="1px solid"
              borderColor="gray.100"
              borderRadius="md"
              p={2}
            >
              {filtered.length === 0 ? (
                <Box color="gray.500" px={1} py={2}>
                  No options
                </Box>
              ) : (
                filtered.map((o) => (
                  <HStack key={o.value} justify="space-between" px={1}>
                    <Checkbox
                      isChecked={value.includes(o.value)}
                      onChange={() => toggle(o.value)}
                    >
                      {o.label}
                    </Checkbox>
                    {value.includes(o.value) && (
                      <CloseButton size="sm" onClick={() => toggle(o.value)} />
                    )}
                  </HStack>
                ))
              )}
            </VStack>

            <HStack justify="flex-end">
              <Button size="sm" onClick={() => setIsOpen(false)} colorScheme="teal">
                Done
              </Button>
            </HStack>
          </VStack>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
}

// ------------------------------------------------------------------------------------
// Main component
export default function ProviderManager() {
  const { data: providers } = useProvidersList({ active: true });
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Provider | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryProvider, setSummaryProvider] = useState<Provider | null>(null);

  const filtered = useMemo(() => {
    if (!providers) return [] as Provider[];
    const q = query.trim().toLowerCase();
    if (!q) return providers;
    return providers.filter((p) => `${p.firstName} ${p.lastName}`.toLowerCase().includes(q));
  }, [providers, query]);

  return (
    <Box>
      <HStack justify="space-between" mb={4}>
        <Heading size="md">Providers</Heading>
        <HStack>
          <InputGroup maxW="300px">
            <InputLeftElement pointerEvents="none">
              <SearchIcon />
            </InputLeftElement>
            <Input placeholder="Search by name" value={query} onChange={(e) => setQuery(e.target.value)} />
          </InputGroup>
          <Button
            leftIcon={<AddIcon />}
            colorScheme="teal"
            onClick={() => {
              setSelected(null);
              setDrawerOpen(true);
            }}
          >
            New
          </Button>
        </HStack>
      </HStack>

      <Card variant="outline">
        <CardBody>
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Contact</Th>
                <Th>Slot</Th>
                <Th>Buffers</Th>
                <Th>Status</Th>
                <Th />
              </Tr>
            </Thead>
            <Tbody>
              {filtered.map((p) => (
                <Tr key={p._id} _hover={{ bg: "blackAlpha.50" }}>
                  <Td>
                    <HStack>
                      <Badge borderRadius="md" px={2} py={1} bg={p.color || "gray.200"} />
                      <VStack align="start" spacing={0}>
                        <Box fontWeight="semibold">
                          {p.firstName} {p.lastName}
                        </Box>
                        <Box fontSize="xs" color="gray.500">
                          {p.initials}
                        </Box>
                      </VStack>
                    </HStack>
                  </Td>
                  <Td>
                    <VStack align="start" spacing={0}>
                      <Box fontSize="sm">{p.email || "—"}</Box>
                      <Box fontSize="xs" color="gray.500">
                        {p.phone || ""}
                      </Box>
                    </VStack>
                  </Td>
                  <Td>{p.defaultSlotMinutes} min</Td>
                  <Td>
                    {p.bufferBefore}/{p.bufferAfter} min
                  </Td>
                  <Td>
                    {p.acceptingNewPatients ? <Tag colorScheme="green">Active</Tag> : <Tag>Inactive</Tag>}
                  </Td>
                  <Td textAlign="right">
                    <HStack spacing={2} justify="flex-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onMouseEnter={preloadProviderSummaryModal}
                        onClick={() => { setSummaryProvider(p); setSummaryOpen(true); }}
                      >
                        View
                      </Button>
                      <Button size="sm" leftIcon={<EditIcon />} onClick={() => { setSelected(p); setDrawerOpen(true); }}>
                        Editar
                      </Button>
                    </HStack>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </CardBody>
      </Card>

      <ProviderDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        provider={selected}
      />
      <Suspense fallback={null}>
        {summaryOpen && (
          <ModalStackProvider>
            <LazyProviderSummaryModal
              isOpen={summaryOpen}
              onClose={() => setSummaryOpen(false)}
              provider={summaryProvider}
            />
          </ModalStackProvider>
        )}
      </Suspense>
    </Box>
  );
}

// ------------------------------------------------------------------------------------
// Drawer (create/edit)
function ProviderDrawer({
  isOpen,
  onClose,
  provider,
}: {
  isOpen: boolean;
  onClose: () => void;
  provider: Provider | null;
}) {
  const toast = useToast();
  const createMut = useCreateProvider();
  const updateMut = useUpdateProvider();

  // —— Treatments from your useMeta() hook
  const { treatments: treatmentsData, isLoadingTreatments: trLoading } = useMeta();

  // fuerza refetch availability tras guardar schedule
  const [refreshKey, setRefreshKey] = useState(0);

  // Form
  const { register, handleSubmit, reset, setValue, watch } = useForm<Partial<Provider>>({
    defaultValues: provider || {
      firstName: "",
      lastName: "",
      initials: "",
      email: "",
      phone: "",
      defaultSlotMinutes: 10,
      bufferBefore: 0,
      bufferAfter: 0,
      maxOverlap: 0,
      acceptingNewPatients: true,
      isActive: true,
      skills: [],
      locations: [],
    },
  });

  React.useEffect(() => {
    reset(
      provider || {
        firstName: "",
        lastName: "",
        initials: "",
        email: "",
        phone: "",
        defaultSlotMinutes: 10,
        bufferBefore: 0,
        bufferAfter: 0,
        maxOverlap: 0,
        acceptingNewPatients: true,
        isActive: true,
        skills: [],
        locations: [],
      }
    );
  }, [provider, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (provider) {
        await updateMut.mutateAsync({ id: provider._id, payload: values });
        toast({ title: "Provider updated", status: "success" });
      } else {
        await createMut.mutateAsync(values);
        toast({ title: "Provider created", status: "success" });
      }
      onClose();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, status: "error" });
    }
  });

  // —— Treatments: map to options from your exact Treatment type
  const treatmentOptions: Option[] = useMemo(() => {
    const arr = Array.isArray(treatmentsData) ? (treatmentsData as Treatment[]) : [];
    return arr
      .map((t) => ({
        value: String((t as any).id ?? (t as any)._id ?? t.name),
        label: t.name || "Treatment",
      }))
      .filter((x) => x.value && x.label)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [treatmentsData]);

  const skillIds = (watch("skills") || []) as string[];

  const initialWeekly = (provider as any)?.schedule?.weekly || (provider as any)?.weekly || undefined;
  const initialTimezone = (provider as any)?.schedule?.timezone || (provider as any)?.timezone || "Australia/Sydney";

  return (
    <Drawer isOpen={isOpen} onClose={onClose} size="xl" placement="right">
      <DrawerOverlay />
      <DrawerContent>
        <DrawerHeader>{provider ? "Edit provider" : "New provider"}</DrawerHeader>
        <DrawerBody>
          <Tabs isFitted variant="enclosed">
            <TabList>
              <Tab>Profile</Tab>
              <Tab>Weekly schedule</Tab>
              <Tab>Time off</Tab>
              <Tab>Availability</Tab>
            </TabList>
            <TabPanels>
              <TabPanel>
                <VStack align="stretch" spacing={4}>
                  <HStack>
                    <FormControl isRequired>
                      <LabelWithHelp label="First name" help="Used in calendar and search." />
                      <Input {...register("firstName", { required: true })} />
                    </FormControl>
                    <FormControl isRequired>
                      <LabelWithHelp label="Last name" help="Dentist last name." />
                      <Input {...register("lastName", { required: true })} />
                    </FormControl>
                  </HStack>

                  <HStack>
                    <FormControl>
                      <LabelWithHelp label="Initials" help="2–4 letters for compact views." />
                      <Input maxLength={4} {...register("initials")} />
                    </FormControl>
                    <FormControl>
                      <LabelWithHelp label="Color" help="Calendar color for quick identification." />
                      <Input type="color" {...register("color")} />
                    </FormControl>
                  </HStack>

                  <HStack>
                    <FormControl>
                      <LabelWithHelp label="Email" help="Used for notifications or invites." />
                      <InputGroup>
                        <InputLeftElement pointerEvents="none">
                          <EmailIcon />
                        </InputLeftElement>
                        <Input type="email" {...register("email")} />
                      </InputGroup>
                    </FormControl>
                    <FormControl>
                      <LabelWithHelp label="Phone" help="Contact number." />
                      <InputGroup>
                        <InputLeftElement pointerEvents="none">
                          <PhoneIcon />
                        </InputLeftElement>
                        <Input {...register("phone")} />
                      </InputGroup>
                    </FormControl>
                  </HStack>

                  {/* Treatments */}
                  <FormControl>
                    <LabelWithHelp label="Treatments" help="Procedures this provider performs." />
                    <MultiSelect
                      options={treatmentOptions}
                      value={skillIds}
                      onChange={(next) => setValue("skills", next, { shouldDirty: true })}
                      isLoading={trLoading}
                      placeholder="Search and select treatments…"
                      maxBadges={3}
                    />
                  </FormControl>

                  <Divider />

                  <SimpleGrid columns={{ base: 1, md: 3 }} gap={4}>
                    <FormControl>
                      <LabelWithHelp label="Default slot (minutes)" help="Step used to create appointment slots (5–60)." />
                      <NumberInput min={5} max={60} step={5}>
                        <NumberInputField {...register("defaultSlotMinutes", { valueAsNumber: true })} />
                      </NumberInput>
                    </FormControl>
                    <FormControl>
                      <LabelWithHelp label="Buffer before (min)" help="Preparation time before each appointment." />
                      <NumberInput min={0} max={60} step={5}>
                        <NumberInputField {...register("bufferBefore", { valueAsNumber: true })} />
                      </NumberInput>
                    </FormControl>
                    <FormControl>
                      <LabelWithHelp label="Buffer after (min)" help="Cleanup time after each appointment." />
                      <NumberInput min={0} max={60} step={5}>
                        <NumberInputField {...register("bufferAfter", { valueAsNumber: true })} />
                      </NumberInput>
                    </FormControl>
                  </SimpleGrid>

                  <HStack>
                    <FormControl display="flex" alignItems="center">
                      <LabelWithHelp label="Accepting new patients" help="If off, provider won’t be offered to new patients." />
                      <Switch {...register("acceptingNewPatients")} />
                    </FormControl>
                    <FormControl display="flex" alignItems="center">
                      <LabelWithHelp label="Active" help="Enable or disable provider availability entirely." />
                      <Switch {...register("isActive")} />
                    </FormControl>
                  </HStack>
                </VStack>
              </TabPanel>

              <TabPanel>
                {provider ? (
                  <WeeklyScheduleEditor
                    providerId={provider._id}
                    initialWeekly={initialWeekly}
                    initialTimezone={initialTimezone}
                    onSaved={() => setRefreshKey((k) => k + 1)}
                  />
                ) : (
                  <Box color="gray.500">Create the provider first to configure schedule.</Box>
                )}
              </TabPanel>

              <TabPanel>
                {provider ? (
                  <TimeOffEditor providerId={provider._id} />
                ) : (
                  <Box color="gray.500">Create the provider first to add time off.</Box>
                )}
              </TabPanel>

              <TabPanel>
                {provider ? (
                  <AvailabilityPreview providerId={provider._id} refreshKey={refreshKey} />
                ) : (
                  <Box color="gray.500">Create the provider first to preview availability.</Box>
                )}
              </TabPanel>
            </TabPanels>
          </Tabs>
        </DrawerBody>
        <DrawerFooter>
          <HStack w="full" justify="space-between">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button colorScheme="teal" onClick={onSubmit}>
              {provider ? "Save" : "Create"}
            </Button>
          </HStack>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

// ------------------------------------------------------------------------------------
// Weekly schedule editor (primero: horario actual; luego editor de blocks)
function WeeklyScheduleEditor({
  providerId,
  initialWeekly,
  initialTimezone = "Australia/Sydney",
  onSaved,
}: {
  providerId: string;
  initialWeekly?: Weekly;
  initialTimezone?: string;
  onSaved?: () => void;
}) {
  const toast = useToast();
  const upsert = useUpsertProviderSchedule();
  const { data: currentSchedule, isFetching } = useProviderSchedule(providerId);
  const queryClient = useQueryClient();

  // fuente de verdad para "current" (si existe en backend)
  const currentWeekly = currentSchedule?.weekly ?? initialWeekly ?? emptyWeekly();
  const currentTZ = currentSchedule?.timezone ?? initialTimezone ?? "Australia/Sydney";

  // estado del editor
  const [weekly, setWeekly] = React.useState<Weekly>(currentWeekly);
  const [timezone, setTimezone] = React.useState(currentTZ);

  // sincroniza al cambiar provider o recargar
  React.useEffect(() => {
    setWeekly(currentWeekly);
    setTimezone(currentTZ);
  }, [currentWeekly, currentTZ]);

  // helpers UI
  const startHour = 6, endHour = 22, totalMinutes = (endHour - startHour) * 60;
  const hhmmToMinutes = (v: string) => {
    const [h, m] = v.split(":");
    return (parseInt(h || "0") || 0) * 60 + (parseInt(m || "0") || 0);
  };
  const hourLabel12h = (h24: number) => {
    const h = ((h24 + 11) % 12) + 1;
    const ampm = h24 < 12 ? "AM" : "PM";
    return `${h} ${ampm}`;
  };
  const dayLabels: Record<DayKey, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

  const addBlock = (day: DayKey) => {
    setWeekly((prev) => ({ ...prev, [day]: [...(prev[day] || []), { start: "09:00", end: "17:00" }] }));
  };
  const updateBlock = (day: DayKey, idx: number, patch: Partial<DayBlock>) => {
    setWeekly((prev) => ({
      ...prev,
      [day]: (prev[day] || []).map((b, i) => (i === idx ? { ...b, ...patch } : b)),
    }));
  };
  const removeBlock = (day: DayKey, idx: number) => {
    setWeekly((prev) => ({ ...prev, [day]: (prev[day] || []).filter((_, i) => i !== idx) }));
  };
  const clearDay = (day: DayKey) => setWeekly((prev) => ({ ...prev, [day]: [] }));
  const clearAll = () => setWeekly(emptyWeekly());

  const save = async () => {
    try {
      await upsert.mutateAsync({ id: providerId, payload: { weekly, timezone } });
      toast({ title: "Schedule saved", status: "success" });
      // refresca schedule actual y availability
      queryClient.invalidateQueries({ queryKey: ['provider-schedule', providerId] });
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === "provider-availability" &&
          q.queryKey.includes(providerId),
      });
      onSaved?.();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Unexpected error", status: "error" });
    }
  };

  // estilos
  const border = useColorModeValue("gray.200", "whiteAlpha.300");
  const trackBg = useColorModeValue("gray.50", "whiteAlpha.100");
  const labelColor = useColorModeValue("gray.600", "gray.300");

  return (
    <VStack align="stretch" spacing={4}>
      <Card variant="outline">
        <CardHeader pb={2}>
          <HStack justify="space-between" align="center" wrap="wrap" gap={2}>
            <Heading size="sm">Current schedule (read-only)</Heading>
            <HStack><Tag>Australia/Sydney</Tag>{isFetching && <Skeleton h="18px" w="80px" />}</HStack>
          </HStack>
        </CardHeader>
        <CardBody>
          <Box position="relative" pl="70px" pr="8px" mb={2}>
            <HStack justify="space-between" fontSize="xs" color={labelColor}>
              {Array.from({ length: (endHour - startHour) / 2 + 1 }).map((_, i) => {
                const h = startHour + i * 2;
                return <Text key={h} minW="32px" textAlign="center">{hourLabel12h(h)}</Text>;
              })}
            </HStack>
          </Box>

          {(["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as DayKey[]).map((dk) => {
            const blocks = (currentWeekly?.[dk] || []) as DayBlock[];
            return (
              <HStack key={dk} align="center" spacing={3} mb={2}>
                <Box w="60px" textAlign="right" fontSize="sm" color={labelColor}>{dayLabels[dk]}</Box>
                <Box flex="1" h="28px" position="relative" borderRadius="md" borderWidth="1px" borderColor={border} bg={trackBg} overflow="hidden">
                  {blocks.length === 0 ? (
                    <Text position="absolute" left="8px" top="4px" fontSize="xs" color={labelColor}>Off</Text>
                  ) : (
                    blocks.map((b, i) => {
                      const leftPct = ((hhmmToMinutes(b.start) - startHour * 60) / totalMinutes) * 100;
                      const widthPct = ((hhmmToMinutes(b.end) - hhmmToMinutes(b.start)) / totalMinutes) * 100;
                      return (
                        <Box key={i} position="absolute" left={`${Math.max(0, leftPct)}%`} width={`${Math.max(0, Math.min(100 - leftPct, widthPct))}%`} top="3px" bottom="3px" borderRadius="md" bg="teal.400" opacity={0.9} />
                      );
                    })
                  )}
                </Box>
                <Box w="220px" fontSize="xs" color={labelColor} textAlign="left">
                  {blocks.length ? blocks.map((b) => `${b.start}–${b.end}`).join("  ·  ") : "—"}
                </Box>
              </HStack>
            );
          })}
        </CardBody>
      </Card>

      <HStack wrap="wrap" gap={3}>
        <FormControl maxW="sm">
          <FormLabel>Timezone</FormLabel>
          <Select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            <option value="Australia/Sydney">Australia/Sydney</option>
          </Select>
        </FormControl>
        <HStack ml="auto" gap={2}>
          <Button variant="outline" onClick={clearAll}>Clear all</Button>
          <Button leftIcon={<CalendarIcon />} colorScheme="teal" onClick={save} isLoading={upsert.isPending}>Save schedule</Button>
          <Button variant="ghost" onClick={() => { setWeekly(currentWeekly); setTimezone(currentTZ); }}>Reset to current</Button>
        </HStack>
      </HStack>

      {(["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as DayKey[]).map((day) => (
        <Card key={day} variant="outline">
          <CardHeader>
            <HStack justify="space-between" wrap="wrap" gap={2}>
              <Heading size="sm">{dayLabels[day]}</Heading>
              <HStack>
                <Button size="xs" variant="outline" onClick={() => setWeekly((p) => ({ ...p, [day]: [] }))}>Clear day</Button>
                <Button size="xs" onClick={() => addBlock(day)}>Add block</Button>
              </HStack>
            </HStack>
          </CardHeader>
          <CardBody>
            <VStack align="stretch" spacing={3}>
              {(weekly[day] && weekly[day].length > 0) ? null : <Box color="gray.500">No blocks</Box>}
              {(weekly[day] || []).map((b, idx) => (
                <HStack key={`${day}-${idx}`} align="end">
                  <FormControl maxW="xs">
                    <FormLabel mb={0}>Start</FormLabel>
                    <InputGroup>
                      <InputLeftElement pointerEvents="none"><TimeIcon /></InputLeftElement>
                      <Input type="time" value={b.start} onChange={(e) => updateBlock(day, idx, { start: e.target.value as HHMM })} />
                    </InputGroup>
                  </FormControl>
                  <FormControl maxW="xs">
                    <FormLabel mb={0}>End</FormLabel>
                    <InputGroup>
                      <InputLeftElement pointerEvents="none"><TimeIcon /></InputLeftElement>
                      <Input type="time" value={b.end} onChange={(e) => updateBlock(day, idx, { end: e.target.value as HHMM })} />
                    </InputGroup>
                  </FormControl>
                  <Button size="sm" variant="ghost" onClick={() => removeBlock(day, idx)}>Remove</Button>
                </HStack>
              ))}
            </VStack>
          </CardBody>
        </Card>
      ))}
    </VStack>
  );
}


// ------------------------------------------------------------------------------------
// Time off editor: lista actuales + alta de nuevos bloques
function TimeOffEditor({ providerId }: { providerId: string }) {
  const [fromLocal, setFromLocal] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 15);
    return toLocalInputValue(d);
  });
  const [toLocal, setToLocal] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 45);
    return toLocalInputValue(d);
  });

  const { data: items = [], isFetching } = useProviderTimeOff(providerId, {
    from: new Date(fromLocal).toISOString(),
    to: new Date(toLocal).toISOString(),
  });

  return (
    <VStack align="stretch" spacing={6}>
      {/* Lista actual */}
      <Card variant="outline">
        <CardHeader pb={2}>
          <HStack justify="space-between" align="center" flexWrap="wrap" gap={2}>
            <HStack>
              <Heading size="sm">Current time off</Heading>
              <Tag colorScheme="red">{items.length}</Tag>
            </HStack>
            <HStack>
              <InputGroup maxW={{ base: "100%", md: "260px" }}>
                <InputLeftElement pointerEvents="none">
                  <CalendarIcon />
                </InputLeftElement>
                <Input
                  type="datetime-local"
                  value={fromLocal}
                  onChange={(e) => setFromLocal(e.target.value)}
                />
              </InputGroup>
              <InputGroup maxW={{ base: "100%", md: "260px" }}>
                <InputLeftElement pointerEvents="none">
                  <CalendarIcon />
                </InputLeftElement>
                <Input
                  type="datetime-local"
                  value={toLocal}
                  onChange={(e) => setToLocal(e.target.value)}
                />
              </InputGroup>
            </HStack>
          </HStack>
        </CardHeader>
        <CardBody>
          {isFetching ? (
            <VStack align="stretch" spacing={2}>
              <Skeleton h="20px" />
              <Skeleton h="20px" />
              <Skeleton h="20px" />
            </VStack>
          ) : items.length === 0 ? (
            <Box color="gray.500">No time off in range.</Box>
          ) : (
            <VStack align="stretch" spacing={2} maxH="280px" overflowY="auto">
              {items.map((t: TimeOffItem) => (
                <HStack
                  key={t._id}
                  p={2}
                  borderWidth="1px"
                  borderRadius="md"
                  _hover={{ bg: useColorModeValue("red.50", "whiteAlpha.100") }}
                  align="center"
                  spacing={3}
                >
                  <Tag colorScheme="red" minW="100px" justifyContent="center">
                    {t.kind}
                  </Tag>
                  <Text flex={1}>
                    {formatSydneyLabel(t.start, { weekday: "short", month: "short", day: "2-digit", hour: "numeric", minute: "2-digit" })}
                    {" – "}
                    {formatSydneyLabel(t.end, { hour: "numeric", minute: "2-digit" })}
                  </Text>
                  {t.reason ? <Badge variant="subtle">{t.reason}</Badge> : null}
                </HStack>
              ))}
            </VStack>
          )}
        </CardBody>
      </Card>

      {/* Form alta */}
      <TimeOffForm providerId={providerId} />
    </VStack>
  );
}

// ------------------------------------------------------------------------------------
// Time-off form (alta)
function TimeOffForm({ providerId }: { providerId: string }) {
  const toast = useToast();
  const { data: items = [], refetch, isFetching } = useProviderTimeOff(providerId, {});
  const createTO = useCreateProviderTimeOff();
  const updateTO = useUpdateProviderTimeOff();
  const deleteTO = useDeleteProviderTimeOff();

  // Crear
  type TimeOffKind = "PTO" | "Sick" | "Course" | "PublicHoliday" | "Block";
  type TimeOffPatch = Partial<{
    kind: TimeOffKind;
    start: string;
    end: string;
    reason?: string;
    location?: string | null;
    chair?: string | null;
  }>;

  const [kind, setKind] = useState<TimeOffKind>("PTO");
  const [startLocal, setStartLocal] = useState(() => toLocalInputValue(new Date()));
  const [endLocal, setEndLocal] = useState(() => toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000)));
  const [reason, setReason] = useState("");

  const submit = async () => {
    try {
      const startIso = new Date(startLocal).toISOString();
      const endIso = new Date(endLocal).toISOString();
      await createTO.mutateAsync({ id: providerId, payload: { kind, start: startIso, end: endIso, reason } });
      toast({ title: "Time off added", status: "success" });
      setReason("");
      await refetch();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Unexpected error", status: "error" });
    }
  };

  const onUpdate = async (rowId: string, patch: TimeOffPatch) => {
    try {
      await updateTO.mutateAsync({
        providerId,
        timeOffId: rowId,
        payload: patch,
      });
      toast({ title: "Time off updated", status: "success" });
      await refetch();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Unexpected error", status: "error" });
    }
  };

  const onDelete = async (rowId: string) => {
    try {
      await deleteTO.mutateAsync({ providerId, timeOffId: rowId });
      toast({ title: "Time off deleted", status: "success" });
      await refetch();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Unexpected error", status: "error" });
    }
  };

  return (
    <VStack align="stretch" spacing={6}>
      {/* Crear nuevo */}
      <Card variant="outline">
        <CardHeader><Heading size="sm">Add time off</Heading></CardHeader>
        <CardBody>
          <SimpleGrid columns={{ base: 1, md: 4 }} gap={4}>
            <FormControl>
              <FormLabel>Kind</FormLabel>
              <Select value={kind} onChange={(e) => setKind(e.target.value as TimeOffKind)}>
                <option value="PTO">PTO</option>
                <option value="Sick">Sick</option>
                <option value="Course">Course</option>
                <option value="PublicHoliday">Public holiday</option>
                <option value="Block">Block</option>
              </Select>
            </FormControl>
            <FormControl>
              <FormLabel>Start</FormLabel>
              <InputGroup>
                <InputLeftElement pointerEvents="none"><CalendarIcon /></InputLeftElement>
                <Input type="datetime-local" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} />
              </InputGroup>
            </FormControl>
            <FormControl>
              <FormLabel>End</FormLabel>
              <InputGroup>
                <InputLeftElement pointerEvents="none"><CalendarIcon /></InputLeftElement>
                <Input type="datetime-local" value={endLocal} onChange={(e) => setEndLocal(e.target.value)} />
              </InputGroup>
            </FormControl>
            <FormControl>
              <FormLabel>Reason</FormLabel>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional" />
            </FormControl>
          </SimpleGrid>
          <HStack justify="flex-end" mt={3}>
            <Button colorScheme="teal" onClick={submit} isLoading={createTO.isPending}>Add time off</Button>
          </HStack>
        </CardBody>
      </Card>

      {/* Lista / editar / eliminar */}
      <Card variant="outline">
        <CardHeader>
          <HStack justify="space-between">
            <Heading size="sm">Current time off</Heading>
            {isFetching && <Skeleton h="18px" w="80px" />}
          </HStack>
        </CardHeader>
        <CardBody>
          {items.length === 0 ? (
            <Box color="gray.500">No time off registered.</Box>
          ) : (
            <Table size="sm" variant="simple">
              <Thead>
                <Tr>
                  <Th>Kind</Th>
                  <Th>Start</Th>
                  <Th>End</Th>
                  <Th>Reason</Th>
                  <Th textAlign="right">Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {items.map((it) => {
                  const startLocal = toLocalInputValue(new Date(it.start));
                  const endLocal = toLocalInputValue(new Date(it.end));
                  return (
                    <Tr key={it._id} _hover={{ bg: "blackAlpha.50" }}>
                      <Td>
                        <Select
                          size="sm"
                          value={it.kind}
                          onChange={(e) => onUpdate(it._id, { kind: e.target.value as TimeOffKind })}
                        >
                          <option value="PTO">PTO</option>
                          <option value="Sick">Sick</option>
                          <option value="Course">Course</option>
                          <option value="PublicHoliday">PublicHoliday</option>
                          <option value="Block">Block</option>
                        </Select>
                      </Td>
                      <Td>
                        <Input
                          size="sm"
                          type="datetime-local"
                          defaultValue={startLocal}
                          onBlur={(e) => onUpdate(it._id, { start: new Date(e.target.value).toISOString() })}
                        />
                      </Td>
                      <Td>
                        <Input
                          size="sm"
                          type="datetime-local"
                          defaultValue={endLocal}
                          onBlur={(e) => onUpdate(it._id, { end: new Date(e.target.value).toISOString() })}
                        />
                      </Td>
                      <Td>
                        <Input
                          size="sm"
                          defaultValue={it.reason || ""}
                          placeholder="Optional"
                          onBlur={(e) => onUpdate(it._id, { reason: e.target.value })}
                        />
                      </Td>
                      <Td textAlign="right">
                        <Button size="xs" colorScheme="red" variant="outline" onClick={() => onDelete(it._id)}>
                          Delete
                        </Button>
                      </Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          )}
        </CardBody>
      </Card>
    </VStack>
  );
}


// ------------------------------------------------------------------------------------
// Availability preview — premium timeline por día
function AvailabilityPreview({ providerId, refreshKey = 0 }: { providerId: string; refreshKey?: number }) {
  // ---------- Controls (range + filters) ----------
  const [rangeLocal, setRangeLocal] = React.useState<{ from: string; to: string }>(() => {
    const now = new Date();
    const to = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return { from: toLocalInputValue(now), to: toLocalInputValue(to) };
  });

  const [view, setView] = React.useState<"list" | "grid" | "calendar">("grid");
  const [minDurationMin, setMinDurationMin] = React.useState<number>(0); // filtro opcional

  const params = React.useMemo(
    () => ({
      from: new Date(rangeLocal.from).toISOString(),
      to: new Date(rangeLocal.to).toISOString(),
      _force: refreshKey, // no se envía pero ayuda con la cache key del hook
    }),
    [rangeLocal, refreshKey]
  );

  const { data: rawSlots = [], isFetching, error } = useProviderAvailability(providerId, params as any);

  // ---------- Helpers ----------
  const ms = (v: number) => v * 60 * 1000;

  function mergeSlots(
    slots: { startUtc: string; endUtc: string }[],
    toleranceMs = ms(1)
  ) {
    const arr = [...slots]
      .map(s => ({ start: new Date(s.startUtc).getTime(), end: new Date(s.endUtc).getTime() }))
      .filter(s => s.end > s.start)
      .sort((a, b) => a.start - b.start);

    const merged: { start: number; end: number }[] = [];
    for (const s of arr) {
      const last = merged[merged.length - 1];
      if (!last) {
        merged.push({ ...s });
        continue;
      }
      if (s.start <= last.end + toleranceMs) {
        last.end = Math.max(last.end, s.end);
      } else {
        merged.push({ ...s });
      }
    }
    return merged;
  }

  // Aplica merge + filtro de duración mínima
  const mergedSlots = React.useMemo(() => {
    const merged = mergeSlots(rawSlots, ms(1));
    if (!minDurationMin || minDurationMin <= 0) return merged;
    const minMs = ms(minDurationMin);
    return merged.filter(b => (b.end - b.start) >= minMs);
  }, [rawSlots, minDurationMin]);

  // Agrupar por día (Australia/Sydney)
  function toSydneyYMD(d: number) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Australia/Sydney",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(d));
    const y = parts.find(p => p.type === "year")!.value;
    const m = parts.find(p => p.type === "month")!.value;
    const day = parts.find(p => p.type === "day")!.value;
    return `${y}-${m}-${day}`;
  }

  const groupedByDay = React.useMemo(() => {
    const map = new Map<string, { start: number; end: number }[]>();
    for (const b of mergedSlots) {
      const key = toSydneyYMD(b.start);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    }
    // ordena slots por inicio en cada día
    for (const [k, arr] of map) {
      arr.sort((a, b) => a.start - b.start);
    }
    return map;
  }, [mergedSlots]);

  const totalSlots = mergedSlots.length;

  // Para Calendar: SmartCalendar events
  const calendarEvents: CalendarEvent[] = React.useMemo(() => {
    return mergedSlots.map((b, i) => ({
      id: `avail-${i}`,
      title: "Available",
      start: new Date(b.start),
      end: new Date(b.end),
      color: "green.500",
    }));
  }, [mergedSlots]);

  // ---------- UI building blocks ----------
  const HeaderControls = (
    <HStack align="end" wrap="wrap" spacing={3}>
      <FormControl maxW="sm">
        <LabelWithHelp label="From" help="Start of preview (your timezone)." />
        <InputGroup>
          <InputLeftElement pointerEvents="none"><CalendarIcon /></InputLeftElement>
          <Input
            type="datetime-local"
            value={rangeLocal.from}
            onChange={(e) => setRangeLocal((r) => ({ ...r, from: e.target.value }))}
          />
        </InputGroup>
      </FormControl>

      <FormControl maxW="sm">
        <LabelWithHelp label="To" help="End of preview (your timezone)." />
        <InputGroup>
          <InputLeftElement pointerEvents="none"><CalendarIcon /></InputLeftElement>
          <Input
            type="datetime-local"
            value={rangeLocal.to}
            onChange={(e) => setRangeLocal((r) => ({ ...r, to: e.target.value }))}
          />
        </InputGroup>
      </FormControl>

      <FormControl maxW="xs">
        <LabelWithHelp label="Min duration (min)" help="Hide short slots to focus on viable windows." />
        <NumberInput min={0} max={480} step={5} value={minDurationMin} onChange={(_, v) => setMinDurationMin(Number.isFinite(v) ? v : 0)}>
          <NumberInputField />
        </NumberInput>
      </FormControl>

      <FormControl maxW="xs">
        <LabelWithHelp label="View" help="Choose how to visualize the availability." />
        <Select value={view} onChange={(e) => setView(e.target.value as any)}>
          <option value="grid">Grid</option>
          <option value="list">List</option>
          <option value="calendar">Calendar</option>
        </Select>
      </FormControl>

      <HStack ml="auto" spacing={2}>
        <Tag colorScheme="green">{totalSlots} slots</Tag>
        <Tag>Australia/Sydney</Tag>
      </HStack>
    </HStack>
  );

  // Barra horaria para Grid
  const startHour = 6, endHour = 22, totalMinutes = (endHour - startHour) * 60;
  const hhmm = (d: number, tz = "Australia/Sydney") => new Intl.DateTimeFormat("en-AU", {
    timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true,
  }).format(new Date(d));
  const headerScale = (
    <Box position="relative" pl="70px" pr="8px" mb={2}>
      <HStack justify="space-between" fontSize="xs" color="gray.500">
        {Array.from({ length: (endHour - startHour) / 2 + 1 }).map((_, i) => {
          const h = startHour + i * 2;
          const h12 = ((h + 11) % 12) + 1;
          const ampm = h < 12 ? "AM" : "PM";
          return <Text key={h} minW="32px" textAlign="center">{h12} {ampm}</Text>;
        })}
      </HStack>
    </Box>
  );

  // ---------- Render ----------
  return (
    <VStack align="stretch" spacing={3}>
      {HeaderControls}

      <Card variant="outline">
        <CardHeader pb={0}>
          <HStack justify="space-between" align="center">
            <Heading size="sm">Availability</Heading>
            {isFetching && <Skeleton height="16px" width="80px" />}
          </HStack>
        </CardHeader>
        <CardBody>
          {error && <Box color="red.500" mb={2}>Failed to load availability.</Box>}

          {/* Views */}
          {view === "list" && (
            <VStack align="stretch" spacing={4}>
              {[...groupedByDay.entries()]
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([ymd, arr]) => (
                  <Box key={ymd} border="1px solid" borderColor="gray.100" borderRadius="md" p={3}>
                    <HStack justify="space-between" mb={1}>
                      <HStack>
                        <Badge colorScheme="teal">{ymd}</Badge>
                        <Tag>{arr.length} {arr.length === 1 ? "slot" : "slots"}</Tag>
                      </HStack>
                    </HStack>
                    <VStack align="stretch" spacing={1}>
                      {arr.map((b, i) => {
                        const durMin = Math.round((b.end - b.start) / 60000);
                        return (
                          <HStack key={`${ymd}-${i}`} justify="space-between">
                            <Box>
                              {formatSydneyLabel(new Date(b.start).toISOString(), { weekday: "short", month: "short", day: "2-digit" })}
                              {" · "}
                              {hhmm(b.start)}
                              {" – "}
                              {hhmm(b.end)}
                            </Box>
                            <HStack>
                              <Tag colorScheme="green">{durMin} min</Tag>
                            </HStack>
                          </HStack>
                        );
                      })}
                    </VStack>
                  </Box>
                ))}
              {(!isFetching && totalSlots === 0) && <Box color="gray.500">No slots in range</Box>}
            </VStack>
          )}

          {view === "grid" && (
            <VStack align="stretch" spacing={2}>
              {headerScale}
              {[...groupedByDay.entries()]
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([ymd, arr]) => (
                  <HStack key={`grid-${ymd}`} spacing={3} align="center">
                    <Box w="70px" textAlign="right" fontSize="sm" color="gray.600">
                      {ymd}
                    </Box>
                    <Box
                      flex="1"
                      h="28px"
                      position="relative"
                      borderRadius="md"
                      borderWidth="1px"
                      borderColor="gray.200"
                      bg="gray.50"
                      overflow="hidden"
                    >
                      {arr.map((b, i) => {
                        // posicion proporcional dentro de la barra del día (6–22 hs)
                        const toSydney = (ts: number) => {
                          const parts = new Intl.DateTimeFormat("en-GB", {
                            timeZone: "Australia/Sydney",
                            hour12: false, hour: "2-digit", minute: "2-digit"
                          }).formatToParts(new Date(ts));
                          const h = Number(parts.find(p => p.type === "hour")?.value ?? "0");
                          const m = Number(parts.find(p => p.type === "minute")?.value ?? "0");
                          return h * 60 + m;
                        };
                        const sMin = toSydney(b.start);
                        const eMin = toSydney(b.end);
                        const leftPct = ((sMin - startHour * 60) / totalMinutes) * 100;
                        const widthPct = ((eMin - sMin) / totalMinutes) * 100;
                        return (
                          <Tooltip
                            key={`${ymd}-${i}`}
                            label={`${hhmm(b.start)} – ${hhmm(b.end)}`}
                            hasArrow
                          >
                            <Box
                              position="absolute"
                              left={`${Math.max(0, leftPct)}%`}
                              width={`${Math.max(0, Math.min(100 - leftPct, widthPct))}%`}
                              top="3px"
                              bottom="3px"
                              borderRadius="md"
                              bg="green.400"
                              opacity={0.9}
                            />
                          </Tooltip>
                        );
                      })}
                      {arr.length === 0 && (
                        <Text position="absolute" left="8px" top="4px" fontSize="xs" color="gray.500">
                          — no availability —
                        </Text>
                      )}
                    </Box>
                    <HStack w="150px" spacing={1} justify="flex-end">
                      <Tag variant="subtle">{arr.length} slots</Tag>
                    </HStack>
                  </HStack>
                ))}
              {(!isFetching && totalSlots === 0) && <Box color="gray.500">No slots in range</Box>}
            </VStack>
          )}

          {view === "calendar" && (
            <Box borderRadius="md" overflow="hidden" border="1px solid" borderColor="gray.100">
              <SmartCalendar
                events={calendarEvents}
                initialDate={new Date(params.from)}
                defaultView="week"
                startHour={6}
                endHour={22}
                slotMinutes={15}
                slotHeightPx={28}
                timeColWidthPx={90}
                onSelectSlot={() => { }}
                onSelectEvent={() => { }}
              />
            </Box>
          )}
        </CardBody>
      </Card>
    </VStack>
  );
}
