import React from "react";
import {
    Modal,
    ModalOverlay,
    ModalContent,
    ModalCloseButton,
    ModalBody,
    ModalFooter,
    Box,
    HStack,
    VStack,
    Stack,
    Text,
    Badge,
    Tag,
    TagLabel,
    Avatar,
    Grid,
    GridItem,
    Button,
    Tooltip,
    useClipboard,
    SimpleGrid,
    Wrap,
    WrapItem,
    useColorModeValue,
    Icon,
    Skeleton,
} from "@chakra-ui/react";
import { FiCalendar, FiClock, FiPhone, FiMail, FiUser, FiClipboard, FiInfo } from "react-icons/fi";
import { useGetCollection } from "@/Hooks/Query/useGetCollection";
import { ContactAppointment } from "@/types";
import { formatDateWS } from "@/Functions/FormatDateWS";
import { GrContact } from "react-icons/gr";
import { CiUser } from "react-icons/ci";
import { formatAustralianMobile } from "@/Functions/formatAustralianMobile";
import { mayusName } from "@/Functions/mayusName";

// -----------------------------
// Tipos basados en tus esquemas Mongoose (actualizados)
// -----------------------------
export type TimeSlot = string; // si tienes enum propio, reemplázalo
export type WeekDay = string;  // idem

export interface Treatment {
    _id: string;
    org_id?: string;
    name: string;
    duration: number; // minutos
    icon: string;
    minIcon: string;
    color: string; // hex o chakra color
    category?: string;
    active?: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface TimeBlock {
    _id?: string;
    org_id: string;
    blockNumber: number; // 1,2,3...
    label: TimeSlot;     // "Early Morning"
    short?: string;      // "EMor"
    from: string;        // "HH:mm"
    to: string;          // "HH:mm"
}

export interface SelectedDates {
    startDate: Date;
    endDate: Date;
    days: Array<{
        weekDay: WeekDay;
        timeBlocks: TimeBlock[];      // refs pobladas
        timeBlocksData?: TimeBlock[]; // opcional
    }>;
}

export interface Priority {
    _id?: string;
    org_id?: string;
    id: number;
    description?: string;
    notes?: string;
    durationHours?: number;
    name: string;
    color: string;
}

export interface ContactLog {
    _id?: string;
    appointment: string; // Appointment _id
    contactedAt: Date;
    contactedBy: string; // user_id o nombre del staff
    method: 'Phone' | 'Email' | 'SMS' | 'WhatsApp';
    status: 'Pending' | 'Contacted' | 'Failed' | 'No Contacted';
    notes?: string;
    org_id: string;
}
type Contacted = {
    _id?: string;
    status?: string; // ContactStatus
    startDate?: Date;
    endDate?: Date;
    context?: string;
    cSid?: string;
    pSid?: string;
    createdAt?: string;
    updatedAt?: string;
}; // populate opcional
export interface Appointment {
    contactedId?: Contacted; // populate opcional
    _id: string;
    proxyAddress?: string;
    unknown?: boolean;
    sid?: string;
    lastMessage?: Date;
    lastMessageInteraction?: string;

    nameInput: string;
    emailInput: string;
    phoneInput: string;
    lastNameInput: string;
    textAreaInput: string;

    treatment: Treatment | null;
    priority: Priority | null;

    note: string;
    color: string;
    user_id: string;
    org_id: string;
    org_name: string;
    position: number;
    contactMessages?: (ContactLog | string)[]; // populated o ids
    reschedule: boolean;

    selectedDates: SelectedDates;

