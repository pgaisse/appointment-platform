import { useLocation } from "react-router-dom";
// apps/frontend/src/Components/DraggableCards/DraggableColumns.tsx

import { formatDateWS } from '@/Functions/FormatDateWS';
import { formatAusPhoneNumber } from '@/Functions/formatAusPhoneNumber';
import { PhoneIcon, TimeIcon, RepeatIcon, CheckIcon } from '@chakra-ui/icons';
import { capitalize } from '@/utils/textFormat';
import {
  Badge,
  Box,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Divider,
  Grid,
  GridItem,
  Heading,
  HStack,
  Icon,
  IconButton,
  Button,
  Skeleton,
  SkeletonCircle,
  SkeletonText,
  Spinner,
  Stack,
  Tag,
  TagLabel,
  Text,
  Tooltip,
  Fade,
  useToast,
  useDisclosure,
} from '@chakra-ui/react';
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  defaultDropAnimationSideEffects,
  type DropAnimation,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ModalStackProvider } from '@/Components/ModalStack/ModalStackContext';
import type { Appointment, GroupedAppointment } from '@/types';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '@/Hooks/Query/useSocket';
import { getIconComponent } from '../CustomIcons';
import Pagination from '../Pagination';
import AddPatientButton from '../DraggableCards/AddPatientButton';
import SearchBar, { SearchBarRef } from '../searchBar';
import PendingDeclinedSearchBar, { PendingDeclinedSearchBarRef } from '../searchBar/PendingDeclinedSearchBar';
import ArchiveItemButton from './ArchiveItemButton';
import UnarchiveItemButton from './UnarchiveItemButton';
import DeleteContactButton from './DeleteContactButton';
import { LiaSmsSolid } from 'react-icons/lia';
import { useMovePriorityItems, type PriorityMove } from '@/Hooks/Query/useMovePriorityItems';
import ChatLauncher from '@/Components/Chat/ChatLauncher';
import { FaCommentSms } from 'react-icons/fa6';
import { CiPhone } from 'react-icons/ci';
import { RiParentFill } from 'react-icons/ri';
import { getDisplaySlotRange, pickDisplaySlot } from "@/Functions/getLatestSelectedAppDate";
import { getTreatment, getPriorityColor } from '@/Functions/extractSlotData';
import { useCompleteAppointmentSlot } from '@/Hooks/Query/useCompleteAppointmentSlot';
import { GoogleReviewButton } from '@/Components/GoogleReview/GoogleReviewButton';
import { DateTime } from 'luxon';

/* ───────────────────────────────────────────────────────────────
   Helpers de estilo premium
   ─────────────────────────────────────────────────────────────── */

const statusColor = (s?: string) => {
  const normalized = s?.toLowerCase();
  return normalized === 'confirmed' ? 'green'
    : normalized === 'rejected' ? 'red'
      : normalized === 'declined' ? 'red'
        : normalized === 'pending' ? 'yellow'
          : normalized === 'complete' ? 'blue'
            : 'gray';
};

const StatusPill: React.FC<{ status?: string }> = ({ status }) => {
  const c = statusColor(status);
  const normalized = status?.toLowerCase();
  const label =
    normalized === 'confirmed' ? 'Confirmed'
      : normalized === 'rejected' ? 'Rejected'
        : normalized === 'declined' ? 'Declined'
          : normalized === 'pending' ? 'Pending'
            : normalized === 'complete' ? 'Complete'
              : 'No Contacted';
  return (
    <Tooltip label={`Status: ${label}`} placement="top" hasArrow>
      <Tag size="sm" variant="subtle" colorScheme={c}>
        <TagLabel>{label}</TagLabel>
      </Tag>
    </Tooltip>
  );
};

const PrefBadge: React.FC<{ pref?: 'sms' | 'call' | string | null | undefined }> = ({ pref }) => {
  if (!pref) return null;
  if (pref === 'sms') {
    return (
      <Tooltip label="Prefers SMS" placement="top" hasArrow>
        <Badge
          colorScheme="yellow"
          variant="subtle"
          display="inline-flex"
          alignItems="center"
          gap={1}
          px={2}
          py={1}
          borderRadius="lg"
        >
          <Icon as={LiaSmsSolid} /> SMS
        </Badge>
      </Tooltip>
    );
  }
  if (pref === 'call') {
    return (
      <Tooltip label="Prefers calls" placement="top" hasArrow>
        <Badge
          colorScheme="green"
          variant="subtle"
          display="inline-flex"
          alignItems="center"
          gap={1}
          px={2}
          py={1}
          borderRadius="lg"
        >
          <Icon as={CiPhone} /> Call
        </Badge>
      </Tooltip>
    );
  }
  return null;
};

/* ───────────────────────────────────────────────────────────────
   Tipos y builder de contacto (paciente vs representante)
   ─────────────────────────────────────────────────────────────── */

type RepAppointmentLite = {
  _id: string;
  nameInput?: string;
  lastNameInput?: string;
  phoneInput?: string;
  phoneE164?: string;
  emailLower?: string;
  sid?: string | null;
  proxyAddress?: string | null;
};

type AppointmentForChat = Appointment & {
  representative?: {
    appointment?: string | RepAppointmentLite;
    relationship?: string;
    verified?: boolean;
  };
};

function buildContactFromAppointment(i: AppointmentForChat) {
  const rep =
    i.representative &&
    i.representative.appointment &&
    typeof i.representative.appointment === 'object'
      ? (i.representative.appointment as RepAppointmentLite)
      : null;

  // If there is a representative, ALWAYS derive chat to the representative
  if (rep) {
    const conversationId = rep.sid || '';
    const phone = rep.phoneInput || rep.phoneE164 || '';
    const email = rep.emailLower || '';
    const author = `${rep.nameInput || ''}`.trim();
    return {
      conversationId,
      lastMessage: {
        author,
        body: '',
        conversationId,
        createdAt: new Date().toISOString(),
        direction: 'outbound' as const,
        media: [],
        sid: 'temp-lastmessage',
        status: 'delivered' as const,
        updatedAt: new Date().toISOString(),
      },
      owner: {
        email,
        lastName: rep.lastNameInput || '',
        name: rep.nameInput || '',
        org_id: i.org_id || '',
        phone,
        color: (i as any).color || undefined,
        unknown: false,
        _id: rep._id,
        represented: true,
      },
    };
  }

  // Otherwise, fall back to the patient's own chat
  const conversationId = i.sid || '';
  const author = (i.nameInput || '').trim();
  return {
    conversationId,
    lastMessage: {
      author,
      body: '',
      conversationId,
      createdAt: new Date().toISOString(),
      direction: 'outbound' as const,
      media: [],
      sid: 'temp-lastmessage',
      status: 'delivered' as const,
      updatedAt: new Date().toISOString(),
    },
    owner: {
      email: i.emailInput || '',
      lastName: i.lastNameInput || '',
      name: i.nameInput || '',
      org_id: i.org_id || '',
      phone: i.phoneInput || '',
      color: (i as any).color || undefined,
      unknown: false,
      _id: i._id,
      represented: false,
    },
  };
}

/* ───────────────────────────────────────────────────────────────
   Tarjeta reutilizable: MISMA UI para item y para DragOverlay
   ─────────────────────────────────────────────────────────────── */
