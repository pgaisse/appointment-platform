import React, { useMemo, useRef, useState } from "react";
import {
    Box,
    Card,
    CardHeader,
    CardBody,
    Heading,
    Text,
    HStack,
    VStack,
    Stack,
    Button,
    Icon,
    Input,
    InputGroup,
    InputLeftElement,
    Tag,
    Tooltip,
    useToast,
    Table,
    Thead,
    Tr,
    Th,
    Tbody,
    Td,
    Badge,
    NumberInput,
    NumberInputField,
    NumberInputStepper,
    NumberIncrementStepper,
    NumberDecrementStepper,
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    ModalCloseButton,
    FormControl,
    FormLabel,
    Textarea,
    FormErrorMessage,
    SimpleGrid,
    AlertDialog,
    AlertDialogOverlay,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogBody,
    AlertDialogFooter,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    Spinner,
    VisuallyHidden,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import { FiPlus, FiSearch, FiTrash2, FiEdit3 } from "react-icons/fi";
import * as FiIcons from "react-icons/fi";
import * as FaIcons from "react-icons/fa";
import * as MdIcons from "react-icons/md";
import * as RiIcons from "react-icons/ri";
import * as GiIcons from "react-icons/gi";
import type { IconType } from "react-icons";
import { useMeta, type Priority, type Treatment } from "@/Hooks/Query/useMeta";

const MotionCard = motion(Card);

// 🔹 Registro de librerías
const ICON_SETS: Record<string, Record<string, IconType>> = {
    fi: FiIcons as Record<string, IconType>,
    fa: FaIcons as Record<string, IconType>,
    md: MdIcons as Record<string, IconType>,
    ri: RiIcons as Record<string, IconType>,
    gi: GiIcons as Record<string, IconType>,
};

// 🔹 Íconos por defecto (normalizados con prefijo)
const DEFAULT_ICON_KEYS: string[] = [
    "md:MdOutlineConstruction", "md:MdConstruction",
    "md:MdOutlineDesignServices", "md:MdDesignServices",
    "md:MdOutlineChat", "md:MdChat",
    "md:MdOutlineTagFaces", "md:MdTagFaces",
    "md:MdOutlineHealthAndSafety", "md:MdHealthAndSafety",
    "md:MdOutlineMedicalServices", "md:MdMedicalServices",
    "md:MdOutlineAddCircleOutline",
    "md:MdOutlineSettingsAccessibility", "md:MdSettingsAccessibility",
    "md:MdOutlineBrokenImage", "md:MdBrokenImage",
    "md:MdCleaningServices",
    "md:MdHealing",

    // GameIcons
    "gi:GiToothImplant",
    "gi:GiCrown",
    "gi:GiToothbrush",
    "gi:GiToothExtraction",

    // FontAwesome
    "fa:FaTooth",
    "fa:FaPuzzlePiece",
    "fa:FaCrown",

    // Feather
    "fi:FiScissors",
];

// 🔹 Normalizador: si viene "MdHealing" lo convierte a "md:MdHealing"
function normalizeIconKey(key: string): string {
    if (!key) return "";
    if (key.includes(":")) return key; // ya viene con prefijo
    // detecta por la inicial del nombre
    if (key.startsWith("Fi")) return `fi:${key}`;
    if (key.startsWith("Fa")) return `fa:${key}`;
    if (key.startsWith("Md")) return `md:${key}`;
    if (key.startsWith("Ri")) return `ri:${key}`;
    if (key.startsWith("Gi")) return `gi:${key}`;
    return key; // fallback
}

// 🔹 Obtiene el componente del icono
function getIconComponent(key?: string): IconType | undefined {
    if (!key) return undefined;
    const normKey = normalizeIconKey(key);
    const [pack, name] = normKey.split(":");
    const set = ICON_SETS[pack?.toLowerCase?.()];
    return set ? set[name] : undefined;
}


// utils
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
                rounded="xl"
            />
        </InputGroup>
    );
}