    selectedAppDates: Array<{
        _id?: string;
        startDate?: Date;
        endDate?: Date;
        status?: string; // ContactStatus
        rescheduleRequested?: boolean;
        proposed?: {
            startDate?: Date;
            endDate?: Date;
            proposedBy?: "clinic" | "patient" | "system";
            reason?: string;
            createdAt?: Date;
        };
        confirmation?: {
            decision?: "confirmed" | "declined" | "reschedule" | "unknown";
            decidedAt?: Date;
            byMessageSid?: string;
            lateResponse?: boolean;
        };
    }>;
}

// -----------------------------
// Helpers visuales
// -----------------------------
const fmtDateTime = (d?: Date | string | number) =>
    d ? new Date(d).toLocaleString("en-AU", {
        timeZone: "Australia/Sydney",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }) : "—";


function contrastText(hex?: string): string {
    if (!hex) return "white";
    const h = hex.replace('#', '');
    const bigint = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    const r = (bigint >> 16) & 255, g = (bigint >> 8) & 255, b = bigint & 255;
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 128 ? "black" : "white";
}


const SectionCard: React.FC<{ title: React.ReactNode; right?: React.ReactNode; children?: React.ReactNode }>
    = ({ title, right, children }) => {
        const bg = useColorModeValue("whiteAlpha.900", "whiteAlpha.50");
        const border = useColorModeValue("blackAlpha.100", "whiteAlpha.200");
        return (
            <Box
                bg={bg}
                border="1px solid"
                borderColor={border}
                rounded="2xl"
                p={4}
                boxShadow="xl"
                backdropFilter="auto"
                backdropBlur="6px"
            >
                <HStack justify="space-between" mb={3}>
                    <HStack>{title}</HStack>
                    {right}
                </HStack>
                {children}
            </Box>
        );
    };

const LabeledRow: React.FC<{ icon?: any; label: string; value?: React.ReactNode; copyable?: boolean }>
    = ({ icon, label, value, copyable }) => {
        const isPrimitive = typeof value === "string" || typeof value === "number";
        const copyText = typeof value === "string" ? value : (typeof value === "number" ? String(value) : "");
        const { onCopy } = useClipboard(copyText);
        const sub = useColorModeValue("gray.600", "gray.300");
        return (
            <HStack align="flex-start" spacing={3}>
                {icon ? <Icon as={icon} boxSize={4} mt={1} opacity={0.9} /> : null}
                <VStack align="start" spacing={0} flex={1}>
                    <Text fontSize="xs" textTransform="uppercase" letterSpacing={0.4} color={sub}>{label}</Text>
                    <HStack>
                        {isPrimitive ? (
                            <Text as="span" fontWeight="semibold">{(value as any) ?? "—"}</Text>
                        ) : (
                            <Box as="span" fontWeight="semibold">{value ?? "—"}</Box>
                        )}
                        {copyable && copyText ? (
                            <Tooltip label="Copy" placement="top">
                                <Box as="button" onClick={onCopy} aria-label={`Copy ${label}`}>
                                    <FiClipboard />
                                </Box>
                            </Tooltip>
                        ) : null}
                    </HStack>
                </VStack>
            </HStack>
        );
    };

const PriorityTag: React.FC<{ priority?: Priority | null }> = ({ priority }) => (
    <Tag size="sm" rounded="full" px={3} py={1} bg={priority?.color ?? "pink.400"} color={contrastText(priority?.color)}>
        <TagLabel>{priority?.name ?? "No priority"}</TagLabel>
    </Tag>
);

const ColorSwatch: React.FC<{ color?: string }> = ({ color }) => (
    <Box w={3} h={3} rounded="full" border="1px solid" borderColor="blackAlpha.300" bg={color ?? "transparent"} />
);

// -----------------------------
// Componente principal (con fetch integrado via useGetCollection)
// -----------------------------
export type PremiumAppointmentModalProps = {
    id: string;
    isOpen: boolean;
    onClose: () => void;
};
console.log("--------------------------------->",)
const PremiumAppointmentModal: React.FC<PremiumAppointmentModalProps> = ({ id, isOpen, onClose }) => {
    const headerBg = useColorModeValue(
        "linear-gradient(135deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0) 100%), linear-gradient(90deg, #7C3AED 0%, #06B6D4 100%)",
        "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 100%), linear-gradient(90deg, #7C3AED 0%, #06B6D4 100%)"
    );
    const sub = useColorModeValue("blackAlpha.700", "whiteAlpha.700");
    const border = useColorModeValue("blackAlpha.200", "whiteAlpha.300");

    // --- Fetch con populate actualizado a tus refs ---
    const populateFields = [
        { path: "priority", select: "id description notes durationHours name color org_id" },
        { path: "treatment", select: "_id name duration icon minIcon color category active" },
        { path: "selectedDates.days.timeBlocks", select: "_id org_id blockNumber label short from to" },
        { path: "user", select: "auth0_id name email" },
    ] as const;

    const limit = 25;
    const safeQuery = React.useMemo(() => (
        id && id.trim() ? { _id: id } : { _id: { $exists: false } }
    ), [id]);

    const safeQuery2 = React.useMemo(() => (
        id && id.trim() ? { appointment: id } : { appointment: { $exists: false } }
    ), [id]);


    const { data, isLoading } = useGetCollection<Appointment>(
        "Appointment",
        { mongoQuery: safeQuery, limit, populate: populateFields }
    );
    const populateFieldsContacted = [
        { path: "user", select: "auth0_id name email" },
    ] as const;
    const { data: contacted } = useGetCollection<ContactAppointment>(
        "ContactAppointment",
        { mongoQuery: safeQuery2, limit, populate: populateFieldsContacted }
    );


    const appointment = data?.[0] ?? null;
    const fullName = `${appointment?.nameInput ?? ""} ${appointment?.lastNameInput ?? ""}`.trim() || "Unnamed";



    return (
        <Modal isOpen={isOpen} onClose={onClose} size="5xl" scrollBehavior="inside">
            <ModalOverlay backdropFilter="blur(6px)" />
            <ModalContent overflow="hidden" border="1px solid" borderColor={border} rounded="2xl">
                {/* Header */}
                <Box bg={headerBg} color="white" px={6} py={5} borderLeftWidth={6} borderLeftStyle="solid" borderLeftColor={appointment?.color ?? "transparent"}>
                    <HStack spacing={4} align="center">
                        <Avatar name={fullName} bg="whiteAlpha.900" color="black" size="lg" />


                        <VStack align="start" spacing={0} flex={1}>
                            <HStack wrap="wrap" spacing={3} align="center">
                                <Text fontSize="xl" fontWeight="extrabold">{fullName}</Text>
                                <PriorityTag priority={appointment?.priority ?? null} />
                                {appointment?.unknown ? (
                                    <Badge colorScheme="orange" rounded="full">Unknown</Badge>
                                ) : null}
                            </HStack>


                        </VStack>
                    </HStack>
                </Box>

                <ModalCloseButton top={3} right={3} color="white" />

                {/* Body */}
                <ModalBody px={6} py={5}>
                    {isLoading && !appointment ? (
                        <VStack align="stretch" spacing={4}>
                            <Skeleton h="28px" />
                            <Skeleton h="180px" />
                            <Skeleton h="220px" />
                        </VStack>
                    ) : (
                        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={5}>
                            {/* Columna izquierda */}
                            <VStack align="stretch" spacing={5}>
                                <SectionCard title={<HStack><Icon as={FiUser} /><Text>Contact</Text></HStack>}>
                                    <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap={4}>
                                        <GridItem>
                                            <LabeledRow icon={FiUser} label="Name" value={mayusName(fullName)} />
                                        </GridItem>
                                        <GridItem>
                                            <LabeledRow icon={FiPhone} label="Phone" value={formatAustralianMobile(appointment?.phoneInput?appointment?.phoneInput:"")} copyable />
                                        </GridItem>
                                        <GridItem>
                                            <LabeledRow icon={FiMail} label="Email" value={appointment?.emailInput} copyable />
                                        </GridItem>
                                    </Grid>
                                </SectionCard>

                                <SectionCard title={<HStack><Icon as={FiInfo} /><Text>Treatment</Text></HStack>} right={
                                    appointment?.treatment?.active === false ? (
                                        <Badge colorScheme="orange" rounded="full">Inactive</Badge>
                                    ) : (
                                        <Badge colorScheme="green" rounded="full">Active</Badge>
                                    )
                                }>
                                    <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap={4}>
                                        <LabeledRow label="Name" value={appointment?.treatment?.name} />
                                        <LabeledRow label="Duration" value={appointment?.treatment?.duration ? `${appointment?.treatment?.duration} min` : "—"} />
                                        <LabeledRow label="Category" value={appointment?.treatment?.category} />
                                        <HStack>
                                            <LabeledRow label="Color" value={appointment?.treatment?.color} />
                                            <ColorSwatch color={appointment?.treatment?.color} />
                                        </HStack>
                                    </Grid>
                                </SectionCard>

                                <SectionCard title={<HStack><Icon as={FiInfo} /><Text>Notes</Text></HStack>}>
                                    <VStack align="stretch" spacing={3}>

                                        <Box bg={useColorModeValue("blackAlpha.50", "whiteAlpha.100")} p={3} rounded="lg">
                                            <Text fontSize="xs" color={sub} mb={1}>Note</Text>
                                            <Text>{appointment?.note || "—"}</Text>
                                        </Box>
                                    </VStack>
                                </SectionCard>


                                <SectionCard title={<HStack><Icon as={FiInfo} /><Text>Contact History</Text></HStack>} right={<Badge rounded="full" colorScheme="blue">{contacted?.length} entries</Badge>}>
                                    {contacted?.length === 0 ? (
                                        <Text>—</Text>
                                    ) : (
                                        <VStack align="stretch" spacing={3}>
                                            {contacted?.map((log, idx) => (
                                                <HStack key={log._id ?? idx} align="flex-start" border="1px solid" borderColor={border} rounded="lg" p={2} justify="space-between">
                                                    <VStack align="start" spacing={1} flex={1}>
                                                        <HStack spacing={2}>
                                                            <Badge rounded="xl" px={2} py={1} bg={log.status === "Confirmed" ? "green.100" : "red.100"}
                                                                color={log.status === "Confirmed" ? "green.800" : "red.800"} fontSize="xs" fontWeight="bold" textTransform="uppercase">
                                                                <HStack spacing={1}>
                                                                    <LabeledRow icon={CiUser} label="User" value={(log.user?.name || "").trim().split(" ")[0] || log.user?.email || log.user?.auth0_id} />
                                                                    <LabeledRow icon={GrContact} label="Contacted" value={fmtDateTime(log.createdAt)} />
                                                                    <LabeledRow icon={FiClock} label="Appointment" value={formatDateWS({ startDate: new Date(log.startDate || ""), endDate: new Date(log.endDate || "") })} />


                                                                </HStack>
                                                            </Badge>
                                                            <Badge
                                                                rounded="full"

                                                            >

                                                            </Badge>


                                                        </HStack>
                                                        {//<Text fontSize="sm" color={sub}>{fmtDateTime(log.contactedAt)} · by {log.contactedBy}</Text>
                                                        }

                                                    </VStack>
                                                </HStack>
                                            ))}
                                        </VStack>
                                    )}
                                </SectionCard>
                            </VStack>

                            {/* Columna derecha */}
                            <VStack align="stretch" spacing={5}>
                                <SectionCard title={<HStack><Icon as={FiCalendar} /><Text>Selected Appointment Dates</Text></HStack>} right={
                                    <Badge colorScheme={appointment?.reschedule ? "orange" : "purple"} rounded="full">
                                        {appointment?.reschedule ? "Reschedule" : "New"}
                                    </Badge>
                                }>
                                    <VStack align="stretch" spacing={3}>
                                        {(appointment?.selectedAppDates ?? []).length === 0 ? (
                                            <Text>—</Text>
                                        ) : (
                                            <Stack spacing={3}>
                                                {(appointment?.selectedAppDates ?? []).map((it, idx) => (
                                                    <Box key={it._id ?? idx} border="1px solid" borderColor={border} rounded="xl" p={3}>
                                                        <HStack justify="space-between" mb={2}>
                                                            <HStack spacing={2}>

                                                                {it.rescheduleRequested ? (
                                                                    <Badge colorScheme="orange" rounded="full">Reschedule requested</Badge>
                                                                ) : null}
                                                                {it.status && (
                                                                    <Badge
                                                                        rounded="full"
                                                                        colorScheme={({
                                                                            Confirmed: "green",
                                                                            Declined: "red",
                                                                            Reschedule: "orange",
                                                                            Unknown: "gray",
                                                                        } as Record<string, string>)[it.status ?? "Unknown"] ?? "gray"}
                                                                    >
                                                                        {it.status}
                                                                    </Badge>
                                                                )}
                                                            </HStack>

                                                        </HStack>
                                                        <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={3}>
                                                            <LabeledRow icon={FiClock} label="Start" value={fmtDateTime(it.startDate)} />
                                                            <LabeledRow icon={FiClock} label="End" value={fmtDateTime(it.endDate)} />
                                                            <LabeledRow icon={FiCalendar} label="Proposed Start" value={fmtDateTime(it.proposed?.startDate)} />
                                                            <LabeledRow icon={FiCalendar} label="Proposed End" value={fmtDateTime(it.proposed?.endDate)} />
                                                        </Grid>
                                                        {(it.proposed?.reason || it.proposed?.proposedBy) && (
                                                            <Box mt={2}>
                                                                <Text fontSize="xs" color={sub}>
                                                                    Proposed by: <b>{it.proposed?.proposedBy}</b>
                                                                    {it.proposed?.createdAt ? ` · ${fmtDateTime(it.proposed.createdAt)}` : ""}
                                                                </Text>
                                                                {it.proposed?.reason && <Text fontSize="sm">Reason: {it.proposed.reason}</Text>}
                                                            </Box>
                                                        )}
                                                        {it.confirmation && (
                                                            <Box mt={2}>
                                                                <Text fontSize="xs" color={sub}>
                                                                    Decided at: {fmtDateTime(it.confirmation.decidedAt)}
                                                                    {it.confirmation.lateResponse ? " · Late response" : ""}
                                                                </Text>
                                                                {it.confirmation.byMessageSid && (
                                                                    <Text fontSize="xs" color={sub}>By Msg SID: {it.confirmation.byMessageSid}</Text>
                                                                )}
                                                            </Box>
                                                        )}

                                                    </Box>
                                                ))}
                                            </Stack>
                                        )}
                                    </VStack>
                                </SectionCard>

                                <SectionCard title={<HStack><Icon as={FiCalendar} /><Text>Selected Dates Pattern</Text></HStack>}>
                                    <VStack align="stretch" spacing={3}>
                                        <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap={4}>
                                            <LabeledRow label="From" value={fmtDateTime(appointment?.selectedDates?.startDate)} />
                                            <LabeledRow label="To" value={fmtDateTime(appointment?.selectedDates?.endDate)} />
                                        </Grid>
                                        <VStack align="stretch" spacing={2}>
                                            {(appointment?.selectedDates?.days ?? []).map((d, idx) => (
                                                <HStack key={idx} justify="space-between" border="1px solid" borderColor={border} rounded="lg" p={2}>
                                                    <Text fontWeight="semibold" w="150px">{d.weekDay}</Text>
                                                    <Wrap>
                                                        {(d.timeBlocks ?? []).map((tb, j) => (
                                                            <WrapItem key={j}>
                                                                <Tag size="sm" variant="subtle" colorScheme="purple" rounded="full">
                                                                    <TagLabel>{`${tb.short || tb.label}: ${tb.from} – ${tb.to}`}</TagLabel>
                                                                </Tag>
                                                            </WrapItem>
                                                        ))}
                                                    </Wrap>
                                                </HStack>
                                            ))}
                                        </VStack>
                                    </VStack>
                                </SectionCard>




                            </VStack>
                        </SimpleGrid>
                    )}
                </ModalBody>

                {/* Footer */}
                <ModalFooter>
                    <HStack w="full" justify="space-between">
                        <HStack color={sub}>
                            <FiInfo />

                        </HStack>
                        <HStack>
                            <Button variant="ghost" onClick={onClose}>Close</Button>
                           
                        </HStack>
                    </HStack>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default PremiumAppointmentModal;