const cap = capitalize;

// Prefer the slot with status "Pending" when present
const pickPendingSlot = (slots?: any[]) => {
  if (!Array.isArray(slots)) return undefined;
  return slots.find((s) => String((s as any)?.status || '').toLowerCase() === 'pending');
};
const getPendingSlotRange = (slots?: any[]) => {
  const s = pickPendingSlot(slots);
  return s ? { start: (s as any).startDate, end: (s as any).endDate } : null;
};
const AppointmentCard: React.FC<{
  item: Appointment;
  priorityColor?: string;
  onCardClick?: (item: Appointment) => void;
  asOverlay?: boolean;       // cuando es overlay: sin eventos, pero misma apariencia
  statusOverride?: string;   // permite forzar el status mostrado (p.ej., columnas Pending/Declined)
  inlineUndo?: boolean;      // muestra botón de deshacer dentro de la card movida
  onUndo?: () => void;       // callback para deshacer
}> = ({ item, priorityColor = 'gray', onCardClick, asOverlay, statusOverride, inlineUndo, onUndo }) => {
  const hasRep = Boolean((item as any).representative?.appointment);
  const rep = hasRep && typeof (item as any).representative.appointment === 'object'
    ? (item as any).representative.appointment as RepAppointmentLite
    : null;
  const { isOpen: isRepOpen, onOpen: onRepOpen, onClose: onRepClose } = useDisclosure();
  const { isOpen: isSelfOpen, onOpen: onSelfOpen, onClose: onSelfClose } = useDisclosure();
  
  // ✅ Hook para completar slot
  const { mutate: completeSlot, isPending: isCompleting } = useCompleteAppointmentSlot();

  // ✅ Extraer datos del slot relevante usando helpers
  const treatment = getTreatment(item);
  const effectivePriorityColor = priorityColor || getPriorityColor(item, 'gray');
  
  // ✅ Obtener slot actual (el primero en selectedAppDates)
  const currentSlot = item.selectedAppDates?.[0];
  const slotStatus = statusOverride ?? currentSlot?.status;
  const slotId = currentSlot?._id;
  
  // ✅ Verificar si la fecha del appointment ya pasó
  const appointmentDate = currentSlot?.startDate ? DateTime.fromISO(currentSlot.startDate as any) : null;
  const now = DateTime.now();
  const isPastAppointment = appointmentDate ? appointmentDate < now : false;
  
  // ✅ Mostrar botón de completar solo si:
  // - La fecha ya pasó
  // - El status no es "Complete"
  // - No estamos en overlay mode
  const normalizedStatus = slotStatus?.toLowerCase();
  const showCompleteButton = !asOverlay && isPastAppointment && normalizedStatus !== 'complete';
  
  // ✅ Mostrar botón de review SIEMPRE si el status es "Complete" (sin importar la fecha)
  const showReviewButton = !asOverlay && normalizedStatus === 'complete';

  const handleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!slotId) return;
    
    completeSlot({
      appointmentId: String(item._id),
      slotId: String(slotId),
    });
  };

  return (
    <Box
      position="relative"
      userSelect="none"
      sx={{
        WebkitUserSelect: 'none',  // Safari/iOS
        msUserSelect: 'none',      // IE/Edge viejo
        WebkitTouchCallout: 'none' // evita menú de selección en iOS
      }}
      p={4}
      my={2}
      borderRadius="2xl"
      border="1px solid"
      borderColor="gray.100"
      borderLeftWidth="4px"
      borderLeftColor={`${effectivePriorityColor}.300`}
      bg="white"
      boxShadow="xs"
      minW="260px"
      maxW="100%"
      w="100%"
      onClick={(e: React.MouseEvent) => {
        if (asOverlay) return;
        e.stopPropagation();
        if (onCardClick) {
          onCardClick(item);
        } else {
          onSelfOpen();
        }
      }}
      // para overlay: impedir interacción pero mantener el look
      pointerEvents={asOverlay ? 'none' : 'auto'}
    >
      {!asOverlay && (
        <Box
          position="absolute"
          bottom="0"
          right="2"
          zIndex={3}
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
          onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
        >
          <HStack spacing={2} align="center">
            {inlineUndo && (
              <Fade in>
                <Tooltip label="Undo" placement="top" hasArrow>
                  <IconButton
                    aria-label="Undo move"
                    icon={<RepeatIcon />}
                    size="sm"
                    colorScheme="blue"
                    variant="ghost"
                    onClick={() => onUndo?.()}
                  />
                </Tooltip>
              </Fade>
            )}
            <ArchiveItemButton id={item._id} modelName="Appointment" />
          </HStack>
        </Box>
      )}

      {/* Cabecera: Fecha + Estado + Preferencia */}
      <HStack justify="space-between" align="center" mb={2}>
        <HStack color="gray.600">
          {/* ✅ Usar treatment extraído del slot */}
          {treatment ? (
            <Tooltip label={treatment.name} placement="top" fontSize="sm" hasArrow>
              {(() => {
                const key = treatment.minIcon;
                const Comp = getIconComponent(key) || getIconComponent('md:MdHealthAndSafety');
                if (!Comp && process.env.NODE_ENV !== 'production') {
                  // eslint-disable-next-line no-console
                  console.warn('[icons] DraggableCards unresolved key:', key, 'for', treatment.name);
                }
                return (
                  <Icon as={Comp} color={treatment.color} fontSize="22px" />
                );
              })()}
            </Tooltip>
          ) : (
            <Tooltip label="No treatment assigned" placement="top" fontSize="sm" hasArrow>
              <Icon as={getIconComponent('md:MdHealthAndSafety')} color="gray.400" fontSize="22px" />
            </Tooltip>
          )}
        </HStack>

        <HStack gap={2}>
          <Tooltip label={`Appointment Date: ${(() => { 
            // Prefer the PENDING slot's date if available; otherwise use the current display logic
            const rPending = getPendingSlotRange(item.selectedAppDates);
            const r = rPending ?? getDisplaySlotRange(item.selectedAppDates);
            return (r ? formatDateWS({ startDate: r.start, endDate: r.end }) : '—');
          })()}`} placement="top" hasArrow>
            <Icon as={TimeIcon} />
          </Tooltip>
          <StatusPill status={statusOverride ?? pickDisplaySlot(item.selectedAppDates)?.status} />
          <PrefBadge pref={item.contactPreference as any} />
          {!asOverlay && showReviewButton && (
            <GoogleReviewButton
              appointmentId={String(item._id)}
              variant="icon"
              size="sm"
            />
          )}
          {!asOverlay && (
            <ChatLauncher
              item={item}
              tooltip="Open chat"
              stopPropagation
              buildContact={buildContactFromAppointment}
              trigger={
                <IconButton
                  aria-label="Open chat"
                  icon={<FaCommentSms size={18} color="var(--chakra-colors-green-500)" />}
                  size="sm"
                  variant="ghost"
                  _hover={{ bg: 'green.50' }}
                />
              }
            />
          )}
        </HStack>
      </HStack>

      {/* Nombre + Tratamiento + Chat */}
      <HStack align="center" justify="space-between" mb={2}>
        <HStack gap={2} minW={0}>
          <Text fontWeight="semibold" noOfLines={1}>
            {cap(item.nameInput)} {cap(item.lastNameInput)}
          </Text>
        </HStack>
      </HStack>
      
      <Divider my={2} />

      {/* ✅ Botón de acción: Complete */}
      {showCompleteButton && (
        <Box mb={3}>
          <Tooltip label="Mark as completed" placement="top" hasArrow>
            <Button
              size="sm"
              colorScheme="green"
              variant="outline"
              leftIcon={<CheckIcon />}
              onClick={handleComplete}
              isLoading={isCompleting}
              loadingText="Completing..."
              width="full"
            >
              Complete
            </Button>
          </Tooltip>
        </Box>
      )}

      {/* Teléfono (paciente o representante) */}
      <HStack color="gray.600" spacing={3}>
        <Icon as={PhoneIcon} color="green.500" />
        {hasRep && rep ? (
          <HStack spacing={2} wrap="wrap">
            <Tooltip
              label={`Represented by ${rep.nameInput ?? ''} ${rep.lastNameInput ?? ''} (${(item as any).representative.relationship})`}
              fontSize="sm"
              hasArrow
              placement="top"
            >
              <Box
                as="button"
                onClick={(e: React.MouseEvent) => { e.stopPropagation(); onRepOpen(); }}
                aria-label="Open representative"
              >
                <Box as={RiParentFill} color="purple.500" />
              </Box>
            </Tooltip>
            <Text fontWeight="medium">
              {formatAusPhoneNumber(rep.phoneInput || '')}
            </Text>
          </HStack>
        ) : (
          <Text fontWeight="medium">{formatAusPhoneNumber(item.phoneInput || '')}</Text>
        )}
      </HStack>

      {/* Nested patient modal (fallback when no onCardClick is provided) */}
      {!onCardClick && (
        <React.Suspense fallback={null}>
          {(() => {
            const AppointmentModalLazy = React.lazy(() => import('@/Components/Modal/AppointmentModal'));
            return (
              <ModalStackProvider>
                <AppointmentModalLazy
                  id={String(item._id || '')}
                  isOpen={isSelfOpen}
                  onClose={onSelfClose}
                />
              </ModalStackProvider>
            );
          })()}
        </React.Suspense>
      )}

      {/* Nested tutor modal */}
      {rep && (
        <React.Suspense fallback={null}>
          {(() => {
            const AppointmentModalLazy = React.lazy(() => import('@/Components/Modal/AppointmentModal'));
            return (
              <ModalStackProvider>
                <AppointmentModalLazy
                  id={String((rep as any)._id || '')}
                  isOpen={isRepOpen}
                  onClose={onRepClose}
                />
              </ModalStackProvider>
            );
          })()}
        </React.Suspense>
      )}
    </Box>
  );
};

