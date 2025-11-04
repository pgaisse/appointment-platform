import React, { useMemo, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Badge,
  Box,
  Button,
  FormControl,
  FormErrorMessage,
  FormLabel,
  HStack,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  SimpleGrid,
  Spinner,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr,
  VisuallyHidden,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { FiEdit3, FiPlus, FiSearch, FiTrash2 } from "react-icons/fi";
import type { IconType } from "react-icons";
import { ICON_SETS, getIconComponent, canonicalizeIconKey } from "@/Components/CustomIcons";
import { z } from "zod";
import type { Treatment } from "@/Hooks/Query/useMeta";

type Props = {
  data: Treatment[];
  isLoading?: boolean;
  onCreate: (payload: Partial<Treatment>) => Promise<any>;
  onUpdate: (args: { id: string; payload: Partial<Treatment> }) => Promise<any>;
  onDelete: (args: { id: string }) => Promise<any>;
};


const DEFAULT_ICON_KEYS: string[] = [
  "md:MdOutlineConstruction", "md:MdConstruction",
  "md:MdOutlineDesignServices", "md:MdDesignServices",
  "md:MdOutlineChat", "md:MdChat",
  "md:MdOutlineMedicalServices", "md:MdMedicalServices",
  "gi:GiToothImplant", "gi:GiCrown", "gi:GiToothbrush", "gi:GiToothExtraction",
  "fa:FaTooth", "fa:FaCrown", "fi:FiScissors",
];

// normalizeIconKey and getIconComponent are provided by CustomIcons

const byName = <T extends { name?: string }>(a: T, b: T) =>
  (a.name || "").localeCompare(b.name || "");

function ColorSwatch({ hex }: { hex?: string }) {
  return (
    <Box
      aria-label={hex || "no color"}
      w="18px"
      h="18px"
      rounded="full"
      borderWidth="1px"
      borderColor="blackAlpha.300"
      style={{ background: hex || "transparent" }}
    />
  );
}

function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <InputGroup maxW="340px">
      <InputLeftElement pointerEvents="none">
        <Icon as={FiSearch} />
      </InputLeftElement>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "Search"}
        focusBorderColor="teal.400"
      />
    </InputGroup>
  );
}

// ——— IconPicker ———
function IconPicker({
  label,
  value,
  onChange,
  helper,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  helper?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [q, setQ] = useState("");

  const preview = getIconComponent(value || "");

  const catalog = useMemo(() => {
    const suggested = DEFAULT_ICON_KEYS.filter(Boolean);
    const query = q.trim().toLowerCase();
    if (!query) return suggested;

    let packFilter: string | null = null;
    let needle = query;
    if (query.includes(":")) {
      const [pack, rest] = query.split(":", 2);
      if (ICON_SETS[pack]) {
        packFilter = pack;
        needle = rest || "";
      }
    }
    const keys: string[] = [];
    Object.entries(ICON_SETS).forEach(([pack, set]) => {
      if (packFilter && pack !== packFilter) return;
      for (const name of Object.keys(set)) {
        const full = `${pack}:${name}`;
        if (!needle || full.toLowerCase().includes(needle)) keys.push(full);
        if (keys.length >= 400) break;
      }
    });
    return keys;
  }, [q]);

  return (
    <FormControl>
      <FormLabel>{label}</FormLabel>
      <HStack>
        <Box
          borderWidth="1px"
          rounded="xl"
          px={3}
          py={2}
          display="flex"
          alignItems="center"
          gap={8}
          flex={1}
        >
          <HStack gap={3}>
            <Box w="28px" h="28px" display="inline-flex" alignItems="center" justifyContent="center">
              {preview ? <Icon as={preview} boxSize={5} /> : <Box w="20px" h="20px" borderWidth="1px" rounded="md" />}
            </Box>
            <Input
              value={value || ""}
              onChange={(e) => onChange(e.target.value)}
              placeholder="ej. fi:FiScissors, md:MdLocalHospital"
            />
          </HStack>
          <Button onClick={() => setIsOpen(true)} rounded="xl" variant="outline">
            Browse
          </Button>
        </Box>
      </HStack>
      <Text mt={1} fontSize="sm" color="gray.600">
        {helper || "Escribe pack:name o explora. Packs: fi, md, fa, ri, gi."}
      </Text>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} size="xl">
        <ModalOverlay />
        <ModalContent rounded="2xl" shadow="2xl">
          <ModalHeader>Select an icon</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack align="stretch" spacing={4}>
              <InputGroup>
                <InputLeftElement pointerEvents="none">
                  <Icon as={FiSearch} />
                </InputLeftElement>
                <Input
                  placeholder="Search pack:name…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </InputGroup>
              <SimpleGrid columns={{ base: 5, md: 8 }} spacing={3} maxH="360px" overflowY="auto" pr={1}>
                {catalog.map((key) => {
                  const Comp = getIconComponent(key);
                  if (!Comp) return null;
                  const [pack, name] = key.split(":");
                  return (
                    <Button
                      key={key}
                      onClick={() => {
                        onChange(key);
                        setIsOpen(false);
                      }}
                      variant="ghost"
                      rounded="lg"
                      h="64px"
                      display="flex"
                      flexDir="column"
                      alignItems="center"
                      justifyContent="center"
                      gap={2}
                    >
                      <Icon as={Comp} boxSize={6} />
                      <Text fontSize="xs" color="gray.600" noOfLines={1} maxW="100%">
                        {pack}:{name}
                      </Text>
                      <VisuallyHidden>{key}</VisuallyHidden>
                    </Button>
                  );
                })}
              </SimpleGrid>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button onClick={() => setIsOpen(false)} rounded="xl">
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </FormControl>
  );
}