// Icon Picker component
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

        // Support optional pack filter like "fi:" or "md:cut"
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
                if (keys.length >= 400) break; // cap for performance
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
                        <Box
                            w="28px"
                            h="28px"
                            display="inline-flex"
                            alignItems="center"
                            justifyContent="center"
                        >
                            {preview ? (
                                <Icon as={preview} boxSize={5} />
                            ) : (
                                <Box w="20px" h="20px" borderWidth="1px" rounded="md" />
                            )}
                        </Box>
                        <Input
                            value={value || ""}
                            onChange={(e) => onChange(e.target.value)}
                            placeholder="e.g. fi:FiScissors, md:MdLocalHospital, ri:RiScissors2, gi:GiHealing"
                            rounded="xl"
                        />
                    </HStack>
                    <Button onClick={() => setIsOpen(true)} rounded="xl" variant="outline">
                        Browse
                    </Button>
                </Box>
            </HStack>
            <Text mt={1} fontSize="sm" color="gray.600">
                {helper ||
                    "Type pack:name or browse. Packs: fi (Feather), md (Material), fa (FontAwesome), ri (Remix), gi (Game Icons)."}
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
                                    placeholder="Search (pack:name)… e.g., 'scissor', 'fi:', 'ri:tooth'"
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                    rounded="xl"
                                />
                            </InputGroup>
                            <SimpleGrid
                                columns={{ base: 5, md: 8 }}
                                spacing={3}
                                maxH="360px"
                                overflowY="auto"
                                pr={1}
                            >
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
                                            <Text
                                                fontSize="xs"
                                                color="gray.600"
                                                noOfLines={1}
                                                maxW="100%"
                                            >
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