/* ───────────────────────────────────────────────────────────────
   Loader skeletons
   ─────────────────────────────────────────────────────────────── */

const LoadingColumn: React.FC<{ color?: string }> = ({ color = 'gray' }) => (
  <Card
    minW="280px"
    flex="0 0 auto"
    minHeight="300px"
    maxHeight="600px"
    borderRadius="2xl"
    position="relative"
    mr={4}
    bg="white"
    boxShadow="sm"
    border="1px solid"
    borderColor="gray.200"
    _before={{
      content: '""',
      position: 'absolute',
      inset: 0,
      borderRadius: '2xl',
      p: '1px',
      bgGradient: `linear(to-br, ${color}.300, transparent)`,
      WebkitMask:
        'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
      WebkitMaskComposite: 'xor',
      pointerEvents: 'none',
    }}
  >
    <CardHeader pb={0}>
      <Heading size="sm" mb={3} bg={`${color}.50`} p={3} borderRadius="lg" width="fit-content">
        <Skeleton height="16px" width="140px" />
      </Heading>
    </CardHeader>
    <CardBody p={3}>
      <Stack spacing={3}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Box key={i} p={4} borderRadius="xl" border="1px" borderColor="gray.100" boxShadow="xs" bg="white">
            <HStack mb={2}>
              <SkeletonCircle size="4" />
              <Skeleton height="14px" width="40%" />
            </HStack>
            <Skeleton height="18px" mb={2} />
            <Skeleton height="14px" />
          </Box>
        ))}
      </Stack>
    </CardBody>
    <CardFooter minH="50px" maxH="50px">
      <HStack w="full" justify="center">
        <Skeleton height="32px" width="80px" />
        <Skeleton height="32px" width="80px" />
        <Skeleton height="32px" width="80px" />
      </HStack>
    </CardFooter>
  </Card>
);

const LoadingContactsPanel: React.FC = () => (
  <Card
    minW="280px"
    flex="0 0 auto"
    minHeight="300px"
    maxHeight="600px"
    borderRadius="2xl"
    position="relative"
    mr={4}
    bg="white"
    boxShadow="sm"
    border="1px solid"
    borderColor="gray.200"
  >
    <CardHeader pb={0}>
      <Heading size="sm" mb={3} bg="red.50" p={3} borderRadius="lg" width="fit-content">
        <Skeleton height="16px" width="100px" />
      </Heading>
    </CardHeader>
    <CardBody p={3}>
      <Skeleton height="38px" borderRadius="md" mb={3} />
      <Stack spacing={3}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Box key={i} p={4} borderRadius="xl" border="1px" borderColor="gray.100" boxShadow="xs" bg="white">
            <HStack spacing={3} mb={2}>
              <SkeletonCircle size="6" />
              <Skeleton height="18px" width="60%" />
            </HStack>
            <SkeletonText noOfLines={2} spacing="2" />
          </Box>
        ))}
      </Stack>
    </CardBody>
    <CardFooter minH="50px" maxH="50px">
      <HStack w="full" justify="center">
        <Skeleton height="32px" width="80px" />
        <Skeleton height="32px" width="80px" />
        <Skeleton height="32px" width="80px" />
      </HStack>
    </CardFooter>
  </Card>
);

/* ───────────────────────────────────────────────────────────────
   Sortable wrapper (no toca UI interna de la card)
   ─────────────────────────────────────────────────────────────── */

function SortableItem({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition,
    zIndex: isDragging ? 999 : 'auto',
    position: isDragging ? 'relative' : 'static',
    opacity: isDragging ? 0 : 1, // la card original desaparece mientras el overlay la clona
  };

  return (
    <Box ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </Box>
  );
}

/* ───────────────────────────────────────────────────────────────
   Util mover item
   ─────────────────────────────────────────────────────────────── */