// ——— Formulario de Treatment (sin campo “active”) ———
const TreatmentSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    duration: z
      .number({ invalid_type_error: "Duration must be a number" })
      .min(0, "Duration must be ≥ 0"),
    category: z.string().optional().or(z.literal("")),
    icon: z.string().min(1, "Icon is required"),
    minIcon: z.string().min(1, "Min icon is required"),
    color: z
      .string()
      .min(1, "Color is required")
      .regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i, "Use a hex color"),
  })
  .superRefine((val, ctx) => {
    if (!getIconComponent(val.icon)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid icon key", path: ["icon"] });
    }
    if (!getIconComponent(val.minIcon)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid min icon key",
        path: ["minIcon"],
      });
    }
  });

function TreatmentForm({
  initial,
  onClose,
  onSubmit,
  isSaving,
}: {
  initial: Partial<Treatment>;
  onClose: () => void;
  onSubmit: (data: Partial<Treatment>) => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<Partial<Treatment>>({
    name: initial.name ?? "",
    duration: initial.duration ?? 30,
    category: initial.category ?? "General",
    icon: initial.icon ?? "fi:FiScissors",
    minIcon: initial.minIcon ?? "fi:FiScissors",
    color: initial.color ?? "#3182ce",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function parseNumber(n: number) {
    return Number.isFinite(n) ? n : (undefined as any);
  }

  function submit() {
    const parsed = TreatmentSchema.safeParse({
      ...form,
      duration: parseNumber(form.duration as any),
    });
    if (!parsed.success) {
      const e: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".") || "form";
        e[path] = issue.message;
      }
      setErrors(e);
      return;
    }
    setErrors({});
    onSubmit(parsed.data);
  }

  return (
    <Modal isOpen onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent rounded="2xl" shadow="2xl">
        <ModalHeader>{initial._id ? "Edit treatment" : "New treatment"}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <HStack align="start" spacing={4} wrap="wrap">
            <FormControl isInvalid={!!errors.name} flex="1 1 260px">
              <FormLabel>Name</FormLabel>
              <Input
                value={form.name || ""}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              {errors.name && <FormErrorMessage>{errors.name}</FormErrorMessage>}
            </FormControl>

            <FormControl isInvalid={!!errors.duration} w="240px">
              <FormLabel>Duration (minutes)</FormLabel>
              <NumberInput
                value={form.duration ?? ""}
                onChange={(_, v) => setForm((f) => ({ ...f, duration: v as any }))}
                min={0}
                step={5}
              >
                <NumberInputField />
                <NumberInputStepper>
                  <NumberIncrementStepper />
                  <NumberDecrementStepper />
                </NumberInputStepper>
              </NumberInput>
              {errors.duration && <FormErrorMessage>{errors.duration}</FormErrorMessage>}
            </FormControl>

            <FormControl isInvalid={!!errors.category} flex="1 1 240px">
              <FormLabel>Category</FormLabel>
              <Input
                value={form.category || ""}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              />
              {errors.category && <FormErrorMessage>{errors.category}</FormErrorMessage>}
            </FormControl>
          </HStack>

          <Box mt={4} sx={{ "input, [role='textbox']": { display: "none" }, "& *": { caretColor: "transparent" } }}>
            <IconPicker
              label="Icon"
              value={form.icon}
              onChange={(v) => setForm((f) => ({ ...f, icon: v }))}
            />
          </Box>
          {errors.icon && (
            <Text color="red.500" fontSize="sm" mt={-2}>
              {errors.icon}
            </Text>
          )}

          <Box mt={4} sx={{ "input, [role='textbox']": { display: "none" }, "& *": { caretColor: "transparent" } }}>
            <IconPicker
              label="Min Icon"
              value={form.minIcon}
              onChange={(v) => setForm((f) => ({ ...f, minIcon: v }))}
            />
          </Box>
          {errors.minIcon && (
            <Text color="red.500" fontSize="sm" mt={-2}>
              {errors.minIcon}
            </Text>
          )}

          <FormControl mt={4} isInvalid={!!errors.color}>
            <FormLabel>Color</FormLabel>
            <HStack>
              <input
                aria-label="color"
                type="color"
                value={form.color || "#3182ce"}
                onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                style={{
                  width: 48,
                  height: 36,
                  borderRadius: 8,
                  border: "1px solid rgba(0,0,0,0.1)",
                }}
              />
              <ColorSwatch hex={form.color} />
              <Text fontSize="sm" color="gray.600">
                {form.color}
              </Text>
            </HStack>
            {errors.color && <FormErrorMessage>{errors.color}</FormErrorMessage>}
          </FormControl>
        </ModalBody>

        <ModalFooter>
          <HStack spacing={3}>
            <Button variant="ghost" onClick={onClose} rounded="xl">
              Cancel
            </Button>
            <Button onClick={submit} rounded="xl" colorScheme="teal" isLoading={isSaving}>
              Save
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function ConfirmDelete({
  isOpen,
  onClose,
  onConfirm,
  label,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  label: string;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <AlertDialog isOpen={isOpen} leastDestructiveRef={cancelRef} onClose={onClose}>
      <AlertDialogOverlay>
        <AlertDialogContent rounded="2xl">
          <AlertDialogHeader fontSize="lg" fontWeight="bold">
            Delete
          </AlertDialogHeader>
          <AlertDialogBody>
            Are you sure you want to delete “{label}”? This cannot be undone.
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button ref={cancelRef} onClick={onClose} variant="ghost" rounded="xl">
              Cancel
            </Button>
            <Button colorScheme="red" onClick={onConfirm} ml={3} rounded="xl">
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  );
}

export function TreatmentsManager({ data, isLoading, onCreate, onUpdate, onDelete }: Props) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<null | Treatment>(null);
  const [deleting, setDeleting] = useState<null | Treatment>(null);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data || [])
      .filter(
        (t) =>
          !needle ||
          t.name.toLowerCase().includes(needle) ||
          (t.category || "").toLowerCase().includes(needle) ||
          (t.icon || "").toLowerCase().includes(needle) ||
          (t.minIcon || "").toLowerCase().includes(needle)
      )
      .sort(byName);
  }, [data, q]);

  async function handleSave(payload: Partial<Treatment>) {
    try {
      setSaving(true);
      const normalized = {
        ...payload,
        icon: canonicalizeIconKey(String(payload.icon || "")),
        minIcon: canonicalizeIconKey(String(payload.minIcon || "")),
      } as Partial<Treatment>;
      if (editing?._id) {
        await onUpdate({ id: editing._id, payload: normalized });
      } else if (editing) {
        await onCreate(normalized);
      }
      toast({ title: "Saved", status: "success" });
      setEditing(null);
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message || "", status: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting?._id) return;
    try {
      await onDelete({ id: deleting._id });
      toast({ title: "Deleted", status: "success" });
      setDeleting(null);
    } catch (e: any) {
      toast({ title: "Delete failed", description: e?.message || "", status: "error" });
    }
  }

  return (
    <Box>
      <HStack justify="space-between" mb={4}>
        <SearchBox value={q} onChange={setQ} placeholder="Search treatment…" />
        <Button
          leftIcon={<Icon as={FiPlus} />}
          colorScheme="teal"
          rounded="xl"
          onClick={() =>
            setEditing({
              name: "",
              duration: 30,
              category: "General",
              icon: "fi:FiScissors",
              minIcon: "fi:FiScissors",
              color: "#3182ce",
              id: "",
            } as Treatment)
          }
        >
          New treatment
        </Button>
      </HStack>

      <Box overflow="auto" rounded="2xl" borderWidth="1px" borderColor="blackAlpha.200">
        <Table size="md">
          <Thead bg="blackAlpha.50">
            <Tr>
              <Th>Name</Th>
              <Th isNumeric>Duration (min)</Th>
              <Th>Category</Th>
              <Th>Color</Th>
              <Th>Icons</Th>
              <Th textAlign="right">Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {isLoading && (
              <Tr>
                <Td colSpan={6}>
                  <HStack py={6} justify="center">
                    <Spinner />
                  </HStack>
                </Td>
              </Tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <Tr>
                <Td colSpan={6}>
                  <HStack py={10} justify="center">
                    <Text color="gray.500">No records</Text>
                  </HStack>
                </Td>
              </Tr>
            )}
            {filtered.map((row) => {
              const MainIcon = getIconComponent(row.icon);
              const MiniIcon = getIconComponent(row.minIcon);
              return (
                <Tr key={row._id || row.name} _hover={{ bg: "blackAlpha.50" }}>
                  <Td>
                    <HStack>
                      {MainIcon ? <Icon as={MainIcon} color={row.color} boxSize={5} /> : <Text fontSize="sm">—</Text>}
                      <Text fontWeight={600}>{row.name}</Text>
                    </HStack>
                  </Td>
                  <Td isNumeric>{row.duration}</Td>
                  <Td>{row.category || "General"}</Td>
                  <Td>
                    {row.color ? (
                      <HStack>
                        <ColorSwatch hex={row.color} />
                        <Text fontSize="sm" color="gray.600">
                          {row.color}
                        </Text>
                      </HStack>
                    ) : (
                      <Text color="gray.400">—</Text>
                    )}
                  </Td>
                  <Td>
                    <VStack align="start" spacing={1}>
                      <HStack>
                        {MainIcon ? <Icon as={MainIcon} color={row.color} boxSize={5} /> : <Text fontSize="sm">—</Text>}
                        <Text fontSize="xs" color="gray.600">
                          icon:
                        </Text>
                        <Badge variant="subtle" rounded="full">
                          {row.icon || "—"}
                        </Badge>
                      </HStack>
                      <HStack>
                        {MiniIcon ? <Icon as={MiniIcon} color={row.color} boxSize={4} /> : <Text fontSize="sm">—</Text>}
                        <Text fontSize="xs" color="gray.600">
                          minIcon:
                        </Text>
                        <Badge variant="subtle" rounded="full">
                          {row.minIcon || "—"}
                        </Badge>
                      </HStack>
                    </VStack>
                  </Td>
                  <Td>
                    <HStack justify="flex-end">
                      <Button
                        size="sm"
                        rounded="xl"
                        leftIcon={<Icon as={FiEdit3} />}
                        onClick={() => setEditing(row)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        rounded="xl"
                        leftIcon={<Icon as={FiTrash2} />}
                        colorScheme="red"
                        variant="outline"
                        onClick={() => setDeleting(row)}
                      >
                        Delete
                      </Button>
                    </HStack>
                  </Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      </Box>

      {editing && (
        <TreatmentForm
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={handleSave}
          isSaving={saving}
        />
      )}

      <ConfirmDelete
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        label={deleting?.name || "record"}
      />
    </Box>
  );
}
