// CustomEntryForm.tsx
import React, {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ProviderPerDate, { type PendingAssignment } from "./ProviderPerDate";
import { useCreateAppointmentProvider, type CreateAppointmentProviderData } from "@/Hooks/Query/useAppointmentProviders";

import DOMPurify from "dompurify";
import CustomHeading from "../Form/CustomHeading";
import CustomInputN from "../Form/CustomInputN";

import { MarkedEvents } from "@/Hooks/Handles/useSlotSelection";
import type { AppointmentForm } from "@/schemas/AppointmentsSchema";
import { makeAppointmentsSchemaOptionalProviders } from "@/schemas/AppointmentsSchema";
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Collapse,
  Divider,
  Flex,
  FormControl,
  FormErrorMessage,
  FormErrorIcon,
  FormLabel,
  HStack,
  IconButton,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Tooltip,
  RadioGroup,
  SimpleGrid,
  Spinner,
  Tag,
  TagLabel,
  InputGroup,
  InputLeftElement,
  Text,
  VStack,
  Skeleton,
  Radio as ChakraRadio,
  Switch,
  Select,
  Badge,
  Avatar,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  QueryObserverResult,
  RefetchOptions,
  useQueryClient,
} from "@tanstack/react-query";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import he from "he";
import { SlotInfo } from "react-big-calendar";
import { Controller, FieldError, FieldErrors, useForm } from "react-hook-form";
import { FiPhone, FiSearch } from "react-icons/fi";
import { LuUserPen } from "react-icons/lu";
import {
  MdAlternateEmail,
  MdEventBusy,
  MdEventNote,
  MdOutlinePostAdd,
  MdScheduleSend,
  MdExpandMore,
  MdExpandLess,
} from "react-icons/md";
import CustomButtonGroup from "../Form/CustomButtonGroup";
import CustomCheckbox from "../Form/CustomCheckbox";
import CustomTextArea from "../Form/CustomTextArea";
import { DateRange } from "./CustomBestApp";
import {
  Appointment,
  ContactPreference,
  ContactStatus,
  Priority,
  Provider,
  Representative,
  SelectedDates,
  TimeBlock,
  Treatment,
  WeekDay,
} from "@/types";
import { useUpdateItems } from "@/Hooks/Query/useUpdateItems";
import AvailabilityDates2 from "./AvailabilityDates2";
import { useInsertToCollection } from "@/Hooks/Query/useInsertToCollection";
import { TreatmentSelector } from "../Treatments/TreatmentSelector";
import PhoneInput from "../Form/PhoneInput";
import { ContactForm, contactsSchema } from "@/schemas/ContactSchema";
import { useProvidersList } from "@/Hooks/Query/useProviders";
// Provider availability hooks removed (now handled inside ProviderPerDate)
// Server-side suggest types no longer used (multi-window handled client-side)
import CustomCalendarEntryForm from "../Scheduler/CustomCalendarEntryForm";
// Weekly type no longer needed (schedule helpers removed)
import { PageResp } from "@/Hooks/Query/useAppointmentsPaginated";
// useProviderSchedule removed (encapsulated in ProviderPerDate)
import { useCheckPhoneUnique } from "@/Hooks/Query/useCheckPhoneUnique";
import { toE164AU } from "@/utils/phoneAU";

// hook genérico para colecciones
import { useGetCollection } from "@/Hooks/Query/useGetCollection";
import { formatAustralianMobile } from "@/Functions/formatAustralianMobile";

// componentes de plantillas
import CreateMessageModal from "../Chat/CustomMessages/CreateCustomMessageModal2";

// ⬇️ SMS hook
import { useSendAppointmentSMS } from "@/Hooks/Query/useSendAppointmentSMS";
import ShowTemplateButtonWithData from "../Chat/CustomMessages/ShowTemplateButtonWithData";

dayjs.extend(utc);
dayjs.extend(timezone);
import customParseFormat from "dayjs/plugin/customParseFormat";
import { getLatestSelectedAppDate } from "@/Functions/getLatestSelectedAppDate";
const SYD_TZ = "Australia/Sydney";

// Status → color scheme mapping for appointment slot tags
const SLOT_STATUS_COLOR: Record<string, string> = {
  confirmed: 'green',
  pending: 'yellow',
  nocontacted: 'gray',
  contacted: 'blue',
  declined: 'red',
  reschedule: 'purple',
  cancelled: 'red',
  unknown: 'gray',
  new: 'blue', // Para slots nuevos en modo CREATION
};

/* ----------------- helpers ----------------- */
function useDebounced<T>(value: T, delay = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

// RHF error helpers
const asFieldError = (err: unknown): FieldError | undefined =>
  err && typeof err === "object" && "type" in (err as any)
    ? (err as FieldError)
    : undefined;

const errMsg = (err: unknown): ReactNode =>
  typeof err === "string" ? err : asFieldError(err)?.message ?? undefined;

// utils
const isObjectId = (s: string) => /^[0-9a-fA-F]{24}$/.test(s.trim());
const norm = (s: string) => s.trim().replace(/\s+/g, " ");
const onlyDigits = (s: string) => s.replace(/\D+/g, "");

function normalizeId(v: any): string | undefined {
  if (!v) return undefined;
  if (typeof v === "string") return v;
  if (typeof v === "object") {
    if (typeof v._id === "string") return v._id;
    if (v._id && typeof v._id.toString === "function") {
      const s = v._id.toString();
      if (s && s !== "[object Object]") return s;
    }
    if (typeof v.$oid === "string") return v.$oid;
    if (typeof v.toHexString === "function") return v.toHexString();
  }
  return undefined;
}

/* ----------------- util fechas y schedule ----------------- */
// Local schedule helper functions removed (encapsulated within ProviderPerDate component now)

/* ===================== Representative search (soft) ===================== */
type AppointmentHit = {
  _id: string;
  nameInput?: string;
  lastNameInput?: string;
  phoneInput?: string;
  phoneE164?: string;
  emailInput?: string;
  emailLower?: string;
  sid?: string;
  createdAt?: string;
};

const hitKey = (h: AppointmentHit) =>
  `${h._id}-${h.phoneE164 || h.phoneInput || ""}-${h.emailLower || h.emailInput || ""
  }`;

const Highlight: React.FC<{ text?: string; q: string }> = React.memo(
  ({ text, q }) => {
    if (!text) return null;
    if (!q) return <>{text}</>;
    const parts = text.split(
      new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "i")
    );
    return (
      <>
        {parts.map((p, i) =>
          p.toLowerCase() === q.toLowerCase() ? (
            <mark key={i} style={{ background: "transparent", fontWeight: 700 }}>
              {p}
            </mark>
          ) : (
            <React.Fragment key={i}>{p}</React.Fragment>
          )
        )}
      </>
    );
  }
);
Highlight.displayName = "Highlight";

const RepRow: React.FC<{
  h: AppointmentHit;
  q: string;
  onPick: (h: AppointmentHit) => void;
}> = React.memo(({ h, q, onPick }) => {
  return (
    <HStack
      as="div"
      tabIndex={0}
      w="100%"
      justify="space-between"
      px={2}
      py={2}
      borderRadius="md"
      _hover={{ bg: "blackAlpha.50" }}
      onClick={() => onPick(h)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onPick(h)}
    >
      <Box textAlign="left" maxW="80%" overflow="hidden">
        <HStack spacing={1} mb={1}>
          <Avatar
            name={`${h.nameInput ?? ""} ${h.lastNameInput ?? ""}`.trim() || "(No name)"}
            size="sm"
          />
          <Text noOfLines={1} fontWeight="semibold" textTransform="capitalize">
            <Highlight
              text={`${h.nameInput ?? ""} ${h.lastNameInput ?? ""}`.trim() || "(No name)"}
              q={q}
            />
          </Text>
          <HStack spacing={2} color="gray.600" fontSize="xs">
            {h.phoneInput && <Badge>{formatAustralianMobile(h.phoneInput)}</Badge>}
            {h.emailInput && <Badge>{h.emailInput}</Badge>}
          </HStack>
        </HStack>
      </Box>
      <Button
        size="xs"
        colorScheme="teal"
        variant="outline"
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onPick(h);
        }}
      >
        Select
      </Button>
    </HStack>
  );
});
RepRow.displayName = "RepRow";

/** Construye un mongoQuery “soft” */
function buildRepMongoQuery(raw: string) {
  const q = norm(raw);
  if (!q || q.length < 2) {
    return { _id: { $exists: false } };
  }
  const ors: any[] = [];
  ors.push({ nameInput: { $regex: q, $options: "i" } });
  ors.push({ lastNameInput: { $regex: q, $options: "i" } });
  ors.push({ emailLower: { $regex: q.toLowerCase(), $options: "i" } });
  ors.push({ sid: { $regex: q, $options: "i" } });

  try {
    const maybeE164 = toE164AU(q);
    ors.push({ phoneE164: maybeE164 });
    ors.push({ phoneInput: maybeE164 });
  } catch {
    const digits = onlyDigits(q);
    if (digits.length >= 4) {
      ors.push({ phoneInput: { $regex: digits, $options: "i" } });
    }
  }

  if (isObjectId(q)) {
    ors.push({ _id: q });
  }

  return { $or: ors };
}