function moveItem(
  data: GroupedAppointment[],
  itemId: string,
  fromColumnId: string,
  toColumnId: string,
  toIndex: number
): GroupedAppointment[] {
  const newData = [...data];
  const sourceCol = newData.find(col => col._id === fromColumnId);
  const destCol = newData.find(col => col._id === toColumnId);
  if (!sourceCol || !destCol) return data;

  // ✅ itemId ahora es "appointmentId|slotId"
  const [appointmentId, slotId] = itemId.split('|');
  const item = sourceCol.patients.find(p => 
    p._id === appointmentId && p.selectedAppDates?.[0]?._id === slotId
  );
  if (!item) return data;

  if (fromColumnId === toColumnId) {
    // Movimiento dentro de la misma columna
    const newPatients = [...sourceCol.patients];
    const oldIndex = newPatients.findIndex(p => 
      p._id === appointmentId && p.selectedAppDates?.[0]?._id === slotId
    );
    if (oldIndex === -1) return data;

    // Remover el elemento
    const [movedItem] = newPatients.splice(oldIndex, 1);
    
    // Insertar directamente en toIndex
    // Ya no necesitamos ajustar porque toIndex viene corregido desde handleDragEnd
    newPatients.splice(toIndex, 0, movedItem);
    
    // ✅ Actualizar position del SLOT, no del root
    sourceCol.patients = newPatients.map((p, idx) => {
      const updatedPatient = { ...p };
      if (updatedPatient.selectedAppDates?.[0]) {
        updatedPatient.selectedAppDates = [{
          ...updatedPatient.selectedAppDates[0],
          position: idx
        }] as any;
      }
      return updatedPatient;
    });
  } else {
    // Movimiento entre columnas: respetar siempre el índice destino tal cual
    sourceCol.patients = sourceCol.patients.filter(p => 
      !(p._id === appointmentId && p.selectedAppDates?.[0]?._id === slotId)
    );
    const newPatients = [...destCol.patients];
    newPatients.splice(toIndex, 0, item);
    
    // ✅ Actualizar position del SLOT, no del root
    destCol.patients = newPatients.map((p, idx) => {
      const updatedPatient = { ...p };
      if (updatedPatient.selectedAppDates?.[0]) {
        updatedPatient.selectedAppDates = [{
          ...updatedPatient.selectedAppDates[0],
          position: idx
        }] as any;
      }
      return updatedPatient;
    });
  }
  return newData;
}

/* ───────────────────────────────────────────────────────────────
   Componente principal
   ─────────────────────────────────────────────────────────────── */

type Props = {
  onCardClick?: (item: Appointment) => void;
  dataAP2: GroupedAppointment[] | undefined;
  dataContacts: Appointment[];
  isPlaceholderData: boolean;
  dataPending: Appointment[];
  dataDeclined: Appointment[];
  dataArchived: Appointment[];
};

const AfterPaint: React.FC<{ on: () => void }> = ({ on }) => {
  React.useEffect(() => {
    const id = requestAnimationFrame(() => on());
    return () => cancelAnimationFrame(id);
  }, [on]);
  return null;
};

