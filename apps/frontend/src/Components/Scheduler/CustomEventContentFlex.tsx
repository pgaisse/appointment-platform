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
} from "@chakra-ui/react";
import { useState, useRef, useEffect } from "react";
import { AppointmentGroup } from "@/types";
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
import { MdOutlinePostAdd, MdScheduleSend } from "react-icons/md";
import { RiCalendarScheduleLine } from "react-icons/ri";
import { DateTime } from "luxon";

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
  const [reminderCheckedByPatient, setReminderCheckedByPatient] = useState<Record<string, boolean>>({});
  const [tipOpenByPid, setTipOpenByPid] = useState<Record<string, boolean>>({});
  const [reminderWhenByPid, setReminderWhenByPid] = useState<Record<string, string>>({});

  // Mutations ahora con mutateAsync para encadenar con await
  const { mutateAsync: updateItemsAsync, isPending: isUpdating } = useUpdateItems();
  const { mutateAsync: sendSMSAsync, isPending: isSending } = useSendAppointmentSMS();

  const toast = useToast();
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
        },
      },
    ];

    try {
      // 1) Update de la cita
      await updateItemsAsync(payload);

      // 2) Confirmación instantánea
      await sendSMSAsync({ appointmentId: id, msg: templateTextByPatient[id] });
      toast({
        title: "Confirmation SMS sent",
        description: "The patient has been notified via SMS.",
        status: "info",
        duration: 3000,
        isClosable: true,
      });

      // 3) Recordatorio programado si corresponde
      const wantsReminder = reminderCheckedByPatient[id] ?? true;
      if (wantsReminder) {
        const candidateISO = reminderWhenByPid[id] || makeDefaultReminderISO(start);
        const check = enforceTwilioWindow(candidateISO);

        if (!check.ok) {
          toast({
            title: check.error === "tooFar" ? "Reminder not scheduled" : "Invalid reminder time",
            description:
              check.error === "tooFar"
                ? "Twilio only allows scheduling up to 35 days in the future. Please pick a closer date."
                : "Please choose a valid date and time for the reminder.",
            status: check.error === "tooFar" ? "info" : "warning",
            duration: 4000,
            isClosable: true,
          });
        } else {
          if ((check as any).adjusted) {
            setReminderWhenByPid((prev) => ({ ...prev, [id]: check.iso! }));
            toast({
              title: "Reminder time adjusted",
              description: "The reminder was too soon and was moved to about 15 minutes from now.",
              status: "warning",
              duration: 4000,
              isClosable: true,
            });
          }

          await sendSMSAsync({
            appointmentId: id,
            msg: templateTextByPatient[id],
            scheduleWithTwilio: true,
            whenISO: check.iso!,
            tz: TZ,
          });

          const human = parseSydney(check.iso!).toFormat("ccc, dd LLL yyyy • h:mm a");
          toast({
            title: "Reminder scheduled",
            description: `Scheduled for ${human} (${TZ}).`,
            status: "success",
            duration: 3000,
            isClosable: true,
          });
        }
      }

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
                        const iconColorForThisPatient = tooltipForThisPatient ? "green.500" : "red.500";

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
                            {/* Header */}
                            <HStack align="start" justify="space-between" spacing={3}>
                              <HStack spacing={2} minW={0}>
                                <Tooltip label={`${item.matchLevel}`}>
                                  <Icon as={icon} color={color} boxSize={5} />
                                </Tooltip>
                                <Icon as={CiUser} color="green" boxSize={4} />
                                <Tooltip label={`${item.nameInput} ${item.lastNameInput}`}>
                                  <Text fontWeight="semibold" noOfLines={1} textTransform="capitalize">
                                    {item.nameInput} {item.lastNameInput}
                                  </Text>
                                </Tooltip>
                              </HStack>

                              <HStack spacing={1} flexShrink={0}>
                                <Icon as={PhoneIcon} color="green" boxSize={3.5} />
                                <Tag size="sm" variant="subtle" colorScheme="gray">
                                  {formatAusPhoneNumber(item.phoneInput)}
                                </Tag>
                              </HStack>
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

                            {/* Actions */}
                            <Flex align="center" justify="space-between" gap={2} wrap="wrap">
                              <HStack spacing={1.5}>
                                <Tooltip
                                  label={
                                    item.selectedAppDates?.[0]?.startDate
                                      ? `Appointment Date: ${parseSydney(item.selectedAppDates[0].startDate).toFormat("ccc, dd LLL yyyy • h:mm a")} — ${parseSydney(item.selectedAppDates[0].endDate).toFormat("h:mm a")}`
                                      : "No appointment date selected"
                                  }
                                >
                                  <Box as="span">
                                    <Icon as={RiCalendarScheduleLine} />
                                  </Box>
                                </Tooltip>
                                <ShowTemplateButtonWithData
                                  category="confirmation"
                                  dataForTokens={{
                                    nameInput: item.nameInput,
                                    lastNameInput: item.lastNameInput,
                                    phoneInput: item.phoneInput,
                                    selectedAppDates: item.selectedAppDates || [],
                                  }}
                                  onSelectTemplate={(val: string) =>
                                    setTemplateTextByPatient((prev) => ({ ...prev, [pid]: val }))
                                  }
                                  tooltipText={tooltipForThisPatient}
                                  colorIcon={iconColorForThisPatient}
                                />
                                <CreateMessageModal
                                  patientId={pid}
                                  triggerButton={
                                    <IconButton
                                      aria-label="Create template"
                                      icon={<MdOutlinePostAdd size={20} />}
                                      variant="ghost"
                                      size="sm"
                                      borderRadius="full"
                                      _focusVisible={{ boxShadow: "0 0 0 3px rgba(66,153,225,0.6)" }}
                                    />
                                  }
                                />
                                <Tooltip
                                  label={`Reminder: ${selectedHuman} (${TZ})`}
                                  isOpen={!!tipOpenByPid[pid]}
                                  openDelay={150}
                                  closeDelay={0}
                                >
                                  <Box
                                    display="inline-flex"
                                    onMouseEnter={() =>
                                      setTipOpenByPid((prev) => ({ ...prev, [pid]: true }))
                                    }
                                    onMouseLeave={() =>
                                      setTipOpenByPid((prev) => ({ ...prev, [pid]: false }))
                                    }
                                    onFocus={() =>
                                      setTipOpenByPid((prev) => ({ ...prev, [pid]: true }))
                                    }
                                    onBlur={() =>
                                      setTipOpenByPid((prev) => ({ ...prev, [pid]: false }))
                                    }
                                  >
                                    <Checkbox
                                      size="sm"
                                      colorScheme="green"
                                      isChecked={reminderCheckedByPatient[pid] ?? true}
                                      onChange={(e) => {
                                        setReminderCheckedByPatient((prev) => ({
                                          ...prev,
                                          [pid]: e.target.checked,
                                        }));
                                        (e.currentTarget as HTMLInputElement).blur();
                                      }}
                                      isDisabled={isThisRowWorking}
                                    >
                                      Reminder
                                    </Checkbox>
                                  </Box>
                                </Tooltip>

                                {/* Editor del horario */}
                                <Popover placement="bottom-end" gutter={8} isLazy>
                                  <PopoverTrigger>
                                    <IconButton
                                      aria-label="Edit reminder time"
                                      icon={<MdScheduleSend size={18} />}
                                      size="sm"
                                      variant="ghost"
                                      isDisabled={!(reminderCheckedByPatient[pid] ?? true) || isThisRowWorking}
                                    />
                                  </PopoverTrigger>
                                  <Portal>
                                    <PopoverContent zIndex={10000} w="sm">
                                      <PopoverArrow />
                                      <PopoverCloseButton />
                                      <PopoverHeader fontWeight="semibold">
                                        Edit reminder date and time ({TZ})
                                      </PopoverHeader>
                                      <PopoverBody>
                                        <VStack align="stretch" spacing={3}>
                                          <Input
                                            type="datetime-local"
                                            value={isoToInputValue(selectedISO)}
                                            onChange={(e) => {
                                              const raw = e.target.value;
                                              let dt = DateTime.fromISO(raw, { zone: TZ });
                                              if (dt.isValid) {
                                                dt = dt.set({ second: 0, millisecond: 0 });
                                                setReminderWhenByPid((prev) => ({
                                                  ...prev,
                                                  [pid]: toIsoLocalSydney(dt),
                                                }));
                                              }
                                            }}
                                            isDisabled={isThisRowWorking}
                                          />
                                          <HStack justify="flex-end">
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() =>
                                                setReminderWhenByPid((prev) => ({
                                                  ...prev,
                                                  [pid]: makeDefaultReminderISO(group.dateRange.startDate),
                                                }))
                                              }
                                              isDisabled={isThisRowWorking}
                                            >
                                              Reset to default
                                            </Button>
                                          </HStack>
                                          <Text fontSize="xs" color="gray.600">
                                            Default is one day before the appointment at 12:00 PM ({TZ}). Twilio allows scheduling up to 35 days in advance and not earlier than about 15 minutes from now. If too soon, we will adjust automatically.
                                          </Text>
                                        </VStack>
                                      </PopoverBody>
                                    </PopoverContent>
                                  </Portal>
                                </Popover>
                              </HStack>

                              <VStack align="flex-end" spacing={1} w="full">
                                <HStack spacing={1} justify="flex-end" w="full">
                                  <Button
                                    size="sm"
                                    colorScheme="green"
                                    isDisabled={!tooltipForThisPatient || isThisRowWorking}
                                    onClick={() =>
                                      handleClick(
                                        pid,
                                        group.dateRange.startDate,
                                        group.dateRange.endDate
                                      )
                                    }
                                    leftIcon={
                                      isThisRowWorking && processingPid === pid ? (
                                        <Spinner size="xs" color="white" />
                                      ) : (
                                        <RepeatIcon />
                                      )
                                    }
                                  >
                                    Rebook
                                  </Button>
                                </HStack>
                              </VStack>
                            </Flex>
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
