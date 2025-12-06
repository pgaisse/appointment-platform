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
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  RadioGroup,
  Radio,
  Stack,
  Textarea,
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
import ShowTemplateButton from "../Chat/CustomMessages/ShowTemplateButton";
import CreateLiquidTemplateModal from "../Chat/CustomMessages/CreateLiquidTemplateModal";
import { MdOutlinePostAdd } from "react-icons/md";
import { RiCalendarScheduleLine } from "react-icons/ri";
import { DateTime } from "luxon";
import { useProposeAppointmentDates } from "@/Hooks/Query/useProposeAppointmentDates";

const MotionBox = motion(Box);
const FadeInBox = motion(Box);
const MotionScrollBox = motion(Box);

const CARD_WIDTH = 420;
const CARD_MARGIN = 16;

interface Props {
  event: AppointmentGroup[];
}

const CustomEventContent: React.FC<Props> = ({ event }) => {
  const [templateTextByPatient, setTemplateTextByPatient] = useState<Record<string, string>>({});
  // (reminder tooltip state removed)

  // Mutations ahora con mutateAsync para encadenar con await
  const { mutateAsync: updateItemsAsync, isPending: isUpdating } = useUpdateItems();
  const { mutateAsync: sendSMSAsync, isPending: isSending } = useSendAppointmentSMS();
  const { mutateAsync: proposeAsync, isPending: isProposing } = useProposeAppointmentDates();

  const toast = useToast();
  const queryClient = useQueryClient();
  const group = event?.[0];
  const containerRef = useRef<HTMLDivElement>(null);
  const [showLeftShadow, setShowLeftShadow] = useState(false);
  const [showRightShadow, setShowRightShadow] = useState(true);
  const [processingPid, setProcessingPid] = useState<string>("");
  // Drawer open trigger versions for template chooser inside Select Base Slot modal
  const [openTemplateDrawerVersionByPid, setOpenTemplateDrawerVersionByPid] = useState<Record<string, number>>({});
  const navigate = useNavigate();

  const TZ = "Australia/Sydney";
  const isWorking = Boolean(processingPid) || isUpdating || isSending || isProposing;

  // ---------- Date helpers ----------
  const parseSydney = (val: Date | string | null | undefined): DateTime => {
    if (val instanceof Date) return DateTime.fromJSDate(val, { zone: TZ });
    const s = String(val ?? "");
    let dt = DateTime.fromISO(s, { zone: TZ });
    if (!dt.isValid) dt = DateTime.fromFormat(s, "yyyy-LL-dd'T'HH:mm:ss", { zone: TZ });
    return dt;
  };

  const titleCase = (raw: any): string => {
    const str = String(raw ?? "").trim().toLowerCase();
    if (!str) return "";
    return str.replace(/\b([a-záéíóúñü])([a-záéíóúñü']*)/gi, (_m, f, rest) => f.toUpperCase() + rest);
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
    return `${dayPart} • ${timePart}`;
  };

  // (Removed reminder initialization)

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
      // If a nested element can scroll vertically in the wheel direction, let it handle the event.
      const target = e.target as HTMLElement | null;
      const canNestedScrollVertically = (() => {
        let node: HTMLElement | null = target;
        while (node && node !== el) {
          const style = window.getComputedStyle(node);
          const oy = style.overflowY;
          const allowsY = oy === "auto" || oy === "scroll";
          if (allowsY && node.scrollHeight > node.clientHeight) {
            const atTop = node.scrollTop <= 0;
            const atBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 1;
            // If we are not at the boundary in the intended direction, allow vertical scroll
            if ((e.deltaY < 0 && !atTop) || (e.deltaY > 0 && !atBottom)) return true;
          }
          node = node.parentElement;
        }
        return false;
      })();

      if (canNestedScrollVertically) return; // do not hijack vertical scroll inside cards

      // Otherwise, transform vertical wheel into horizontal scrolling for the columns strip
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

  // ---------- Rebooking con selección de base slot ----------
  const [selectOpen, setSelectOpen] = useState(false);
  const [selectPid, setSelectPid] = useState<string>("");
  const [selectSlots, setSelectSlots] = useState<
    Array<{ _id: string; startDate: any; endDate: any; status?: string; proposed?: { startDate?: any; endDate?: any } }>
  >([]);
  const [selectedBaseSlotId, setSelectedBaseSlotId] = useState<string>("");
  const [recommendedSlotId, setRecommendedSlotId] = useState<string>("");
  const [selectPatientMeta, setSelectPatientMeta] = useState<{ name?: string; lastName?: string; phone?: string }>({});
  const [selectMode, setSelectMode] = useState<"sms" | "manual">("sms");
  // Removed selectedSlotByPid state (was being set but never read). Re-introduce if persistent per-patient slot tracking is required.

  const fmtRange = (s: any, e: any) => {
    const S = parseSydney(s);
    const E = parseSydney(e);
    if (!S.isValid || !E.isValid) return "—";
    const sameDay = S.hasSame(E, "day");
    const dayPart = sameDay
      ? S.toFormat("ccc, dd LLL yyyy")
      : `${S.toFormat("ccc, dd LLL yyyy")} → ${E.toFormat("ccc, dd LLL yyyy")}`;
    const timePart = `${S.toFormat("h:mm a")} — ${E.toFormat("h:mm a")}`;
    return `${dayPart} • ${timePart}`;
  };
  const fmtShortRange = (s?: any, e?: any) => {
    if (!s || !e) return null;
    const S = parseSydney(s);
    const E = parseSydney(e);
    if (!S.isValid || !E.isValid) return null;
    const sameDay = S.hasSame(E, "day");
    const dayPart = sameDay
      ? S.toFormat("dd LLL yyyy")
      : `${S.toFormat("dd LLL yyyy")} → ${E.toFormat("dd LLL yyyy")}`;
    const timePart = `${S.toFormat("HH:mm")}—${E.toFormat("HH:mm")}`;
    return `${dayPart} • ${timePart}`;
  };
  const statusBadge = (status?: string) => {
    const st = String(status || '').toLowerCase();
    const map: Record<string, { label: string; color: string }> = {
      pending: { label: 'Pending', color: 'yellow' },
      contacted: { label: 'Contacted', color: 'blue' },
      noconacted: { label: 'NoContacted', color: 'gray' },
      noconacted2: { label: 'NoContacted', color: 'gray' },
      confirmed: { label: 'Confirmed', color: 'green' },
      rescheduled: { label: 'Rescheduled', color: 'purple' },
      cancelled: { label: 'Cancelled', color: 'red' },
      canceled: { label: 'Cancelled', color: 'red' },
      rejected: { label: 'Rejected', color: 'red' },
      failed: { label: 'Failed', color: 'red' },
    };
    const key = map[st] ? st : (st === 'nocontacted' ? 'noconacted2' : 'pending');
    const cfg = map[key];
    return <Badge colorScheme={cfg.color} variant="subtle">{cfg.label}</Badge>;
  };

  const pickClosestSlotId = (slots: Array<{ _id: string; startDate: any; endDate: any }>) => {
    if (!slots?.length) return "";
    const target = parseSydney(group.dateRange.startDate).toMillis();
    let best = slots[0];
    let bestDiff = Math.abs(parseSydney(slots[0].startDate).toMillis() - target);
    for (let i = 1; i < slots.length; i++) {
      const d = Math.abs(parseSydney(slots[i].startDate).toMillis() - target);
      if (d < bestDiff) {
        bestDiff = d;
        best = slots[i];
      }
    }
    return String(best._id || "");
  };

  const openSelectModal = (
    pid: string,
    slots: Array<{ _id: string; startDate: any; endDate: any }>,
    meta?: { name?: string; lastName?: string; phone?: string }
  ) => {
    setSelectPid(pid);
    setSelectSlots(slots);
    const rec = pickClosestSlotId(slots);
    setSelectedBaseSlotId(rec);
    setRecommendedSlotId(rec);
    setSelectPatientMeta(meta || {});
    setSelectMode("sms");
    setSelectOpen(true);
  };

  const doPropose = async (pid: string, baseSlotId: string) => {
    setProcessingPid(pid);
    try {
      const s = new Date(group.dateRange.startDate as any);
      const e = new Date(group.dateRange.endDate as any);
      const current = selectSlots.find((x) => String(x._id) === String(baseSlotId));

      const resp = await proposeAsync({
        appointmentId: pid,
        proposedStartDate: s.toISOString(),
        proposedEndDate: e.toISOString(),
        currentStartDate: current?.startDate ? new Date(current.startDate).toISOString() : undefined,
        currentEndDate: current?.endDate ? new Date(current.endDate).toISOString() : undefined,
        reason: "Rebooking",
        baseSlotId,
      });

      try {
        await sendSMSAsync({ appointmentId: pid, msg: templateTextByPatient[pid], slotId: resp?.slotId });
        toast({
          title: "Proposal & SMS Sent",
          description: "Slot proposed and confirmation SMS dispatched.",
          status: "info",
          duration: 3000,
          isClosable: true,
        });
      } catch (err: any) {
        toast({
          title: "Slot proposed but SMS failed",
          description: err?.message || "Could not send SMS to the patient.",
          status: "warning",
          duration: 4000,
          isClosable: true,
        });
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["DraggableCards"] }),
        queryClient.invalidateQueries({ queryKey: ["PriorityList"] }),
        queryClient.invalidateQueries({ queryKey: ["Appointment"] }),
        queryClient.invalidateQueries({ queryKey: ["appointments-range"] }),
        queryClient.invalidateQueries({ queryKey: ["appointments-month-days"] }),
        queryClient.invalidateQueries({ queryKey: ["calendarAppointments"] }),
      ]);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["DraggableCards"] }),
        queryClient.refetchQueries({ queryKey: ["calendarAppointments"] }),
        queryClient.refetchQueries({ queryKey: ["Appointment"] }),
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
      setSelectOpen(false);
    }
  };

  const doManualChange = async (pid: string, baseSlotId: string) => {
    setProcessingPid(pid);
    try {
      const s = new Date(group.dateRange.startDate as any);
      const e = new Date(group.dateRange.endDate as any);

      // Build next selectedAppDates array updating the chosen base slot to new start/end
      const nextArray = (selectSlots || []).map((slot) => {
        if (String(slot._id) !== String(baseSlotId)) return slot as any;
        return {
          ...slot,
          startDate: s,
          endDate: e,
        } as any;
      });

      const payload = [
        {
          table: "Appointment",
          id_field: "_id",
          id_value: pid,
          data: { selectedAppDates: nextArray },
        },
      ];

      await updateItemsAsync(payload as any);

      toast({
        title: "Date updated",
        description: "Appointment date changed without SMS.",
        status: "success",
        duration: 3000,
        isClosable: true,
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["DraggableCards"] }),
        queryClient.invalidateQueries({ queryKey: ["PriorityList"] }),
        queryClient.invalidateQueries({ queryKey: ["Appointment"] }),
        queryClient.invalidateQueries({ queryKey: ["appointments-range"] }),
        queryClient.invalidateQueries({ queryKey: ["appointments-month-days"] }),
        queryClient.invalidateQueries({ queryKey: ["calendarAppointments"] }),
      ]);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["DraggableCards"] }),
        queryClient.refetchQueries({ queryKey: ["calendarAppointments"] }),
        queryClient.refetchQueries({ queryKey: ["Appointment"] }),
      ]);

      navigate("/appointments/priority-list");
    } catch (error: any) {
      toast({
        title: "Error updating date",
        description: error?.message || "An unexpected error occurred.",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setProcessingPid("");
      setSelectOpen(false);
    }
  };

  if (!group || !group.dateRange || !group.priorities?.length) {
    return <Text>No appointment data available</Text>;
  }

  // ------- Barra general con el horario seleccionado + default reminder -------
  const generalSlotHuman = formatGroupSlotHuman(group.dateRange.startDate, group.dateRange.endDate);

  return (
    <FadeInBox initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: "easeOut" }}>
      {/* Barra informativa general */}
      <Box
        mb={3}
        w="full"
        position="sticky"
        top={0}
        zIndex={10}
        bgGradient="linear(to-r, gray.50, white)"
        border="1px solid"
        borderColor="gray.200"
        boxShadow="sm"
        borderRadius="2xl"
        px={4}
        py={3}
        backdropFilter="saturate(110%)"
      >
        <VStack align="start" spacing={2}>
          <HStack spacing={3} align="center">
            <Icon as={RiCalendarScheduleLine} color="blue.500" />
            <Text fontWeight="bold">Selected slot</Text>
            <Tag colorScheme="blue" variant="solid" borderRadius="md">
              {generalSlotHuman}
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
          overflowY="auto"
          scrollSnapType="x mandatory"
          onScroll={handleScroll}
          px={2}
          css={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            WebkitOverflowScrolling: "touch",
            // Allow vertical gestures so nested scrollable elements (cards) can scroll on touch devices
            touchAction: "auto",
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

                        const isThisRowWorking = processingPid === pid || isWorking;

                        // Get current slot info from selectedAppDates
                        const currentSlot = Array.isArray(item.selectedAppDates) && item.selectedAppDates.length > 0 
                          ? item.selectedAppDates[0] 
                          : null;

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
                                  <Text fontWeight="semibold" noOfLines={1}>
                                    {titleCase(item.nameInput)} {titleCase(item.lastNameInput)}
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

                            {/* Current Slot Info */}
                            {currentSlot && (
                              <Box bg="blue.50" borderRadius="md" px={2.5} py={2} borderWidth="1px" borderColor="blue.100">
                                <HStack spacing={2} align="center">
                                  <Icon as={RiCalendarScheduleLine} color="blue.600" boxSize={4} />
                                  <VStack align="start" spacing={0}>
                                    <Text fontSize="xs" fontWeight="semibold" color="blue.800">
                                      Current Slot
                                    </Text>
                                    <Text fontSize="xs" color="blue.700" noOfLines={1}>
                                      {parseSydney(currentSlot.startDate).toFormat("dd LLL • HH:mm")} — {parseSydney(currentSlot.endDate).toFormat("HH:mm")}
                                    </Text>
                                  </VStack>
                                  {currentSlot.status && (
                                    <Box ml="auto">
                                      {statusBadge(currentSlot.status)}
                                    </Box>
                                  )}
                                </HStack>
                              </Box>
                            )}

                            {/* Availability */}
                            {Array.isArray(item.matchedBlocks) && item.matchedBlocks.length > 0 && (
                              <Box>
                                <Text fontSize="xs" fontWeight="semibold" color="gray.600" mb={1}>
                                  Patient Availability
                                </Text>
                                <Wrap spacing={1.5}>
                                  {item.matchedBlocks.map((block, bIdx) => (
                                    <WrapItem key={bIdx}>
                                      <Tooltip label={`${block.from} — ${block.to}`}>
                                        <Tag size="sm" variant="solid" colorScheme="gray">
                                          {block.short}
                                        </Tag>
                                      </Tooltip>
                                    </WrapItem>
                                  ))}
                                </Wrap>
                              </Box>
                            )}

                            <Divider />

                            {/* Actions */}
                            <Flex align="center" justify="flex-end" gap={2} wrap="wrap">
                              <Button
                                size="sm"
                                colorScheme="green"
                                isDisabled={isThisRowWorking}
                                onClick={() => {
                                      const slots = Array.isArray(item.selectedAppDates)
                                        ? item.selectedAppDates.map((s) => ({ _id: s._id, startDate: s.startDate, endDate: s.endDate, status: (s as any).status, proposed: (s as any).proposed }))
                                        : [];
                                      if (!slots.length) {
                                        toast({
                                          title: "No existing dates",
                                          description: "This patient has no base slot to edit.",
                                          status: "warning",
                                          duration: 3000,
                                          isClosable: true,
                                        });
                                        return;
                                      }
                                      // Always open Select Base Slot modal (also handles message selection)
                                      openSelectModal(pid, slots, { name: titleCase(item.nameInput), lastName: titleCase(item.lastNameInput), phone: item.phoneInput });
                                    }}
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

      {/* Modal de selección de slot base */}
      <Modal isOpen={selectOpen} onClose={() => setSelectOpen(false)} isCentered size="lg" motionPreset="slideInBottom">
        <ModalOverlay bg="blackAlpha.500" backdropFilter="blur(4px)" />
        <ModalContent>
          <ModalHeader>
            <VStack align="stretch" spacing={1}>
              <HStack justify="space-between" align="center">
                <Text fontSize="lg" fontWeight="bold">Select Base Slot</Text>
                {selectSlots.length > 1 && (
                  <Badge size="sm" colorScheme="purple" variant="subtle">Multi-slot patient</Badge>
                )}
              </HStack>
              {(selectPatientMeta?.name || selectPatientMeta?.lastName || selectPatientMeta?.phone) && (
                <HStack spacing={3} color="gray.600">
                  <Icon as={CiUser} />
                  <Text fontSize="sm" noOfLines={1}>
                    {(selectPatientMeta?.name || "")} {(selectPatientMeta?.lastName || "")} • {formatAusPhoneNumber(selectPatientMeta?.phone || "")}
                  </Text>
                </HStack>
              )}
            </VStack>
          </ModalHeader>
          <Divider />
          <ModalBody>
            <VStack align="stretch" spacing={3} pt={2} maxH="60vh" overflowY="auto">
              {/* Mode selector: Consult via SMS vs Manual change */
              }
              <Box>
                <Text fontWeight="semibold" mb={2}>How would you like to proceed?</Text>
                <RadioGroup value={selectMode} onChange={(v) => setSelectMode(v as any)}>
                  <Stack direction="row" spacing={6}>
                    <Radio value="sms" colorScheme="purple">Consult via SMS</Radio>
                    <Radio value="manual" colorScheme="green">Manual change (no SMS)</Radio>
                  </Stack>
                </RadioGroup>
              </Box>

              <RadioGroup value={selectedBaseSlotId} onChange={(v) => setSelectedBaseSlotId(String(v))}>
                <Stack direction="column" spacing={3}>
                  {[...selectSlots]
                    .sort((a, b) => new Date(a.startDate as any).getTime() - new Date(b.startDate as any).getTime())
                    .map((s, idx) => {
                      const id = String(s._id);
                      const isSelected = id === selectedBaseSlotId;
                      const isRecommended = id === recommendedSlotId;
                      const hasProposed = Boolean(s?.proposed?.startDate && s?.proposed?.endDate);
                      const proposedText = fmtShortRange(s?.proposed?.startDate, s?.proposed?.endDate);
                      return (
                        <Box
                          key={id}
                          role="button"
                          onClick={() => setSelectedBaseSlotId(id)}
                          borderWidth="2px"
                          borderColor={isSelected ? "green.400" : "gray.200"}
                          bg={isSelected ? "green.50" : "white"}
                          rounded="xl"
                          p={3}
                          transition="all 0.2s ease"
                          _hover={{ borderColor: isSelected ? "green.500" : "gray.300", bg: isSelected ? "green.100" : "gray.50" }}
                        >
                          <HStack align="start" justify="space-between">
                            <HStack align="center" spacing={3}>
                              <Badge rounded="full" px={2} colorScheme="gray" variant="subtle">{idx + 1}</Badge>
                              <Radio value={id} colorScheme="green" />
                              <VStack align="start" spacing={0}>
                                <HStack spacing={2} align="center">
                                  <Icon as={RiCalendarScheduleLine} color="blue.500" />
                                  <Text fontWeight="semibold" color="gray.800" fontSize="sm">
                                    {fmtRange(s.startDate, s.endDate)}
                                  </Text>
                                </HStack>
                                <HStack spacing={2} pt={1} align="center">
                                  {statusBadge(s.status)}
                                  {hasProposed && (
                                    <Badge colorScheme="blue" variant="subtle">Proposed</Badge>
                                  )}
                                  {isRecommended && (
                                    <Badge colorScheme="cyan" variant="subtle">Recommended</Badge>
                                  )}
                                </HStack>
                                {hasProposed && proposedText && (
                                  <Text fontSize="xs" color="blue.700" mt={1}>
                                    Proposed: {proposedText}
                                  </Text>
                                )}
                              </VStack>
                            </HStack>
                          </HStack>
                        </Box>
                      );
                    })}
                </Stack>
              </RadioGroup>

              {/* Branch: SMS vs Manual */}
              {selectMode === "sms" ? (
                <>
                  <Divider my={3} />
                  {/* Custom message selection inside Select Base Slot */}
                  <Box>
                    <HStack justify="space-between" align="center" mb={2}>
                      <Text fontWeight="semibold">Custom message</Text>
                      {/* Inline template chooser tied to the currently selected slot */}
                      <HStack>
                        <Text fontSize="xs" color="gray.600">Choose a template:</Text>
                        <ShowTemplateButton
                          category="confirmation"
                          selectedPatient={selectPid}
                          calendarSlot={{ startDate: group.dateRange.startDate as any, endDate: group.dateRange.endDate as any }}
                          selectedSlot={(() => {
                            const s = selectSlots.find((x) => String(x._id) === String(selectedBaseSlotId));
                            return s ? { _id: s._id as any, startDate: s.startDate as any, endDate: s.endDate as any } : undefined;
                          })()}
                          onSelectTemplate={(val: string) =>
                            setTemplateTextByPatient((prev) => ({ ...prev, [selectPid]: val }))
                          }
                          tooltipText="Select template"
                          colorIcon={templateTextByPatient[selectPid] ? 'green.500' : 'purple.500'}
                          initialTypeFilter="liquid"
                          externalOpenVersion={openTemplateDrawerVersionByPid[selectPid] || 0}
                        />
                        <CreateLiquidTemplateModal
                          trigger={
                            <IconButton
                              aria-label="Create template"
                              icon={<MdOutlinePostAdd size={18} />}
                              variant="ghost"
                              size="sm"
                              colorScheme="purple"
                            />
                          }
                          defaultCategory="confirmation"
                          defaultAppointmentId={selectPid}
                          calendarSlot={{ startDate: group.dateRange.startDate as any, endDate: group.dateRange.endDate as any }}
                          selectedSlot={(() => {
                            const s = selectSlots.find((x) => String(x._id) === String(selectedBaseSlotId));
                            return s ? { _id: s._id as any, startDate: s.startDate as any, endDate: s.endDate as any } : undefined;
                          })()}
                          onCreated={() => setOpenTemplateDrawerVersionByPid(prev => ({ ...prev, [selectPid]: (prev[selectPid] || 0) + 1 }))}
                        />
                      </HStack>
                    </HStack>
                    <Text fontSize="xs" color="gray.500" mb={1}>You can edit the message below before sending.</Text>
                    <Textarea
                      value={templateTextByPatient[selectPid] || ''}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTemplateTextByPatient((prev) => ({ ...prev, [selectPid]: e.target.value }))}
                      placeholder={selectedBaseSlotId ? 'Your message will use the selected slot: :StartDate, :StartTime, :EndTime, etc.' : 'Select a base slot to enable date/time tokens.'}
                      minH="120px"
                      fontFamily="mono"
                      fontSize="sm"
                    />
                  </Box>
                </>
              ) : (
                <>
                  <Divider my={3} />
                  <Box bg="green.50" borderWidth="1px" borderColor="green.200" p={3} rounded="md">
                    <Text fontSize="sm" color="green.800">
                      Manual path selected. No SMS will be sent. The selected base slot will be updated to the selected time range shown at the top.
                    </Text>
                  </Box>
                </>
              )}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <HStack spacing={3}>
              <Button variant="ghost" onClick={() => setSelectOpen(false)}>Cancel</Button>
              {selectMode === "sms" ? (
                <Button colorScheme="purple" isDisabled={!selectedBaseSlotId || !templateTextByPatient[selectPid] || isWorking} onClick={() => {
                  if (!selectedBaseSlotId) return;
                  const chosen = selectSlots.find((s) => String(s._id) === String(selectedBaseSlotId));
                  if (!chosen) return;
                  doPropose(selectPid, String(selectedBaseSlotId));
                }}>
                  {isWorking ? <Spinner size="sm" /> : "Confirm & Send"}
                </Button>
              ) : (
                <Button colorScheme="green" isDisabled={!selectedBaseSlotId || isWorking} onClick={() => {
                  if (!selectedBaseSlotId) return;
                  const chosen = selectSlots.find((s) => String(s._id) === String(selectedBaseSlotId));
                  if (!chosen) return;
                  doManualChange(selectPid, String(selectedBaseSlotId));
                }}>
                  {isWorking ? <Spinner size="sm" /> : "Save without SMS"}
                </Button>
              )}
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </FadeInBox>
  );
};

export default CustomEventContent;
