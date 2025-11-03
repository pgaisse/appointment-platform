import {
  Box,
  Text,
  Flex,
  Card,
  CardHeader,
  CardBody,
  Heading,
  HStack,
  Icon,
  Tag,
  Tooltip,
  Button,
  useToast,
  Spinner,
  IconButton,
  VStack,
  Wrap,
  WrapItem,
  Divider,
  Badge,
  Checkbox,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverArrow,
  PopoverBody,
  PopoverHeader,
  PopoverCloseButton,
  Input,
  Portal,
  Avatar,
  AvatarBadge,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
} from "@chakra-ui/react";
import { useState, useRef, useEffect } from "react";
import { AppointmentGroup, env } from "@/types";
import { formatAusPhoneNumber } from "@/Functions/formatAusPhoneNumber";
import { PhoneIcon, RepeatIcon } from "@chakra-ui/icons";
import { CiUser } from "react-icons/ci";
import { useUpdateItems } from "@/Hooks/Query/useUpdateItems";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { getMatchLevelIcon } from "@/Functions/getMatchLevelIcon";
import { useNavigate } from "react-router-dom";
import { useSendAppointmentSMS } from "@/Hooks/Query/useSendAppointmentSMS";
import ShowTemplateButtonWithData from "../Chat/CustomMessages/ShowTemplateButtonWithData";
import CreateMessageModal from "../Chat/CustomMessages/CreateCustomMessageModal";
import { MdOutlinePostAdd, MdScheduleSend, MdEdit } from "react-icons/md";
import { RiCalendarScheduleLine, RiMessage3Line } from "react-icons/ri";
import { DateTime } from "luxon";
import CreateCustomMessageForm2 from "../Chat/CustomMessages/CreateCustomMessageForm2";

const MotionBox = motion(Box);
const FadeInBox = motion(Box);
const MotionScrollBox = motion(Box);

const CARD_WIDTH = 320;
const CARD_MARGIN = 16;

interface Props {
  event: AppointmentGroup[];
}

