// CustomEntryForm.tsx
import React, { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  RadioGroup,
  SimpleGrid,
  Spinner,
  Tooltip,
  useDisclosure,
  useToast,
  Tag,
  TagLabel,
  TagCloseButton,
  Input,
  InputGroup,
  InputLeftElement,
  Text,
  VStack,
  Kbd,
  Skeleton,
  Radio as ChakraRadio,
  Switch,
  Select,
  Badge,
  Avatar,
} from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { QueryObserverResult, RefetchOptions, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import he from "he";
import { SlotInfo } from "react-big-calendar";
import { Controller, FieldError, FieldErrors, useForm } from "react-hook-form";
import { FiPhone, FiSearch } from "react-icons/fi";
import { LuUserPen } from "react-icons/lu";
import { MdAlternateEmail, MdEventBusy, MdEventNote } from "react-icons/md";
import CustomButtonGroup from "../Form/CustomButtonGroup";
import CustomCheckbox from "../Form/CustomCheckbox";
import CustomTextArea from "../Form/CustomTextArea";
import { DateRange } from "./CustomBestApp";
import { Appointment, ContactPreference, Priority, Provider, Representative, SelectedDates, TimeBlock, Treatment, WeekDay } from "@/types";
import { useUpdateItems } from "@/Hooks/Query/useUpdateItems";
import AvailabilityDates2 from "./AvailabilityDates2";
import { useInsertToCollection } from "@/Hooks/Query/useInsertToCollection";
import { TreatmentSelector } from "../Treatments/TreatmentSelector";
import PhoneInput from "../Form/PhoneInput";
import { ContactForm, contactsSchema } from "@/schemas/ContactSchema";
import { appointmentsKey, appointmentsSearchKey } from "@/lib/queryKeys";
import { PageResp } from "@/Hooks/Query/useAppointmentsPaginated";
import { useProvidersList } from "@/Hooks/Query/useProviders";
import { useProviderAppointments, useProviderTimeOff } from "@/Hooks/Query/useProviderAppointments";
import { SuggestItem, useSuggestProviders } from "@/Hooks/Query/useSuggestProviders";
import CustomCalendarEntryForm from "../Scheduler/CustomCalendarEntryForm";
import type { Weekly } from "@/Hooks/Query/useProviders";
import { useProviderSchedule } from "@/Hooks/Query/useProviderSchedule";
import { useCheckPhoneUnique } from "@/Hooks/Query/useCheckPhoneUnique";
import { toE164AU } from "@/utils/phoneAU";

// 👇 hook genérico para colecciones
import { useGetCollection } from "@/Hooks/Query/useGetCollection";
import { formatAustralianMobile } from "@/Functions/formatAustralianMobile";

dayjs.extend(utc);
dayjs.extend(timezone);

const SYD_TZ = "Australia/Sydney";

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

/** ✅ Normaliza ids venidos como string, ObjectId, { _id }, { $oid }, etc. */
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
type DayKey = keyof Weekly;
const IDX_TO_DAYKEY: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const HHMMtoMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10) || 0);
  return h * 60 + m;
};
function splitRangeByLocalDays(fromTs: number, toTs: number, tz = SYD_TZ): Array<{ day: DayKey; startMin: number; endMin: number }> {
  if (toTs <= fromTs) return [];
  const out: Array<{ day: DayKey; startMin: number; endMin: number }> = [];

  let cursor = fromTs;
  const end = toTs;

  const endLocal = dayjs.utc(end).tz(tz);
  const endLocalYMD = endLocal.format("YYYY-MM-DD");

  while (cursor < end) {
    const cLocal = dayjs.utc(cursor).tz(tz);
    const dayKey = IDX_TO_DAYKEY[cLocal.day()] as DayKey;
    const startMin = cLocal.hour() * 60 + cLocal.minute();

    const endOfDayLocal = cLocal.endOf("day");
    const segmentEnd = Math.min(end, endOfDayLocal.valueOf() + 1);
    const sameDayAsEnd = cLocal.format("YYYY-MM-DD") === endLocalYMD;
    const endMin = sameDayAsEnd ? endLocal.hour() * 60 + endLocal.minute() : 24 * 60;

    out.push({ day: dayKey, startMin, endMin });

    const nextStartLocal = cLocal.add(1, "day").startOf("day");
    cursor = Math.max(segmentEnd, nextStartLocal.valueOf());
  }

  return out;
}
function fitsSchedule(weekly: Weekly, tz: string, fromTs: number, toTs: number) {
  const segs = splitRangeByLocalDays(fromTs, toTs, tz);
  if (!segs.length) return false;
  return segs.every((seg) => {
    const blocks = (weekly?.[seg.day] ?? []) as { start: string; end: string }[];
    return blocks.some((b) => HHMMtoMin(b.start) <= seg.startMin && HHMMtoMin(b.end) >= seg.endMin);
  });
}
function partialSchedule(weekly: Weekly, tz: string, fromTs: number, toTs: number) {
  const segs = splitRangeByLocalDays(fromTs, toTs, tz);
  return segs.some((seg) => {
    const blocks = (weekly?.[seg.day] ?? []) as { start: string; end: string }[];
    return blocks.some((b) => {
      const bs = HHMMtoMin(b.start);
      const be = HHMMtoMin(b.end);
      return Math.max(0, Math.min(be, seg.endMin) - Math.max(bs, seg.startMin)) > 0;
    });
  });
}
function overlaps(a0: number, a1: number, b0: number, b1: number) {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0)) > 0;
}
function appointmentRanges(a: any): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  if (Array.isArray(a?.selectedAppDates)) {
    for (const r of a.selectedAppDates) {
      const s = r?.startDate ?? r?.propStartDate;
      const e = r?.endDate ?? r?.propEndDate;
      if (s && e) out.push([new Date(s).getTime(), new Date(e).getTime()]);
    }
  }
  if (a?.selectedDates?.startDate && a?.selectedDates?.endDate) {
    out.push([new Date(a.selectedDates.startDate).getTime(), new Date(a.selectedDates.endDate).getTime()]);
  }
  if (a?.startUtc && a?.endUtc) out.push([new Date(a.startUtc).getTime(), new Date(a.endUtc).getTime()]);
  if (a?.start && a?.end) out.push([new Date(a.start).getTime(), new Date(a.end).getTime()]);
  return out.filter(([s, e]) => e > s);
}

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
  `${h._id}-${h.phoneE164 || h.phoneInput || ""}-${h.emailLower || h.emailInput || ""}`;

