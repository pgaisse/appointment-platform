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
  FormControl, FormLabel, Switch, NumberInput, NumberInputField,
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
  // ↓↓↓ premium confirm dialog
  AlertDialog, AlertDialogBody, AlertDialogContent, AlertDialogFooter,
  AlertDialogHeader, AlertDialogOverlay,
} from "@chakra-ui/react";
import {
  SearchIcon, AddIcon, TimeIcon, CalendarIcon, EditIcon,
  InfoOutlineIcon, EmailIcon, PhoneIcon, DeleteIcon,
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
  useProviderSchedule,
  useUpdateProviderTimeOff,
  useDeleteProviderTimeOff,
} from "@/Hooks/Query/useProviders";
import { useMeta, Treatment } from "@/Hooks/Query/useMeta";
import { Provider } from "@/types";

// time off (list) hook
import { useProviderTimeOff, type TimeOffItem } from "@/Hooks/Query/useProviderAppointments";
import { ModalStackProvider } from "../ModalStack/ModalStackContext";
import { formatAustralianMobile } from "@/Functions/formatAustralianMobile";

const LazyProviderSummaryModal = lazy(() => import("@/Components/Provider/ProviderSummaryModal"));
export const preloadProviderSummaryModal = () => import("@/Components/Provider/ProviderSummaryModal");