/* ===================== COMPONENTE PRINCIPAL ===================== */
type Props = {
  typeButonVisible?: boolean;
  onlyPatient?: boolean;
  onClose_1?: () => void;
  rfetchPl?: (
    options?: RefetchOptions
  ) => Promise<QueryObserverResult<any, Error>>;
  handleAppSelectEvent?: (slotInfo: SlotInfo) => void;
  handleAppSelectSlot?: (slotInfo: { start: Date; end: Date }) => void;
  markedAppEvents?: MarkedEvents;
  handleSelectEvent?: (slotInfo: SlotInfo) => void;
  handleSelectSlot?: (slotInfo: { start: Date; end: Date }) => void;
  markedEvents?: MarkedEvents;
  refetch_list?:
  | ((
    options?: RefetchOptions
  ) => Promise<QueryObserverResult<unknown, Error>>)
  | undefined;
  children?: ReactNode;
  title?: string;
  btnName?: string;
  dates?: SelectedDates;
  datesApp?: { startDate: Date; endDate: Date }[];
  onDatesChange?: React.Dispatch<React.SetStateAction<DateRange[]>>;
  nameVal?: string;
  idVal?: string;
  lastNameVal?: string;
  phoneVal?: string;
  phoneFieldReadOnly?: boolean;
  reschedule?: boolean;
  emailVal?: string;
  priorityVal?: Priority;
  note?: string;
  datesSelected?: SelectedDates;
  datesAppSelected?: DateRange[];
  mode: "CREATION" | "EDITION";
  toastInfo: { description: string; title: string };
  setDates?: React.Dispatch<React.SetStateAction<DateRange[]>>;
  setDatesApp?: React.Dispatch<React.SetStateAction<DateRange[]>>;
  treatmentBack?: Treatment;
  conversationId?: string;
  refetchPage?: (
    options?: RefetchOptions | undefined
  ) => Promise<QueryObserverResult<PageResp<Appointment>, Error>>;
  contactPreference?: ContactPreference;
  providers?: Provider[];
  representative?: Representative;
  // REMOVED: providersAssignments - now handled by AppointmentProvider collection
};

