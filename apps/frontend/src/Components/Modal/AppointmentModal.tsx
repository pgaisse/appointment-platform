// apps/frontend/src/Components/Modal/PremiumAppointmentModal.tsx
import React, { Suspense } from "react";
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
  Button,
  Tooltip,
  useClipboard,
  SimpleGrid,
  Wrap,
  WrapItem,
  useColorModeValue,
  Icon,
  Skeleton,
  useDisclosure,
} from "@chakra-ui/react";
import { FiCalendar, FiClock, FiClipboard, FiInfo } from "react-icons/fi";
import { useQueryClient } from "@tanstack/react-query";
import { useGetCollection } from "@/Hooks/Query/useGetCollection";
import { Appointment, ContactAppointment, Provider } from "@/types";
import { formatDateWS } from "@/Functions/FormatDateWS";
import { GrContact } from "react-icons/gr";
import { CiUser } from "react-icons/ci";
import { getLatestSelectedAppDate, getSlotStart, getSlotEnd, pickDisplaySlot, getDisplaySlotRange } from "@/Functions/getLatestSelectedAppDate";

// 🚀 Chat: componente reutilizable (lazy) + icono
import ChatLauncher from "@/Components/Chat/ChatLauncher";
import { FaCommentSms } from "react-icons/fa6";
import { to12Hour } from "@/Functions/to12Hour";
import { useModalIndex } from "../ModalStack/ModalStackContext";
import { useSocket } from "@/Hooks/Query/useSocket";

// — Lazy load del ProviderSummaryModal —
const ProviderSummaryModalLazy = React.lazy(
  () => import("@/Components/Provider/ProviderSummaryModal")
);

// -----------------------------
// Tipos basados en tus esquemas Mongoose (actualizados)
// -----------------------------
export type TimeSlot = string;
export type WeekDay = string;