export default function DraggableColumns({ onCardClick, dataAP2, dataContacts, isPlaceholderData, dataPending, dataDeclined, dataArchived }: Props) {
    const location = useLocation();
    const [highlightPending, setHighlightPending] = useState(false);
    const pendingCardRef = useRef<HTMLDivElement | null>(null);
  const toast = useToast();
  const searchRef = useRef<SearchBarRef>(null);
  const pendingSearchRef = useRef<PendingDeclinedSearchBarRef>(null);
  const declinedSearchRef = useRef<PendingDeclinedSearchBarRef>(null);
  const { mutate: moveMutate } = useMovePriorityItems();
  const [activeItem, setActiveItem] = useState<Appointment | null>(null);
  const [overlayColor, setOverlayColor] = useState<string>('gray'); // color de la columna origen
  const [optimisticData, setOptimisticData] = useState<GroupedAppointment[] | null>(null);
  const [sourceCol, setSourceCol] = useState<GroupedAppointment | undefined>();
  const [columnPages, setColumnPages] = useState<Record<string, number>>({});
  const queryClient = useQueryClient();
  const [lastColPainted, setLastColPainted] = useState(false);
  // ───────── Undo stack (multi-level) ─────────
  const historyRef = useRef<GroupedAppointment[][]>([]);
  const MAX_HISTORY = 10;
  const [showUndo, setShowUndo] = useState(false);
  const undoHideTimeoutRef = useRef<number | null>(null);
  const [lastMovedId, setLastMovedId] = useState<string | null>(null);

  const cloneState = (state: GroupedAppointment[] | null) => {
    if (!state) return [] as GroupedAppointment[];
    return state.map(col => ({
      ...col,
      patients: col.patients.map(p => ({ ...p }))
    }));
  };

  const pushHistory = (prev: GroupedAppointment[] | null) => {
    if (!prev) return;
    historyRef.current.unshift(cloneState(prev));
    if (historyRef.current.length > MAX_HISTORY) historyRef.current.pop();
    // make visible immediately
    setShowUndo(true);
    if (undoHideTimeoutRef.current) window.clearTimeout(undoHideTimeoutRef.current);
    // keep undo visible longer (20s) after each move
    undoHideTimeoutRef.current = window.setTimeout(() => setShowUndo(false), 20000);
  };

  const buildMovesFromSnapshot = (snap: GroupedAppointment[]) => {
    const moves: PriorityMove[] = [];
    snap.forEach(col => {
      col.patients.forEach((p, i) => {
        // ✅ Extraer slotId del primer slot
        const slotId = p.selectedAppDates?.[0]?._id;
        moves.push({ 
          id: p._id, 
          position: i, 
          priority: col._id ?? undefined,
          slotId: slotId || undefined
        });
      });
    });
    return moves;
  };

  const handleUndo = () => {
    // Solo deshacer la última acción (la primera en el historial)
    const snap = historyRef.current.shift();
    if (!snap) {
      setShowUndo(false);
      return;
    }
    const cloned = cloneState(snap);
    setOptimisticData(cloned);
    queryClient.setQueryData(['DraggableCards'], cloned);
    const revertMoves = buildMovesFromSnapshot(cloned);
    moveMutate(revertMoves, {
      onError: (error: any) => {
        toast({
          title: 'Undo failed',
          description: error?.message || 'Could not revert positions.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      },
      onSettled: () => {
        // Ocultar undo inmediatamente después de deshacer
        setShowUndo(false);
        setLastMovedId(null);
        // Limpiar el resto del historial para que solo se deshaga una acción
        historyRef.current = [];
      }
    });
  };

  useEffect(() => {
    return () => {
      if (undoHideTimeoutRef.current) window.clearTimeout(undoHideTimeoutRef.current);
    };
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const { socket, connected } = useSocket();

  // keep local optimistic copy in sync
  useEffect(() => {
    setOptimisticData(dataAP2 ?? null);
  }, [dataAP2]);

  // When arriving with ?focus=pending, briefly highlight the Pending Approvals card
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('focus') === 'pending' && lastColPainted) {
      setHighlightPending(true);
      // scroll into view subtly after layout
      setTimeout(() => {
        pendingCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }, 100);
      const t = setTimeout(() => setHighlightPending(false), 2800);
      return () => clearTimeout(t);
    }
  }, [location.search, lastColPainted]);

  // 🔄 Ensure board reflects backend updates immediately upon confirmation events and appointment updates
  useEffect(() => {
    if (!socket || !connected) return;
    
    const refreshDraggableCards = () => {
      // Cancel in-flight queries before updating to avoid showing stale data in Pending/Declined
      queryClient.cancelQueries({
        predicate: (q) => {
          const key = q.queryKey as any[];
          const head = Array.isArray(key) ? key[0] : undefined;
          return head === 'DraggableCards' || head === 'appointments' || head === 'appointments-search' || head === 'Appointment';
        }
      });
      queryClient.invalidateQueries({ queryKey: ['DraggableCards'] });
      queryClient.refetchQueries({ queryKey: ['DraggableCards'] });
    };
    
    // Listen to both confirmationResolved and appointmentUpdated events
    socket.on('confirmationResolved', refreshDraggableCards);
    socket.on('appointmentUpdated', refreshDraggableCards);
    
    return () => { 
      socket.off('confirmationResolved', refreshDraggableCards); 
      socket.off('appointmentUpdated', refreshDraggableCards);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, connected]);

  const cols = optimisticData ?? [];
  // removed unused lastIndex
  useEffect(() => {
    setLastColPainted(false);
  }, [cols.length, isPlaceholderData]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = event.active.id as string;
    if (!dataAP2) return;
    // ✅ id es "appointmentId|slotId"
    const [appointmentId, slotId] = id.split('|');
    const item = dataAP2.flatMap(col => col.patients).find(p => 
      p._id === appointmentId && p.selectedAppDates?.[0]?._id === slotId
    ) ?? null;
    setActiveItem(item);
    const originCol = dataAP2.find(col => col.patients.some(p => 
      p._id === appointmentId && p.selectedAppDates?.[0]?._id === slotId
    ));
    setSourceCol(originCol);
    
    // ✅ Si no hay originCol (arrastrando desde Pending/Declined), extraer color del slot
    const color = originCol?.priorityColor || (item ? getPriorityColor(item, 'gray') : 'gray');
    setOverlayColor(color);
    
    if (!optimisticData) setOptimisticData(dataAP2);
  }, [dataAP2, optimisticData]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !optimisticData || !sourceCol) {
      setActiveItem(null);
      setSourceCol(undefined);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;
    
    // ✅ Manejar overId que puede ser "appointmentId|slotId" o "placeholder-{colId}"
    const [overAppointmentId, overSlotId] = overId.includes('|') ? overId.split('|') : [null, null];
    
    const destinationCol = overAppointmentId
      ? optimisticData.find(col => col.patients.some(p => 
          p._id === overAppointmentId && p.selectedAppDates?.[0]?._id === overSlotId
        ))
      : optimisticData.find(col => `placeholder-${col._id}` === overId);

    if (!destinationCol) {
      setActiveItem(null);
      setSourceCol(undefined);
      return;
    }

    const fromColumnId = sourceCol._id ?? '';
    const toColumnId = destinationCol._id ?? '';

    // Calcular correctamente el índice de inserción
    let index: number;
    
    if (fromColumnId === toColumnId) {
      // Movimiento dentro de la misma columna
      const [activeAppId, activeSlotId] = activeId.split('|');
      const oldIndex = destinationCol.patients.findIndex(p => 
        p._id === activeAppId && p.selectedAppDates?.[0]?._id === activeSlotId
      );
      const overIndex = overAppointmentId
        ? destinationCol.patients.findIndex(p => 
            p._id === overAppointmentId && p.selectedAppDates?.[0]?._id === overSlotId
          )
        : -1;
      
      if (overIndex === -1) {
        index = destinationCol.patients.length;
      } else if (oldIndex < overIndex) {
        // Moviendo hacia abajo: insertar DESPUÉS del elemento over
        index = overIndex;
      } else {
        // Moviendo hacia arriba: insertar ANTES del elemento over
        index = overIndex;
      }
    } else {
      // Movimiento entre columnas: insertar antes del elemento over
      const overIndex = overAppointmentId
        ? destinationCol.patients.findIndex(p => 
            p._id === overAppointmentId && p.selectedAppDates?.[0]?._id === overSlotId
          )
        : -1;
      index = overIndex === -1 ? destinationCol.patients.length : overIndex;
    }

    // Snapshot full state BEFORE applying any movement so undo is exact
    pushHistory(optimisticData);
    setLastMovedId(activeId);

    // Apply movement over a cloned copy to avoid mutating history snapshots
    const updatedData = moveItem(cloneState(optimisticData), activeId, fromColumnId, toColumnId, index);
    setOptimisticData(updatedData);
    queryClient.setQueryData(['DraggableCards'], updatedData);

    const updatedSource = updatedData.find(col => col._id === fromColumnId);
    const updatedDest = updatedData.find(col => col._id === toColumnId);

    const moves: PriorityMove[] = [];
    if (updatedSource) {
      updatedSource.patients.forEach((p, i) => {
        // ✅ Extraer slotId del primer slot (cada card tiene 1 slot)
        const slotId = p.selectedAppDates?.[0]?._id;
        moves.push({ 
          id: p._id, 
          position: i, 
          priority: updatedSource._id ?? undefined,
          slotId: slotId || undefined
        });
      });
    }
    if (updatedDest && updatedDest._id !== fromColumnId) {
      updatedDest.patients.forEach((p, i) => {
        // ✅ Extraer slotId del primer slot (cada card tiene 1 slot)
        const slotId = p.selectedAppDates?.[0]?._id;
        moves.push({ 
          id: p._id, 
          position: i, 
          priority: updatedDest._id ?? undefined,
          slotId: slotId || undefined
        });
      });
    }

    moveMutate(moves, {
      onSuccess: (response: any) => {
        const failed = response?.results?.filter((r: { status: string }) => r.status === 'failed');
        if (failed?.length) {
          toast({
            title: 'Some updates failed',
            description: `${failed.length} updates could not be applied.`,
            status: 'warning',
            duration: 4000,
            isClosable: true,
          });
        }
      },
      onSettled: () => {
        // Cancel queries related to Pending Approvals and Declined panels before refetch/invalidate
        // We treat any appointment-related queries (board + base lists) to avoid race conditions
        queryClient.cancelQueries({
          predicate: (q) => {
            const key = q.queryKey as any[];
            const head = Array.isArray(key) ? key[0] : undefined;
            return head === 'DraggableCards' || head === 'appointments' || head === 'appointments-search' || head === 'Appointment';
          }
        });
        setSourceCol(undefined);
        setActiveItem(null);
      },
      onError: (error: any) => {
        console.error('❌ Move error:', error);
        toast({
          title: 'Error al mover cita',
          description: error?.message || 'No se pudo guardar el reordenamiento.',
          status: 'error',
          duration: 2500,
          isClosable: true,
        });
        queryClient.cancelQueries({
          predicate: (q) => {
            const key = q.queryKey as any[];
            const head = Array.isArray(key) ? key[0] : undefined;
            return head === 'DraggableCards' || head === 'appointments' || head === 'appointments-search' || head === 'Appointment';
          }
        });
        queryClient.invalidateQueries({ queryKey: ['DraggableCards'] });
        setOptimisticData(null);
      },
    });
  }, [optimisticData, sourceCol, queryClient, moveMutate, toast]);

  const handleDragCancel = useCallback(() => {
    setActiveItem(null);
    setSourceCol(undefined);
  }, []);

  const handlePageChange = (colId: string, page: number) => {
    setColumnPages((prev) => ({ ...prev, [colId]: page }));
  };

  const [filteredItems, setFilteredItems] = useState<Appointment[] | null>(null);
  // removed unused currentItems / totalPages (legacy pagination)

  const [filteredPending, setFilteredPending] = useState<Appointment[] | null>(null);
  const [filteredDeclined, setFilteredDeclined] = useState<Appointment[] | null>(null);
  // removed unused currentPending / totalPagesPending

  const [filteredArchived, setFilteredArchived] = useState<Appointment[] | null>(null);
  // removed unused currentArchived / totalPagesArchived

  const isLoadingColumns = !optimisticData || isPlaceholderData;
  const isLoadingContacts = isPlaceholderData && (!dataContacts || dataContacts.length === 0);
  const isLoadingPending = isPlaceholderData && (!dataPending || dataPending.length === 0);
  const isLoadingDeclined = isPlaceholderData && (!dataDeclined || dataDeclined.length === 0);
  const isLoadingArchived = isPlaceholderData && (!dataArchived || dataArchived.length === 0);

  // Derive data sources that gracefully fallback to base data when filters are empty arrays
  const sourceContacts = (filteredItems && filteredItems.length > 0) ? filteredItems : dataContacts;
  const sourcePending = (filteredPending && filteredPending.length > 0) ? filteredPending : dataPending;
  const sourceDeclined = (filteredDeclined && filteredDeclined.length > 0) ? filteredDeclined : dataDeclined;
  const sourceArchived = (filteredArchived && filteredArchived.length > 0) ? filteredArchived : dataArchived;

  // animación fluida de soltar
  const dropAnimation: DropAnimation = {
    duration: 250,
    easing: 'cubic-bezier(0.2, 0, 0, 1)',
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: { opacity: '0' }, // ya ocultamos la card fuente
      },
    }),
  };

  if (!optimisticData) {
    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <LoadingColumn color="blue" />
        <LoadingColumn color="green" />
        <LoadingColumn color="purple" />
        <LoadingContactsPanel />
      </DndContext>
    );
  }

  return (
    <>
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {(optimisticData ?? []).map((col, idx) => {
        const patients = Array.isArray(col.patients) ? col.patients : [];
        
        console.log(`🏥 Column "${col.priorityName}" (${col._id}):`, {
          totalPatients: patients.length,
          priorityColor: col.priorityColor,
          samplePatient: patients[0] ? {
            _id: patients[0]._id,
            name: `${patients[0].nameInput} ${patients[0].lastNameInput}`,
            slotsCount: patients[0].selectedAppDates?.length || 0,
            position: (patients[0].selectedAppDates?.[0] as any)?.position ?? 0
          } : null
        });
        
        const sorted = [...patients]
          .filter(p => Array.isArray(p.selectedAppDates) && p.selectedAppDates.some(s => {
            const st = String((s as any)?.status || "").toLowerCase();
            // ✅ Incluir TODOS los status relevantes: Complete, Confirmed, NoContacted, Contacted, Pending
            return st === "confirmed" || st === "nocontacted" || st === "pending" || st === "complete" || st === "contacted";
          }))
          .sort((a, b) => {
            const posA = (a.selectedAppDates?.[0] as any)?.position ?? 0;
            const posB = (b.selectedAppDates?.[0] as any)?.position ?? 0;
            return Number(posA) - Number(posB);
          });
        
        console.log(`   → After filter: ${sorted.length} patients`);

        const perPage = 5;
        const colCurrentPage = columnPages[col._id || ''] || 1;
        const colTotalPages = Math.ceil(sorted.length / perPage);
        const startIndex = (colCurrentPage - 1) * perPage;
        const endIndex = startIndex + perPage;
        const paginatedPatients = sorted.slice(startIndex, endIndex);

        // ✅ ID único: appointmentId|slotId
        const items = paginatedPatients.length > 0 
          ? paginatedPatients.map(d => `${d._id}|${d.selectedAppDates?.[0]?._id || ''}`)
          : [`placeholder-${col._id}`];

        const isLast = idx === (optimisticData?.length ?? 1) - 1;
        return (
          <Fade in key={col._id}>
            <Card
              minW="280px"
              flex="0 0 auto"
              minHeight="300px"
              height="520px"
              maxHeight="620px"
              borderRadius="2xl"
              position="relative"
              mr={4}
              bg="white"
              boxShadow="md"
              border="1px solid"
              borderColor="gray.200"
              _before={{
                content: '""',
                position: 'absolute',
                inset: 0,
                borderRadius: '2xl',
                p: '1px',
                bgGradient: `linear(to-br, ${col.priorityColor}.300, transparent)`,
                WebkitMask:
                  'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                WebkitMaskComposite: 'xor',
                pointerEvents: 'none',
              }}
            >
              {isPlaceholderData && (
                <Box
                  position="absolute"
                  inset={0}
                  bg="whiteAlpha.60"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  zIndex={2}
                  pointerEvents="none"
                  borderRadius="2xl"
                >
                  <Spinner thickness="3px" size="md" />
                </Box>
              )}

              <CardHeader pb={0}>
                <HStack
                  mb={2}
                  bg={`${col.priorityColor}.50`}
                  border="1px solid"
                  borderColor={`${col.priorityColor}.100`}
                  px={3}
                  py={2}
                  borderRadius="full"
                  width="fit-content"
                  boxShadow="xs"
                  gap={2}
                >
                  <Box w="10px" h="10px" borderRadius="full" bg={`${col.priorityColor}.400`} />
                  <Heading size="sm">{col.priorityName}</Heading>
                </HStack>
              </CardHeader>

              <CardBody p={3} overflowY="auto">
                {isLoadingColumns ? (
                  <Stack spacing={3}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Box key={i} p={4} borderRadius="xl" border="1px" borderColor="gray.100" boxShadow="xs" bg="white">
                        <HStack mb={2}>
                          <SkeletonCircle size="4" />
                          <Skeleton height="14px" width="40%" />
                        </HStack>
                        <Skeleton height="18px" mb={2} />
                        <Skeleton height="14px" />
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <SortableContext items={items} strategy={verticalListSortingStrategy}>
                    {paginatedPatients.length > 0 ? (
                      paginatedPatients.map((item) => {
                        // ✅ ID único: appointmentId|slotId
                        const uniqueId = `${item._id}|${item.selectedAppDates?.[0]?._id || ''}`;
                        return (
                          <SortableItem key={uniqueId} id={uniqueId}>
                            <AppointmentCard
                              item={item}
                              priorityColor={col.priorityColor}
                              onCardClick={onCardClick}
                              inlineUndo={showUndo && historyRef.current.length > 0 && uniqueId === lastMovedId}
                              onUndo={handleUndo}
                            />
                          </SortableItem>
                        );
                      })
                    ) : (
                      <SortableItem id={`placeholder-${col._id}`}>
                        <Box
                          textAlign="center"
                          color="gray.400"
                          fontStyle="italic"
                          border="2px dashed"
                          borderColor="gray.200"
                          borderRadius="xl"
                          py={6}
                          bg="gray.50"
                        >
                          Drop items here
                        </Box>
                      </SortableItem>
                    )}
                  </SortableContext>
                )}
              </CardBody>

              <Box pr={4} pt={1} bg="transparent" zIndex={1}>
                {isPlaceholderData ? (
                  <Skeleton height="36px" width="160px" borderRadius="md" />
                ) : (
                  <AddPatientButton key={col._id} priority={col.priority} formProps={{ typeButonVisible: false }} modalSize="6xl"/>
                )}
              </Box>

              <CardFooter minH="50px" maxH="56px" p={3}>
                {isPlaceholderData ? (
                  <HStack w="full" justify="center">
                    <Skeleton height="32px" width="80px" />
                    <Skeleton height="32px" width="80px" />
                    <Skeleton height="32px" width="80px" />
                  </HStack>
                ) : (
                  <Pagination
                    isPlaceholderData={isPlaceholderData}
                    totalPages={colTotalPages}
                    currentPage={colCurrentPage}
                    onPageChange={(page) => handlePageChange(col._id || '', page)}
                  />
                )}
              </CardFooter>
            </Card>

            {!isLoadingColumns && isLast && <AfterPaint on={() => setLastColPainted(true)} />}
          </Fade>
        );
      })}

      {/* Contacts */}
      {lastColPainted && (
        <Fade in>
          <Card
            pb={2}
            minW="280px"
            flex="0 0 auto"
            minHeight="300px"
            height="520px"
            maxHeight="620px"
            borderRadius="2xl"
            position="relative"
            mr={4}
            bg="white"
            boxShadow="md"
            border="1px solid"
            borderColor="gray.200"
            _before={{
              content: '""',
              position: 'absolute',
              inset: 0,
              borderRadius: '2xl',
              p: '1px',
              bgGradient: 'linear(to-br, red.300, transparent)',
              WebkitMask:
                'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              WebkitMaskComposite: 'xor',
              pointerEvents: 'none',
            }}
          >
            {isLoadingContacts && (
              <Box
                position="absolute"
                inset={0}
                bg="whiteAlpha.60"
                display="flex"
                alignItems="center"
                justifyContent="center"
                zIndex={2}
                pointerEvents="none"
                borderRadius="2xl"
              >
                <Spinner thickness="3px" size="md" />
              </Box>
            )}

            <CardHeader pb={0}>
              <HStack
                mb={2}
                bg="red.50"
                border="1px solid"
                borderColor="red.100"
                px={3}
                py={2}
                borderRadius="full"
                width="fit-content"
                boxShadow="xs"
                gap={2}
              >
                <Box w="10px" h="10px" borderRadius="full" bg="red.400" />
                <Heading size="sm">Contacts</Heading>
              </HStack>
            </CardHeader>

            <CardBody p={3} overflowY="auto">
              {isPlaceholderData ? (
                <Skeleton height="38px" borderRadius="md" mb={3} />
              ) : (
                <SearchBar ref={searchRef} data={dataContacts || []} onFilter={setFilteredItems} who="contact" />
              )}

              {isPlaceholderData ? (
                <Stack spacing={3}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Box key={i} p={4} borderRadius="xl" border="1px" borderColor="gray.100" boxShadow="xs" bg="white">
                      <HStack spacing={3} mb={2}>
                        <SkeletonCircle size="6" />
                        <Skeleton height="18px" width="60%" />
                      </HStack>
                      <SkeletonText noOfLines={2} spacing="2" />
                    </Box>
                  ))}
                </Stack>
              ) : (
                (sourceContacts).map((item) => (
                  <Box
                    key={`${item._id}-box`}
                    userSelect="none"
                    p={4}
                    borderRadius="2xl"
                    border="1px"
                    borderColor="gray.100"
                    w="full"
                    my={2}
                    cursor="default"
                    boxShadow="xs"
                    bg="white"
                    _hover={{ borderColor: 'blackAlpha.300', transform: 'translateY(-1px)', boxShadow: 'md' }}
                  >

                    <Grid templateColumns="1fr" templateRows="auto" w="100%">
                      <GridItem />
                      <GridItem>
                        <HStack justify="space-between" align="center">
                          <HStack>
                            <Text fontWeight="semibold" textTransform="capitalize">{item.nameInput} {item.lastNameInput}</Text>
                          </HStack>
                          <DeleteContactButton item={item} modelName="Appointment" />
                        </HStack>
                      </GridItem>
                      <GridItem mt={2}>
                        <HStack color="gray.600">
                          <Icon as={PhoneIcon} color="green.500" />
                          <ChatLauncher
                            item={item}
                            tooltip="Open chat"
                            stopPropagation
                            buildContact={buildContactFromAppointment}
                            trigger={
                              <IconButton
                                aria-label="Open chat"
                                icon={<FaCommentSms size={18} color="var(--chakra-colors-green-500)" />}
                                size="sm"
                                variant="ghost"
                                _hover={{ bg: 'green.50' }}
                              />
                            }
                          />
                          <Text>{formatAusPhoneNumber(item.phoneInput)}</Text>
                        </HStack>
                      </GridItem>
                    </Grid>
                  </Box>
                ))
              )}
            </CardBody>

            <Box pr={4} pt={1} bg="transparent" zIndex={1}>
              {isPlaceholderData ? (
                <Skeleton height="36px" width="160px" borderRadius="md" />
              ) : (
                <AddPatientButton onlyPatient={true} label="New Contact" formProps={{ typeButonVisible: false }} />
              )}
            </Box>

            <CardFooter minH="50px" maxH="56px" />
          </Card>
        </Fade>
      )}

      {/* Pending Approvals */}
      {lastColPainted && (
        <Fade in>
          <Card
            ref={pendingCardRef as any}
            pb={2}
            minW="280px"
            flex="0 0 auto"
            minHeight="300px"
            height="520px"
            maxHeight="620px"
            borderRadius="2xl"
            position="relative"
            mr={4}
            bg="white"
            boxShadow={highlightPending ? '0 0 0 3px rgba(72,187,120,0.35)' : 'md'}
            border="1px solid"
            borderColor={highlightPending ? 'green.400' : 'gray.200'}
            _before={{
              content: '""',
              position: 'absolute',
              inset: 0,
              borderRadius: '2xl',
              p: '1px',
              bgGradient: 'linear(to-br, green.300, transparent)',
              WebkitMask:
                'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              WebkitMaskComposite: 'xor',
              pointerEvents: 'none',
            }}
          >
            {isLoadingPending && (
              <Box
                position="absolute"
                inset={0}
                bg="whiteAlpha.60"
                display="flex"
                alignItems="center"
                justifyContent="center"
                zIndex={2}
                pointerEvents="none"
                borderRadius="2xl"
              >
                <Spinner thickness="3px" size="md" />
              </Box>
            )}

            <CardHeader pb={0}>
              <HStack
                mb={2}
                bg="green.50"
                border="1px solid"
                borderColor="green.100"
                px={3}
                py={2}
                borderRadius="full"
                width="fit-content"
                boxShadow="xs"
                gap={3}
              >
                <Box w="10px" h="10px" borderRadius="full" bg="green.400" />
                <Heading size="sm">Pending Approvals</Heading>
                <Tooltip
                  label={`Not filtered by date range. Showing all pending (${(sourcePending).length}/${dataPending.length})`}
                  hasArrow
                  placement="top"
                >
                  <Badge colorScheme="green" variant="solid" borderRadius="full" px={2} py={1} fontSize="0.7rem">
                    {(sourcePending).length}
                  </Badge>
                </Tooltip>
              </HStack>
            </CardHeader>

            <CardBody p={3} overflowY="auto">
              {isPlaceholderData ? (
                <Skeleton height="38px" borderRadius="md" mb={3} />
              ) : (
                <PendingDeclinedSearchBar ref={pendingSearchRef} data={dataPending || []} onFilter={setFilteredPending} placeholder="Search pending by name or phone" />
              )}

              {(sourcePending)
                .map((item) => (
                  <Box key={`${item._id}-pending-card`} onClick={() => onCardClick?.(item)}>
                    <AppointmentCard item={item} onCardClick={onCardClick} statusOverride="Pending" inlineUndo={showUndo && historyRef.current.length > 0 && item._id === lastMovedId} onUndo={handleUndo} />
                  </Box>
                ))}
            </CardBody>

            <CardFooter minH="50px" maxH="56px" />
          </Card>
        </Fade>
      )}

      {/* Declined */}
      {lastColPainted && (
        <Fade in>
          <Card
            pb={2}
            minW="280px"
            flex="0 0 auto"
            minHeight="300px"
            height="520px"
            maxHeight="620px"
            borderRadius="2xl"
            position="relative"
            mr={4}
            bg="white"
            boxShadow="md"
            border="1px solid"
            borderColor="gray.200"
            _before={{
              content: '""',
              position: 'absolute',
              inset: 0,
              borderRadius: '2xl',
              p: '1px',
              bgGradient: 'linear(to-br, red.300, transparent)',
              WebkitMask:
                'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              WebkitMaskComposite: 'xor',
              pointerEvents: 'none',
            }}
          >
            {isLoadingDeclined && (
              <Box
                position="absolute"
                inset={0}
                bg="whiteAlpha.60"
                display="flex"
                alignItems="center"
                justifyContent="center"
                zIndex={2}
                pointerEvents="none"
                borderRadius="2xl"
              >
                <Spinner thickness="3px" size="md" />
              </Box>
            )}

            <CardHeader pb={0}>
              <HStack
                mb={2}
                bg="red.50"
                border="1px solid"
                borderColor="red.100"
                px={3}
                py={2}
                borderRadius="full"
                width="fit-content"
                boxShadow="xs"
                gap={3}
              >
                <Box w="10px" h="10px" borderRadius="full" bg="red.400" />
                <Heading size="sm">Declined</Heading>
                <Tooltip
                  label={`Not filtered by date range. Showing all declined (${(sourceDeclined).length}/${dataDeclined.length})`}
                  hasArrow
                  placement="top"
                >
                  <Badge colorScheme="red" variant="solid" borderRadius="full" px={2} py={1} fontSize="0.7rem">
                    {(sourceDeclined).length}
                  </Badge>
                </Tooltip>
              </HStack>
            </CardHeader>

            <CardBody p={3} overflowY="auto">
              {isPlaceholderData ? (
                <Skeleton height="38px" borderRadius="md" mb={3} />
              ) : (
                <PendingDeclinedSearchBar ref={declinedSearchRef} data={dataDeclined || []} onFilter={setFilteredDeclined} placeholder="Search declined by name or phone" />
              )}

              {(sourceDeclined)
                .map((item) => (
                  <Box key={`${item._id}-declined-card`} onClick={() => onCardClick?.(item)}>
                    <AppointmentCard item={item} onCardClick={onCardClick} statusOverride="Declined" inlineUndo={showUndo && historyRef.current.length > 0 && item._id === lastMovedId} onUndo={handleUndo} />
                  </Box>
                ))}
            </CardBody>

            <CardFooter minH="50px" maxH="56px" />
          </Card>
        </Fade>
      )}

      {/* Archived Appointments */}
      {lastColPainted && (
        <Fade in>
          <Card
            pb={2}
            minW="280px"
            flex="0 0 auto"
            minHeight="300px"
            height="520px"
            maxHeight="620px"
            borderRadius="2xl"
            position="relative"
            mr={4}
            bg="white"
            boxShadow="md"
            border="1px solid"
            borderColor="gray.200"
            _before={{
              content: '""',
              position: 'absolute',
              inset: 0,
              borderRadius: '2xl',
              p: '1px',
              bgGradient: 'linear(to-br, gray.300, transparent)',
              WebkitMask:
                'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              WebkitMaskComposite: 'xor',
              pointerEvents: 'none',
            }}
          >
            {isLoadingArchived && (
              <Box
                position="absolute"
                inset={0}
                bg="whiteAlpha.60"
                display="flex"
                alignItems="center"
                justifyContent="center"
                zIndex={2}
                pointerEvents="none"
                borderRadius="2xl"
              >
                <Spinner thickness="3px" size="md" />
              </Box>
            )}

            <CardHeader pb={0}>
              <HStack
                mb={2}
                bg="gray.50"
                border="1px solid"
                borderColor="gray.100"
                px={3}
                py={2}
                borderRadius="full"
                width="fit-content"
                boxShadow="xs"
                gap={2}
              >
                <Box w="10px" h="10px" borderRadius="full" bg="gray.400" />
                <Heading size="sm">Archived</Heading>
              </HStack>
            </CardHeader>

            <CardBody p={3} overflowY="auto">
              {isPlaceholderData ? (
                <Skeleton height="38px" borderRadius="md" mb={3} />
              ) : (
                <SearchBar ref={searchRef} data={dataArchived || []} onFilter={setFilteredArchived} who="contact" />
              )}

              {(sourceArchived).map((item) => (
                <Box
                  onClick={() => onCardClick?.(item)}
                  key={`${item._id}-box`}
                  userSelect="none"
                  p={4}
                  borderRadius="2xl"
                  border="1px"
                  borderColor="gray.100"
                  w="full"
                  my={2}
                  cursor="pointer"
                  boxShadow="xs"
                  bg="white"
                  _hover={{ borderColor: 'blackAlpha.300', transform: 'translateY(-1px)', boxShadow: 'md' }}
                >
                  <Grid templateColumns="1fr" templateRows="auto" w="100%">
                    <GridItem />
                    <GridItem>
                      <HStack justify="space-between" align="center">
                        <Text fontWeight="semibold" textTransform="capitalize">{item.nameInput} {item.lastNameInput}</Text>
                        <UnarchiveItemButton id={item._id ?? ""} modelName="Appointment" />
                      </HStack>
                    </GridItem>
                    <GridItem mt={2}>
                      <HStack color="gray.600">
                        <Icon as={PhoneIcon} color="green.500" />
                        <Text>{formatAusPhoneNumber(item.phoneInput || '')}</Text>
                        <PrefBadge pref={item.contactPreference as any} />
                      </HStack>
                    </GridItem>
                  </Grid>
                </Box>
              ))}
            </CardBody>

            <CardFooter minH="50px" maxH="56px" />
          </Card>
        </Fade>
      )}

      {/* Overlay: AHORA ES LA MISMA CARD */}
      <DragOverlay dropAnimation={dropAnimation} adjustScale={false}>
        {activeItem ? (
                  <AppointmentCard item={activeItem} priorityColor={overlayColor} asOverlay />
        ) : null}
      </DragOverlay>
    </DndContext>
    {/* Inline undo ahora se muestra dentro de la card movida; se elimina el botón flotante global */}
    </>
  );
}