// ------------------------------------------------------------
// Helpers
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
                        {formatAustralianMobile(p.phone || "")}
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

  // treatments
  const { treatments: treatmentsData, isLoadingTreatments: trLoading } = useMeta();

  // force refetch availability after saving schedule (external)
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

  // treatments -> options
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
            </TabList>
            <TabPanels>
              {/* Profile */}
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

              {/* Weekly schedule */}
              <TabPanel>
                {provider ? (
                  <WeeklyScheduleEditor
                    key={refreshKey} // ensure refresh on save if needed
                    providerId={provider._id}
                    initialWeekly={initialWeekly}
                    initialTimezone={initialTimezone}
                    onSaved={() => setRefreshKey((k) => k + 1)}
                  />
                ) : (
                  <Box color="gray.500">Create the provider first to configure schedule.</Box>
                )}
              </TabPanel>

              {/* Time off CRUD */}
              <TabPanel>
                {provider ? (
                  <TimeOffTab providerId={provider._id} />
                ) : (
                  <Box color="gray.500">Create the provider first to manage time off.</Box>
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
// Weekly schedule editor
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

  // source of truth for current
  const currentWeekly = currentSchedule?.weekly ?? initialWeekly ?? { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };
  const currentTZ = currentSchedule?.timezone ?? initialTimezone ?? "Australia/Sydney";

  // editor state
  const [weekly, setWeekly] = React.useState<Weekly>(currentWeekly);
  const [timezone, setTimezone] = React.useState(currentTZ);

  React.useEffect(() => {
    setWeekly(currentWeekly);
    setTimezone(currentTZ);
  }, [currentWeekly, currentTZ]);

  // helpers
  const LABEL_COL_PX = 60;
  const RIGHT_COL_PX = 220;
  const startHour = 6;
  const endHour = 20;
  const totalMinutes = (endHour - startHour) * 60;

  const dayName: Record<DayKey, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

  const hhmmToMinutes = (v: string) => {
    const [h, m] = v.split(":");
    return (parseInt(h || "0", 10) || 0) * 60 + (parseInt(m || "0", 10) || 0);
  };

  const to12h = (hhmm: string) => {
    const [hStr, mStr] = hhmm.split(":");
    let h = Math.max(0, Math.min(23, parseInt(hStr || "0", 10)));
    const m = Math.max(0, Math.min(59, parseInt(mStr || "0", 10)));
    const ampm = h < 12 ? "AM" : "PM";
    const h12 = ((h + 11) % 12) + 1;
    return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
  };

  const hourLabel12h = (h24: number) => {
    const h12 = ((h24 + 11) % 12) + 1;
    const ampm = h24 < 12 ? "AM" : "PM";
    return `${h12} ${ampm}`;
  };

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
  const clearAll = () => setWeekly({ mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] });

  const save = async () => {
    const key = ["provider-schedule", providerId] as const;
    const previous = queryClient.getQueryData<any>(key);
    const optimistic = { weekly, timezone };

    // ⏩ Optimista: reflejamos inmediatamente
    queryClient.setQueryData(key, (old: any) => ({ ...(old ?? {}), ...optimistic }));

    try {
      await upsert.mutateAsync({ id: providerId, payload: { weekly, timezone } });
      toast({ title: "Schedule saved", status: "success" });
      // refresca consumidores relacionados (schedule y availability que dependan de esto)
      queryClient.invalidateQueries({ queryKey: key, exact: false });
      queryClient.invalidateQueries({ queryKey: ["provider-availability", providerId], exact: false });
      onSaved?.();
    } catch (e: any) {
      // ⏪ Rollback en error
      queryClient.setQueryData(key, previous);
      toast({ title: "Error", description: e?.message ?? "Unexpected error", status: "error" });
    }
  };

  // styles
  const border = useColorModeValue("gray.200", "whiteAlpha.300");
  const trackBg = useColorModeValue("gray.50", "whiteAlpha.100");
  const labelColor = useColorModeValue("gray.600", "gray.300");

  return (
    <VStack align="stretch" spacing={4}>
      {/* Current (read-only) */}
      <Card variant="outline">
        <CardHeader pb={2}>
          <HStack justify="space-between" align="center" wrap="wrap" gap={2}>
            <Heading size="sm">Current schedule (read-only)</Heading>
            <HStack>
              <Tag>{timezone}</Tag>
              {isFetching && <Skeleton h="18px" w="80px" />}
            </HStack>
          </HStack>
        </CardHeader>
        <CardBody>
          {/* hours header */}
          <Box
            display="grid"
            gridTemplateColumns={`${LABEL_COL_PX}px 1fr ${RIGHT_COL_PX}px`}
            columnGap={3}
            mb={2}
            position="relative"
          >
            <Box />
            <Box position="relative" h="20px">
              {[...Array((endHour - startHour) / 2 + 1)].map((_, i) => {
                const h = startHour + i * 2;
                const leftPct = ((h - startHour) / (endHour - startHour)) * 100;
                const translate = h === startHour ? "0%" : h === endHour ? "-100%" : "-50%";
                const textAlign = h === startHour ? "left" : h === endHour ? "right" : "center";

                return (
                  <Text
                    key={h}
                    position="absolute"
                    left={`${leftPct}%`}
                    transform={`translateX(${translate})`}
                    textAlign={textAlign}
                    fontSize="xs"
                    color={labelColor}
                    whiteSpace="nowrap"
                    lineHeight="1"
                    pointerEvents="none"
                  >
                    {hourLabel12h(h)}
                  </Text>
                );
              })}
            </Box>
            <Box />
          </Box>

          {/* rows */}
          {(["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as DayKey[]).map((dk) => {
            const blocks = (currentWeekly?.[dk] || []) as DayBlock[];
            return (
              <Box
                key={dk}
                display="grid"
                gridTemplateColumns={`${LABEL_COL_PX}px 1fr ${RIGHT_COL_PX}px`}
                columnGap={3}
                alignItems="center"
                mb={2}
              >
                <Box w={`${LABEL_COL_PX}px`} textAlign="right" fontSize="sm" color={labelColor}>
                  {dayName[dk]}
                </Box>

                <Box
                  h="28px"
                  position="relative"
                  borderRadius="md"
                  borderWidth="1px"
                  borderColor={border}
                  bg={trackBg}
                  overflow="hidden"
                >
                  {blocks.length === 0 ? (
                    <Text position="absolute" left="8px" top="4px" fontSize="xs" color={labelColor}>
                      Off
                    </Text>
                  ) : (
                    blocks.map((b, i) => {
                      const s = hhmmToMinutes(b.start);
                      const e = hhmmToMinutes(b.end);
                      const leftPct = ((Math.max(s, startHour * 60) - startHour * 60) / totalMinutes) * 100;
                      const widthPct = ((Math.min(e, endHour * 60) - Math.max(s, startHour * 60)) / totalMinutes) * 100;
                      if (widthPct <= 0) return null;
                      return (
                        <Box
                          key={i}
                          position="absolute"
                          left={`${leftPct}%`}
                          width={`${widthPct}%`}
                          top="3px"
                          bottom="3px"
                          borderRadius="md"
                          bg="teal.400"
                          opacity={0.9}
                        />
                      );
                    })
                  )}
                </Box>

                <Box fontSize="xs" color={labelColor} textAlign="left">
                  {blocks.length ? blocks.map((b) => `${to12h(b.start)}–${to12h(b.end)}`).join("  ·  ") : "—"}
                </Box>
              </Box>
            );
          })}
        </CardBody>
      </Card>

      {/* Controls */}
      <HStack wrap="wrap" gap={3}>
        <FormControl maxW="sm">
          <FormLabel>Timezone</FormLabel>
          <Select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            <option value="Australia/Sydney">Australia/Sydney</option>
          </Select>
        </FormControl>
        <HStack ml="auto" gap={2}>
          <Button variant="outline" onClick={clearAll}>Clear all</Button>
          <Button leftIcon={<CalendarIcon />} colorScheme="teal" onClick={save} isLoading={upsert.isPending}>
            Save schedule
          </Button>
          <Button variant="ghost" onClick={() => { setWeekly(currentWeekly); setTimezone(currentTZ); }}>
            Reset to current
          </Button>
        </HStack>
      </HStack>

      {/* Block editor */}
      {(["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as DayKey[]).map((day) => (
        <Card key={day} variant="outline">
          <CardHeader>
            <HStack justify="space-between" wrap="wrap" gap={2}>
              <Heading size="sm">{dayName[day]}</Heading>
              <HStack>
                <Button size="xs" variant="outline" onClick={() => clearDay(day)}>Clear day</Button>
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
                      <Input
                        type="time"
                        value={b.start}
                        onChange={(e) => updateBlock(day, idx, { start: e.target.value as any })}
                      />
                    </InputGroup>
                    <Text mt={1} fontSize="xs" color={labelColor}>
                      {to12h(b.start)}
                    </Text>
                  </FormControl>
                  <FormControl maxW="xs">
                    <FormLabel mb={0}>End</FormLabel>
                    <InputGroup>
                      <InputLeftElement pointerEvents="none"><TimeIcon /></InputLeftElement>
                      <Input
                        type="time"
                        value={b.end}
                        onChange={(e) => updateBlock(day, idx, { end: e.target.value as any })}
                      />
                    </InputGroup>
                    <Text mt={1} fontSize="xs" color={labelColor}>
                      {to12h(b.end)}
                    </Text>
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
// Time off CRUD tab
function TimeOffTab({ providerId }: { providerId: string }) {
  const toast = useToast();
  const qc = useQueryClient();

  // Filters
  const [fromLocal, setFromLocal] = React.useState<string>("");
  const [toLocal, setToLocal] = React.useState<string>("");

  const queryRange = React.useMemo(() => {
    const from = fromLocal ? new Date(fromLocal).toISOString() : undefined;
    const to = toLocal ? new Date(toLocal).toISOString() : undefined;
    return { from, to };
  }, [fromLocal, toLocal]);

  const exactKey = ["provider-timeoff", providerId, queryRange] as const;   // key exacta de la lista visible
  const baseKey = ["provider-timeoff", providerId] as const;                // prefijo para setQueriesData/invalidate
  const { data: items = [], isFetching } = useProviderTimeOff(providerId, queryRange);

  // Create form
  type Kind = "PTO" | "Sick" | "Course" | "PublicHoliday" | "Block";
  const kinds: Kind[] = ["PTO", "Sick", "Course", "PublicHoliday", "Block"];

  const now = new Date();
  const in60 = new Date(now.getTime() + 60 * 60 * 1000);
  const [cKind, setCKind] = React.useState<Kind>("PTO");
  const [cStart, setCStart] = React.useState<string>(toLocalInputValue(now));
  const [cEnd, setCEnd] = React.useState<string>(toLocalInputValue(in60));
  const [cReason, setCReason] = React.useState<string>("");

  const createMut = useCreateProviderTimeOff();
  const updateMut = useUpdateProviderTimeOff();
  const deleteMut = useDeleteProviderTimeOff();

  // Inline edit
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [eKind, setEKind] = React.useState<Kind>("PTO");
  const [eStart, setEStart] = React.useState<string>("");
  const [eEnd, setEEnd] = React.useState<string>("");
  const [eReason, setEReason] = React.useState<string>("");

  // Premium confirm dialog
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  const [toDelete, setToDelete] = React.useState<TimeOffItem | null>(null);

  const openDeleteDialog = (item: TimeOffItem) => {
    setToDelete(item);
    setConfirmOpen(true);
  };
  const closeDeleteDialog = () => {
    setConfirmOpen(false);
    setToDelete(null);
  };

  const beginEdit = (it: TimeOffItem) => {
    setEditingId(it._id);
    setEKind(it.kind as Kind);
    setEStart(toLocalInputValue(new Date(it.start)));
    setEEnd(toLocalInputValue(new Date(it.end)));
    setEReason(it.reason || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEReason("");
  };

  const validateRange = (startLocal: string, endLocal: string) => {
    const s = new Date(startLocal).getTime();
    const e = new Date(endLocal).getTime();
    return e > s;
  };

  /** Helpers de escritura */
  const addOptimistic = (it: TimeOffItem) => {
    // actualiza la lista visible (key exacta)
    qc.setQueryData<TimeOffItem[]>(exactKey, (cur = []) => [it, ...cur]);
    // y las demás listas del mismo proveedor (cualquier rango)
    qc.setQueriesData<TimeOffItem[]>({ queryKey: baseKey, exact: false }, (cur) => {
      if (!Array.isArray(cur)) return cur;
      return [it, ...cur];
    });
  };
  const replaceOptimistic = (id: string, patch: Partial<TimeOffItem>) => {
    qc.setQueryData<TimeOffItem[]>(exactKey, (cur = []) => cur.map(i => i._id === id ? { ...i, ...patch } as TimeOffItem : i));
    qc.setQueriesData<TimeOffItem[]>({ queryKey: baseKey, exact: false }, (cur) => {
      if (!Array.isArray(cur)) return cur;
      return cur.map(i => i._id === id ? { ...i, ...patch } as TimeOffItem : i);
    });
  };
  const removeOptimistic = (id: string) => {
    qc.setQueryData<TimeOffItem[]>(exactKey, (cur = []) => cur.filter(i => i._id !== id));
    qc.setQueriesData<TimeOffItem[]>({ queryKey: baseKey, exact: false }, (cur) => {
      if (!Array.isArray(cur)) return cur;
      return cur.filter(i => i._id !== id);
    });
  };

  const onCreate = async () => {
    if (!validateRange(cStart, cEnd)) {
      toast({ title: "Invalid range", description: "End must be after start.", status: "warning" });
      return;
    }
    const optimisticItem: TimeOffItem = {
      _id: `tmp-${Date.now()}`,
      kind: cKind,
      start: new Date(cStart).toISOString(),
      end: new Date(cEnd).toISOString(),
      reason: cReason || "",
    };

    const prevExact = qc.getQueryData<TimeOffItem[]>(exactKey) ?? [];
    addOptimistic(optimisticItem);

    try {
      const created: any = await createMut.mutateAsync({
        id: providerId,
        payload: {
          kind: cKind,
          start: optimisticItem.start,
          end: optimisticItem.end,
          reason: optimisticItem.reason,
        },
      });

      if (created && created._id) {
        // reemplaza el temporal por el real en todas las listas
        removeOptimistic(optimisticItem._id);
        addOptimistic(created);
      } else {
        qc.invalidateQueries({ queryKey: baseKey, exact: false });
      }

      toast({ title: "Time off created", status: "success" });
    } catch (e: any) {
      // rollback solo en la visible; las demás también quedarán limpias por removeOptimistic
      qc.setQueryData(exactKey, prevExact);
      removeOptimistic(optimisticItem._id);
      toast({ title: "Error creating", description: e?.message ?? "Unexpected error", status: "error" });
    } finally {
      // Asegura refresco por si hay otras vistas (summary modal con otro rango)
      qc.invalidateQueries({ queryKey: baseKey, exact: false });
    }
  };

  const onSaveEdit = async () => {
    if (!editingId) return;
    if (!validateRange(eStart, eEnd)) {
      toast({ title: "Invalid range", description: "End must be after start.", status: "warning" });
      return;
    }
    const patch: Partial<TimeOffItem> = {
      kind: eKind,
      start: new Date(eStart).toISOString(),
      end: new Date(eEnd).toISOString(),
      reason: eReason,
    };

    const prevExact = qc.getQueryData<TimeOffItem[]>(exactKey) ?? [];
    replaceOptimistic(editingId, patch);

    try {
      await updateMut.mutateAsync({
        providerId,
        timeOffId: editingId,
        payload: patch,
      });
      toast({ title: "Time off updated", status: "success" });
      setEditingId(null);
    } catch (e: any) {
      qc.setQueryData(exactKey, prevExact);
      toast({ title: "Error updating", description: e?.message ?? "Unexpected error", status: "error" });
    } finally {
      qc.invalidateQueries({ queryKey: baseKey, exact: false });
    }
  };

  const handleConfirmDelete = async () => {
    if (!toDelete) return;

    const prevExact = qc.getQueryData<TimeOffItem[]>(exactKey) ?? [];
    removeOptimistic(toDelete._id);

    try {
      await deleteMut.mutateAsync({ providerId, timeOffId: toDelete._id });
      toast({ title: "Time off deleted", status: "success" });
    } catch (e: any) {
      // rollback
      qc.setQueryData(exactKey, prevExact);
      addOptimistic(toDelete);
      toast({ title: "Error deleting", description: e?.message ?? "Unexpected error", status: "error" });
    } finally {
      qc.invalidateQueries({ queryKey: baseKey, exact: false });
      closeDeleteDialog();
    }
  };

  const labelColor = useColorModeValue("gray.600", "gray.300");

  return (
    <VStack align="stretch" spacing={5}>
      {/* Filters */}
      <Card variant="outline">
        <CardHeader pb={2}>
          <Heading size="sm">Filter</Heading>
        </CardHeader>
        <CardBody>
          <HStack gap={4} wrap="wrap">
            <FormControl maxW="xs">
              <FormLabel mb={1}>From</FormLabel>
              <Input type="datetime-local" value={fromLocal} onChange={(e) => setFromLocal(e.target.value)} />
            </FormControl>
            <FormControl maxW="xs">
              <FormLabel mb={1}>To</FormLabel>
              <Input type="datetime-local" value={toLocal} onChange={(e) => setToLocal(e.target.value)} />
            </FormControl>
            <Spacer />
            <HStack>
              <Button variant="ghost" onClick={() => { setFromLocal(""); setToLocal(""); }}>
                Clear
              </Button>
              <Tag>{isFetching ? "Loading…" : `${items.length} item${items.length === 1 ? "" : "s"}`}</Tag>
            </HStack>
          </HStack>
        </CardBody>
      </Card>

      {/* Create */}
      <Card variant="outline">
        <CardHeader pb={2}>
          <Heading size="sm">Add time off</Heading>
        </CardHeader>
        <CardBody>
          <SimpleGrid columns={{ base: 1, md: 4 }} gap={4}>
            <FormControl>
              <FormLabel mb={1}>Kind</FormLabel>
              <Select value={cKind} onChange={(e) => setCKind(e.target.value as Kind)}>
                {kinds.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </Select>
            </FormControl>
            <FormControl>
              <FormLabel mb={1}>Start</FormLabel>
              <Input type="datetime-local" value={cStart} onChange={(e) => setCStart(e.target.value)} />
              <Text mt={1} fontSize="xs" color={labelColor}>
                {formatSydneyLabel(new Date(cStart).toISOString())}
              </Text>
            </FormControl>
            <FormControl>
              <FormLabel mb={1}>End</FormLabel>
              <Input type="datetime-local" value={cEnd} onChange={(e) => setCEnd(e.target.value)} />
              <Text mt={1} fontSize="xs" color={labelColor}>
                {formatSydneyLabel(new Date(cEnd).toISOString())}
              </Text>
            </FormControl>
            <FormControl>
              <FormLabel mb={1}>Reason</FormLabel>
              <Input value={cReason} onChange={(e) => setCReason(e.target.value)} placeholder="Optional" />
            </FormControl>
          </SimpleGrid>
          <HStack justify="flex-end" mt={4}>
            <Button
              leftIcon={<AddIcon />}
              colorScheme="teal"
              onClick={onCreate}
              isLoading={createMut.isPending}
            >
              Create
            </Button>
          </HStack>
        </CardBody>
      </Card>

      {/* List + inline edit */}
      <Card variant="outline">
        <CardHeader pb={2}>
          <Heading size="sm">Current time off</Heading>
        </CardHeader>
        <CardBody>
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>Kind</Th>
                <Th>Start</Th>
                <Th>End</Th>
                <Th>Reason</Th>
                <Th isNumeric>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {items.map((it) => {
                const isEditing = editingId === it._id;
                return (
                  <Tr key={it._id} _hover={{ bg: "blackAlpha.50" }}>
                    <Td>
                      {isEditing ? (
                        <Select size="sm" value={eKind} onChange={(e) => setEKind(e.target.value as Kind)}>
                          {kinds.map((k) => (
                            <option key={k} value={k}>{k}</option>
                          ))}
                        </Select>
                      ) : (
                        <Tag>{it.kind}</Tag>
                      )}
                    </Td>
                    <Td>
                      {isEditing ? (
                        <VStack align="start" spacing={1}>
                          <Input size="sm" type="datetime-local" value={eStart} onChange={(e) => setEStart(e.target.value)} />
                          <Text fontSize="xs" color={labelColor}>
                            {formatSydneyLabel(it.start)}
                          </Text>
                        </VStack>
                      ) : (
                        <Box>{formatSydneyLabel(it.start)}</Box>
                      )}
                    </Td>
                    <Td>
                      {isEditing ? (
                        <VStack align="start" spacing={1}>
                          <Input size="sm" type="datetime-local" value={eEnd} onChange={(e) => setEEnd(e.target.value)} />
                          <Text fontSize="xs" color={labelColor}>
                            {formatSydneyLabel(it.end)}
                          </Text>
                        </VStack>
                      ) : (
                        <Box>{formatSydneyLabel(it.end)}</Box>
                      )}
                    </Td>
                    <Td>
                      {isEditing ? (
                        <Input
                          size="sm"
                          value={eReason}
                          onChange={(e) => setEReason(e.target.value)}
                          placeholder="Optional"
                        />
                      ) : (
                        <Box>{it.reason || "—"}</Box>
                      )}
                    </Td>
                    <Td isNumeric>
                      <HStack justify="flex-end" spacing={2}>
                        {isEditing ? (
                          <>
                            <Button
                              size="xs"
                              colorScheme="teal"
                              onClick={onSaveEdit}
                              isLoading={updateMut.isPending}
                            >
                              Save
                            </Button>
                            <Button size="xs" variant="ghost" onClick={cancelEdit}>
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="xs"
                              leftIcon={<EditIcon />}
                              variant="outline"
                              onClick={() => beginEdit(it)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="xs"
                              leftIcon={<DeleteIcon />}
                              colorScheme="red"
                              variant="outline"
                              onClick={() => openDeleteDialog(it)}
                              isLoading={deleteMut.isPending && toDelete?._id === it._id}
                            >
                              Delete
                            </Button>
                          </>
                        )}
                      </HStack>
                    </Td>
                  </Tr>
                );
              })}
              {items.length === 0 && (
                <Tr>
                  <Td colSpan={5}>
                    <Box color="gray.500">No time off found for the selected range.</Box>
                  </Td>
                </Tr>
              )}
            </Tbody>
          </Table>
        </CardBody>
      </Card>

      {/* Premium confirm dialog */}
      <AlertDialog
        isOpen={confirmOpen}
        leastDestructiveRef={cancelRef}
        onClose={closeDeleteDialog}
        isCentered
        motionPreset="scale"
      >
        <AlertDialogOverlay />
        <AlertDialogContent>
          <AlertDialogHeader fontSize="lg" fontWeight="bold">
            Delete time off
          </AlertDialogHeader>

          <AlertDialogBody>
            {toDelete ? (
              <>
                Are you sure you want to delete this time off?
                <br />
                <Text mt={2} fontSize="sm" color="gray.500">
                  {formatSydneyLabel(toDelete.start)} — {formatSydneyLabel(toDelete.end)}
                </Text>
                {toDelete.reason ? (
                  <Text mt={1} fontSize="sm" color="gray.500">
                    Reason: {toDelete.reason}
                  </Text>
                ) : null}
              </>
            ) : null}
          </AlertDialogBody>

          <AlertDialogFooter>
            <Button ref={cancelRef} onClick={closeDeleteDialog} variant="ghost">
              Cancel
            </Button>
            <Button colorScheme="red" onClick={handleConfirmDelete} ml={3} isLoading={deleteMut.isPending}>
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </VStack>
  );
}