const CustomEventContent: React.FC<Props> = ({ event }) => {
  const [templateTextByPatient, setTemplateTextByPatient] = useState<Record<string, string>>({});
  // Separate optional reminder message per patient; falls back to confirmation text if not provided
  const [reminderTextByPatient, setReminderTextByPatient] = useState<Record<string, string>>({});
  const [reminderCheckedByPatient, setReminderCheckedByPatient] = useState<Record<string, boolean>>({});
  const [tipOpenByPid, setTipOpenByPid] = useState<Record<string, boolean>>({});
  const [reminderWhenByPid, setReminderWhenByPid] = useState<Record<string, string>>({});
  const [msgOpenByPid, setMsgOpenByPid] = useState<Record<string, boolean>>({});
  const [selectedTemplateByPid, setSelectedTemplateByPid] = useState<Record<string, any>>({});
  const [selectedReminderTemplateByPid, setSelectedReminderTemplateByPid] = useState<Record<string, any>>({});
  const [editModalOpenByPid, setEditModalOpenByPid] = useState<Record<string, boolean>>({});
  const [editReminderModalOpenByPid, setEditReminderModalOpenByPid] = useState<Record<string, boolean>>({});

  // Mutations ahora con mutateAsync para encadenar con await
  const { mutateAsync: updateItemsAsync, isPending: isUpdating } = useUpdateItems();
  const { mutateAsync: sendSMSAsync, isPending: isSending } = useSendAppointmentSMS();

  const toast = useToast();
  
  // Socket toast para notificar cuando el backend programe el recordatorio
  useEffect(() => {
    // Asume que el socket está disponible en window.socket o similar
    const socket = (window as any).socket;
    if (!socket) return;
    const handler = (data: any) => {
      toast({
        title: "Reminder scheduled",
        description: `Reminder for slot ${data.slotId} scheduled at ${data.runAtLocal}`,
        status: "success",
        duration: 4000,
        isClosable: true,
      });
    };
    socket.on("reminderScheduled", handler);
    return () => {
      socket.off("reminderScheduled", handler);
    };
  }, [toast]);
  const queryClient = useQueryClient();
  const group = event?.[0];
  const containerRef = useRef<HTMLDivElement>(null);
  const [showLeftShadow, setShowLeftShadow] = useState(false);
  const [showRightShadow, setShowRightShadow] = useState(true);
  const [processingPid, setProcessingPid] = useState<string>("");
  const navigate = useNavigate();

  const TZ = "Australia/Sydney";
  const isWorking = Boolean(processingPid) || isUpdating || isSending;

  // ---------- Date helpers ----------
  const toIsoLocalSydney = (dt: DateTime) => dt.toFormat("yyyy-LL-dd'T'HH:mm:ss");

  const parseSydney = (val: Date | string | null | undefined): DateTime => {
    if (val instanceof Date) return DateTime.fromJSDate(val, { zone: TZ });
    const s = String(val ?? "");
    let dt = DateTime.fromISO(s, { zone: TZ });
    if (!dt.isValid) dt = DateTime.fromFormat(s, "yyyy-LL-dd'T'HH:mm:ss", { zone: TZ });
    return dt;
  };

  // Default reminder = día − 1 a las 12:00
  const makeDefaultReminderISO = (start: Date | string) => {
    let base = parseSydney(start);
    if (!base.isValid) base = DateTime.now().setZone(TZ).plus({ days: 2 });
    return base
      .minus({ days: 1 })
      .set({ hour: 12, minute: 0, second: 0, millisecond: 0 })
      .toFormat("yyyy-LL-dd'T'HH:mm:ss");
  };

  const isoToInputValue = (iso: string) => {
    const dt = parseSydney(iso);
    return dt.isValid ? dt.toFormat("yyyy-LL-dd'T'HH:mm") : "";
  };

  // Ventana Twilio
  const enforceTwilioWindow = (iso: string) => {
    const now = DateTime.now().setZone(TZ);
    let dt = parseSydney(iso);
    if (!dt.isValid) return { ok: false as const, error: "invalid" as const };

    const daysAhead = dt.diff(now, "days").days;
    if (daysAhead > 35) return { ok: false as const, error: "tooFar" as const };

    const minsAhead = dt.diff(now, "minutes").minutes;
    if (minsAhead < 15) {
      const fixed = now.plus({ minutes: 16 }).set({ second: 0, millisecond: 0 });
      return { ok: true as const, iso: toIsoLocalSydney(fixed), adjusted: true as const };
    }
    return { ok: true as const, iso: toIsoLocalSydney(dt.set({ second: 0, millisecond: 0 })) };
  };

  const formatGroupSlotHuman = (start: Date | string, end: Date | string) => {
    const s = parseSydney(start);
    const e = parseSydney(end);
    if (!s.isValid || !e.isValid) return "No appointment date selected";
    const sameDay = s.hasSame(e, "day");
    const dayPart = sameDay
      ? s.toFormat("ccc, dd LLL yyyy")
      : `${s.toFormat("ccc, dd LLL yyyy")} → ${e.toFormat("ccc, dd LLL yyyy")}`;
    const timePart = `${s.toFormat("h:mm a")} — ${e.toFormat("h:mm a")}`;
    return `${dayPart} • ${timePart} (${TZ})`;
  };

  // ---------- Inicialización ----------
  useEffect(() => {
    if (!group?.priorities?.length || !group?.dateRange?.startDate) return;

    // Checkbox default = true
    setReminderCheckedByPatient((prev) => {
      const next = { ...prev };
      for (const g of group.priorities) {
        for (const appt of g.appointments || []) {
          if (next[appt._id] === undefined) next[appt._id] = true;
        }
      }
      return next;
    });

    // Hora default por paciente = start del slot − 1 día a las 12:00
    const slotStart = group.dateRange.startDate;
    const defaultISO = makeDefaultReminderISO(slotStart);

    setReminderWhenByPid((prev) => {
      const next = { ...prev };
      for (const g of group.priorities) {
        for (const appt of g.appointments || []) {
          if (!next[appt._id]) next[appt._id] = defaultISO;
        }
      }
      return next;
    });
  }, [group?.priorities, group?.dateRange?.startDate]);

  // ---------- Scroll sombras ----------
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const atStart = scrollLeft <= 5;
    const atEnd = scrollLeft + clientWidth >= scrollWidth - 5;
    setShowLeftShadow(!atStart);
    setShowRightShadow(!atEnd);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateUI = () => {
      handleScroll();
    };

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        const SCROLL_SPEED = 2;
        el.scrollLeft += e.deltaY * SCROLL_SPEED;
      }
    };

    updateUI();
    window.addEventListener("resize", updateUI);
    el.addEventListener("scroll", handleScroll);
    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      window.removeEventListener("resize", updateUI);
      el.removeEventListener("scroll", handleScroll);
      el.removeEventListener("wheel", onWheel);
    };
  }, []);

  // ---------- Acción principal: flujo encadenado sin onSuccess anidados ----------
  const handleClick = async (id: string, start: Date | string, end: Date | string) => {
    setProcessingPid(id);

    const payload = [
      {
        table: "Appointment",
        id_field: "_id",
        id_value: id ?? "",
        data: {
          "selectedAppDates.0.proposed.startDate": start,
          "selectedAppDates.0.proposed.endDate": end,
          "selectedAppDates.0.status": "Pending",
          // Persist reminder plan (if any). Scheduling will happen after patient confirms.
          ...(reminderCheckedByPatient[id] ?? true
            ? {
                "selectedAppDates.0.reminder.msg": (reminderTextByPatient[id] || templateTextByPatient[id]) ?? "",
                "selectedAppDates.0.reminder.tz": TZ,
                "selectedAppDates.0.reminder.whenISO": (reminderWhenByPid[id] || makeDefaultReminderISO(start)) as any,
                "selectedAppDates.0.reminder.scheduled": false,
              }
            : {
                "selectedAppDates.0.reminder": null as any,
              }),
        },
      },
    ];

    try {
      // 1) Update de la cita
      await updateItemsAsync(payload);

      // 2) Do NOT send confirmation here. The clinic will contact separately; we only saved the reminder plan.
      toast({
        title: "Rebooked",
        description: "Reminder plan saved and will be scheduled automatically after patient confirms.",
        status: "info",
        duration: 3500,
        isClosable: true,
      });

      // 4) Caché y navegación
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["DraggableCards"] }),
        queryClient.invalidateQueries({ queryKey: ["PriorityList"] }),
        queryClient.invalidateQueries({ queryKey: ["Appointment"] }),
      ]);

      navigate("/appointments/priority-list");
    } catch (error: any) {
      toast({
        title: "Error while rebooking or sending SMS",
        description: error?.message || "An unexpected error occurred.",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setProcessingPid("");
      // Invalidación complementaria ligera
      queryClient.invalidateQueries({ queryKey: ["Appointment"] });
      queryClient.invalidateQueries({ queryKey: ["DraggableCards"] });
    }
  };

  if (!group || !group.dateRange || !group.priorities?.length) {
    return <Text>No appointment data available</Text>;
  }

  // ------- Barra general con el horario seleccionado + default reminder -------
  const generalSlotHuman = formatGroupSlotHuman(group.dateRange.startDate, group.dateRange.endDate);
  const generalDefaultReminderHuman = parseSydney(
    makeDefaultReminderISO(group.dateRange.startDate)
  ).toFormat("ccc, dd LLL yyyy • h:mm a");

  return (
    <FadeInBox initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: "easeOut" }}>
      {/* Barra informativa general */}
      <Box
        mb={3}
        w="full"
        bg="gray.50"
        border="1px solid"
        borderColor="gray.200"
        borderRadius="xl"
        px={4}
        py={3}
      >
        <VStack align="start" spacing={1}>
          <HStack spacing={2}>
            <Icon as={RiCalendarScheduleLine} />
            <Text fontWeight="semibold">Selected slot:</Text>
            <Tag colorScheme="gray" variant="subtle">{generalSlotHuman}</Tag>
          </HStack>
          <HStack spacing={2}>
            <Icon as={MdScheduleSend} />
            <Text>Default reminder:</Text>
            <Tag colorScheme="gray" variant="subtle">
              {generalDefaultReminderHuman} ({TZ})
            </Tag>
          </HStack>
        </VStack>
      </Box>

      <Flex justify="center" align="center" position="relative">
        {showLeftShadow && (
          <Box
            position="absolute"
            left={0}
            top={0}
            bottom={0}
            width="60px"
            zIndex={2}
            bgGradient="linear(to-r, rgba(255,255,255,1), rgba(255,255,255,0))"
            pointerEvents="none"
          />
        )}
        {showRightShadow && (
          <Box
            position="absolute"
            right={0}
            top={0}
            bottom={0}
            width="60px"
            zIndex={2}
            bgGradient="linear(to-l, rgba(255,255,255,1), rgba(255,255,255,0))"
            pointerEvents="none"
          />
        )}

        <MotionScrollBox
          ref={containerRef}
          display="flex"
          gap={`${CARD_MARGIN}px`}
          overflowX="auto"
          scrollSnapType="x mandatory"
          onScroll={handleScroll}
          px={2}
          css={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-x",
          }}
          sx={{ "&::-webkit-scrollbar": { display: "none" } }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {group.priorities.map((groupItem) => {
            const colorBase = groupItem?.priority?.color ?? "gray";
            const count = groupItem?.appointments?.length ?? 0;

            return (
              <MotionBox
                key={groupItem.priority._id}
                minW={`${CARD_WIDTH}px`}
                maxW={`${CARD_WIDTH}px`}
                flexShrink={0}
                scrollSnapAlign="start"
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
              >
                <Card
                  h="xl"
                  boxShadow="2xl"
                  userSelect="none"
                  p={2}
                  borderRadius="2xl"
                  border="1px"
                  borderColor="gray.100"
                  bg={`${colorBase}.300`}
                >
                  <CardHeader py={3} pb={2}>
                    <HStack justify="space-between" align="center">
                      <HStack bg={`${colorBase}.200`} px={3} py={1.5} borderRadius="md" spacing={2}>
                        <Box w="8px" h="8px" borderRadius="full" bg={`${colorBase}.500`} />
                        <Heading size="sm">{groupItem.priority.name}</Heading>
                      </HStack>
                      <Badge rounded="full" px={2.5} py={1} fontWeight="semibold" colorScheme={colorBase} variant="subtle">
                        {count} {count === 1 ? "match" : "matches"}
                      </Badge>
                    </HStack>
                  </CardHeader>

                  <CardBody
                    p={3}
                    bg="white"
                    borderRadius="xl"
                    h="280px"
                    overflowY="auto"
                    overflowX="hidden"
                    sx={{
                      "&::-webkit-scrollbar": { width: "6px" },
                      "&::-webkit-scrollbar-thumb": { backgroundColor: "#a0aec0", borderRadius: "4px" },
                      "&::-webkit-scrollbar-track": { backgroundColor: "#edf2f7" },
                    }}
                  >
                    <VStack spacing={3} align="stretch">
                      {groupItem.appointments.map((item) => {
                        const { icon, color } = getMatchLevelIcon(item.matchLevel);
                        const pid = item._id;
                        const tooltipForThisPatient = templateTextByPatient[pid] ?? "";
                        const reminderTooltipForThisPatient = reminderTextByPatient[pid] ?? "";
                        const iconColorForThisPatient = tooltipForThisPatient ? "green.500" : "red.500";
                        const reminderIconColorForThisPatient = reminderTooltipForThisPatient ? "green.500" : "red.500";

                        const defaultISO = makeDefaultReminderISO(group.dateRange.startDate);
                        const selectedISO = reminderWhenByPid[pid] || defaultISO;
                        const selectedDT = parseSydney(selectedISO);
                        const selectedHuman = selectedDT.isValid
                          ? selectedDT.toFormat("ccc, dd LLL yyyy • h:mm a")
                          : DateTime.fromISO(defaultISO, { zone: TZ }).toFormat("ccc, dd LLL yyyy • h:mm a");

                        const isThisRowWorking = processingPid === pid || isWorking;

                        return (
                          <MotionBox
                            key={pid}
                            initial={{ opacity: 0.95 }}
                            whileHover={{ y: -2, boxShadow: "lg" }}
                            transition={{ duration: 0.2 }}
                            border="1px solid"
                            borderColor="gray.100"
                            bg="gray.50"
                            borderRadius="lg"
                            px={3}
                            py={3}
                            display="grid"
                            gridTemplateRows="auto 1fr auto"
                            gap={2}
                          >
                            {/* Header - Apple-like compact layout prioritizing name */}
                            <HStack align="center" spacing={3}>
                              <Avatar
                                size="sm"
                                name={`${item.nameInput} ${item.lastNameInput}`}
                                bg={item.color || "gray.200"}
                                color="white"
                              >
                                <AvatarBadge boxSize="0.9em" bg={color as any} borderColor="white" />
                              </Avatar>
                              <Box flex="1" minW={0}>
                                <Tooltip label={`${item.nameInput} ${item.lastNameInput}`}>
                                  <Text
                                    fontWeight="semibold"
                                    fontSize="sm"
                                    noOfLines={2}
                                    lineHeight="short"
                                    textTransform="capitalize"
                                  >
                                    {item.nameInput} {item.lastNameInput}
                                  </Text>
                                </Tooltip>
                                <HStack spacing={1.5} mt={1} color="gray.600">
                                  <Icon as={PhoneIcon} boxSize={3} />
                                  <Text fontSize="xs">{formatAusPhoneNumber(item.phoneInput)}</Text>
                                </HStack>
                              </Box>
                              <VStack spacing={0} align="flex-end">
                                <Tooltip label={`${item.matchLevel}`}>
                                  <Icon as={icon} color={color} boxSize={4} />
                                </Tooltip>
                                {item.selectedAppDates?.[0]?.startDate && (
                                  <Tooltip label="Original appointment date">
                                    <HStack spacing={1} color="gray.500">
                                      <Icon as={RiCalendarScheduleLine} boxSize={3} />
                                      <Text fontSize="xs">
                                        {parseSydney(item.selectedAppDates[0].startDate).toFormat("dd/MM")}
                                      </Text>
                                    </HStack>
                                  </Tooltip>
                                )}
                              </VStack>
                            </HStack>

                            {/* Availability */}
                            {Array.isArray(item.matchedBlocks) && item.matchedBlocks.length > 0 ? (
                              <Wrap spacing={2}>
                                {item.matchedBlocks.map((block, bIdx) => (
                                  <WrapItem key={bIdx}>
                                    <Tooltip label={`${block.from} — ${block.to}`}>
                                      <Tag variant="solid" colorScheme="gray">
                                        {block.short}
                                      </Tag>
                                    </Tooltip>
                                  </WrapItem>
                                ))}
                              </Wrap>
                            ) : (
                              <Text fontSize="sm" color="gray.500">
                                No availability details
                              </Text>
                            )}

                            <Divider />

                            {/* Actions - Messaging moved into a modal */}
                            <VStack align="stretch" spacing={2} w="full">
                              <HStack justify="flex-end">
                                <Tooltip label="Messages">
                                  <IconButton
                                    aria-label="Open messaging"
                                    icon={<RiMessage3Line />}
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setMsgOpenByPid((prev) => ({ ...prev, [pid]: true }))}
                                    isDisabled={isThisRowWorking}
                                  />
                                </Tooltip>
                              </HStack>

                              {/* Modal with confirmation and reminder settings */}
                              {msgOpenByPid[pid] && (
                                <Modal isOpen={true} onClose={() => setMsgOpenByPid((prev) => ({ ...prev, [pid]: false }))} size={{ base: "full", md: "lg" }}>
                                  <ModalOverlay />
                                  <ModalContent>
                                    <ModalHeader>Messaging for {item.nameInput} {item.lastNameInput}</ModalHeader>
                                    <ModalCloseButton />
                                    <ModalBody>
                                      <VStack align="stretch" spacing={4}>
                                        <HStack spacing={2} align="center">
                                          <Icon as={RiCalendarScheduleLine} color="gray.500" />
                                          <Text fontSize="sm" color="gray.600">
                                            {item.selectedAppDates?.[0]?.startDate
                                              ? parseSydney(item.selectedAppDates[0].startDate).toFormat("ccc, dd LLL yyyy • h:mm a")
                                              : "No appointment date selected"}
                                          </Text>
                                        </HStack>

                                        <Divider />

                                        <Box>
                                          <Text fontSize="xs" fontWeight="semibold" color="gray.600" mb={2}>Confirmation Message</Text>
                                          <HStack spacing={2} flexWrap="wrap">
                                            <ShowTemplateButtonWithData
                                              category="confirmation"
                                              dataForTokens={{
                                                nameInput: item.nameInput,
                                                lastNameInput: item.lastNameInput,
                                                phoneInput: item.phoneInput,
                                                org_name: item.org_name || env.VITE_AUTH0_ORGANIZATION_NAME,
                                                selectedAppDates: item.selectedAppDates || [],
                                              }}
                                              onSelectTemplate={(val: string) =>
                                                setTemplateTextByPatient((prev) => ({ ...prev, [pid]: val }))
                                              }
                                              tooltipText={tooltipForThisPatient || "Select confirmation template"}
                                              colorIcon={iconColorForThisPatient}
                                              enableEdit={true}
                                            />
                                            <CreateMessageModal
                                              patientId={pid}
                                              triggerButton={
                                                <Tooltip label="New template">
                                                  <IconButton
                                                    aria-label="Create template"
                                                    icon={<MdOutlinePostAdd size={18} />}
                                                    variant="ghost"
                                                    size="sm"
                                                  />
                                                </Tooltip>
                                              }
                                            />
                                          </HStack>
                                        </Box>

                                        <Divider />

                                        <Box>
                                          <HStack justify="space-between" mb={2}>
                                            <Text fontSize="xs" fontWeight="semibold" color="gray.600">Reminder</Text>
                                            <Checkbox
                                              size="sm"
                                              colorScheme="teal"
                                              isChecked={reminderCheckedByPatient[pid] ?? true}
                                              onChange={(e) =>
                                                setReminderCheckedByPatient((prev) => ({ ...prev, [pid]: e.target.checked }))
                                              }
                                              isDisabled={isThisRowWorking}
                                            >
                                              Enabled
                                            </Checkbox>
                                          </HStack>

                                          {(reminderCheckedByPatient[pid] ?? true) && (
                                            <VStack align="stretch" spacing={3}>
                                              <HStack spacing={2} flexWrap="wrap">
                                                <ShowTemplateButtonWithData
                                                  category="message"
                                                  dataForTokens={{
                                                    nameInput: item.nameInput,
                                                    lastNameInput: item.lastNameInput,
                                                    phoneInput: item.phoneInput,
                                                    org_name: item.org_name || env.VITE_AUTH0_ORGANIZATION_NAME,
                                                    selectedAppDates: item.selectedAppDates || [],
                                                  }}
                                                  onSelectTemplate={(val: string) =>
                                                    setReminderTextByPatient((prev) => ({ ...prev, [pid]: val }))
                                                  }
                                                  tooltipText={reminderTooltipForThisPatient || "Reminder template (optional)"}
                                                  colorIcon={reminderTooltipForThisPatient ? "teal.500" : "orange.400"}
                                                  enableEdit={true}
                                                />
                                                <CreateMessageModal
                                                  patientId={pid}
                                                  triggerButton={
                                                    <Tooltip label="New reminder template">
                                                      <IconButton
                                                        aria-label="Create reminder template"
                                                        icon={<MdOutlinePostAdd size={18} />}
                                                        variant="ghost"
                                                        size="sm"
                                                      />
                                                    </Tooltip>
                                                  }
                                                />
                                              </HStack>
                                              <HStack spacing={2} align="center">
                                                <Input
                                                  type="datetime-local"
                                                  size="sm"
                                                  value={isoToInputValue(selectedISO)}
                                                  onChange={(e) => {
                                                    const raw = e.target.value;
                                                    let dt = DateTime.fromISO(raw, { zone: TZ });
                                                    if (dt.isValid) {
                                                      dt = dt.set({ second: 0, millisecond: 0 });
                                                      setReminderWhenByPid((prev) => ({ ...prev, [pid]: toIsoLocalSydney(dt) }));
                                                    }
                                                  }}
                                                  isDisabled={isThisRowWorking}
                                                />
                                                <Button
                                                  size="xs"
                                                  variant="outline"
                                                  onClick={() =>
                                                    setReminderWhenByPid((prev) => ({
                                                      ...prev,
                                                      [pid]: makeDefaultReminderISO(group.dateRange.startDate),
                                                    }))
                                                  }
                                                  isDisabled={isThisRowWorking}
                                                >
                                                  Reset Default
                                                </Button>
                                              </HStack>
                                              <Text fontSize="xs" color="gray.500">
                                                Default: 1 day before at 12 PM. Range: 15min-35days. ({TZ})
                                              </Text>
                                            </VStack>
                                          )}
                                        </Box>
                                      </VStack>
                                    </ModalBody>
                                    <ModalFooter>
                                      <HStack w="full" justify="space-between">
                                        <Button variant="ghost" onClick={() => setMsgOpenByPid((prev) => ({ ...prev, [pid]: false }))}>Cancel</Button>
                                        <Button
                                          size="sm"
                                          colorScheme="green"
                                          isDisabled={!tooltipForThisPatient || isThisRowWorking}
                                          onClick={() => handleClick(pid, group.dateRange.startDate, group.dateRange.endDate)}
                                          leftIcon={
                                            isThisRowWorking && processingPid === pid ? (
                                              <Spinner size="xs" />
                                            ) : (
                                              <RepeatIcon />
                                            )
                                          }
                                        >
                                          {isThisRowWorking && processingPid === pid ? "Processing..." : "Rebook"}
                                        </Button>
                                      </HStack>
                                    </ModalFooter>
                                  </ModalContent>
                                </Modal>
                              )}
                            </VStack>
                          </MotionBox>
                        );
                      })}
                    </VStack>
                  </CardBody>
                </Card>
              </MotionBox>
            );
          })}
        </MotionScrollBox>
      </Flex>
    </FadeInBox>
  );
};

export default CustomEventContent;
