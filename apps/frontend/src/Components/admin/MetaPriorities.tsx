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
  Spinner,
  Table,
  Tbody,
  Td,
  Text,
  Textarea,
  Th,
  Thead,
  Tooltip,
  Tr,
  useToast,
} from "@chakra-ui/react";
import { FiEdit3, FiPlus, FiSearch, FiTrash2 } from "react-icons/fi";
import { z } from "zod";
import type { Priority } from "@/Hooks/Query/useMeta";
import { debounce } from "@/utils/validation";

type Props = {
  data: Priority[];
  isLoading?: boolean;
  suggestedId: number;
  onCreate: (payload: Partial<Priority>) => Promise<any>;
  onUpdate: (args: { id: string | number; payload: Partial<Priority> }) => Promise<any>;
  onDelete: (args: { id: string | number }) => Promise<any>;
};

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

// ——— Formulario de Priority (validación Zod) ———
const PrioritySchema = z.object({
  name: z.string().min(1, "Name is required"),
  id: z.number({ invalid_type_error: "ID must be a number" }).finite(),
  description: z.string().min(10, "Description is required"),
  notes: z.string().optional().or(z.literal("")),
  durationHours: z
    .number({ invalid_type_error: "Duration must be a number" })
    .min(0.5, "Minimum duration is 0.5 hours")
    .max(8, "Maximum duration is 8 hours"),
  color: z
    .string()
    .min(1, "Color is required")
    .regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i, "Use a hex color"),
});

function PriorityForm({
  initial,
  suggestedId,
  onClose,
  onSubmit,
  isSaving,
}: {
  initial: Partial<Priority>;
  suggestedId: number;
  onClose: () => void;
  onSubmit: (data: Partial<Priority>) => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<Partial<Priority>>({
    id: initial.id ?? suggestedId,
    name: initial.name ?? "",
    description: initial.description ?? "",
    notes: initial.notes ?? "",
    durationHours: initial.durationHours ?? 0.5,
    color: initial.color ?? "#3182ce",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function parseNumber(n: number) {
    return Number.isFinite(n) ? n : (undefined as any);
  }

  function submit() {
    const parsed = PrioritySchema.safeParse({
      ...form,
      id: parseNumber(form.id as any),
      durationHours: parseNumber(form.durationHours as any),
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
        <ModalHeader>{initial._id ? "Edit priority" : "New priority"}</ModalHeader>
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

            <FormControl isInvalid={!!errors.id} w="200px">
              <FormLabel>ID</FormLabel>
              <NumberInput
                value={form.id ?? ""}
                onChange={(_, v) => setForm((f) => ({ ...f, id: v as any }))}
                min={1}
                precision={0}
              >
                <NumberInputField />
                <NumberInputStepper>
                  <NumberIncrementStepper />
                  <NumberDecrementStepper />
                </NumberInputStepper>
              </NumberInput>
              <Text mt={1} fontSize="sm" color="gray.500">
                Suggested: {suggestedId}
              </Text>
              {errors.id && <FormErrorMessage>{errors.id}</FormErrorMessage>}
            </FormControl>

            <FormControl isInvalid={!!errors.durationHours} w="240px">
              <FormLabel>Duration (hours)</FormLabel>
              <NumberInput
                value={form.durationHours ?? ""}
                onChange={(_, v) => setForm((f) => ({ ...f, durationHours: v as any }))}
                min={0.5}
                max={8}
                step={0.25}
                precision={2}
              >
                <NumberInputField />
                <NumberInputStepper>
                  <NumberIncrementStepper />
                  <NumberDecrementStepper />
                </NumberInputStepper>
              </NumberInput>
              {errors.durationHours && (
                <FormErrorMessage>{errors.durationHours}</FormErrorMessage>
              )}
            </FormControl>
          </HStack>

          <FormControl mt={4} isInvalid={!!errors.description}>
            <FormLabel>Description</FormLabel>
            <Textarea
              rows={3}
              value={form.description || ""}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
            {errors.description && <FormErrorMessage>{errors.description}</FormErrorMessage>}
          </FormControl>

          <FormControl mt={4}>
            <FormLabel>Notes</FormLabel>
            <Textarea
              rows={2}
              value={form.notes || ""}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </FormControl>

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

export function PrioritiesManager({
  data,
  isLoading,
  suggestedId,
  onCreate,
  onUpdate,
  onDelete,
}: Props) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<null | Priority>(null);
  const [deleting, setDeleting] = useState<null | Priority>(null);
  const [saving, setSaving] = useState(false);

  // Debounced search
  const debouncedSetQ = useMemo(() => debounce(setQ, 300), []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data || [])
      .filter(
        (p) =>
          !needle ||
          p.name.toLowerCase().includes(needle) ||
          (p.description || "").toLowerCase().includes(needle)
      )
      .sort(byName);
  }, [data, q]);

  async function handleSave(payload: Partial<Priority>) {
    try {
      setSaving(true);
      if (editing?._id) {
        await onUpdate({ id: editing._id, payload });
      } else if (editing) {
        await onCreate(payload);
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
    if (!deleting) return;
    try {
      await onDelete({ id: deleting._id || deleting.id });
      toast({ title: "Deleted", status: "success" });
      setDeleting(null);
    } catch (e: any) {
      toast({ title: "Delete failed", description: e?.message || "", status: "error" });
    }
  }

  return (
    <Box>
      <HStack justify="space-between" mb={4}>
        <SearchBox value={q} onChange={debouncedSetQ} placeholder="Search priority…" />
        <Button
          leftIcon={<Icon as={FiPlus} />}
          colorScheme="teal"
          rounded="xl"
          onClick={() =>
            setEditing({
              id: suggestedId,
              name: "",
              description: "",
              notes: "",
              durationHours: 0.5,
              color: "#3182ce",
            } as Priority)
          }
        >
          New priority
        </Button>
      </HStack>

      <Box overflow="auto" rounded="2xl" borderWidth="1px" borderColor="blackAlpha.200">
        <Table size="md">
          <Thead bg="blackAlpha.50">
            <Tr>
              <Th>ID</Th>
              <Th>Name</Th>
              <Th>Description</Th>
              <Th isNumeric>Hours</Th>
              <Th>Color</Th>
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
            {filtered.map((row) => (
              <Tr key={row._id || row.id} _hover={{ bg: "blackAlpha.50" }}>
                <Td>
                  <Badge rounded="md" px={2}>
                    {row.id}
                  </Badge>
                </Td>
                <Td>
                  <HStack>
                    <Text fontWeight={600}>{row.name}</Text>
                    {row.notes && (
                      <Tooltip label={row.notes} hasArrow>
                        <Badge variant="subtle" rounded="full">
                          Notes
                        </Badge>
                      </Tooltip>
                    )}
                  </HStack>
                </Td>
                <Td>
                  <Text noOfLines={1}>{row.description}</Text>
                </Td>
                <Td isNumeric>{row.durationHours ?? "—"}</Td>
                <Td>
                  {row.color ? (
                    <HStack>
                      <ColorSwatch hex={row.color} />
                      
                    </HStack>
                  ) : (
                    <Text color="gray.400">—</Text>
                  )}
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
            ))}
          </Tbody>
        </Table>
      </Box>

      {editing && (
        <PriorityForm
          initial={editing}
          suggestedId={suggestedId}
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