// Shared form for Priority and Treatment
function MetaForm<T extends Priority | Treatment>({
    item,
    onSave,
    onClose,
    title,
    isSaving,
    kind,
    suggestId,
}: {
    item: Partial<T>;
    onSave: (data: Partial<T>) => void; // <-- FIX TS2352: accept Partial<T>
    onClose: () => void;
    title: string;
    isSaving: boolean;
    kind: "priority" | "treatment";
    suggestId?: number; // only for priority
}) {
    const [form, setForm] = useState<Partial<T>>({ ...item });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const isPriority = kind === "priority";

    function validate(): boolean {
        const e: Record<string, string> = {};
        if (!form.name || String(form.name).trim().length === 0) e.name = "Required";
        if (isPriority) {
            if (form.id == null || isNaN(Number(form.id))) e.id = "Numeric ID required";
            if (!(form as unknown as Priority).description || String((form as unknown as Priority).description).trim().length === 0)
                e.description = "Required";
            if ((form as unknown as Priority).durationHours == null || Number((form as unknown as Priority).durationHours) < 0)
                e.durationHours = "Hours must be ≥ 0";
            if (!(form as unknown as Priority).color) e.color = "Color required";
        } else {
            // treatment validation
            if ((form as unknown as Treatment).duration == null || Number((form as unknown as Treatment).duration) <= 0)
                e.duration = "Duration (min) > 0";
            if (!(form as unknown as Treatment).icon) e.icon = "Icon required";
            if (!(form as unknown as Treatment).minIcon) e.minIcon = "Min icon required";
            if (!(form as unknown as Treatment).color) e.color = "Color required";
        }
        setErrors(e);
        return Object.keys(e).length === 0;
    }

    function submit() {
        if (!validate()) return;
        onSave(form); // <-- no unsafe cast
    }

    return (
        <Modal isOpen onClose={onClose} size="lg">
            <ModalOverlay />
            <ModalContent rounded="2xl" shadow="2xl">
                <ModalHeader>{title}</ModalHeader>
                <ModalCloseButton />
                <ModalBody>
                    <VStack align="stretch" spacing={4}>
                        <FormControl isInvalid={!!errors.name}>
                            <FormLabel>Name</FormLabel>
                            <Input
                                rounded="xl"
                                value={(form.name as string) || ""}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value as any }))}
                            />
                            {errors.name && <FormErrorMessage>{errors.name}</FormErrorMessage>}
                        </FormControl>

                        {isPriority ? (
                            <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
                                <FormControl isInvalid={!!errors.id}>
                                    <FormLabel>ID</FormLabel>
                                    <NumberInput
                                        rounded="xl"
                                        value={(form.id as number) ?? ""}
                                        onChange={(_, v) => setForm((f) => ({ ...f, id: v as any }))}
                                    >
                                        <NumberInputField />
                                        <NumberInputStepper>
                                            <NumberIncrementStepper />
                                            <NumberDecrementStepper />
                                        </NumberInputStepper>
                                    </NumberInput>
                                    {suggestId != null && (
                                        <Text mt={1} fontSize="sm" color="gray.500">
                                            Suggested ID: {suggestId}
                                        </Text>
                                    )}
                                    {errors.id && <FormErrorMessage>{errors.id}</FormErrorMessage>}
                                </FormControl>

                                <FormControl isInvalid={!!errors.durationHours}>
                                    <FormLabel>Duration (hours)</FormLabel>
                                    <NumberInput
                                        precision={2}
                                        step={0.25}
                                        min={0}
                                        rounded="xl"
                                        value={(form as unknown as Priority).durationHours ?? ""}
                                        onChange={(_, v) => setForm((f) => ({ ...f, durationHours: v as any }))}
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
                            </SimpleGrid>
                        ) : (
                            <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
                                <FormControl isInvalid={!!errors.duration}>
                                    <FormLabel>Duration (minutes)</FormLabel>
                                    <NumberInput
                                        step={5}
                                        min={0}
                                        rounded="xl"
                                        value={(form as unknown as Treatment).duration ?? ""}
                                        onChange={(_, v) => setForm((f) => ({ ...f, duration: v as any }))}
                                    >
                                        <NumberInputField />
                                        <NumberInputStepper>
                                            <NumberIncrementStepper />
                                            <NumberDecrementStepper />
                                        </NumberInputStepper>
                                    </NumberInput>
                                    {errors.duration && <FormErrorMessage>{errors.duration}</FormErrorMessage>}
                                </FormControl>
                                <FormControl>
                                    <FormLabel>Category</FormLabel>
                                    <Input
                                        rounded="xl"
                                        value={(form as unknown as Treatment).category || ""}
                                        onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as any }))}
                                    />
                                </FormControl>
                            </SimpleGrid>
                        )}

                        {isPriority ? (
                            <>
                                <FormControl isInvalid={!!errors.description}>
                                    <FormLabel>Description</FormLabel>
                                    <Textarea
                                        rounded="xl"
                                        rows={3}
                                        value={(form as unknown as Priority).description || ""}
                                        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value as any }))}
                                    />
                                    {errors.description && (
                                        <FormErrorMessage>{errors.description}</FormErrorMessage>
                                    )}
                                </FormControl>

                                <FormControl>
                                    <FormLabel>Notes</FormLabel>
                                    <Textarea
                                        rounded="xl"
                                        rows={2}
                                        value={(form as unknown as Priority).notes || ""}
                                        onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value as any }))}
                                    />
                                </FormControl>

                                <FormControl isInvalid={!!errors.color}>
                                    <FormLabel>Color</FormLabel>
                                    <HStack>
                                        <input
                                            aria-label="color"
                                            type="color"
                                            value={(form as unknown as Priority).color || "#3182ce"}
                                            onChange={(e) => setForm((f) => ({ ...f, color: e.target.value as any }))}
                                            style={{
                                                width: 48,
                                                height: 36,
                                                borderRadius: 8,
                                                border: "1px solid rgba(0,0,0,0.1)",
                                            }}
                                        />
                                        <ColorSwatch hex={(form as unknown as Priority).color} />
                                        <Text fontSize="sm" color="gray.600">
                                            {(form as unknown as Priority).color}
                                        </Text>
                                    </HStack>
                                    {errors.color && <FormErrorMessage>{errors.color}</FormErrorMessage>}
                                </FormControl>
                            </>
                        ) : (
                            <>
                                <Box
                                    sx={{
                                        // oculta inputs descendientes del IconPicker
                                        'input, [role="textbox"]': { display: 'none' },
                                        // evita que un posible input invisible reciba foco
                                        '& *': { caretColor: 'transparent' },
                                    }}
                                >
                                    <IconPicker
                                        label="Icon"
                                        value={(form as unknown as Treatment).icon}
                                        onChange={(v) => setForm((f) => ({ ...f, icon: v as any }))}
                                    />
                                </Box>
                                <Box
                                    sx={{
                                        // oculta inputs descendientes del IconPicker
                                        'input, [role="textbox"]': { display: 'none' },
                                        // evita que un posible input invisible reciba foco
                                        '& *': { caretColor: 'transparent' },
                                    }}
                                >
                                    <IconPicker
                                        label="Min Icon"
                                        value={(form as unknown as Treatment).minIcon}
                                        onChange={(v) => setForm((f) => ({ ...f, minIcon: v as any }))}
                                    />
                                </Box>
                                <FormControl isInvalid={!!errors.color}>
                                    <FormLabel>Color</FormLabel>
                                    <HStack>
                                        <input
                                            aria-label="color"
                                            type="color"
                                            value={(form as unknown as Treatment).color || "#3182ce"}
                                            onChange={(e) => setForm((f) => ({ ...f, color: e.target.value as any }))}
                                            style={{
                                                width: 48,
                                                height: 36,
                                                borderRadius: 8,
                                                border: "1px solid rgba(0,0,0,0.1)",
                                            }}
                                        />
                                        <ColorSwatch hex={(form as unknown as Treatment).color} />
                                        <Text fontSize="sm" color="gray.600">
                                            {(form as unknown as Treatment).color}
                                        </Text>
                                    </HStack>
                                    {errors.color && <FormErrorMessage>{errors.color}</FormErrorMessage>}
                                </FormControl>
                                {/* Active field removed */}
                            </>
                        )}
                    </VStack>
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