export interface Treatment {
  _id: string;
  org_id?: string;
  name: string;
  duration: number;
  icon: string;
  minIcon: string;
  color: string;
  category?: string;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface TimeBlock {
  _id?: string;
  org_id: string;
  blockNumber: number;
  label: TimeSlot;
  short?: string;
  from: string;
  to: string;
}

export interface SelectedDates {
  startDate: Date;
  endDate: Date;
  days: Array<{
    weekDay: WeekDay;
    timeBlocks: TimeBlock[];
    timeBlocksData?: TimeBlock[];
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

// -----------------------------
// Tipado adicional para slots y logs de contacto (reduce uso de any)
// -----------------------------
export interface AppointmentSlotConfirmation {
  askMessageSid?: string;
  sentAt?: string | Date;
  decidedAt?: string | Date;
  lateResponse?: boolean;
  status?: string;
}
export interface AppointmentSlotProposed {
  startDate?: string | Date;
  endDate?: string | Date;
  createdAt?: string | Date;
  reason?: string;
}
export interface AppointmentSlot {
  _id?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  proposed?: AppointmentSlotProposed;
  confirmation?: AppointmentSlotConfirmation;
  status?: string;
  rescheduleRequested?: boolean;
}

export interface ContactAppointmentSlim extends ContactAppointment {
  selectedAppDate?: string | AppointmentSlot; // puede venir poblado con el objeto del slot
  askMessageSid?: string;
  proposedStartDate?: string | Date;
  proposedEndDate?: string | Date;
  appointment?: {
    selectedAppDates?: AppointmentSlot[]; // lista recortada (solo slot relacionado)
  };
}

export interface ContactLog {
  _id?: string;
  appointment: string;
  contactedAt: Date;
  contactedBy: string;
  method: "Phone" | "Email" | "SMS" | "WhatsApp";
  status: "Pending" | "Contacted" | "Failed" | "No Contacted";
  notes?: string;
  org_id: string;
}
type Contacted = {
  _id?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  context?: string;
  cSid?: string;
  pSid?: string;
  createdAt?: string;
  updatedAt?: string;
};

// -----------------------------
// Helpers visuales
// -----------------------------
const fmtDateTime = (d?: Date | string | number) =>
  d
    ? new Date(d).toLocaleString("en-AU", {
        timeZone: "Australia/Sydney",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : "—";

function contrastText(hex?: string): string {
  if (!hex) return "white";
  const h = hex.replace("#", "");
  const bigint = parseInt(
    h.length === 3 ? h.split("").map((c) => c + c).join("") : h,
    16
  );
  const r = (bigint >> 16) & 255,
    g = (bigint >> 8) & 255,
    b = bigint & 255;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? "black" : "white";
}

function enrichAvatarColor(color?: string): { bg: string; color: string; borderColor: string } {
  if (!color) return { bg: "gray.500", color: "white", borderColor: "gray.700" };
  
  // Si es un color de Chakra (e.g., "blue", "red")
  if (!color.startsWith('#') && !color.includes('.')) {
    return {
      bg: `${color}.500`,
      color: "white",
      borderColor: `${color}.700`,
    };
  }
  
  // Si ya viene con nivel (e.g., "blue.500"), lo mantenemos
  if (color.includes(".")) {
    const [base] = color.split(".");
    return {
      bg: `${base}.500`,
      color: "white",
      borderColor: `${base}.700`,
    };
  }
  
  // Si es hex, calculamos contraste y añadimos borde oscuro
  const textColor = contrastText(color);
  return {
    bg: color,
    color: textColor,
    borderColor: textColor === "white" ? "blackAlpha.400" : "blackAlpha.600",
  };
}

// Normaliza status para comparaciones case-insensitive
const statusKey = (s?: string) => String(s || '').trim().toLowerCase();
const capStatus = (s?: string) => {
  const k = statusKey(s);
  if (!k) return 'Unknown';
  return k.replace(/^[a-z]/, c => c.toUpperCase());
};

const SectionCard: React.FC<{
  title: React.ReactNode;
  right?: React.ReactNode;
  children?: React.ReactNode;
}> = ({ title, right, children }) => {
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

const LabeledRow: React.FC<{
  icon?: any;
  label: string;
  value?: React.ReactNode;
  copyable?: boolean;
}> = ({ icon, label, value, copyable }) => {
  const isPrimitive = typeof value === "string" || typeof value === "number";
  const copyText =
    typeof value === "string"
      ? value
      : typeof value === "number"
      ? String(value)
      : "";
  const { onCopy } = useClipboard(copyText);
  const sub = useColorModeValue("gray.600", "gray.300");
  return (
    <HStack align="flex-start" spacing={3}>
      {icon ? <Icon as={icon} boxSize={4} mt={1} opacity={0.9} /> : null}
      <VStack align="start" spacing={0} flex={1}>
        <Text
          fontSize="xs"
          textTransform="uppercase"
          letterSpacing={0.4}
          color={sub}
        >
          {label}
        </Text>
        <HStack align="start">
          {isPrimitive ? (
            <Text as="span" fontWeight="semibold">
              {(value as any) ?? "—"}
            </Text>
          ) : (
            <Box as="span" fontWeight="semibold">
              {value ?? "—"}
            </Box>
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
  <Tag
    size="sm"
    rounded="full"
    px={3}
    py={1}
    bg={priority?.color ?? "pink.400"}
    color={contrastText(priority?.color)}
  >
    <TagLabel>{priority?.name ?? "No priority"}</TagLabel>
  </Tag>
);

const ColorSwatch: React.FC<{ color?: string }> = ({ color }) => (
  <Box
    w={3}
    h={3}
    rounded="full"
    border="1px solid"
    borderColor="blackAlpha.300"
    bg={color ?? "transparent"}
  />
);

// -----------------------------
// Componente principal
// -----------------------------
export type PremiumAppointmentModalProps = {
  id: string;
  isOpen: boolean;
  onClose: () => void;
};

const PremiumAppointmentModal: React.FC<PremiumAppointmentModalProps> = ({
  id,
  isOpen,
  onClose,
}) => {
  const headerBg = useColorModeValue(
    "linear-gradient(135deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0) 100%), linear-gradient(90deg, #7C3AED 0%, #06B6D4 100%)",
    "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 100%), linear-gradient(90deg, #7C3AED 0%, #06B6D4 100%)"
  );
  const sub = useColorModeValue("blackAlpha.700", "whiteAlpha.700");
  const border = useColorModeValue("blackAlpha.200", "whiteAlpha.300");

  // Estado modal Provider (lazy)
  const {
    isOpen: isProviderOpen,
    onOpen: onProviderOpen,
    onClose: onProviderClose,
  } = useDisclosure();
  const [selectedProvider, setSelectedProvider] = React.useState<Provider | null>(
    null
  );

  // 👇 Modal index (solo gestión open/close)
  const { modalIndex, topModalIndex } = useModalIndex(isOpen, { id: "premium-appointment-modal" });
  const isTopOpen = isOpen && modalIndex === topModalIndex;

  // --- Fetch con populate actualizado a tus refs ---
  const populateFields = [
    { path: "priority", select: "id description notes durationHours name color org_id" },
    { path: "treatment", select: "_id name duration icon minIcon color category active" },
    { path: "providers" },
    { path: "selectedDates.days.timeBlocks", select: "_id org_id blockNumber label short from to" },
    { path: "user", select: "auth0_id name email" },
  ] as const;

  const limit = 25;
  const safeQuery = React.useMemo(
    () => (id && id.trim() ? { _id: id } : { _id: { $exists: false } }),
    [id]
  );

  const safeQuery2 = React.useMemo(
    () => (id && id.trim() ? { appointment: id } : { appointment: { $exists: false } }),
    [id]
  );

  const { data, isLoading } = useGetCollection<Appointment>(
    "Appointment",
    { mongoQuery: safeQuery, limit, populate: populateFields }
  );

  // 👉 Contact logs population: bring only minimal slot fields to reduce payload.
  // NOTE: Mongoose populate 'select' can't deep-filter array elements; we still project only needed keys.
  // For tighter backend filtering (single selectedAppDate), we'd need a custom endpoint or aggregation ($filter).
  const populateFieldsContacted = [
    { path: "user", select: "auth0_id name email" },
    { path: "appointment", select: "selectedAppDates._id selectedAppDates.startDate selectedAppDates.endDate selectedAppDates.proposed selectedAppDates.confirmation" },
    // selectedAppDate es un ObjectId a subdocumento embebido: no se puede hacer populate directo
  ] as const;

  const { data: contacted } = useGetCollection<ContactAppointment>(
    "ContactAppointment",
    { mongoQuery: safeQuery2, limit, populate: populateFieldsContacted }
  );

  console.log("contacted", contacted)
  // Enriquecemos cada log con el objeto del slot relacionado y recortamos la lista poblada a solo ese slot
  const contactedSlim = React.useMemo<ContactAppointmentSlim[]>(() => {
    if (!contacted) return [];
    return (contacted as ContactAppointmentSlim[]).map((log) => {
      const rawSel = log?.selectedAppDate as string | AppointmentSlot | undefined;
      const selId = typeof rawSel === 'string' ? rawSel : (rawSel as AppointmentSlot | undefined)?. _id ? String((rawSel as AppointmentSlot)._id) : "";
      const populatedApp = log?.appointment as { selectedAppDates?: AppointmentSlot[] } | undefined;
      const list: AppointmentSlot[] = Array.isArray(populatedApp?.selectedAppDates)
        ? populatedApp!.selectedAppDates!
        : [];

      let matched: AppointmentSlot | null = null;
      if (selId) {
        matched = list.find((s) => String(s?._id) === selId) || null;
      }
      if (!matched && log?.askMessageSid) {
        const askSid = String(log.askMessageSid);
        matched = list.find((s) => String(s?.confirmation?.askMessageSid || "") === askSid) || null;
      }
      if (!matched && log?.startDate && log?.endDate) {
        const st = new Date(log.startDate).getTime();
        const et = new Date(log.endDate).getTime();
        if (!Number.isNaN(st) && !Number.isNaN(et)) {
          matched = list.find((s) => {
            const t1 = s?.startDate ? new Date(s.startDate).getTime() : NaN;
            const t2 = s?.endDate ? new Date(s.endDate).getTime() : NaN;
            const p1 = s?.proposed?.startDate ? new Date(s.proposed.startDate).getTime() : NaN;
            const p2 = s?.proposed?.endDate ? new Date(s.proposed.endDate).getTime() : NaN;
            return (t1 === st && t2 === et) || (p1 === st && p2 === et);
          }) || null;
        }
      }

      const slim: ContactAppointmentSlim = { ...log };
      if (matched) {
        // Poblar el propio campo selectedAppDate con el objeto completo
        slim.selectedAppDate = matched;
        if (populatedApp) {
          slim.appointment = { ...populatedApp, selectedAppDates: [matched] };
        }
      }
      return slim;
    });
  }, [contacted]);
  console.log("contactedSlim", contactedSlim);
  const appointment = data?.[0] ?? null;
  const fullName =
    `${appointment?.nameInput ?? ""} ${appointment?.lastNameInput ?? ""}`.trim() ||
    "Unnamed";

  // 🔄 Live refresh: ensure modal always shows the freshest appointment after server-side updates
  const queryClient = useQueryClient();
  const { socket, connected } = useSocket();

  React.useEffect(() => {
    if (!socket || !connected || !id) return;
    // When a confirmation resolves, refetch this specific appointment + general lists
    const handleConfirm = (evt: any) => {
      // evt.conversationId matches appointment.sid (conversation) or we fallback to always refetch
      if (!appointment || evt?.conversationId === appointment.sid) {
        queryClient.invalidateQueries({ queryKey: ["Appointment"] });
        queryClient.refetchQueries({ queryKey: ["Appointment"] });
        queryClient.invalidateQueries({ queryKey: ["DraggableCards"] });
        queryClient.refetchQueries({ queryKey: ["DraggableCards"] });
      }
    };
    socket.on("confirmationResolved", handleConfirm);
    return () => {
      socket.off("confirmationResolved", handleConfirm);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, connected, id, appointment?.sid]);

  // Handler de click en provider
  const openProvider = (p: Provider) => {
    setSelectedProvider(p);
    onProviderOpen(); // ← abre ProviderSummary
    // 🔒 Al abrir Provider, ocultamos este modal (sin desmontar el componente)
    //     pasando isOpen={false} al Modal de Appointment (ver más abajo).
  };

  return (
    <>
      {/* 🔑 Importante: cuando isProviderOpen === true, este Modal se "cierra" */}
      <Modal isOpen={isTopOpen && !isProviderOpen} onClose={onClose} size="6xl">
        <ModalOverlay backdropFilter="blur(6px)" />
        <ModalContent
          overflow="hidden"
          border="1px solid"
          borderColor={border}
          rounded="2xl"
        >
          {/* Header */}
          <Box
            bg={headerBg}
            color="white"
            px={6}
            py={6}
            borderLeftWidth={6}
            borderLeftStyle="solid"
            borderLeftColor={appointment?.color ?? "transparent"}
          >
            <HStack spacing={4} align="center" justify="space-between">
              <HStack spacing={4} align="center">
                <Avatar 
                  name={appointment?.nameInput?.[0] || fullName} 
                  {...enrichAvatarColor(appointment?.color)} 
                  size="lg"
                  boxShadow="0 2px 8px rgba(0,0,0,0.15)"
                />
                <VStack align="start" spacing={0} flex={1}>
                  <HStack wrap="wrap" spacing={3} align="center">
                    <Text fontSize="xl" fontWeight="extrabold">
                      {fullName}
                    </Text>
                    <PriorityTag priority={appointment?.priority ?? null} />
                    {appointment?.unknown ? (
                      <Badge colorScheme="orange" rounded="full">
                        Unknown
                      </Badge>
                    ) : null}
                  </HStack>
                </VStack>
              </HStack>
              {/* 🔗 Acceso rápido al chat desde el header */}
              {appointment && (
                <ChatLauncher
                  item={appointment}
                  tooltip="Open chat"
                  buildContact={(i: Appointment) => ({
                    conversationId: i.sid ?? i._id,
                    lastMessage: {
                      author: i.nameInput || "",
                      body: "",
                      conversationId: i.sid ?? i._id,
                      createdAt: new Date().toISOString(),
                      direction: "outbound",
                      media: [],
                      sid: "temp-lastmessage",
                      status: "delivered",
                      updatedAt: new Date().toISOString(),
                    },
                    owner: {
                      email: i.emailInput,
                      lastName: i.lastNameInput,
                      name: i.nameInput,
                      org_id: i.org_id,
                      phone: i.phoneInput,
                      unknown: !!i.unknown,
                      _id: i._id,
                    },
                  })}
                  modalInitial={{ appId: appointment._id }}
                  trigger={
                    <Button
                      size="sm"
                      leftIcon={<FaCommentSms />}
                      variant="outline"
                      colorScheme="teal"
                    >
                      Open chat
                    </Button>
                  }
                />
              )}
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
                  <SectionCard
                    title={
                      <HStack>
                        <Icon as={FiInfo} />
                        <Text>Treatment</Text>
                      </HStack>
                    }
                    right={
                      appointment?.treatment?.active === false ? (
                        <Badge colorScheme="orange" rounded="full">
                          Inactive
                        </Badge>
                      ) : (
                        <Badge colorScheme="green" rounded="full">
                          Active
                        </Badge>
                      )
                    }
                  >
                    <Grid
                      templateColumns={{ base: "1fr", sm: "1fr 1fr" }}
                      gap={4}
                    >
                      <LabeledRow label="Name" value={appointment?.treatment?.name} />
                      <LabeledRow
                        label="Duration"
                        value={
                          appointment?.treatment?.duration
                            ? `${appointment?.treatment?.duration} min`
                            : "—"
                        }
                      />
                      <LabeledRow
                        label="Category"
                        value={appointment?.treatment?.category}
                      />

                      {/* ——— Provider como links (abre ProviderSummaryModal lazy) ——— */}
                      <LabeledRow
                        label="Provider"
                        value={
                          appointment?.providers && appointment.providers.length ? (
                            <Wrap>
                              {appointment.providers.map((p: Provider) => {
                                const name = `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || "Provider";
                                return (
                                  <WrapItem key={String((p as any)._id ?? name)}>
                                    <Button
                                      variant="link"
                                      size="sm"
                                      colorScheme="teal"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openProvider(p);
                                      }}
                                    >
                                      {name}
                                    </Button>
                                  </WrapItem>
                                );
                              })}
                            </Wrap>
                          ) : (
                            "—"
                          )
                        }
                      />

                      <HStack>
                        <LabeledRow label="Color" value={appointment?.treatment?.color} />
                        <ColorSwatch color={appointment?.treatment?.color} />
                      </HStack>
                    </Grid>
                  </SectionCard>

                  <SectionCard
                    title={
                      <HStack>
                        <Icon as={FiInfo} />
                        <Text>Notes</Text>
                      </HStack>
                    }
                  >
                    <VStack align="stretch" spacing={3}>
                      <Box
                        bg={useColorModeValue("blackAlpha.50", "whiteAlpha.100")}
                        p={3}
                        rounded="lg"
                      >
                        <Text fontSize="xs" color={sub} mb={1}>
                          Note
                        </Text>
                        <Text>{appointment?.note || "—"}</Text>
                      </Box>
                    </VStack>
                  </SectionCard>

                  <SectionCard
                    title={
                      <HStack>
                        <Icon as={FiInfo} />
                        <Text>Contact History</Text>
                      </HStack>
                    }
                    right={(() => {
                      console.log("contacted",contacted)
                      const list = (contactedSlim ?? []) as any[];
                      const total = list.length;
                      const confirmed = list.filter((l) => statusKey((l as any).status) === "confirmed").length;
                      const declined = list.filter((l) => {
                        const sk = statusKey((l as any).status);
                        return sk === "rejected" || sk === "declined";
                      }).length;
                      const pending = list.filter((l) => statusKey((l as any).status) === "pending").length;
                      return (
                        <HStack spacing={2}>
                          <Badge rounded="full" colorScheme="blue">{total} attempts</Badge>
                          <Badge rounded="full" colorScheme="green">{confirmed} confirmed</Badge>
                          <Badge rounded="full" colorScheme="red">{declined} declined</Badge>
                          <Badge rounded="full" colorScheme="purple">{pending} pending</Badge>
                        </HStack>
                      );
                    })()}
                  >
                    {contactedSlim?.length === 0 ? (
                      <Text>—</Text>
                    ) : (
                      <VStack align="stretch" spacing={3}>
                        {contactedSlim?.map((log, idx) => (
                          <HStack
                            key={log._id ?? idx}
                            align="flex-start"
                            border="1px solid"
                            borderColor={border}
                            rounded="lg"
                            p={2}
                            justify="space-between"
                          >
                            <VStack align="start" spacing={1} flex={1}>
                              <HStack spacing={2}>
                                {(() => {
                                  const status = (log as any).status as string | undefined;
                                  const sk = statusKey(status);
                                  const isConfirmed = sk === "confirmed";
                                  const isPending = sk === "pending";
                                  const isRejected = sk === "rejected" || sk === "declined";
                                  const bg = isConfirmed
                                    ? "green.100"
                                    : isPending
                                    ? "purple.100"
                                    : isRejected
                                    ? "red.100"
                                    : "gray.100";
                                  const color = isConfirmed
                                    ? "green.800"
                                    : isPending
                                    ? "purple.800"
                                    : isRejected
                                    ? "red.800"
                                    : "gray.800";
                                  return (
                                    <Badge rounded="xl" px={2} py={1} bg={bg} color={color} fontSize="xs" fontWeight="bold" textTransform="uppercase">
                                        {capStatus(status)}
                                    </Badge>
                                  );
                                })()}
                              </HStack>
                              <HStack spacing={4} align="flex-start" flexWrap="wrap">
                                <LabeledRow
                                  icon={CiUser}
                                  label="User"
                                  value={
                                    ((log as any).user?.name || "")
                                      .trim()
                                      .split(" ")[0] ||
                                    (log as any).user?.email ||
                                    (log as any).user?.auth0_id
                                  }
                                />
                                <LabeledRow
                                  icon={GrContact}
                                  label="Contacted"
                                  value={fmtDateTime((log as any).sentAt || (log as any).createdAt)}
                                />
                                <LabeledRow
                                  icon={FiClock}
                                  label="Responded"
                                  value={
                                    (log as any).status && statusKey((log as any).status) !== "pending"
                                      ? fmtDateTime((log as any).respondedAt || (log as any).updatedAt)
                                      : "—"
                                  }
                                />
                                {(() => {
                                  // Resolver slot usando primero la version poblada dentro del propio log (appointment.selectedAppDates)
                                  const populatedApp = (log as any).appointment as any | undefined;
                                  const localList = Array.isArray(populatedApp?.selectedAppDates) ? populatedApp.selectedAppDates : [];
                                  const globalList = (appointment?.selectedAppDates ?? []) as any[];
                                  const list = localList.length ? localList : globalList;

                                  // selectedAppDate puede venir poblado (objeto) o como id (string)
                                  const rawSel = (log as any).selectedAppDate as string | AppointmentSlot | undefined;
                                  const selId = typeof rawSel === 'string' ? rawSel : '';
                                  let slot: AppointmentSlot | null = null;
                                  let linkSource: string = ""; // debug metadata

                                  // Preferimos el objeto ya poblado dentro de selectedAppDate
                                  if (rawSel && typeof rawSel === 'object') {
                                    slot = rawSel as AppointmentSlot;
                                    linkSource = '';
                                  }
                                  if (selId) {
                                    if (!slot) {
                                      slot = (list as AppointmentSlot[]).find((s: AppointmentSlot) => String(s?._id) === selId) || null;
                                      if (slot) linkSource = "selectedAppDate";
                                    }
                                  }
                                  if (!slot) {
                                    const askSid = (log as any).askMessageSid ? String((log as any).askMessageSid) : "";
                                    if (askSid) {
                                      slot = (list as AppointmentSlot[]).find((sd: AppointmentSlot) => String(sd?.confirmation?.askMessageSid || "") === askSid) || null;
                                      if (slot) linkSource = "askMessageSid";
                                    }
                                  }
                                  if (!slot) {
                                    const s = (log as any).startDate ? new Date((log as any).startDate) : null;
                                    const e = (log as any).endDate ? new Date((log as any).endDate) : null;
                                    const st = s && !isNaN(s.getTime()) ? s.getTime() : NaN;
                                    const et = e && !isNaN(e.getTime()) ? e.getTime() : NaN;
                                    if (!Number.isNaN(st) && !Number.isNaN(et)) {
                                      slot = (list as AppointmentSlot[]).find((sd: AppointmentSlot) => {
                                        const t1 = sd?.startDate ? new Date(sd.startDate as any).getTime() : NaN;
                                        const t2 = sd?.endDate ? new Date(sd.endDate as any).getTime() : NaN;
                                        const p1 = sd?.proposed?.startDate ? new Date(sd.proposed.startDate as any).getTime() : NaN;
                                        const p2 = sd?.proposed?.endDate ? new Date(sd.proposed.endDate as any).getTime() : NaN;
                                        return (t1 === st && t2 === et) || (p1 === st && p2 === et);
                                      }) || null;
                                      if (slot) linkSource = "dates";
                                    }
                                  }

                                  let proposedStr: string | null = null;
                                  let currentStr: string | null = null;

                                  // Proposed priority: use persisted log fields first, then fallback to slot
                                  if ((log as any).proposedStartDate && (log as any).proposedEndDate) {
                                    const logProposedStart = new Date((log as any).proposedStartDate);
                                    const logProposedEnd = new Date((log as any).proposedEndDate);
                                    if (!isNaN(logProposedStart.getTime()) && !isNaN(logProposedEnd.getTime())) {
                                      proposedStr = formatDateWS({ startDate: logProposedStart, endDate: logProposedEnd });
                                    }
                                  } else if (slot?.proposed?.startDate && slot?.proposed?.endDate) {
                                    proposedStr = formatDateWS({
                                      startDate: new Date(slot.proposed.startDate),
                                      endDate: new Date(slot.proposed.endDate)
                                    });
                                  } else if (slot?.proposed && slot?.startDate && slot?.endDate) {
                                    // proposed object exists but missing explicit proposed dates: treat slot dates as proposed
                                    proposedStr = formatDateWS({
                                      startDate: new Date(slot.startDate),
                                      endDate: new Date(slot.endDate)
                                    });
                                  }

                                  // Current always from actual slot top-level
                                  if (slot?.startDate && slot?.endDate) {
                                    currentStr = formatDateWS({
                                      startDate: new Date(slot.startDate),
                                      endDate: new Date(slot.endDate)
                                    });
                                  } else {
                                    const s = (log as any).startDate ? new Date((log as any).startDate) : null;
                                    const e = (log as any).endDate ? new Date((log as any).endDate) : null;
                                    if (s && e && !isNaN(s.getTime()) && !isNaN(e.getTime())) {
                                      currentStr = formatDateWS({ startDate: s as Date, endDate: e as Date });
                                    }
                                  }

                                  return (
                                    <>
                                      <LabeledRow icon={FiClock} label="Proposed" value={proposedStr ?? "—"} />
                                      <LabeledRow icon={FiClock} label="Current" value={currentStr ?? "—"} />
                                      {/* Optional debug badge showing link source (remove in prod) */}
                                      {process.env.NODE_ENV === 'development' && linkSource && (
                                        <Badge colorScheme="blue" rounded="full">{linkSource}</Badge>
                                      )}
                                    </>
                                  );
                                })()}
                              </HStack>
                            </VStack>
                          </HStack>
                        ))}
                      </VStack>
                    )}
                  </SectionCard>
                </VStack>

                {/* Columna derecha */}
                <VStack align="stretch" spacing={5}>
                  <SectionCard
                    title={
                      <HStack>
                        <Icon as={FiCalendar} />
                        <Text>Selected Appointment Dates</Text>
                      </HStack>
                    }
                    right={
                      <Badge
                        colorScheme={appointment?.reschedule ? "orange" : "purple"}
                        rounded="full"
                      >
                        {appointment?.reschedule ? "Reschedule" : "New"}
                      </Badge>
                    }
                  >
                    <VStack align="stretch" spacing={3}>
                      {(appointment?.selectedAppDates ?? []).length === 0 ? (
                        <Text>—</Text>
                      ) : (
                        <>
                          {/* Timeline list: Latest is indicated inline with a blue badge, same style as others */}
                          <Box maxH="320px" overflowY="auto" pr={1}
                            sx={{ "&::-webkit-scrollbar": { width: "6px" }, "&::-webkit-scrollbar-thumb": { backgroundColor: "#a0aec0", borderRadius: "4px" }, "&::-webkit-scrollbar-track": { backgroundColor: "#edf2f7" } }}
                          >
                            <VStack align="stretch" spacing={2}>
                              {(() => {
                                const display = pickDisplaySlot(appointment?.selectedAppDates ?? []);
                                const displayId = display ? String((display as any)?._id ?? "") : "";
                                const oidTime = (val: any): number => {
                                  const hex = String(val ?? '').trim();
                                  // ObjectId: first 8 hex chars are seconds since epoch
                                  if (/^[0-9a-fA-F]{24}$/.test(hex)) {
                                    const secs = parseInt(hex.slice(0, 8), 16);
                                    if (!Number.isNaN(secs)) return secs * 1000;
                                  }
                                  return 0;
                                };

                                // 1) Ordenar SOLO por updatedAt (más reciente primero). Si falta updatedAt, tratamos como 0.
                                const updatedAtTs = (s: any): number => {
                                  if (s?.updatedAt) {
                                    const t = new Date(s.updatedAt).getTime();
                                    return Number.isFinite(t) ? t : 0;
                                  }
                                  return 0;
                                };

                                const sorted = [...(appointment?.selectedAppDates ?? [])]
                                  .sort((a: any, b: any) => updatedAtTs(b) - updatedAtTs(a));

                                // 2) Deduplicar por rango top-level (startDate-endDate) conservando el más reciente
                                const seen = new Set<string>();
                                const deduped = [] as any[];
                                for (const s of sorted) {
                                  const hasTopDates = s?.startDate && s?.endDate;
                                  const key = hasTopDates
                                    ? `${new Date(s.startDate as any).getTime()}|${new Date(s.endDate as any).getTime()}`
                                    : `__unique__${String((s as any)?._id ?? Math.random())}`; // si no hay ambas fechas, no deduplicamos
                                  if (seen.has(key)) continue;
                                  seen.add(key);
                                  deduped.push(s);
                                }

                                // 3) Asegurar orden final: más reciente arriba
                                const finalList = deduped.sort((a: any, b: any) => updatedAtTs(b) - updatedAtTs(a));

                                return finalList
                                .map((it: any, idx: number) => {
                                  const s = getSlotStart(it);
                                  const e = getSlotEnd(it);
                                  // Determinar un status efectivo si falta el campo
                                  const rawStatusOriginal = it?.status;
                                  let effectiveStatus = rawStatusOriginal;
                                  if (!effectiveStatus || !String(effectiveStatus).trim()) {
                                    // Si tiene propuesta y aún no hay confirmación => Pending
                                    if (it?.proposed && !it?.confirmation) {
                                      effectiveStatus = 'Pending';
                                    } else if (it?.confirmation?.status) {
                                      effectiveStatus = it.confirmation.status;
                                    } else {
                                      effectiveStatus = 'Unknown';
                                    }
                                  }
                                  const rawStatus = effectiveStatus ?? 'Unknown';
                                  const sk = statusKey(rawStatus);
                                  const colorSchemeMap: Record<string, string> = {
                                    confirmed: 'green',
                                    declined: 'red',
                                    rejected: 'red',
                                    reschedule: 'orange',
                                    pending: 'purple',
                                    nocontacted: 'gray',
                                    'no contacted': 'gray',
                                    unknown: 'gray',
                                  };
                                  const colorScheme = colorSchemeMap[sk] ?? 'gray';
                                  console.log("it",it)
                                  const isLatest = String(it?._id ?? '') === displayId; // mark display slot as Latest
                                  return (
                                    <Box key={it?._id ?? idx} border="1px solid" borderColor={border} rounded="xl" p={3}>
                                      <HStack justify="space-between" align="center" mb={1}>
                                        <HStack spacing={2}>
                                          <Tooltip  label={`Create at ${fmtDateTime(it?.updatedAt)}`}   ><Badge rounded="full" colorScheme={colorScheme}>{capStatus(rawStatus)}</Badge></Tooltip>
                                          {it?.rescheduleRequested ? (
                                            <Badge colorScheme="orange" rounded="full">Reschedule requested</Badge>
                                          ) : null}
                                          {isLatest ? (
                                            <Badge colorScheme="blue" variant="subtle" rounded="full">Latest</Badge>
                                          ) : null}
                                        </HStack>
                       
                                      </HStack>
                                      <VStack align="stretch" spacing={2}>
                                        <LabeledRow
                                          icon={FiClock}
                                          label="Range"
                                          value={(() => {
                                            const startVal = s ?? it?.startDate ?? it?.propStartDate ?? it?.proposed?.startDate;
                                            const endVal = e ?? it?.endDate ?? it?.propEndDate ?? it?.proposed?.endDate;
                                            if (startVal && endVal) {
                                              try {
                                                return formatDateWS({ startDate: new Date(startVal), endDate: new Date(endVal) });
                                              } catch {
                                                return "—";
                                              }
                                            }
                                            return "—";
                                          })()}
                                        />
                                       
                                      </VStack>
                                      {it?.proposed && (
                                        <Box mt={2}>
                                          <Text fontSize="xs" color={sub}>
                                            {it?.confirmation?.sentAt ? `Sent at: ${fmtDateTime(it?.confirmation?.sentAt)}` : ""}
                                            {it?.proposed?.createdAt ? ` · ${fmtDateTime(it?.proposed.createdAt)}` : ""}
                                          </Text>
                                          {it?.proposed?.reason && (
                                            <Text fontSize="sm">Reason: {it?.proposed.reason}</Text>
                                          )}
                                        </Box>
                                      )}
                                      {it?.confirmation && (
                                        <Box mt={2}>
                                          <Text fontSize="xs" color={sub}>
                                            Decided at: {fmtDateTime(it?.confirmation.decidedAt)}
                                            {it?.confirmation.lateResponse ? " · Late response" : ""}
                                          </Text>
                                         
                                        </Box>
                                      )}
                                    </Box>
                                  );
                                })
                              })()}
                            </VStack>
                          </Box>
                        </>
                      )}
                    </VStack>
                  </SectionCard>

                  <SectionCard
                    title={
                      <HStack>
                        <Icon as={FiCalendar} />
                        <Text>Selected Dates Pattern</Text>
                      </HStack>
                    }
                  >
                    <VStack align="stretch" spacing={3}>
                      <VStack align="stretch" spacing={2}>
                        <LabeledRow
                          label="Range"
                          value={(() => {
                            const s = appointment?.selectedDates?.startDate;
                            const e = appointment?.selectedDates?.endDate;
                            return s && e
                              ? formatDateWS({ startDate: new Date(s as any), endDate: new Date(e as any) })
                              : "—";
                          })()}
                        />
                      </VStack>
                      <VStack align="stretch" spacing={2}>
                        {(appointment?.selectedDates?.days ?? []).map((d, idx) => (
                          <HStack
                            key={idx}
                            justify="space-between"
                            border="1px solid"
                            borderColor={border}
                            rounded="lg"
                            p={2}
                          >
                            <Text fontWeight="semibold" w="150px">
                              {(d as any).weekDay}
                            </Text>
                            <Wrap>
                              {((d as any).timeBlocks ?? []).map((tb: TimeBlock, j: number) => (
                                <WrapItem key={j}>
                                  <Tag
                                    size="sm"
                                    variant="subtle"
                                    colorScheme="purple"
                                    rounded="full"
                                  >
                                    <TagLabel>{`${tb.short || tb.label}: ${to12Hour(
                                      tb.from
                                    )} — ${to12Hour(tb.to)}`}</TagLabel>
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
                <Button variant="ghost" onClick={onClose}>
                  Close
                </Button>
              </HStack>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* — Modal del Provider en lazy load — */}
      {selectedProvider && (
        <Suspense
          fallback={
            <Modal isOpen={isProviderOpen} onClose={() => {}} isCentered>
              <ModalOverlay />
              <ModalContent>
                <ModalBody p={6}>
                  <VStack align="stretch" spacing={3}>
                    <Skeleton h="24px" />
                    <Skeleton h="18px" />
                    <Skeleton h="240px" />
                  </VStack>
                </ModalBody>
              </ModalContent>
            </Modal>
          }
        >
          <ProviderSummaryModalLazy
            isOpen={isProviderOpen}
            onClose={() => {
              onProviderClose();
              setSelectedProvider(null);
              // 👇 Si quieres que al cerrar Provider se reabra el Appointment,
              //     no toques nada: al quedar isProviderOpen=false, este modal vuelve a abrirse
              //     automáticamente por la condición (isTopOpen && !isProviderOpen).
            }}
            provider={selectedProvider}
          />
        </Suspense>
      )}
    </>
  );
};

export default PremiumAppointmentModal;