const Highlight: React.FC<{ text?: string; q: string }> = React.memo(({ text, q }) => {
  if (!text) return null;
  if (!q) return <>{text}</>;
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "i"));
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
});
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
          <Avatar name={`${h.nameInput ?? ""} ${h.lastNameInput ?? ""}`.trim() || "(No name)"} size="sm" />
          <Text noOfLines={1} fontWeight="semibold">
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
  rfetchPl?: (options?: RefetchOptions) => Promise<QueryObserverResult<any, Error>>;
  handleAppSelectEvent?: (slotInfo: SlotInfo) => void;
  handleAppSelectSlot?: (slotInfo: { start: Date; end: Date }) => void;
  markedAppEvents?: MarkedEvents;
  handleSelectEvent?: (slotInfo: SlotInfo) => void;
  handleSelectSlot?: (slotInfo: { start: Date; end: Date }) => void;
  markedEvents?: MarkedEvents;
  refetch_list?: ((options?: RefetchOptions) => Promise<QueryObserverResult<unknown, Error>>) | undefined;
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
  refetchPage?: (options?: RefetchOptions | undefined) => Promise<QueryObserverResult<PageResp<Appointment>, Error>>;
  contactPreference?: ContactPreference;
  providers?: Provider[];
  representative?: Representative;
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
  toastInfo,
  onlyPatient = false,
  setDatesApp,
  typeButonVisible = true,
  phoneFieldReadOnly = false,
  conversationId,
  providers,
}: Props) {
  const { data: allProviders = [] } = useProvidersList({ active: true });
  const { onOpen: onOpenApp, onClose: onCloseApp, isOpen: isOpenApp } = useDisclosure();
  const [isAnAppointment, setIsAnAppointment] = useState(!onlyPatient);
  const onToggle = useCallback(() => setIsAnAppointment((s) => !s), []);
  const providerIdsFromProps = React.useMemo(
    () => (providers ?? []).map((p: any) => String(p?._id ?? p)),
    [providers]
  );
  const { mutate, isPending } = useInsertToCollection<{ message: string; document: any }>("Appointment");
  const { mutate: editItem, isPending: editIsPending } = useUpdateItems(
    isAnAppointment ? "update-items" : "update-items-contacts"
  );
  const formBusy = isPending || editIsPending;
  const queryClient = useQueryClient();
  const toast = useToast();

  // === checkUnique (servidor) solo en CREATION ===
  const checkPhoneUnique = useCheckPhoneUnique();
  const isCreation = mode === "CREATION";
  const schema = useMemo(
    () =>
      makeAppointmentsSchemaOptionalProviders(
        isCreation ? checkPhoneUnique : async () => false // no valida duplicidad en edición
      ),
    [checkPhoneUnique, isCreation]
  );

  // ✅ normaliza el representative para defaultValues (evita meter objetos en appointment)
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
      id: idVal || "default",
      reschedule: !!reschedule,
      providers: providerIdsFromProps,
      representative: normalizedRepresentative ?? ({
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

  // Estado local de "es niño/dependiente"
  const [isChild, setIsChild] = useState<boolean>(!!normalizeId(representative?.appointment));

  // ========== 🚫 Detectar si este paciente YA es representante ==========
  const currentPatientId = useMemo(() => normalizeId(idVal), [idVal]);

  const repOfFilters = useMemo(() => {
    return currentPatientId
      ? {
          mongoQuery: { "representative.appointment": currentPatientId },
          limit: 1,
          projection: { _id: 1 },
        }
      : { mongoQuery: { _id: { $exists: false } }, limit: 1, projection: { _id: 1 } };
  }, [currentPatientId]);

  const { data: repOfHits = [] } = useGetCollection<Pick<Appointment, "_id">>("Appointment", repOfFilters);
  const isAlreadyRepresentative = repOfHits.length > 0;

  // Si ya es representante, limpiamos y bloqueamos el bloque de dependiente
  useEffect(() => {
    if (isAlreadyRepresentative) {
      if (isChild) setIsChild(false);
      const rep = (getValues("representative") as any) || {};
      if (rep?.appointment) {
        setValue("representative.appointment" as any, "", { shouldDirty: true, shouldTouch: true });
        trigger("representative");
      }
    }
  }, [isAlreadyRepresentative, isChild, getValues, setValue, trigger]);

  // =================== Representative Search State ===================
  const [repQuery, setRepQuery] = useState("");
  const repQ = useDebounced(repQuery, 250);

  // Filtros MEMOizados
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

  const { data: repHits = [], isFetching: repLoading } = useGetCollection<AppointmentHit>("Appointment", repFilters);

  const handlePickRepresentative = useCallback(
    (h: AppointmentHit) => {
      // 🚫 No permitas seleccionarse a sí mismo
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
      setValue("representative.appointment" as any, h._id, { shouldDirty: true, shouldTouch: true });
      setValue("representative.relationship" as any, "parent", { shouldDirty: false, shouldTouch: false });
      setValue("representative.nameInput" as any, h.nameInput || "", { shouldDirty: false, shouldTouch: false });
      setValue("representative.lastNameInput" as any, h.lastNameInput || "", { shouldDirty: false, shouldTouch: false });
      trigger("representative");
      toast({
        title: "Representative linked",
        description: `${h.nameInput ?? ""} ${h.lastNameInput ?? ""}`.trim() || h._id,
        status: "success",
        duration: 1800,
        isClosable: true,
      });
    },
    [setValue, trigger, toast, currentPatientId]
  );

  // Valores derivados para UI
  const Relationship = (getValues("representative") as any)?.relationship || "";
  const fullName = `${(getValues("representative") as any)?.nameInput || ""} ${(getValues("representative") as any)?.lastNameInput || ""}`;
  const selectedRepId = (getValues("representative") as any)?.appointment || "";

  /* ───────────────── Prefill de representante en EDITION ───────────────── */
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
    repIdForEdition && typeof repIdForEdition === "string" && repIdForEdition.trim();
  return validId
    ? {
        mongoQuery: { _id: repIdForEdition },
        limit: 1,
        projection: repPrefillProjection,
      }
    : {
        mongoQuery: { _id: { $exists: false } },
        limit: 1,
        projection: repPrefillProjection, // 👈 misma shape aquí
      };
}, [repIdForEdition]);

const { data: repPrefillHits = [] } =
  useGetCollection<AppointmentHit>("Appointment", repPrefillFilters);
  const didPrefillRep = useRef(false);

  useEffect(() => {
    if (didPrefillRep.current) return;
    if (mode !== "EDITION") return;
    if (!repIdForEdition) return;
    if (isAlreadyRepresentative) return; // 🚫 si es representante, no prellenes nada

    const h = repPrefillHits?.[0];
    if (!h) return;

    setIsChild(true);
    setValue("representative.appointment" as any, repIdForEdition, { shouldDirty: false, shouldTouch: false });
    if (representative?.relationship) {
      setValue("representative.relationship" as any, representative.relationship, { shouldDirty: false, shouldTouch: false });
    }
    setValue("representative.nameInput" as any, h.nameInput || "", { shouldDirty: false, shouldTouch: false });
    setValue("representative.lastNameInput" as any, h.lastNameInput || "", { shouldDirty: false, shouldTouch: false });

    trigger("representative");
    didPrefillRep.current = true;
  }, [mode, repIdForEdition, repPrefillHits, representative?.relationship, setValue, trigger, isAlreadyRepresentative]);

  // 🔥 Suscripción ligera al cambio de phoneInput (solo en CREATION)
  const phoneTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCheckedRef = React.useRef<string>("");

  useEffect(() => {
    if (!isCreation) return;

    const sub = watch((values, info) => {
      if (info.name !== "phoneInput") return;

      const raw = String(values.phoneInput ?? "").replace(/\s+/g, "");
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
          /^04\d{8}$/.test(raw) || /^\+61\d{9}$/.test(raw) || /^61\d{9}$/.test(raw);
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
          const exists = await checkPhoneUnique(e164, { excludeId: getValues("id") || undefined });
          if (exists) {
            setError("phoneInput" as any, { type: "duplicate", message: "Phone number already exists" });
          } else if (errType === "duplicate") {
            clearErrors("phoneInput" as any);
          }
        } catch {
          // opcional: manejo de red
        }
      }, 250);
    });

    return () => {
      sub.unsubscribe();
      if (phoneTimerRef.current) clearTimeout(phoneTimerRef.current);
    };
  }, [isCreation, watch, getFieldState, clearErrors, setError, checkPhoneUnique, getValues, isChild]);

  const appointmentErrors = errors as FieldErrors<AppointmentForm>;
  const [duration, setDuration] = useState<number>(priorityVal?.durationHours || 0);
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

  React.useEffect(() => {
    if (mode === "EDITION") {
      setValue("providers", providerIdsFromProps, { shouldDirty: false, shouldTouch: false });
    }
  }, [mode, providerIdsFromProps, setValue]);

  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [selectedAppDates, setSelectedAppDates] = useState<DateRange[]>(datesAppSelected || []);
  const [selectedDays, setSelectedDays] = useState<Partial<Record<WeekDay, TimeBlock[]>>>(() => {
    if (Array.isArray(dates?.days)) {
      return dates.days.reduce((acc, curr) => {
        acc[curr.weekDay] = curr.timeBlocks;
        return acc;
      }, {} as Partial<Record<WeekDay, TimeBlock[]>>);
    }
    return {};
  });

  // Appointment window
  const appointmentWindow = useMemo(() => {
    const pick = (selectedAppDates && selectedAppDates.length ? selectedAppDates[0] : undefined) as DateRange | undefined;
    if (!pick?.startDate || !pick?.endDate) return null;
    const fromIso = dayjs.utc(pick.startDate).toDate().toISOString();
    const toIso = dayjs.utc(pick.endDate).toDate().toISOString();
    return { fromIso, toIso };
  }, [selectedAppDates]);

  const selectedTreatmentId = ((): string | undefined => {
    const v = getValues("treatment") as unknown as string | undefined;
    return v;
  })();

  const suggestParams = useMemo(() => {
    if (!appointmentWindow || !selectedTreatmentId) return undefined;
    return {
      from: appointmentWindow.fromIso,
      to: appointmentWindow.toIso,
      treatmentIds: [selectedTreatmentId],
      durationMin: duration ? duration * 60 : undefined,
    };
  }, [appointmentWindow, selectedTreatmentId, duration]);

  const { data: suggestResp = [], isFetching: isSuggesting } = useSuggestProviders(suggestParams);

  const suggestedProviders = useMemo<Provider[]>(() => {
    const selectedSet = new Set((getValues("providers") as string[]) || []);
    return (suggestResp as SuggestItem[])
      .map((r: SuggestItem) => r.provider)
      .filter((p: Provider) => !selectedSet.has(String(p._id)));
  }, [suggestResp, getValues]);

  /* —— submit —— */
  const sanitize = (data: any) => {
    const repApp = (data?.representative?.appointment ?? "").trim();

    // 🚫 Si el paciente YA es representante, ignoramos por completo representative
    if (isAlreadyRepresentative) {
      const cleanedNoRep: any = {
        ...data,
        nameInput: DOMPurify.sanitize(data.nameInput, { ALLOWED_TAGS: [] }),
        lastNameInput: DOMPurify.sanitize(data.lastNameInput, { ALLOWED_TAGS: [] }),
        phoneInput: DOMPurify.sanitize(data.phoneInput || "", { ALLOWED_TAGS: [] }),
        emailInput: DOMPurify.sanitize(data.emailInput || "", { ALLOWED_TAGS: [] }),
        priority: "priority" in data ? DOMPurify.sanitize(data.priority || "", { ALLOWED_TAGS: [] }) : undefined,
        note: "note" in data ? DOMPurify.sanitize(data.note || "", { ALLOWED_TAGS: [] }) : undefined,
        _id: data._id ? DOMPurify.sanitize(data._id, { ALLOWED_TAGS: [] }) : undefined,
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
            consentAt: data?.representative?.consentAt || undefined,
            notes: DOMPurify.sanitize(data?.representative?.notes || "", { ALLOWED_TAGS: [] }),
          }
        : undefined;

    const cleaned: any = {
      ...data,
      nameInput: DOMPurify.sanitize(data.nameInput, { ALLOWED_TAGS: [] }),
      lastNameInput: DOMPurify.sanitize(data.lastNameInput, { ALLOWED_TAGS: [] }),
      phoneInput: DOMPurify.sanitize(data.phoneInput || "", { ALLOWED_TAGS: [] }),
      emailInput: DOMPurify.sanitize(data.emailInput || "", { ALLOWED_TAGS: [] }),
      priority: "priority" in data ? DOMPurify.sanitize(data.priority || "", { ALLOWED_TAGS: [] }) : undefined,
      note: "note" in data ? DOMPurify.sanitize(data.note || "", { ALLOWED_TAGS: [] }) : undefined,
      _id: data._id ? DOMPurify.sanitize(data._id, { ALLOWED_TAGS: [] }) : undefined,
    };

    if (repObj) {
      cleaned.representative = repObj;
      if (!cleaned.phoneInput) cleaned.phoneInput = "";
    } else {
      delete cleaned.representative;
    }
    return cleaned;
  };

  const onSubmit = (data: AppointmentForm | ContactForm) => {
    const cleanedData: any = sanitize(data);

    if (mode === "CREATION") {
      mutate(cleanedData, {
        onSuccess: () => {
          toast({
            title: "Patient successfully submitted.",
            description: isChild
              ? "Child/dependent has been registered and linked to their representative."
              : "Your new contact has been submitted successfully",
            status: "success",
            duration: 3000,
            isClosable: true,
          });
          reset();
          setRepQuery("");
          setIsChild(false);

          queryClient.refetchQueries({ queryKey: ["DraggableCards"] });
          queryClient.invalidateQueries({ queryKey: ["DraggableCards"] });
          queryClient.invalidateQueries({ queryKey: ["Appointment"] });
          queryClient.invalidateQueries({ queryKey: ["conversations"] });
        },
        onError: (error: any) => {
          const status = error?.response?.status;
          if (status === 409) {
            const field = error?.response?.data?.field ?? "phoneInput";
            const value = error?.response?.data?.value ?? cleanedData?.phoneInput ?? "";
            setError("phoneInput" as any, {
              type: "manual",
              message: `Duplicate ${field}: ${value}`,
            });
            toast({
              title: "Duplicate record",
              description: `There is already a record with ${field}: ${value} in this organization.`,
              status: "error",
              duration: 5000,
              isClosable: true,
            });
            return;
          }
          toast({
            title: "Error submitting the form.",
            description: error?.response?.data?.message || "An unexpected error occurred.",
            status: "error",
            duration: 4000,
            isClosable: true,
          });
        },
      });
    } else if (mode === "EDITION") {
      const { description: toastDesc, title: toastTitle } = toastInfo;
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
          toast({ title: toastTitle, description: toastDesc, status: "success", duration: 3000, isClosable: true });
          if (rfetchPl) rfetchPl();
          if (onClose_1) onClose_1();
          await queryClient.cancelQueries({ queryKey: appointmentsKey.base });
          await queryClient.cancelQueries({ queryKey: appointmentsSearchKey.base });
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
        },
      });
    }
  };
  const onError = () => setHasSubmitted(true);

  // chips seleccionados horizontales
  const renderSelectedProviderTags = (providersList: Provider[], values: string[], removeById: (id: string) => void) => {
    const byId = new Map(providersList.map((p) => [String(p._id), p]));
    const chips = values.map((id) => byId.get(String(id))).filter(Boolean) as Provider[];
    return (
      <Box
        role="list"
        aria-label="Selected providers"
        mb={2}
        px={2}
        py={1}
        borderWidth="1px"
        borderRadius="md"
        bg="blackAlpha.50"
        overflowX="auto"
        overflowY="hidden"
        whiteSpace="nowrap"
      >
        {chips.length === 0 ? (
          <Tag size="sm" colorScheme="gray" mr={2}>
            No providers selected
          </Tag>
        ) : (
          chips.map((p) => (
            <Tag key={String(p._id)} size="xs" variant="subtle" borderRadius="md" mr={2}>
              <Box w="8px" h="8px" borderRadius="full" bg={p.color || "gray.300"} mr={2} />
              <TagLabel maxW="140px" isTruncated>
                {p.firstName} {p.lastName}
              </TagLabel>
              <TagCloseButton onClick={() => removeById(String(p._id))} />
            </Tag>
          ))
        )}
      </Box>
    );
  };

  /* =================== UI =================== */
  return (
    <Box
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
      {/* Toggle */}
      <Box position="relative" p={4}>
        <Tooltip label={"Change Entry"} hasArrow placement="top">
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
              icon={isAnAppointment ? <MdEventBusy size={20} /> : <MdEventNote size={20} />}
              bgGradient="linear(to-r, teal.400, blue.500)"
              color="white"
              rounded="full"
              boxSize="42px"
              shadow="md"
              mt={4}
              transition="all 0.25s ease"
              _hover={{ bgGradient: "linear(to-r, teal.500, blue.600)", transform: "scale(1.08)", shadow: "lg" }}
              _active={{ transform: "scale(0.95)", shadow: "sm" }}
              isDisabled={formBusy}
            />
          )}
        </Tooltip>
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
        />
      </Flex>

      {/* Representative (Child/Dependent) */}
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
                    setValue("representative.appointment" as any, "", { shouldDirty: true });
                    setRepQuery("");
                    trigger("representative");
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
                    <Input
                      placeholder="Type at least 2 characters…"
                      value={repQuery}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRepQuery(val);
                        if (isObjectId(val)) {
                          setValue("representative.appointment" as any, val.trim(), { shouldDirty: true });
                          trigger("representative");
                        }
                      }}
                      isDisabled={formBusy}
                    />
                  </InputGroup>
                </FormControl>

                {/* Selected representative summary */}
                {selectedRepId ? (
                  <Alert status="success" borderRadius="md" >
                    <AlertIcon />
                    <Text>Selected representative:</Text>
                    <Text mx={2} fontWeight={"bold"}>{` ${fullName} (${Relationship})`}</Text>
                    <Button
                      size="xs"
                      ml={3}
                      variant="ghost"
                      type="button"
                      onClick={() => {
                        setValue("representative.appointment" as any, "", { shouldDirty: true });
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
                <Box borderWidth="1px" borderRadius="md" maxH="220px" overflowY="auto" px={1} py={1}>
                  {repLoading ? (
                    <Skeleton height="28px" borderRadius="md" />
                  ) : repHits.length === 0 ? (
                    <Box p={3} color="gray.500">
                      {repQ && repQ.length >= 2 ? "No matches." : "Start typing to search…"}
                    </Box>
                  ) : (
                    repHits.map((h) => (
                      <RepRow key={hitKey(h)} h={h} q={repQ} onPick={handlePickRepresentative} />
                    ))
                  )}
                </Box>

                {/* Relationship / Parentesco */}
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
                placeholder={!!selectedRepId ? "Child uses representative's phone" : "04XX XXX XXX"}
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

        <FormControl mt={3} isInvalid={!!(errors as FieldErrors<AppointmentForm>).contactPreference}>
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

        {/* Priority arriba */}
        <FormControl mt="2%" isInvalid={!!(appointmentErrors && appointmentErrors.priority)}>
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
          <FormErrorMessage>
            <FormErrorIcon mr="1" />
            {errMsg(appointmentErrors?.priority)}
          </FormErrorMessage>
        </FormControl>

        <Divider my={5} />

        {/* Treatment */}
        <FormControl mt="2%" isInvalid={!!(appointmentErrors && appointmentErrors.treatment)}>
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
          <FormErrorMessage>
            <FormErrorIcon mr="1" />
            {errMsg(appointmentErrors?.treatment)}
          </FormErrorMessage>
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
                  <FormLabel>Appointment Date</FormLabel>
                  <Flex wrap="wrap" gap={3}>
                    {field.value?.map((item: DateRange, index: number) => {
                      const start = dayjs.utc(item.startDate).tz("Australia/Sydney");
                      const end = dayjs.utc(item.endDate).tz("Australia/Sydney");
                      return (
                        <Button
                          key={`${start.toISOString()}-${index}`}
                          fontSize="xs"
                          isDisabled={formBusy}
                          colorScheme="blue"
                          type="button"
                        >
                          {start.format("YYYY/MM/DD hh:mm A")} — {end.format("hh:mm A")}
                        </Button>
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
              {selected > 0 ? (
                <>
                  <Button type="button" onClick={onOpenApp} isDisabled={formBusy}>
                    Add Appointment
                  </Button>
                  <Modal isOpen={isOpenApp} onClose={onCloseApp} size={"6xl"} isCentered motionPreset="scale">
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
                        <Button onClick={onCloseApp} variant="ghost" colorScheme="gray" isDisabled={formBusy} type="button">
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

        <Divider my={5} />

        {/* Providers debajo del Appointment Date */}
        <Divider my={5} />
        <FormControl isInvalid={!!(appointmentErrors as any)?.providers}>
          <FormLabel>
            Providers <Tag ml={2} size="sm" colorScheme="gray">Optional</Tag>
          </FormLabel>
          <Controller
            name="providers"
            control={control}
            render={({ field }) => {
              const values = (field.value as string[]) || [];

              const addProvider = (p: Provider) => {
                if (values.includes(String(p._id))) return;
                field.onChange([...values, String(p._id)]);
                trigger("providers");
              };

              const removeById = (id: string) => {
                const next = values.filter((x) => x !== id);
                field.onChange(next);
                trigger("providers");
              };

              const gateMissingInputs = !appointmentWindow || !selectedTreatmentId;

              return (
                <VStack align="stretch" spacing={3}>
                  {/* Chips seleccionados (horizontales) */}
                  <Box>
                    {renderSelectedProviderTags(allProviders, values, removeById)}
                  </Box>

                  {gateMissingInputs ? (
                    <Alert status="info" borderRadius="md">
                      <AlertIcon />
                      Select a <b style={{ margin: "0 4px" }}>treatment</b> and an{" "}
                      <b style={{ margin: "0 4px" }}>appointment date</b> so I can suggest providers by schedule.
                    </Alert>
                  ) : (
                    <>
                      {/* Sugeridos */}
                      {isSuggesting ? (
                        <Skeleton h="28px" borderRadius="md" />
                      ) : suggestedProviders.length > 0 ? (
                        <Box>
                          <Text fontWeight="semibold" fontSize="sm" mb={1}>Suggested</Text>
                          <Box borderWidth="1px" borderRadius="md" maxH="180px" overflowY="auto" px={1} py={1}>
                            {suggestedProviders.map((p) => (
                              <ProviderRowScheduleAvailability
                                key={`sugg-${p._id}`}
                                p={p}
                                windowIso={appointmentWindow}
                                skillId={selectedTreatmentId}
                                onAdd={addProvider}
                                minMatch="partialOrBetter"
                                hideIfBusy={false}
                                hideIfTimeOff={false}
                              />
                            ))}
                          </Box>
                        </Box>
                      ) : null}

                      {/* Fallback buscador manual */}
                      <Text fontWeight="semibold" fontSize="sm" mt={2}>All providers (manual search)</Text>
                      <ProviderFinderInline
                        providers={allProviders}
                        skillId={selectedTreatmentId}
                        selectedIds={values}
                        onAdd={addProvider}
                        windowIso={appointmentWindow}
                      />
                    </>
                  )}

                  <FormErrorMessage>
                    <FormErrorIcon mr="1" />
                    {errMsg((appointmentErrors as any)?.providers)}
                  </FormErrorMessage>
                </VStack>
              );
            }}
          />
        </FormControl>

        <Divider my={5} />

        {/* Disponibilidad preferida del paciente */}
        <SimpleGrid columns={1} spacing={4}>
          <Box p={1}>
            <FormControl isInvalid={hasSubmitted && !!appointmentErrors?.selectedDates}>
              <FormLabel>Availability</FormLabel>
              <Box display="flex" justifyContent="center" width="100%">
                <AvailabilityDates2
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
          <Box borderWidth="1px" rounded="lg" shadow="1px 1px 3px rgba(0,0,0,0.1)" py={2}>
            <CustomCheckbox
              name="reschedule"
              isPending={formBusy}
              anotherName="Re-Schedule"
              register={register}
              error={asFieldError((appointmentErrors as any)?.reschedule)}
            />
          </Box>
        </SimpleGrid>
      )}

      {/* Hidden id */}
      <CustomInputN type="hidden" name="id" register={register} error={asFieldError((appointmentErrors as any)?.id)} />

      <FormControl pt={4}>{children}</FormControl>

      <Flex justifyContent="flex-end" mt={6} gap={3}>
        <Button fontSize="xs" type="submit" colorScheme="red" isDisabled={formBusy} width="150px" aria-live="polite">
          {formBusy ? <Spinner size="sm" /> : btnName}
        </Button>
      </Flex>
    </Box>
  );
}

/* ----------------- Subcomponentes usados arriba ----------------- */
function ProviderRow({
  p,
  highlight,
  onAdd,
  rightAdornment,
}: {
  p: Provider;
  highlight?: string;
  onAdd: (p: Provider) => void;
  rightAdornment?: React.ReactNode;
}) {
  const label = `${p.firstName} ${p.lastName}`.trim();
  const renderHighlighted = (text: string, q?: string) => {
    if (!q) return text;
    const parts = text.split(new RegExp(`(${q})`, "i"));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === q.toLowerCase() ? (
            <mark key={i} style={{ background: "transparent", color: "inherit", fontWeight: 700 }}>
              {part}
            </mark>
          ) : (
            <React.Fragment key={i}>{part}</React.Fragment>
          )
        )}
      </>
    );
  };

  return (
    <HStack
      as="div"
      role="button"
      tabIndex={0}
      w="100%"
      justify="space-between"
      px={2}
      py={2}
      borderRadius="md"
      _hover={{ bg: "blackAlpha.50" }}
      onClick={() => onAdd(p)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onAdd(p)}
    >
      <HStack overflow="hidden">
        <Box w="8px" h="8px" borderRadius="full" bg={p.color || "gray.300"} />
        <Text noOfLines={1}>{renderHighlighted(label, highlight)}</Text>
      </HStack>
      {rightAdornment}
    </HStack>
  );
}

function ProviderRowScheduleAvailability({
  p,
  windowIso,
  skillId,
  onAdd,
  qHighlight,
  minMatch = "partialOrBetter",
  hideIfBusy = false,
  hideIfTimeOff = false,
}: {
  p: Provider;
  windowIso: { fromIso: string; toIso: string } | null;
  skillId?: string;
  onAdd: (p: Provider) => void;
  qHighlight?: string;
  minMatch?: "fit" | "partialOrBetter";
  hideIfBusy?: boolean;
  hideIfTimeOff?: boolean;
}) {
  const toast = useToast();

  if (!windowIso) {
    return (
      <ProviderRow
        p={p}
        onAdd={(prov) => {
          if (!skillId) {
            toast({ title: "Select a treatment first", status: "warning", duration: 2500, isClosable: true });
            return;
          }
          const hasSkill = (p.skills || []).map(String).includes(String(skillId));
          if (!hasSkill) {
            toast({
              title: "Provider doesn’t perform the selected treatment",
              status: "error",
              duration: 3500,
              isClosable: true,
            });
            return;
          }
          onAdd(prov);
        }}
        highlight={qHighlight}
        rightAdornment={<Tag size="sm">Schedule unknown</Tag>}
      />
    );
  }

  const { data: sched, isFetching: isFetchingSched } = useProviderSchedule(p._id);
  const { data: busyEvents = [], isFetching: isFetchingApps } = useProviderAppointments(
    p._id,
    { from: windowIso.fromIso, to: windowIso.toIso }
  );
  const { data: timeOff = [], isFetching: isFetchingTO } = useProviderTimeOff(
    p._id,
    { from: windowIso.fromIso, to: windowIso.toIso }
  );

  const tz = sched?.timezone || SYD_TZ;
  const from = new Date(windowIso.fromIso).getTime();
  const to = new Date(windowIso.toIso).getTime();

  const hasBusyOverlap = useMemo(() => {
    if (!busyEvents?.length) return false;
    return busyEvents.some((ev: any) =>
      appointmentRanges(ev).some(([s, e]) => overlaps(from, to, s, e))
    );
  }, [busyEvents, from, to]);

  const hasPTOOverlap = useMemo(() => {
    if (!timeOff.length) return false;
    return timeOff.some((t) => overlaps(from, to, new Date(t.start).getTime(), new Date(t.end).getTime()));
  }, [timeOff, from, to]);

  const fitBySchedule = useMemo(() => fitsSchedule(sched?.weekly ?? ({} as Weekly), tz, from, to), [sched, tz, from, to]);
  const partialBySchedule = useMemo(
    () => !fitBySchedule && partialSchedule(sched?.weekly ?? ({} as Weekly), tz, from, to),
    [sched, tz, from, to, fitBySchedule]
  );

  const loading = isFetchingSched || isFetchingApps || isFetchingTO;
  if (loading) return <Skeleton height="28px" borderRadius="md" />;

  if (minMatch === "fit" && !fitBySchedule) return null;
  if (!fitBySchedule && !partialBySchedule) return null;
  if (hideIfBusy && hasBusyOverlap) return null;
  if (hideIfTimeOff && hasPTOOverlap) return null;

  const handleAdd = () => {
    if (skillId) {
      const hasSkill = (p.skills || []).map(String).includes(String(skillId));
      if (!hasSkill) {
        toast({ title: "Provider doesn’t perform the selected treatment", status: "error", duration: 3500, isClosable: true });
        return;
      }
    }
    if (hasBusyOverlap) {
      toast({ title: "Provider already has an appointment in that window", status: "error", duration: 3500, isClosable: true });
      return;
    }
    if (hasPTOOverlap) {
      toast({ title: "Provider is on time off in that window", status: "error", duration: 3500, isClosable: true });
      return;
    }
    onAdd(p);
  };

  return (
    <ProviderRow
      p={p}
      onAdd={handleAdd}
      highlight={qHighlight}
      rightAdornment={
        hasBusyOverlap ? (
          <Tag size="sm" colorScheme="red">Booked</Tag>
        ) : hasPTOOverlap ? (
          <Tag size="sm" colorScheme="red">Time off</Tag>
        ) : fitBySchedule ? (
          <Tag size="sm" colorScheme="green">Fits</Tag>
        ) : (
          <Tag size="sm" colorScheme="yellow">Partial</Tag>
        )
      }
    />
  );
}

function ProviderFinderInline({
  providers,
  skillId,
  selectedIds,
  onAdd,
  windowIso,
}: {
  providers: Provider[];
  skillId?: string;
  selectedIds: string[];
  onAdd: (p: Provider) => void;
  windowIso: { fromIso: string; toIso: string } | null;
}) {
  const [query, setQuery] = useState("");
  const q = useDebounced(query, 200);

  const baseFiltered = useMemo(() => {
    let arr = providers.filter((p) => !selectedIds.includes(String(p._id)));
    if (skillId) {
      const sid = String(skillId);
      arr = arr.filter((p) => (p.skills || []).map(String).includes(sid));
    }
    if (q) {
      const qq = q.trim().toLowerCase();
      arr = arr.filter((p) => `${p.firstName} ${p.lastName}`.toLowerCase().includes(qq));
    }
    return arr;
  }, [providers, selectedIds, q, skillId]);

  return (
    <VStack align="stretch" spacing={2}>
      <InputGroup>
        <InputLeftElement pointerEvents="none">
          <FiSearch />
        </InputLeftElement>
        <Input
          placeholder="Search provider by name"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </InputGroup>

      <Box borderWidth="1px" borderRadius="md" maxH="240px" overflowY="auto" px={1} py={1}>
        {baseFiltered.length === 0 ? (
          <Box p={3} color="gray.500">No providers found.</Box>
        ) : (
          baseFiltered.map((p) => (
            <ProviderRowScheduleAvailability
              key={p._id as any}
              p={p}
              windowIso={windowIso}
              skillId={skillId}
              onAdd={onAdd}
              qHighlight={q}
              minMatch="partialOrBetter"
            />
          ))
        )}
      </Box>

      <HStack color="gray.500" fontSize="xs">
        <Kbd>Enter</Kbd> / click to add · <Kbd>Esc</Kbd> to clear
      </HStack>
    </VStack>
  );
}

export default CustomEntryForm;