function CustomEntryForm({
  representative,
  contactPreference,
  children,
  dates,
  btnName = "Save",
  onClose_1,
  nameVal,
  lastNameVal,
  phoneVal,
  emailVal,
  priorityVal,
  datesSelected,
  datesAppSelected,
  note,
  reschedule = false,
  rfetchPl,
  treatmentBack,
  idVal,
  mode = "CREATION",
  refetch_list,
  refetchPage,
  onlyPatient = false,
  typeButonVisible = true,
  phoneFieldReadOnly = false,
  conversationId,
  providers,
  // REMOVED: providersAssignments: providersAssignmentsProp,
}: Props) {
  const topRef = useRef<HTMLDivElement | null>(null);
  const { data: allProviders = [] } = useProvidersList({ active: true });
  const { onOpen: onOpenApp, onClose: onCloseApp, isOpen: isOpenApp } =
    useDisclosure();
  const [isAnAppointment, setIsAnAppointment] = useState(!onlyPatient);
  const onToggle = useCallback(() => setIsAnAppointment((s) => !s), []);
  const providerIdsFromProps = useMemo(
    () => (providers ?? []).map((p: any) => String(p?._id ?? p)),
    [providers]
  );

  // ⬇️ Mutaciones
  const { mutateAsync, isPending } =
    useInsertToCollection<{ message: string; document: any }>("Appointment");
  const { mutate: editItem, isPending: editIsPending } = useUpdateItems(
    isAnAppointment ? "update-items" : "update-items-contacts"
  );
  const { mutateAsync: sendSMSAsync, isPending: isSending } =
    useSendAppointmentSMS();
  const { mutateAsync: createProviderAssignment } = useCreateAppointmentProvider();
  const [uiBusy, setUiBusy] = useState(false);
  const formBusy = isPending || editIsPending || isSending || uiBusy;
  const queryClient = useQueryClient();
  const toast = useToast();
  
  // State for pending provider assignments in CREATION mode
  const [pendingProviderAssignments, setPendingProviderAssignments] = useState<PendingAssignment[]>([]);
  
  // Stabilize the callback to prevent infinite re-renders
  const handlePendingAssignmentsChange = useCallback((assignments: PendingAssignment[]) => {
    setPendingProviderAssignments(assignments);
  }, []);

  // Cancel any in-flight queries that depend on appointments
  const cancelAppointmentDependentQueries = useCallback(async () => {
    try {
      await queryClient.cancelQueries({
        predicate: (q) => {
          const key = q.queryKey as unknown as any[];
          const head = Array.isArray(key) ? key[0] : undefined;
          // Known appointment-related roots
          return (
            head === 'appointments' ||
            head === 'appointments-search' ||
            head === 'DraggableCards' ||
            head === 'Appointment'
          );
        },
      });
    } catch (e) {
      // No-op: cancellation is best-effort
    }
  }, [queryClient]);

  // checkUnique (servidor) solo en CREATION
  const checkPhoneUnique = useCheckPhoneUnique();
  const isCreation = mode === "CREATION";
  const schema = useMemo(
    () =>
      makeAppointmentsSchemaOptionalProviders(
        isCreation ? checkPhoneUnique : async () => false
      ),
    [checkPhoneUnique, isCreation]
  );

  const validateTwilioWindowStrict = (d: dayjs.Dayjs | null) => {
    if (!d || !d.isValid()) return { ok: false, error: "invalid" as const };
    const now = dayjs().tz(SYD_TZ).second(0).millisecond(0);
    const minsAhead = d.diff(now, "minute", true);
    const daysAhead = d.diff(now, "day", true);
    if (minsAhead < 15) return { ok: false, error: "tooSoon" as const };
    if (daysAhead > 35) return { ok: false, error: "tooFar" as const };
    return { ok: true as const };
  };

  // normaliza representative para defaultValues
  const normalizedRepresentative: Representative | undefined = representative
    ? ({
      ...representative,
      appointment: normalizeId((representative as any).appointment) || "",
    } as unknown as Representative)
    : undefined;

  const {
    register,
    reset,
    handleSubmit,
    clearErrors,
    control,
    setValue,
    trigger,
    getValues,
    setError,
    watch,
  getFieldState,
    formState: { errors },
  } = useForm<AppointmentForm | ContactForm>({
    resolver: zodResolver(isAnAppointment ? schema : contactsSchema),
    shouldUnregister: true,
    mode: "onSubmit",
    reValidateMode: "onBlur",
    criteriaMode: "firstError",
    defaultValues: {
      treatment: he.decode(treatmentBack?._id?.toString?.() || ""),
      selectedAppDates: datesAppSelected || [],
      selectedDates: datesSelected,
      contactPreference: contactPreference || "sms",
      nameInput: he.decode(nameVal || ""),
      lastNameInput: he.decode(lastNameVal || ""),
      note: he.decode(note || ""),
      phoneInput: he.decode(phoneVal || ""),
      emailInput: he.decode(emailVal || ""),
      priority: priorityVal?._id ?? undefined,
      id: mode === "EDITION" ? idVal || "" : "",
      reschedule: !!reschedule,
      providers: providerIdsFromProps,
      // REMOVED: providersAssignments: [],
      representative:
        normalizedRepresentative ??
        ({
          appointment: "",
          relationship: "parent",
          verified: false,
          verifiedAt: undefined,
          verifiedBy: "",
          consentAt: undefined,
          notes: "",
        } as unknown as Representative),
    } as any,
  });
  // const CONFIRMATION_ENABLED = false; // toggle global (unused)

  // Estado local de "es niño/dependiente"
  const [isChild, setIsChild] = useState<boolean>(
    !!normalizeId(representative?.appointment)
  );

  type SelectedTemplate = { id?: string; raw: string };
  const [selectedTemplate, setSelectedTemplate] = useState<SelectedTemplate | null>(null);

  // detecta si el paciente YA es representante
  const currentPatientId = useMemo(() => {
    const n = normalizeId(idVal);
    return n && typeof n === "string" && isObjectId(n) ? n : undefined;
  }, [idVal]);

  const repOfFilters = useMemo(() => {
    return currentPatientId
      ? {
        mongoQuery: { "representative.appointment": currentPatientId },
        limit: 1,
        projection: { _id: 1 },
      }
      : { mongoQuery: { _id: { $exists: false } }, limit: 1, projection: { _id: 1 } };
  }, [currentPatientId]);

  const { data: repOfHits = [] } =
    useGetCollection<Pick<Appointment, "_id">>("Appointment", repOfFilters);
  const isAlreadyRepresentative = repOfHits.length > 0;

  useEffect(() => {
    if (isAlreadyRepresentative) {
      if (isChild) setIsChild(false);
      const rep = (getValues("representative") as any) || {};
      if (rep?.appointment) {
        setValue("representative.appointment" as any, "", {
          shouldDirty: true,
          shouldTouch: true,
        });
        trigger("representative");
      }
    }
  }, [isAlreadyRepresentative, isChild, getValues, setValue, trigger]);

  // Representative Search State
  const [repQuery, setRepQuery] = useState("");
  const repQ = useDebounced(repQuery, 250);

  const inFlightRef = useRef(false); // evita reentradas durante todo el flujo

  const repFilters = useMemo(() => {
    const mongoQuery = buildRepMongoQuery(repQ);
    const projection = {
      nameInput: 1,
      lastNameInput: 1,
      phoneInput: 1,
      phoneE164: 1,
      emailInput: 1,
      emailLower: 1,
      sid: 1,
      createdAt: 1,
    };
    return { mongoQuery, limit: 10, projection };
  }, [repQ]);

  const { data: repHits = [], isFetching: repLoading } =
    useGetCollection<AppointmentHit>("Appointment", repFilters);

  const handlePickRepresentative = useCallback(
    (h: AppointmentHit) => {
      if (currentPatientId && h._id === currentPatientId) {
        toast({
          title: "Invalid representative",
          description: "A patient cannot be their own representative.",
          status: "warning",
          duration: 2500,
          isClosable: true,
        });
        return;
      }
      setIsChild(true);
      setValue("representative.appointment" as any, h._id, {
        shouldDirty: true,
        shouldTouch: true,
      });
      setValue("representative.relationship" as any, "parent", {
        shouldDirty: false,
        shouldTouch: false,
      });
      setValue("representative.nameInput" as any, h.nameInput || "", {
        shouldDirty: false,
        shouldTouch: false,
      });
      setValue("representative.lastNameInput" as any, h.lastNameInput || "", {
        shouldDirty: false,
        shouldTouch: false,
      });
      trigger("representative");
      toast({
        title: "Representative linked",
        description:
          `${h.nameInput ?? ""} ${h.lastNameInput ?? ""}`.trim() || h._id,
        status: "success",
        duration: 1800,
        isClosable: true,
      });
    },
    [setValue, trigger, toast, currentPatientId]
  );

  // Valores derivados para UI
  const Relationship =
    (getValues("representative") as any)?.relationship || "";
  const fullName = `${(getValues("representative") as any)?.nameInput || ""} ${(getValues("representative") as any)?.lastNameInput || ""
    }`;
  const selectedRepId =
    (getValues("representative") as any)?.appointment || "";

  /* Prefill representante en EDICIÓN (seguro) */
  const repIdForEdition = useMemo(
    () => (mode === "EDITION" ? normalizeId(representative?.appointment) : undefined),
    [mode, representative]
  );

  const repPrefillProjection = {
    _id: 1,
    nameInput: 1,
    lastNameInput: 1,
    phoneInput: 1,
    emailInput: 1,
    phoneE164: 1,
    emailLower: 1,
  } as const;

  const repPrefillFilters = useMemo(() => {
    const validId =
      repIdForEdition &&
      typeof repIdForEdition === "string" &&
      isObjectId(repIdForEdition.trim());
    return validId
      ? {
        mongoQuery: { _id: repIdForEdition },
        limit: 1,
        projection: repPrefillProjection,
      }
      : {
        mongoQuery: { _id: { $exists: false } },
        limit: 1,
        projection: repPrefillProjection,
      };
  }, [repIdForEdition]);

  const { data: repPrefillHits = [] } =
    useGetCollection<AppointmentHit>("Appointment", repPrefillFilters);
  const didPrefillRep = useRef(false);

  useEffect(() => {
    if (didPrefillRep.current) return;
    if (mode !== "EDITION") return;
    if (!repIdForEdition) return;
    if (isAlreadyRepresentative) return;

    const h = repPrefillHits?.[0];
    if (!h) return;

    setIsChild(true);
    setValue("representative.appointment" as any, repIdForEdition, {
      shouldDirty: false,
      shouldTouch: false,
    });
    if (representative?.relationship) {
      setValue(
        "representative.relationship" as any,
        representative.relationship,
        { shouldDirty: false, shouldTouch: false }
      );
    }
    setValue("representative.nameInput" as any, h.nameInput || "", {
      shouldDirty: false,
      shouldTouch: false,
    });
    setValue("representative.lastNameInput" as any, h.lastNameInput || "", {
      shouldDirty: false,
      shouldTouch: false,
    });

    trigger("representative");
    didPrefillRep.current = true;
  }, [
    mode,
    repIdForEdition,
    repPrefillHits,
    representative?.relationship,
    setValue,
    trigger,
    isAlreadyRepresentative,
  ]);

  // Debounce + unique phone validation with optimized subscription
  const phoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCheckedRef = useRef<string>("");

  useEffect(() => {
    if (!isCreation) return;

    // Subscribe directly to the field changes instead of using watch
    const subscription = watch((value, { name }) => {
      // Only process phoneInput changes
      if (name !== "phoneInput") return;

      const raw = String(value.phoneInput ?? "").replace(/\s+/g, "");
      if (phoneTimerRef.current) clearTimeout(phoneTimerRef.current);

      phoneTimerRef.current = setTimeout(async () => {
        const repId = (getValues("representative") as any)?.appointment;
        if ((isChild || !!repId) && !raw) {
          const errType = getFieldState("phoneInput").error?.type;
          if (errType === "duplicate") clearErrors("phoneInput" as any);
          lastCheckedRef.current = "";
          return;
        }

        const isCompleteAU =
          /^04\d{8}$/.test(raw) ||
          /^\+61\d{9}$/.test(raw) ||
          /^61\d{9}$/.test(raw);
        const errType = getFieldState("phoneInput").error?.type;
        if (!isCompleteAU) {
          if (errType === "duplicate") clearErrors("phoneInput" as any);
          lastCheckedRef.current = "";
          return;
        }

        if (lastCheckedRef.current === raw) return;
        lastCheckedRef.current = raw;

        try {
          const e164 = toE164AU(raw);
          const excludeIdVal = getValues("id");
          const exists = await checkPhoneUnique(e164, {
            excludeId:
              typeof excludeIdVal === "string" && isObjectId(excludeIdVal)
                ? excludeIdVal
                : undefined,
          });
          if (exists) {
            setError("phoneInput" as any, {
              type: "duplicate",
              message: "Phone number already exists",
            });
          } else if (errType === "duplicate") {
            clearErrors("phoneInput" as any);
          }
        } catch {
          // noop
        }
      }, 500); // Increased debounce to 500ms for better performance
    });

    return () => {
      subscription.unsubscribe();
      if (phoneTimerRef.current) clearTimeout(phoneTimerRef.current);
    };
  }, [
    isCreation,
    watch,
    getFieldState,
    clearErrors,
    setError,
    checkPhoneUnique,
    getValues,
    isChild,
  ]);

  const appointmentErrors = errors as FieldErrors<AppointmentForm>;
  const [duration, setDuration] = useState<number>(
    priorityVal?.durationHours || 0
  );
  const [, setIdpriority] = useState<string>("");
  const [color, setColor] = useState<string>("");
  const [, setTreatment] = useState<Treatment | undefined>(treatmentBack);
  const [selected, setSelected] = useState<number>(priorityVal?.id ?? -1);
  const [selectedTreatment] = useState<number>(priorityVal?.id ?? -1);

  useEffect(() => {
    if (!priorityVal) return;
    const current = getValues("priority") as unknown as string | undefined;
    const next = (priorityVal as any)._id ?? "";
    if (!current && next) {
      setValue("priority", next, { shouldDirty: false, shouldTouch: false });
      trigger("priority");
    }
  }, [priorityVal, getValues, setValue, trigger]);

  useEffect(() => {
    if (mode === "EDITION") {
      setValue("providers", providerIdsFromProps, {
        shouldDirty: false,
        shouldTouch: false,
      });
    }
  }, [mode, providerIdsFromProps, setValue]);

  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [selectedAppDates, setSelectedAppDates] = useState<DateRange[]>(
    datesAppSelected || []
  );
  const [resetKey, setResetKey] = useState(0);
  // REMOVED: providersAssignments state - now handled by AppointmentProvider collection
  const [selectedDays, setSelectedDays] = useState<
    Partial<Record<WeekDay, TimeBlock[]>>
  >(() => {
    if (Array.isArray(dates?.days)) {
      return dates.days.reduce((acc, curr) => {
        acc[curr.weekDay] = curr.timeBlocks;
        return acc;
      }, {} as Partial<Record<WeekDay, TimeBlock[]>>);
    }
    return {};
  });

  // Appointment window (single) deprecated: we now compute allAppointmentWindows instead

  const appointmentStartLocal = useMemo(() => {
    const latest = getLatestSelectedAppDate(selectedAppDates as any);
    const start = (latest as any)?.startDate ?? (latest as any)?.propStartDate ?? (latest as any)?.proposed?.startDate;
    return start ? dayjs.utc(start).tz(SYD_TZ) : null;
  }, [selectedAppDates]);

  // ======== Reminder ========
  const [templateTextByPatient] = useState<Record<string, string>>({});

  // removed notifyNow state as it wasn't used and caused re-renders

  const [reminderEnabled, setReminderEnabled] = useState<boolean>(true);

  // ⬅️ NUEVO: offset en horas 1..5 (null = nada seleccionado)
  const [reminderOffsetH, setReminderOffsetH] = useState<number | null>(1);

  // Solo abrir reminder cuando haya fecha seleccionada
  const [messagingOpen, setMessagingOpen] = useState(false);

  dayjs.extend(customParseFormat);

  const fmtHuman = (d: dayjs.Dayjs | null) =>
    d && d.isValid() ? d.tz(SYD_TZ).format("ddd, DD MMM YYYY • h:mm A") : "—";

  // Recordatorio calculado a partir del turno y el offset
  const selectedReminder = useMemo(() => {
    if (!reminderEnabled) return null;
    if (!appointmentStartLocal) return null;
    if (reminderOffsetH == null) return null;
    // Mantiene minutos del turno, solo resta horas
    return appointmentStartLocal.clone().subtract(reminderOffsetH, "hour");
  }, [reminderEnabled, appointmentStartLocal, reminderOffsetH]);

  // Validación/ajuste ventana Twilio
  const enforceTwilioWindow = (d: dayjs.Dayjs | null) => {
    if (!d || !d.isValid()) return { ok: false as const, error: "invalid" as const };

    const now = dayjs().tz(SYD_TZ).second(0).millisecond(0);
    let chosen = d.tz(SYD_TZ).second(0).millisecond(0);

    const daysAhead = chosen.diff(now, "day", true);
    if (daysAhead > 35) return { ok: false as const, error: "tooFar" as const };

    const minsAhead = chosen.diff(now, "minute", true);
    let adjusted = false;
    if (minsAhead < 15) { chosen = now.add(16, "minute"); adjusted = true; }

    return {
      ok: true as const,
      whenLocal: chosen,
      isoLocal: chosen.format("YYYY-MM-DDTHH:mm:ssZ"),
      isoUtc: chosen.toDate().toISOString(),
      adjusted,
    };
  };

  // Opciones (1..5h) y bloqueo si no hay tiempo suficiente para Twilio
  const REMINDER_OPTIONS = [1, 2, 3, 4, 5] as const;
  const disabledByOffset = useMemo(() => {
    const map = new Map<number, boolean>();
    for (const h of REMINDER_OPTIONS) {
      if (!appointmentStartLocal) {
        map.set(h, true);
        continue;
      }
      const candidate = appointmentStartLocal.clone().subtract(h, "hour");
      const v = validateTwilioWindowStrict(candidate);
      map.set(h, !v.ok);
    }
    return map;
  }, [appointmentStartLocal]);

  // Trigger estable para CreateMessageModal
  const createTemplateTrigger = useMemo(
    () => (
      <IconButton
        type="button"
        aria-label="Create template"
        icon={<MdOutlinePostAdd size={20} />}
        variant="ghost"
        size="sm"
        borderRadius="full"
        _focusVisible={{ boxShadow: "0 0 0 3px rgba(66,153,225,0.6)" }}
      />
    ),
    []
  );
  const formId = watch("id");
  const [createdIdState, setCreatedIdState] = useState<string | undefined>();
  const validPatientIdForTemplates = useMemo(() => {
    const raw = createdIdState ?? (formId as string | undefined) ?? idVal;
    return raw && isObjectId(raw) ? raw : undefined;
  }, [createdIdState, formId, idVal]);


  // Datos que usarán las plantillas cuando aún no hay _id en BD
  // Snapshot ligero de campos para plantillas, sólo cuando el panel está abierto
  const [tokensSnapshot, setTokensSnapshot] = useState<Record<string, any>>({});
  const tokensTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // REMOVED: providersAssignments prefill useEffect - now handled by AppointmentProvider collection

  useEffect(() => {
    if (!messagingOpen) return;
    const sub = watch((vals) => {
      if (tokensTimerRef.current) clearTimeout(tokensTimerRef.current);
      tokensTimerRef.current = setTimeout(() => {
        setTokensSnapshot({
          nameInput: (vals as any)?.nameInput ?? "",
          lastNameInput: (vals as any)?.lastNameInput ?? "",
          phoneInput: (vals as any)?.phoneInput ?? "",
          emailInput: (vals as any)?.emailInput ?? "",
          note: (vals as any)?.note ?? "",
          contactPreference: (vals as any)?.contactPreference ?? "sms",
          treatment: (vals as any)?.treatment,
          priority: (vals as any)?.priority,
          providers: (vals as any)?.providers ?? [],
          representative: (vals as any)?.representative ?? undefined,
        });
      }, 150);
    });
    return () => {
      sub.unsubscribe();
      if (tokensTimerRef.current) clearTimeout(tokensTimerRef.current);
    };
  }, [messagingOpen, watch]);

  const dataForTokens = useMemo(() => {
    if (!messagingOpen) return {} as Record<string, any>;
    const selectedAppDatesForTokens = selectedAppDates?.map((d) => ({
      startDate: d.startDate,
      endDate: d.endDate,
    })) ?? [];
    return {
      ...tokensSnapshot,
      selectedAppDates: selectedAppDatesForTokens,
      timezone: "Australia/Sydney",
    } as Record<string, any>;
  }, [messagingOpen, tokensSnapshot, selectedAppDates]);

  const templateKey = useMemo(
    () => validPatientIdForTemplates ?? "__NEW__",
    [validPatientIdForTemplates]
  );
  const handleSelectTemplate = useCallback((tpl: any) => {
    if (typeof tpl === "string") {
      setSelectedTemplate({ raw: tpl });
    } else if (tpl && typeof tpl === "object") {
      setSelectedTemplate({ id: tpl.id, raw: tpl.raw });
    }
  }, []);

  const tooltipForThis =
    selectedTemplate?.raw ??
    templateTextByPatient[templateKey] ??
    "";

  const iconColorForThis =
    (selectedTemplate?.raw || templateTextByPatient[templateKey])
      ? "green.500"
      : "red.500";

  const showTemplatesButtonNode = useMemo(() => {
    const commonProps = {
      category: "confirmation" as const,
      onSelectTemplate: handleSelectTemplate,
      tooltipText: tooltipForThis,
      colorIcon: iconColorForThis,
    };

    return (
      <>
        {/**
       * Templates: usamos ShowTemplateButtonWithData con getDataForTokens
       * para leer valores frescos del formulario justo antes de abrir.
       * Esto evita suscripciones globales (watch all) y previene lag en los inputs,
       * además de que los tokens (name/lastName/fechas) se apliquen al primer intento.
       */}
        <ShowTemplateButtonWithData
        {...commonProps}
        dataForTokens={dataForTokens}
        getDataForTokens={() => {
          const vals = getValues();
          const selectedAppDatesForTokens = selectedAppDates?.map((d) => ({
            startDate: d.startDate,
            endDate: d.endDate,
          })) ?? [];
          return {
            nameInput: (vals as any)?.nameInput ?? "",
            lastNameInput: (vals as any)?.lastNameInput ?? "",
            phoneInput: (vals as any)?.phoneInput ?? "",
            emailInput: (vals as any)?.emailInput ?? "",
            note: (vals as any)?.note ?? "",
            contactPreference: (vals as any)?.contactPreference ?? "sms",
            treatment: (vals as any)?.treatment,
            priority: (vals as any)?.priority,
            providers: (vals as any)?.providers ?? [],
            representative: (vals as any)?.representative ?? undefined,
            selectedAppDates: selectedAppDatesForTokens,
            timezone: SYD_TZ,
          } as Record<string, any>;
        }}
      />
      </>
    );
  }, [
    validPatientIdForTemplates,
    handleSelectTemplate,
    tooltipForThis,
    iconColorForThis,
    dataForTokens,
  ]);


  const selectedTreatmentId = ((): string | undefined => {
    const v = getValues("treatment") as unknown as string | undefined;
    return v;
  })();

  // Multi-window suggestion support was moved into the ProviderPerDate component

  // REMOVED: providersAssignments sync - now handled by AppointmentProvider collection

  // ⚡ OPTIMIZACIÓN: Observar providers una sola vez para suggested list (we'll filter client-side by availability across all windows)
  // const currentProviderIds = watch("providers"); // unused after refactor

  /* —— submit helpers —— */
  const sanitize = (data: any) => {
    const repApp = (data?.representative?.appointment ?? "").trim();

    if (isAlreadyRepresentative) {
      const cleanedNoRep: any = {
        ...data,
        nameInput: DOMPurify.sanitize(data.nameInput, { ALLOWED_TAGS: [] }),
        lastNameInput: DOMPurify.sanitize(data.lastNameInput, { ALLOWED_TAGS: [] }),
        phoneInput: DOMPurify.sanitize(data.phoneInput || "", { ALLOWED_TAGS: [] }),
        emailInput: DOMPurify.sanitize(data.emailInput || "", { ALLOWED_TAGS: [] }),
        priority:
          "priority" in data
            ? DOMPurify.sanitize(data.priority || "", { ALLOWED_TAGS: [] })
            : undefined,
        note:
          "note" in data
            ? DOMPurify.sanitize(data.note || "", { ALLOWED_TAGS: [] })
            : undefined,
        _id: data._id
          ? DOMPurify.sanitize(data._id, { ALLOWED_TAGS: [] })
          : undefined,
      };
      delete cleanedNoRep.representative;
      return cleanedNoRep;
    }

    const repObj =
      (isChild || !!repApp) && repApp
        ? {
          appointment: repApp,
          relationship: data?.representative?.relationship || "parent",
          verified: !!data?.representative?.verified,
          verifiedAt: data?.representative?.verifiedAt || undefined,
          verifiedBy: (data?.representative?.verifiedBy || "").trim(),
          consentAt: undefined,
          notes: DOMPurify.sanitize(data?.representative?.notes || "", {
            ALLOWED_TAGS: [],
          }),
        }
        : undefined;

    const cleaned: any = {
      ...data,
      nameInput: DOMPurify.sanitize(data.nameInput, { ALLOWED_TAGS: [] }),
      lastNameInput: DOMPurify.sanitize(data.lastNameInput, { ALLOWED_TAGS: [] }),
      phoneInput: DOMPurify.sanitize(data.phoneInput || "", { ALLOWED_TAGS: [] }),
      emailInput: DOMPurify.sanitize(data.emailInput || "", { ALLOWED_TAGS: [] }),
      priority:
        "priority" in data
          ? DOMPurify.sanitize(data.priority || "", { ALLOWED_TAGS: [] })
          : undefined,
      note:
        "note" in data
          ? DOMPurify.sanitize(data.note || "", { ALLOWED_TAGS: [] })
          : undefined,
      _id: data._id
        ? DOMPurify.sanitize(data._id, { ALLOWED_TAGS: [] })
        : undefined,
    };

    // Ensure selectedAppDates status handling
        const statusNoContacted:ContactStatus= "NoContacted";
    // Ensure selectedAppDates status handling
    if (Array.isArray(data?.selectedAppDates)) {
      // In CREATION mode, force status to Confirmed for each entry
      const forceConfirmed = mode === "CREATION";
      cleaned.selectedAppDates = (data.selectedAppDates as any[]).map((it) => {
        const next: any = { ...it };
        if (forceConfirmed) next.status =statusNoContacted ;
        return next;
      });
    }

    if (repObj) {
      cleaned.representative = repObj;
      // Business rule: a child/dependent MUST NOT have their own phone in Appointment
      // Ensure no phone fields are persisted when represented by another
      delete cleaned.phoneInput;
      delete cleaned.phoneE164; // in case present from previous data
    } else {
      delete cleaned.representative;
    }

    // REMOVED: providersAssignments - now handled by AppointmentProvider collection
    return cleaned;
  };

  // 🔔 flujo de notificaciones: SOLO recordatorio
  const scheduledKeysRef = useRef<Set<string>>(new Set());
  const sendNotificationsFlow = useCallback(
    async (appointmentId: string) => {
      try {
        if (!reminderEnabled) return;

        const msgRaw = selectedTemplate?.raw?.trim() ?? "";
        if (!msgRaw) {
          toast({
            title: "Select a message template",
            description: "Choose a template before scheduling the reminder.",
            status: "warning",
            duration: 3000,
            isClosable: true,
          });
          return;
        }

        const chosenLocal = selectedReminder;
        if (!chosenLocal) {
          toast({ title: "Select appointment and reminder", status: "warning", duration: 2500 });
          return;
        }

        const v = validateTwilioWindowStrict(chosenLocal);
        if (!v.ok) {
          toast({
            title: v.error === "tooSoon" ? "Too close to now" :
              v.error === "tooFar" ? "Too far in the future" : "Invalid date",
            description: "Twilio requiere ≥ 15 min y ≤ 35 días.",
            status: v.error === "invalid" ? "warning" : "info",
            duration: 3500, isClosable: true,
          });
          return;
        }

        const isoUtc = chosenLocal.toDate().toISOString();
        const check = enforceTwilioWindow(chosenLocal);

        const key = `${appointmentId}|${isoUtc}`;
        if (scheduledKeysRef.current.has(key)) {
          console.warn("Duplicate schedule suppressed:", key);
          return;
        }
        scheduledKeysRef.current.add(key);

        if (!check?.ok) {
          toast({
            title: check?.error === "tooFar" ? "Reminder not scheduled" : "Invalid reminder time",
            description:
              check?.error === "tooFar"
                ? "Twilio solo permite programar hasta 35 días hacia adelante. Elige una fecha más cercana."
                : "Elige una fecha y hora válidas para el recordatorio.",
            status: check?.error === "tooFar" ? "info" : "warning",
            duration: 4000,
            isClosable: true,
          });
          return;
        }

        await sendSMSAsync({
          appointmentId,
          msg: msgRaw,
          scheduleWithTwilio: true,
          whenISO: isoUtc,
          tz: SYD_TZ,
        });

        toast({
          title: "Reminder scheduled",
          description: `Programado para ${fmtHuman(chosenLocal)} (${SYD_TZ}).`,
          status: "success",
          duration: 3000,
          isClosable: true,
        });
      } catch (e: any) {
        console.error("Error en sendNotificationsFlow:", e);
      }
    },
    [selectedTemplate, reminderEnabled, selectedReminder, sendSMSAsync, toast]
  );

  // Hard reset of UI and local states + scroll to top
  const hardResetUI = useCallback(() => {
    try {
      reset();
      setSelectedAppDates([]);
      setSelectedDays({});
      setIsChild(false);
      setRepQuery("");
      setPendingProviderAssignments([]);
      setReminderEnabled(true);
      setReminderOffsetH(1);
      setSelectedTemplate(null);
      setMessagingOpen(false);
      setDuration(0);
      setColor("");
      setSelected(-1);
      setTreatment(undefined);
      setIsAnAppointment(!onlyPatient);
      scheduledKeysRef.current = new Set();
      setTokensSnapshot({});
      setResetKey((k) => k + 1); // force remount of subcomponents tied to this key
    } catch {}
    // Scroll to initial view
    try {
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
      }
      if (topRef.current && typeof topRef.current.scrollIntoView === 'function') {
        topRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch {}
  }, [onlyPatient, reset]);

  const extractCreatedId = (resp: any) =>
    normalizeId(resp?.document?._id) ??
    normalizeId(resp?.document?.id) ??
    normalizeId(resp?.insertedId) ??
    normalizeId(resp?._id) ??
    normalizeId(resp?.id) ??
    normalizeId(resp?.result?.insertedId);

  // Function to create provider assignments after appointment creation
  const createPendingProviderAssignments = useCallback(async (appointmentId: string, selectedAppDates: any[]) => {
    if (!pendingProviderAssignments.length) return;

    try {
      console.log('Creating provider assignments:', { 
        appointmentId, 
        pendingProviderAssignments, 
        selectedAppDates: selectedAppDates.map((slot, idx) => ({ 
          index: idx, 
          _id: slot._id, 
          slotId: slot.slotId, 
          startDate: slot.startDate, 
          endDate: slot.endDate 
        }))
      });

      // Create assignments for each pending assignment
      const promises = pendingProviderAssignments.map(async (assignment) => {
        const slotData = selectedAppDates[assignment.slotIndex];
        if (!slotData) return;

        // Use the actual slot data's ID if it exists and is a valid ObjectId
        const slotId = slotData._id || slotData.slotId;

        const assignmentData: CreateAppointmentProviderData = {
          appointment: appointmentId,
          provider: assignment.providerId,
          startDate: assignment.startDate,
          endDate: assignment.endDate,
        };

        // Only include slotId if it's a valid ObjectId format (24 hex characters)
        if (slotId && /^[0-9a-fA-F]{24}$/.test(String(slotId))) {
          assignmentData.slotId = String(slotId);
        }
        // If no valid slotId, let the server generate one or handle it appropriately

        return createProviderAssignment(assignmentData);
      });

      await Promise.all(promises.filter(Boolean));

      toast({
        title: "Provider assignments created",
        description: `Successfully assigned ${pendingProviderAssignments.length} provider(s)`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });

      // Clear pending assignments after successful creation
      setPendingProviderAssignments([]);
    } catch (error) {
      console.error('Error creating provider assignments:', error);
      toast({
        title: "Error creating provider assignments",
        description: "Some provider assignments may not have been saved correctly.",
        status: "warning",
        duration: 4000,
        isClosable: true,
      });
    }
  }, [pendingProviderAssignments, createProviderAssignment, toast]);

  /* —— submit —— */
  const onSubmit = (data: AppointmentForm | ContactForm) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setUiBusy(true);

    const finish = () => {
      inFlightRef.current = false;
      setUiBusy(false);
    };

    const cleanedData: any = sanitize(data);

    if (mode === "CREATION") {
      (async () => {
        try {
          const resp = await mutateAsync(cleanedData);
          const createdId = extractCreatedId(resp);
          if (createdId) {
            setCreatedIdState(createdId);
            setValue("id", createdId, { shouldDirty: false, shouldTouch: false });
          }

          toast({
            title: "Patient successfully submitted.",
            description: isChild
              ? "Child/dependent has been registered and linked to their representative."
              : "Your new contact has been submitted successfully",
            status: "success",
            duration: 3000,
            isClosable: true,
          });

          if (isAnAppointment && createdId) {
            // Create provider assignments before sending notifications
            await createPendingProviderAssignments(createdId, cleanedData.selectedAppDates || []);
            
            await sendNotificationsFlow(createdId);
          }

          // reset UI de reminder
          hardResetUI();

          // Ensure in-flight appointment-related queries are stopped before invalidation/refetch
          await cancelAppointmentDependentQueries();
          await queryClient.refetchQueries({ queryKey: ["DraggableCards"] });
          queryClient.invalidateQueries({ queryKey: ["DraggableCards"] });
          queryClient.invalidateQueries({ queryKey: ["Appointment"] });
          queryClient.invalidateQueries({ queryKey: ["conversations"] });
        } catch (error: any) {
          const status = error?.status ?? error?.response?.status;
          if (status === 409) {
            const data = error?.data || error?.response?.data || {};
            const field = data.field || (data.keyValue && Object.keys(data.keyValue)[0]) || "unknown";
            const value = data.value || (data.keyValue && Object.values(data.keyValue)[0]) || "";
            if (field === "phoneInput" || field === "phoneE164") {
              setError("phoneInput" as any, {
                type: "manual",
                message: `Duplicate ${field}: ${value}`,
              });
            }
            toast({
              title: "Duplicate record",
              description:
                data.reason || data.message || `Duplicate ${field}${value ? `: ${value}` : ''}.` ,
              status: "error",
              duration: 6000,
              isClosable: true,
            });
          } else {
            toast({
              title: "Error submitting the form.",
              description:
                error?.response?.data?.message || "An unexpected error occurred.",
              status: "error",
              duration: 4000,
              isClosable: true,
            });
          }
        } finally {
          finish();
        }
      })();

      return;
    } else if (mode === "EDITION") {
      const payload = [
        {
          table: "Appointment",
          id_field: "_id",
          id_value: (data as any)?.id ?? idVal ?? "",
          data: cleanedData,
        },
      ];

      editItem(payload, {
        onSuccess: async () => {
          if (refetch_list) refetch_list();
          if (rfetchPl) rfetchPl();
          if (onClose_1) onClose_1();
          await cancelAppointmentDependentQueries();
          if (refetchPage) refetchPage();
          queryClient.refetchQueries({ queryKey: ["DraggableCards"] });
          queryClient.invalidateQueries({ queryKey: ["DraggableCards"] });
          queryClient.invalidateQueries({ queryKey: ["Appointment"] });
          queryClient.invalidateQueries({ queryKey: ["conversations"] });
          if (conversationId) {
            await queryClient.refetchQueries({
              predicate: (q) =>
                Array.isArray(q.queryKey) &&
                q.queryKey[0] === "messages" &&
                q.queryKey[1] === conversationId,
              type: "active",
            });
          }

          const targetId =
            normalizeId((getValues("id") as any)) || normalizeId(idVal);
          if (isAnAppointment && targetId) {
            try {
              await sendNotificationsFlow(targetId);
            } catch {
              toast({
                title: "Notification error",
                description: "We couldn't schedule the reminder.",
                status: "error",
                duration: 3000,
                isClosable: true,
              });
            }
          }

          // Ensure UI fully resets and scroll returns to top after an edit
          hardResetUI();
        },
        onError: () => {
          toast({
            title: "Update error",
            description: "An unexpected error occurred.",
            status: "error",
            duration: 3000,
            isClosable: true,
          });
        },
        onSettled: () => {
          finish();
        },
      });
    }
  };
  const onError = () => setHasSubmitted(true);

  // Removed legacy inline provider chips/tag rendering (moved to ProviderPerDate)

  /* =================== UI =================== */
  return (
    <Box
      ref={topRef}
      as="form"
      noValidate
      autoComplete="on"
      aria-busy={formBusy}
      fontSize="xs"
      borderWidth="1px"
      rounded="lg"
      shadow="1px 1px 3px rgba(0,0,0,0.3)"
      maxWidth={1000}
      px={6}
      pb={6}
      m="10px auto"
      onSubmit={handleSubmit(onSubmit, onError)}
    >
      {/* Toggle (sin Tooltip para evitar loops de ref) */}
      <Box position="relative" p={4}>
        {typeButonVisible && (
          <IconButton
            type="button"
            position="absolute"
            top="1"
            right="1"
            zIndex="10"
            onClick={onToggle}
            aria-label="Toggle appointment section"
            aria-pressed={isAnAppointment}
            icon={
              isAnAppointment ? (
                <MdEventBusy size={20} />
              ) : (
                <MdEventNote size={20} />
              )
            }
            bgGradient="linear(to-r, teal.400, blue.500)"
            color="white"
            rounded="full"
            boxSize="42px"
            shadow="md"
            mt={4}
            transition="all 0.25s ease"
            _hover={{
              bgGradient: "linear(to-r, teal.500, blue.600)",
              transform: "scale(1.08)",
              shadow: "lg",
            }}
            _active={{ transform: "scale(0.95)", shadow: "sm" }}
            isDisabled={formBusy}
          />
        )}
      </Box>

      <CustomHeading fontSize="md">
        {isAnAppointment ? "New Appointment" : "New Contact"}
      </CustomHeading>

      {/* Identity */}
      <Flex gap={3}>
        <CustomInputN
          isPending={formBusy}
          type="text"
          name="nameInput"
          placeholder="Name"
          register={register}
          error={asFieldError(errors?.nameInput)}
          ico={<LuUserPen color="gray.300" />}
          autoComplete="given-name"
          spellCheck={false}
          style={{ textTransform: "capitalize" }}
        />
        <CustomInputN
          isPending={formBusy}
          type="text"
          name="lastNameInput"
          placeholder="Last Name"
          register={register}
          error={asFieldError(errors?.lastNameInput)}
          ico={<LuUserPen color="gray.300" />}
          autoComplete="family-name"
          spellCheck={false}
          style={{ textTransform: "capitalize" }}
        />
      </Flex>

      {/* Representative (Child/Dependent) */}
      {isAnAppointment ? (
        <Box mt={3} borderWidth="1px" borderRadius="md" p={3}>
          {isAlreadyRepresentative ? (
            <Alert status="warning" borderRadius="md">
              <AlertIcon />
              This patient is already a representative of at least one dependent and cannot be represented by someone else.
            </Alert>
          ) : (
            <>
              <HStack justify="space-between" align="start">
                <Text fontWeight="semibold">Is this a child/dependent?</Text>
                <Switch
                  isChecked={isChild}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsChild(checked);
                    if (!checked) {
                      setValue("representative.appointment" as any, "", {
                        shouldDirty: true,
                      });
                      setRepQuery("");
                      trigger("representative");
                    } else {
                      // If marking as child/dependent, ensure no phone number is set for the child
                      setValue("phoneInput" as any, "", { shouldDirty: true });
                      clearErrors("phoneInput" as any);
                    }
                  }}
                  colorScheme="teal"
                  isDisabled={formBusy}
                />
              </HStack>

              <Collapse in={isChild} animateOpacity>
                <SimpleGrid columns={1} spacing={3} mt={3}>
                  <FormControl>
                    <FormLabel>Search representative (name, email or phone)</FormLabel>
                    <InputGroup>
                      <InputLeftElement pointerEvents="none">
                        <FiSearch />
                      </InputLeftElement>
                      <input
                        style={{
                          border: "1px solid var(--chakra-colors-gray-200)",
                          borderRadius: 6,
                          padding: "8px 12px 8px 36px",
                          fontSize: "0.875rem",
                        }}
                        placeholder="Type at least 2 characters…"
                        value={repQuery}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRepQuery(val);
                          if (isObjectId(val)) {
                            setValue("representative.appointment" as any, val.trim(), {
                              shouldDirty: true,
                            });
                            trigger("representative");
                          }
                        }}
                        disabled={formBusy}
                      />
                    </InputGroup>
                  </FormControl>

                  {/* Selected representative summary */}
                  {selectedRepId ? (
                    <Alert status="success" borderRadius="md">
                      <AlertIcon />
                      <Text>Selected representative:</Text>
                      <Text mx={2} fontWeight={"bold"}>{` ${fullName} (${Relationship})`}</Text>
                      <Button
                        size="xs"
                        ml={3}
                        variant="ghost"
                        type="button"
                        onClick={() => {
                          setValue("representative.appointment" as any, "", {
                            shouldDirty: true,
                          });
                          setRepQuery("");
                          trigger("representative");
                        }}
                      >
                        Clear
                      </Button>
                    </Alert>
                  ) : (
                    <Alert status="info" borderRadius="md">
                      <AlertIcon />
                      Messages will be routed to the representative if the child has no phone.
                    </Alert>
                  )}

                  {/* Results */}
                  <Box
                    borderWidth="1px"
                    borderRadius="md"
                    maxH="220px"
                    overflowY="auto"
                    px={1}
                    py={1}
                  >
                    {repLoading ? (
                      <Skeleton height="28px" borderRadius="md" />
                    ) : repHits.length === 0 ? (
                      <Box p={3} color="gray.500">
                        {repQ && repQ.length >= 2 ? "No matches." : "Start typing to search…"}
                      </Box>
                    ) : (
                      repHits.map((h) => (
                        <RepRow
                          key={hitKey(h)}
                          h={h}
                          q={repQ}
                          onPick={handlePickRepresentative}
                        />
                      ))
                    )}
                  </Box>

                  {/* Relationship */}
                  <FormControl
                    isDisabled={!isChild}
                    isInvalid={!!(errors as any)?.representative?.relationship}
                  >
                    <FormLabel>Relationship</FormLabel>
                    <Controller
                      name={"representative.relationship" as any}
                      control={control}
                      render={({ field }) => (
                        <Select {...field} placeholder="Select relationship" size="sm">
                          <option value="parent">Parent</option>
                          <option value="legal_guardian">Legal guardian</option>
                          <option value="grandparent">Grandparent</option>
                          <option value="sibling">Sibling</option>
                          <option value="carer">Carer</option>
                          <option value="other">Other</option>
                        </Select>
                      )}
                    />
                    <FormErrorMessage>
                      <FormErrorIcon mr="1" />
                      {errMsg((errors as any)?.representative?.relationship)}
                    </FormErrorMessage>
                  </FormControl>
                </SimpleGrid>
              </Collapse>
            </>
          )}
        </Box>
      ) : null}

      {/* Contact */}
      <Flex gap={3} mt={3}>
        <Controller
          name="phoneInput"
          control={control}
          render={({ field }) => (
            <FormControl mt={3} isInvalid={!!errors?.phoneInput}>
              <PhoneInput
                {...field}
                isReadOnly={phoneFieldReadOnly}
                isDisabled={!!selectedRepId}
                onChange={(val) => field.onChange(val)}
                type="tel"
                isPending={formBusy}
                name="phoneInput"
                error={asFieldError(errors?.phoneInput)}
                ico={<FiPhone color="gray.300" />}
                placeholder={
                  !!selectedRepId ? "Child uses representative's phone" : "04XX XXX XXX"
                }
                anotherName="Phone Number"
                autoComplete="tel-national"
                inputMode="tel"
              />
              <FormErrorMessage>
                <FormErrorIcon mr="1" />
                {errMsg(errors?.phoneInput)}
              </FormErrorMessage>
            </FormControl>
          )}
        />

        <FormControl
          mt={3}
          isInvalid={!!(errors as FieldErrors<AppointmentForm>).contactPreference}
        >
          <FormLabel textAlign={"center"}>Contact preference</FormLabel>
          <Controller
            name="contactPreference"
            control={control}
            render={({ field }) => (
              <RadioGroup value={field.value} onChange={field.onChange}>
                <HStack spacing={6} w={"-webkit-fit-content"} mx="auto">
                  <ChakraRadio value="call">Call</ChakraRadio>
                  <ChakraRadio value="sms">SMS</ChakraRadio>
                </HStack>
              </RadioGroup>
            )}
          />
          <FormErrorMessage>
            <FormErrorIcon mr="1" />
            {errMsg((errors as FieldErrors<AppointmentForm>).contactPreference)}
          </FormErrorMessage>
        </FormControl>

        <CustomInputN
          isPending={formBusy}
          name="emailInput"
          type="email"
          placeholder="Email"
          register={register}
          error={asFieldError(errors?.emailInput)}
          ico={<MdAlternateEmail color="gray.300" />}
          autoComplete="email"
          spellCheck={false}
          isDisabled={isChild || !!selectedRepId}
        />
      </Flex>

      {/* Appointment-only */}
      <Collapse in={isAnAppointment} animateOpacity>
        <Divider my={5} />

        {/* Priority */}
        <FormControl
          mt="2%"
          isInvalid={!!(appointmentErrors && appointmentErrors.priority)}
        >
          <FormLabel>Priority Level</FormLabel>
          <Controller
            name="priority"
            control={control}
            render={({ field }) => (
              <Box role="group" aria-label="Priority level selector" p={1}>
                <CustomButtonGroup
                  selected={selected}
                  setSelected={setSelected}
                  isPending={formBusy}
                  error={asFieldError(appointmentErrors?.priority)}
                  value={(field.value as string) || ""}
                  onChange={(id, _name, colorSel, durationSel) => {
                    setIdpriority(id);
                    field.onChange(id);
                    setDuration(durationSel ? durationSel : 0);
                    setColor(colorSel ? colorSel : "gray");
                    trigger("priority");
                  }}
                />
              </Box>
            )}
          />
        </FormControl>

        <Divider my={5} />

        {/* Treatment */}
        <FormControl
          mt="2%"
          isInvalid={!!(appointmentErrors && appointmentErrors.treatment)}
        >
          <FormLabel>Treatment Type</FormLabel>
          <Controller
            name="treatment"
            control={control}
            render={({ field }) => (
              <Box role="group" aria-label="Treatment selector">
                <TreatmentSelector
                  onSelect={(t) => setTreatment(t)}
                  selectedId={field.value}
                  selected={selectedTreatment}
                  {...field}
                  onChange={(id, _val, _c, _d) => {
                    setIdpriority(id);
                    field.onChange(id);
                    trigger("treatment");
                  }}
                />
              </Box>
            )}
          />
        </FormControl>

        <Divider my={5} />

        {/* Appointment Date */}
        <SimpleGrid columns={2} spacing={4} my={2}>
          <Box pt={1}>
            <CustomTextArea
              isPending={formBusy}
              resize="none"
              name={"note"}
              pb={5}
              px={5}
              placeholder="Note for this appointment"
              register={register}
              error={asFieldError((appointmentErrors as any)?.note)}
              spellCheck
              autoComplete="off"
            />
          </Box>

          <Box p={1}>
            <Controller
              name="selectedAppDates"
              control={control}
              render={({ field }) => (
                <FormControl isInvalid={!!appointmentErrors?.selectedAppDates}>
                  <FormLabel>
                    Appointment Date
                    <Tag ml={2} size="sm" colorScheme="gray" variant="subtle">
                      {((field.value as any[]) || []).length || 0}/10
                    </Tag>
                  </FormLabel>
                  <Flex wrap="wrap" gap={2}>
                    {((field.value as any[]) || [])?.map((item: DateRange & { status?: string }, index: number) => {
                      const start = dayjs.utc(item.startDate).tz(SYD_TZ);
                      const end = dayjs.utc(item.endDate).tz(SYD_TZ);
                      const sameDay = start.format("YYYY-MM-DD") === end.format("YYYY-MM-DD");
                      const display = sameDay
                        ? `${start.format("ddd, DD MMM • h:mm A")} – ${end.format("h:mm A")}`
                        : `${start.format("ddd, DD MMM • h:mm A")} → ${end.format("ddd, DD MMM • h:mm A")}`;
                      const full = sameDay
                        ? `${start.format("ddd, DD MMM YYYY • h:mm A")} – ${end.format("h:mm A")}`
                        : `${start.format("ddd, DD MMM YYYY • h:mm A")} → ${end.format("ddd, DD MMM YYYY • h:mm A")}`;
                      
                      // En modo CREATION, usar fondo azul y no mostrar status
                      const statusRaw = mode === "CREATION" ? "new" : String(item.status || '').toLowerCase();
                      const colorScheme = SLOT_STATUS_COLOR[statusRaw] || (mode === "CREATION" ? 'blue' : 'gray');
                      const statusLabel = mode === "CREATION" ? "" : (item.status || 'Unknown');
                      
                      return (
                        <Tooltip key={`${start.toISOString()}-${index}`} label={full} hasArrow>
                          <Tag size="sm" colorScheme={colorScheme} borderRadius="md" maxW="260px" display="flex" alignItems="center" gap={1}>
                            <TagLabel isTruncated>{display}</TagLabel>
                            {statusLabel && (
                              <Box as="span" fontSize="0.65rem" opacity={0.85}>{statusLabel}</Box>
                            )}
                          </Tag>
                        </Tooltip>
                      );
                    })}
                  </Flex>
                  <FormErrorMessage>
                    <FormErrorIcon mr="1" />
                    {errMsg(appointmentErrors?.selectedAppDates)}
                  </FormErrorMessage>
                </FormControl>
              )}
            />

            <FormControl pt={4}>
              {mode === "EDITION" ? (
                <Alert status="info" rounded="10px" mt={2}>
                  <AlertIcon />
                  Appointment date is read-only in edit mode.
                </Alert>
              ) : selected > 0 ? (
                <>
                  {(() => {
                    const values = (getValues("selectedAppDates") as any[]) || [];
                    // In creation mode count all selected slots; in edit mode selectedAppDates is read-only (already confirmed)
                    const count = values.length;
                    const atLimit = count >= 10;
                    return (
                      <Tooltip
                        isDisabled={!atLimit}
                        label={atLimit ? "You can add up to 10 appointment slots" : ""}
                        hasArrow
                      >
                        <Button
                          type="button"
                          onClick={onOpenApp}
                          isDisabled={formBusy || atLimit}
                        >
                          Add Appointment ({count}/10)
                        </Button>
                      </Tooltip>
                    );
                  })()}
                  <Modal
                    isOpen={isOpenApp}
                    onClose={onCloseApp}
                    size={"6xl"}
                    isCentered
                    motionPreset="scale"
                  >
                    <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(8px)" />
                    <ModalContent borderRadius="2xl" p={4} boxShadow="2xl">
                      <ModalHeader fontSize="2xl" fontWeight="bold">
                        Add Appointment
                      </ModalHeader>
                      <ModalCloseButton />
                      <ModalBody p={0}>
                        <CustomCalendarEntryForm
                          colorEvent={color}
                          height="50vh"
                          offset={duration}
                          selectedAppDates={selectedAppDates}
                          setSelectedAppDates={setSelectedAppDates}
                          trigger={trigger as any}
                          setValue={setValue}
                          onClose={onCloseApp}
                        />
                      </ModalBody>
                      <ModalFooter>
                        <Button
                          onClick={onCloseApp}
                          variant="ghost"
                          colorScheme="gray"
                          isDisabled={formBusy}
                          type="button"
                        >
                          Cancel
                        </Button>
                      </ModalFooter>
                    </ModalContent>
                  </Modal>
                </>
              ) : (
                <Alert status="warning" rounded={"10px"}>
                  <AlertIcon />
                  You must select a category
                </Alert>
              )}
            </FormControl>
          </Box>
        </SimpleGrid>

        {/* Per-date Provider Assignment */}
        <ProviderPerDate
          key={`provider-per-date-${resetKey}`}
          mode={mode}
          tz={SYD_TZ}
          selectedAppDates={selectedAppDates}
          allProviders={allProviders as any}
          selectedTreatmentId={selectedTreatmentId}
          appointmentId={(getValues("id") as any) || (idVal as any)}
          onPendingAssignmentsChange={handlePendingAssignmentsChange}
        />

        {/* Reminder Section */}
        <Box mt={4} p={3} borderWidth="1px" borderRadius="md" bg="blackAlpha.50">
          <HStack justify="space-between" align="center">
            <Button
              type="button"
              onClick={() => setMessagingOpen((o) => !o)}
              variant="ghost"
              size="sm"
              leftIcon={<MdScheduleSend />}
              rightIcon={messagingOpen ? <MdExpandLess /> : <MdExpandMore />}
              fontWeight="semibold"
              isDisabled={!selectedAppDates?.length}
            >
              Reminder
            </Button>

            {selectedAppDates?.length ? (
              <HStack spacing={2}>
                {showTemplatesButtonNode}
                <CreateMessageModal
                  patientId={validPatientIdForTemplates as any}
                  triggerButton={createTemplateTrigger}
                />
              </HStack>
            ) : (
              <Text fontSize="xs" color="gray.500">
                Select an appointment date first
              </Text>
            )}
          </HStack>

          <Collapse in={messagingOpen && !!selectedAppDates?.length} animateOpacity>
            <Divider my={3} />

            {/* Alerta si es dependiente sin teléfono */}
            {isChild && selectedRepId && !getValues("phoneInput") && (
              <Alert status="info" borderRadius="md" mb={3}>
                <AlertIcon />
                <Box>
                  <Text fontSize="sm" fontWeight="semibold">
                    Messages will be sent to the representative
                  </Text>
                  <Text fontSize="xs" color="gray.600">
                    This child has no phone number. All reminders and messages will be sent to their representative's phone.
                  </Text>
                </Box>
              </Alert>
            )}

            <VStack align="stretch" spacing={3}>
              {/* Reminder toggle */}
              <HStack justify="space-between" align="center">
                <HStack>
                  <MdScheduleSend />
                  <Text fontWeight="semibold">Reminder</Text>
                </HStack>
                <Switch
                  isChecked={reminderEnabled}
                  onChange={(e) => setReminderEnabled(e.target.checked)}
                  colorScheme="teal"
                />
              </HStack>

              <Collapse in={reminderEnabled} animateOpacity>
                <SimpleGrid columns={[1, 2]} spacing={3}>
                  <FormControl>
                    <FormLabel fontSize="xs">Send (hours before)</FormLabel>
                    <HStack wrap="wrap" spacing={2}>
                      {REMINDER_OPTIONS.map((h) => (
                        <Button
                          key={h}
                          size="sm"
                          variant={reminderOffsetH === h ? "solid" : "outline"}
                          onClick={() => setReminderOffsetH(h)}
                          isDisabled={disabledByOffset.get(h)}
                        >
                          {h}h before
                        </Button>
                      ))}
                    </HStack>
                  </FormControl>

                  <Box>
                    <Text fontSize="xs" color="gray.600" mt={[2, 7]}>
                      The reminder will be scheduled {reminderOffsetH ?? "—"}h before the
                      appointment start. Twilio allows scheduling up to 35 days ahead
                      and at least ~15 minutes from now. Disabled options don't meet
                      that window or there’s no appointment selected yet.
                    </Text>
                  </Box>
                </SimpleGrid>

                <Alert status="info" mt={3} borderRadius="md">
                  <AlertIcon />
                  <Box>
                    <Text fontSize="sm">
                      Selected send time:{" "}
                      <b>
                        {fmtHuman(selectedReminder)} ({SYD_TZ})
                      </b>
                    </Text>
                    {!selectedAppDates?.length && (
                      <Text fontSize="xs" color="gray.600">
                        Choose an appointment date to compute reminder times.
                      </Text>
                    )}
                  </Box>
                </Alert>
              </Collapse>
            </VStack>
          </Collapse>
        </Box>

        <Divider my={5} />

        {/* Providers (global, optional; auto-synced with per-date assignments) */}
        

        <Divider my={5} />

        {/* Disponibilidad preferida */}
        <SimpleGrid columns={1} spacing={4}>
          <Box p={1}>
            <FormControl
              isInvalid={hasSubmitted && !!appointmentErrors?.selectedDates}
            >
              <FormLabel>Availability</FormLabel>
              <Box display="flex" justifyContent="center" width="100%">
                <AvailabilityDates2
                  key={`availability-${resetKey}`}
                  modeInput={true}
                  selectedDaysResp={selectedDays}
                  setSelectedDaysResp={setSelectedDays}
                  hasSubmitted={hasSubmitted}
                  trigger={trigger}
                  setValue={setValue}
                  isPending={formBusy}
                />
              </Box>
              <FormErrorMessage>
                <FormErrorIcon mr="1" />
                {errMsg(appointmentErrors?.selectedDates)}
              </FormErrorMessage>
            </FormControl>
            <FormControl pt={4}></FormControl>
          </Box>
        </SimpleGrid>
      </Collapse>

      {mode === "EDITION" && reschedule && (
        <SimpleGrid columns={1} spacing={4} my={2}>
          <Box
            borderWidth="1px"
            rounded="lg"
            p={2}
            shadow="1px 1px 3px rgba(0,0,0,0.1)"
            py={2}
          >
            <CustomCheckbox
              name="reschedule"
              isPending={formBusy}
              anotherName="Rebooked"
              register={register}
              error={asFieldError((appointmentErrors as any)?.reschedule)}
            />
          </Box>
        </SimpleGrid>
      )}

      {/* Hidden id */}
      <CustomInputN
        type="hidden"
        name="id"
        register={register}
        error={asFieldError((appointmentErrors as any)?.id)}
      />

      <FormControl pt={4}>{children}</FormControl>

      <Flex justifyContent="flex-end" mt={6} gap={3}>
        <Button
          fontSize="xs"
          type="submit"
          colorScheme="red"
          isDisabled={formBusy}
          width="150px"
          aria-live="polite"
        >
          {formBusy ? <Spinner size="sm" /> : btnName}
        </Button>
      </Flex>
    </Box>
  );
}

/* ----------------- Subcomponentes ----------------- */

// Removed legacy ProviderFinderInline (replaced by ProviderPerDate component)

export default CustomEntryForm;