function PriorityTable<T extends Priority>({
    data,
    onEdit,
    onDelete,
    isLoading,
}: {
    data: T[];
    onEdit: (item: T) => void;
    onDelete: (item: T) => void;
    isLoading?: boolean;
}) {
    return (
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
                    {!isLoading && data.length === 0 && (
                        <Tr>
                            <Td colSpan={6}>
                                <HStack py={10} justify="center">
                                    <Text color="gray.500">No records</Text>
                                </HStack>
                            </Td>
                        </Tr>
                    )}
                    {data.map((row) => (
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
                                            <Tag size="sm" variant="subtle" rounded="full">
                                                Notes
                                            </Tag>
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
                                        <Text fontSize="sm" color="gray.600">
                                            {row.color}
                                        </Text>
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
                                        onClick={() => onEdit(row)}
                                    >
                                        Edit
                                    </Button>
                                    <Button
                                        size="sm"
                                        rounded="xl"
                                        leftIcon={<Icon as={FiTrash2} />}
                                        colorScheme="red"
                                        variant="outline"
                                        onClick={() => onDelete(row)}
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
    );
}

function TreatmentTable<T extends Treatment>({
    data,
    onEdit,
    onDelete,
    isLoading,
}: {
    data: T[];
    onEdit: (item: T) => void;
    onDelete: (item: T) => void;
    isLoading?: boolean;
}) {
    return (
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
                    {!isLoading && data.length === 0 && (
                        <Tr>
                            <Td colSpan={6}>
                                <HStack py={10} justify="center">
                                    <Text color="gray.500">No records</Text>
                                </HStack>
                            </Td>
                        </Tr>
                    )}
                    {data.map((row) => {
                        const MainIcon = getIconComponent(row.icon);

                        const MiniIcon = getIconComponent(row.minIcon);
                        return (
                            <Tr key={row._id || row.name} _hover={{ bg: "blackAlpha.50" }}>
                                <Td>
                                    <HStack>
                                        {<Icon as={MainIcon} color={`${row.color}.500`} boxSize={5} />}
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
                                            {MainIcon ? (
                                                <Icon as={MainIcon} color={`${row.color}.500`} boxSize={5} />
                                            ) : (
                                                <Text fontSize="sm">—</Text>
                                            )}
                                            <Text fontSize="xs" color="gray.600">
                                                icon:
                                            </Text>
                                            <Tag size="sm" variant="subtle" rounded="full">
                                                {row.icon || "—"}
                                            </Tag>
                                        </HStack>
                                        <HStack>
                                            {MiniIcon ? (
                                                <Icon as={MiniIcon} color={`${row.color}.500`} boxSize={4} />
                                            ) : (
                                                <Text fontSize="sm">—</Text>
                                            )}
                                            <Text fontSize="xs" color="gray.600">
                                                minIcon:
                                            </Text>
                                            <Tag size="sm" variant="subtle" rounded="full">
                                                {row.minIcon || "—"}
                                            </Tag>
                                        </HStack>
                                    </VStack>
                                </Td>
                                <Td>
                                    <HStack justify="flex-end">
                                        <Button
                                            size="sm"
                                            rounded="xl"
                                            leftIcon={<Icon as={FiEdit3} />}
                                            onClick={() => onEdit(row)}
                                        >
                                            Edit
                                        </Button>
                                        <Button
                                            size="sm"
                                            rounded="xl"
                                            leftIcon={<Icon as={FiTrash2} />}
                                            colorScheme="red"
                                            variant="outline"
                                            onClick={() => onDelete(row)}
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
    );
}

export default function MetaManager() {
    const toast = useToast();
    const [tab, setTab] = useState(0); // 0=Priorities, 1=Treatments
    const [q1, setQ1] = useState("");
    const [q2, setQ2] = useState("");

    const {
        priorities,
        treatments,
        isLoadingPriorities,
        isLoadingTreatments,
        suggestedPriorityId,
        createPriority,
        updatePriority,
        deletePriority,
        createTreatment,
        updateTreatment,
        deleteTreatment,
    } = useMeta();

    const filteredPriorities = useMemo(() => {
        const q = q1.trim().toLowerCase();
        return (priorities || [])
            .filter(
                (p) =>
                    !q ||
                    p.name.toLowerCase().includes(q) ||
                    (p.description || "").toLowerCase().includes(q)
            )
            .sort(byName);
    }, [priorities, q1]);

    const filteredTreatments = useMemo(() => {
        const q = q2.trim().toLowerCase();
        return (treatments || [])
            .filter(
                (t) =>
                    !q ||
                    t.name.toLowerCase().includes(q) ||
                    (t.category || "").toLowerCase().includes(q) ||
                    (t.icon || "").toLowerCase().includes(q) ||
                    (t.minIcon || "").toLowerCase().includes(q)
            )
            .sort(byName);
    }, [treatments, q2]);

    const [editing, setEditing] = useState<null | { kind: "priority" | "treatment"; data: any }>(null);
    const [deleting, setDeleting] = useState<null | { kind: "priority" | "treatment"; data: any }>(null);
    const [saving, setSaving] = useState(false);

    function onAddPriority() {
        setEditing({
            kind: "priority",
            data: { id: suggestedPriorityId, durationHours: 0, color: "#3182ce" },
        });
    }
    function onAddTreatment() {
        setEditing({
            kind: "treatment",
            data: {
                duration: 30,
                color: "#3182ce",
                category: "General",
                icon: "fi:FiScissors",
                minIcon: "fi:FiScissors",
            },
        });
    }
    function onEdit(item: any, kind: "priority" | "treatment") {
        setEditing({ kind, data: item });
    }
    function onDelete(item: any, kind: "priority" | "treatment") {
        setDeleting({ kind, data: item });
    }

    async function handleSave(payload: any) {
        try {
            setSaving(true);
            if (!editing) return;
            if (editing.data?._id) {
                if (editing.kind === "priority")
                    await updatePriority({ id: editing.data._id, payload });
                else await updateTreatment({ id: editing.data._id, payload });
            } else {
                if (editing.kind === "priority") await createPriority(payload);
                else await createTreatment(payload);
            }
            toast({ title: "Saved", status: "success" });
            setEditing(null);
        } catch (err: any) {
            toast({ title: "Save failed", description: err?.message || "", status: "error" });
        } finally {
            setSaving(false);
        }
    }

    async function confirmDelete() {
        try {
            if (!deleting) return;
            const { kind, data } = deleting;
            if (kind === "priority") await deletePriority({ id: data._id || data.id });
            else await deleteTreatment({ id: data._id });
            toast({ title: "Deleted", status: "success" });
            setDeleting(null);
        } catch (err: any) {
            toast({ title: "Delete failed", description: err?.message || "", status: "error" });
        }
    }

    return (
        <Stack spacing={6}>
            <MotionCard
                rounded="2xl"
                shadow="xl"
                whileHover={{ y: -2 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
            >
                <CardHeader pb={2}>
                    <HStack justify="space-between" align="center">
                        <VStack align="start" spacing={0}>
                            <Heading size="lg">Priorities & Treatments</Heading>
                            <Text color="gray.600">Manage key metadata for scheduling and classification</Text>
                        </VStack>
                    </HStack>
                </CardHeader>
                <CardBody pt={2}>
                    <Tabs index={tab} onChange={setTab} variant="enclosed" rounded="xl">
                        <TabList>
                            <Tab roundedTop="xl">Priorities</Tab>
                            <Tab roundedTop="xl">Treatments</Tab>
                        </TabList>
                        <TabPanels>
                            <TabPanel>
                                <HStack justify="space-between" mb={4}>
                                    <SearchBox value={q1} onChange={setQ1} placeholder="Search priority…" />
                                    <Button
                                        leftIcon={<Icon as={FiPlus} />}
                                        onClick={onAddPriority}
                                        colorScheme="teal"
                                        rounded="xl"
                                    >
                                        New priority
                                    </Button>
                                </HStack>
                                <PriorityTable
                                    data={filteredPriorities}
                                    isLoading={isLoadingPriorities}
                                    onEdit={(r) => onEdit(r, "priority")}
                                    onDelete={(r) => onDelete(r, "priority")}
                                />
                            </TabPanel>
                            <TabPanel>
                                <HStack justify="space-between" mb={4}>
                                    <SearchBox value={q2} onChange={setQ2} placeholder="Search treatment…" />
                                    <Button
                                        leftIcon={<Icon as={FiPlus} />}
                                        onClick={onAddTreatment}
                                        colorScheme="teal"
                                        rounded="xl"
                                    >
                                        New treatment
                                    </Button>
                                </HStack>
                                <TreatmentTable
                                    data={filteredTreatments as any}
                                    isLoading={isLoadingTreatments}
                                    onEdit={(r) => onEdit(r, "treatment")}
                                    onDelete={(r) => onDelete(r, "treatment")}
                                />
                            </TabPanel>
                        </TabPanels>
                    </Tabs>
                </CardBody>
            </MotionCard>

            {editing && (
                <MetaForm
                    item={editing.data}
                    onSave={handleSave}
                    onClose={() => setEditing(null)}
                    title={editing.data?._id ? "Edit" : "Create"}
                    isSaving={saving}
                    kind={editing.kind}
                    suggestId={editing.kind === "priority" ? suggestedPriorityId : undefined}
                />
            )}

            <ConfirmDelete
                isOpen={!!deleting}
                onClose={() => setDeleting(null)}
                onConfirm={confirmDelete}
                label={deleting?.data?.name || "record"}
            />
        </Stack>
    );
}
