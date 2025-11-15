import {
  Box,
  Text,
  Flex,
  Card,
  CardHeader,
  CardBody,
  Heading,
  Grid,
  GridItem,
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
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  RadioGroup,
  Radio,
  Stack,
  useColorModeValue,
  Kbd,
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
import { useProposeAppointmentDates } from "@/Hooks/Query/useProposeAppointmentDates";
import { useAuth0 } from "@auth0/auth0-react";
import ShowTemplateButton from "../Chat/CustomMessages/ShowTemplateButton";
import CreateMessageModal from "../Chat/CustomMessages/CreateCustomMessageModal";
import { MdOutlinePostAdd } from "react-icons/md";
import { getLatestSelectedAppDate, getSlotStart, getSlotEnd } from "@/Functions/getLatestSelectedAppDate";
import { formatDateWS } from "@/Functions/FormatDateWS";

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
  const { mutate, isPending } = useUpdateItems();
  const { mutate: proposeDates, isPending: isProposing } = useProposeAppointmentDates();
  const { mutate: sendSMS } = useSendAppointmentSMS();
  const toast = useToast();
  const queryClient = useQueryClient();
  const group = event?.[0];
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleCards, setVisibleCards] = useState(3);
  const [showLeftShadow, setShowLeftShadow] = useState(false);
  const [showRightShadow, setShowRightShadow] = useState(true);
  const [rescheduleButton, setRescheduleButton] = useState<string>("");
  const { user } = useAuth0();
  const navigate = useNavigate();
  // Slot selection modal state for patients with multiple dates
  const [slotSelectOpen, setSlotSelectOpen] = useState(false);
  const [slotSelectItem, setSlotSelectItem] = useState<AppointmentGroup["priorities"][number]["appointments"][number] | null>(null);
  const [slotSelectProposed, setSlotSelectProposed] = useState<{ start: Date; end: Date } | null>(null);
  const [selectedBaseSlotId, setSelectedBaseSlotId] = useState<string>("");

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
      const width = el.offsetWidth;
      const cards = Math.floor(width / (CARD_WIDTH + CARD_MARGIN));
      setVisibleCards(cards);
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
    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      window.removeEventListener("resize", updateUI);
      el.removeEventListener("wheel", onWheel);
    };
  }, []);

  // Nuevo flujo: 1) Crear slot + ContactAppointment vía endpoint transactional /appointments/:id/propose
  //              2) Enviar SMS de confirmación usando sendMessageAsk (ya existente)
  //              3) Invalidar queries y navegar
  const handleClick = async (
    item: (AppointmentGroup["priorities"][number]["appointments"][number]),
    proposedStart: Date,
    proposedEnd: Date,
    baseSlotId?: string
  ) => {
    const id = item._id;
    setRescheduleButton(id);
    let baseSlot: any = null;
    if (baseSlotId) {
      baseSlot = (item.selectedAppDates || []).find((s: any) => String(s._id) === String(baseSlotId));
    }
    if (!baseSlot) {
      baseSlot = getLatestSelectedAppDate(item.selectedAppDates);
    }
    const currentStart = baseSlot?.startDate ? new Date(baseSlot.startDate) : proposedStart;
    const currentEnd = baseSlot?.endDate ? new Date(baseSlot.endDate) : proposedEnd;

    // Ensure all dates are Date objects before calling toISOString
    const safeProposedStart = proposedStart instanceof Date ? proposedStart : new Date(proposedStart);
    const safeProposedEnd = proposedEnd instanceof Date ? proposedEnd : new Date(proposedEnd);
    const safeCurrentStart = currentStart instanceof Date ? currentStart : new Date(currentStart);
    const safeCurrentEnd = currentEnd instanceof Date ? currentEnd : new Date(currentEnd);

    proposeDates(
      {
        appointmentId: id,
        proposedStartDate: safeProposedStart.toISOString(),
        proposedEndDate: safeProposedEnd.toISOString(),
        currentStartDate: safeCurrentStart.toISOString(),
        currentEndDate: safeCurrentEnd.toISOString(),
        reason: "Rebooking",
        baseSlotId: baseSlotId,
      },
      {
        onSuccess: async (resp) => {
          const slotId = resp?.slotId;
          try {
            sendSMS({ appointmentId: id, msg: templateTextByPatient[id], slotId });
            toast({
              title: "Proposal & SMS Sent",
              description: "Slot proposed and confirmation SMS dispatched.",
              status: "info",
              duration: 3000,
              isClosable: true,
            });
          } catch (err: any) {
            toast({
              title: "Slot created but SMS failed",
              description: err.message || "Could not send SMS to the patient.",
              status: "warning",
              duration: 4000,
              isClosable: true,
            });
          }
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["DraggableCards"] }),
            queryClient.invalidateQueries({ queryKey: ["PriorityList"] }),
            queryClient.invalidateQueries({ queryKey: ["Appointment"] }),
          ]);
          navigate("/appointments/priority-list");
        },
        onError: (error: any) => {
          toast({
            title: "Error proposing slot",
            description: error?.message || "An error occurred while proposing dates.",
            status: "error",
            duration: 3200,
            isClosable: true,
          });
        },
      }
    );
  };

  if (!group || !group.dateRange || !group.priorities?.length) {
    return <Text>No appointment data available</Text>;
  }

  return (
    <FadeInBox initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: "easeOut" }}>
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
          {group.priorities.map((groupItem, index) => {
            const colorBase = groupItem?.priority?.color ?? "gray";
            const count = groupItem?.appointments?.length ?? 0;

            return (
              <MotionBox
                key={groupItem.priority._id || index}
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
                      <HStack
                        bg={`${colorBase}.200`}
                        px={3}
                        py={1.5}
                        borderRadius="md"
                        spacing={2}
                      >
                        <Box w="8px" h="8px" borderRadius="full" bg={`${colorBase}.500`} />
                        <Heading size="sm">{groupItem.priority.name}</Heading>
                      </HStack>
                      <Badge
                        rounded="full"
                        px={2.5}
                        py={1}
                        fontWeight="semibold"
                        colorScheme={colorBase}
                        variant="subtle"
                      >
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
                      {groupItem.appointments.map((item, idx) => {
                        const { icon, color } = getMatchLevelIcon(item.matchLevel);
                        const pid = item._id;
                        const tooltipForThisPatient = templateTextByPatient[pid] ?? "";
                        const iconColorForThisPatient = tooltipForThisPatient ? "green" : "gray";

                        return (
                          <MotionBox
                            key={idx}
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
                            {/* Header: nombre + match + teléfono */}
                            <HStack align="start" justify="space-between" spacing={3}>
                              <HStack spacing={2} minW={0}>
                                <Tooltip label={`${item.matchLevel}`}>
                                  <Icon as={icon} color={color} boxSize={5} />
                                </Tooltip>
                                <Icon as={CiUser} color="green" boxSize={4} />
                                <Tooltip label={`${item.nameInput} ${item.lastNameInput}`}>
                                  <Text fontWeight="semibold" noOfLines={1}>
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

                            {/* Chips de disponibilidad */}
                            {Array.isArray(item.matchedBlocks) && item.matchedBlocks.length > 0 ? (
                              <Wrap spacing={2}>
                                {item.matchedBlocks.map((block, bIdx) => (
                                  <WrapItem key={bIdx}>
                                    <Tooltip label={`${block.from} - ${block.to}`}>
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

                            {/* Proposed rebooking dates indicator */}
                            {(() => {
                              const latestSlot = getLatestSelectedAppDate(item.selectedAppDates);
                              const proposedStart = latestSlot?.proposed?.startDate;
                              const proposedEnd = latestSlot?.proposed?.endDate;
                              
                              if (proposedStart && proposedEnd) {
                                const start = new Date(proposedStart);
                                const end = new Date(proposedEnd);
                                const formattedDate = formatDateWS({ startDate: start, endDate: end });
                                
                                return (
                                  <VStack spacing={1} align="start" fontSize="xs">
                                    <Text color="blue.600" fontWeight="semibold">
                                      Proposed rebooking:
                                    </Text>
                                    <Text color="blue.500">
                                      {formattedDate}
                                    </Text>
                                  </VStack>
                                );
                              }
                              return null;
                            })()}

                            <Divider />

                            {/* Footer de acciones */}
                            <Flex align="center" justify="space-between" gap={2} wrap="wrap">
                              <HStack spacing={1.5}>
                                <ShowTemplateButton
                                  category="confirmation"
                                  selectedPatient={item._id}
                                  onSelectTemplate={(val: string) => {
                                    setTemplateTextByPatient((prev) => ({ ...prev, [pid]: val }));
                                  }}
                                  tooltipText={tooltipForThisPatient}
                                  colorIcon={iconColorForThisPatient}
                                />
                                <CreateMessageModal
                                  patientId={item._id}
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
                              </HStack>

                              <Button
                                size="sm"
                                colorScheme="green"
                                isDisabled={!tooltipForThisPatient}
                                onClick={() => {
                                  // Get proposed dates from the latest slot, fallback to group dates
                                  const latestSlot = getLatestSelectedAppDate(item.selectedAppDates);
                                  const proposedStart = latestSlot?.proposed?.startDate 
                                    ? new Date(latestSlot.proposed.startDate) 
                                    : group.dateRange.startDate;
                                  const proposedEnd = latestSlot?.proposed?.endDate 
                                    ? new Date(latestSlot.proposed.endDate) 
                                    : group.dateRange.endDate;
                                  
                                  // If multiple slots exist, open selection modal first
                                  const slots = item.selectedAppDates || [];
                                  if (Array.isArray(slots) && slots.length > 1) {
                                    setSlotSelectItem(item);
                                    setSlotSelectProposed({ start: proposedStart, end: proposedEnd });
                                    // Default to the slot closest to the previously selected calendar date (use proposedStart as anchor)
                                    const targetTs = proposedStart instanceof Date ? proposedStart.getTime() : new Date(proposedStart).getTime();
                                    const repTs = (s: any): number => {
                                      const candidates: number[] = [];
                                      if (s?.startDate) {
                                        const t = new Date(s.startDate).getTime();
                                        if (Number.isFinite(t)) candidates.push(t);
                                      }
                                      if (s?.proposed?.startDate) {
                                        const t = new Date(s.proposed.startDate).getTime();
                                        if (Number.isFinite(t)) candidates.push(t);
                                      }
                                      // Tie-breaker: updatedAt proximity if no date fields
                                      if (s?.updatedAt) {
                                        const t = new Date(s.updatedAt).getTime();
                                        if (Number.isFinite(t)) candidates.push(t);
                                      }
                                      return candidates.length ? candidates[0] : Number.POSITIVE_INFINITY;
                                    };
                                    let closest = slots[0];
                                    let bestDist = Math.abs(repTs(slots[0]) - targetTs);
                                    for (let i = 1; i < slots.length; i++) {
                                      const d = Math.abs(repTs(slots[i]) - targetTs);
                                      if (d < bestDist) {
                                        bestDist = d;
                                        closest = slots[i];
                                      }
                                    }
                                    setSelectedBaseSlotId(String((closest as any)?._id || ""));
                                    setSlotSelectOpen(true);
                                  } else {
                                    handleClick(item, proposedStart, proposedEnd, slots[0]?._id);
                                  }
                                }}
                                leftIcon={
                                  (isPending || isProposing) && rescheduleButton === item._id ? (
                                    <Spinner size="xs" color="white" />
                                  ) : (
                                    <RepeatIcon />
                                  )
                                }
                              >
                                {(() => {
                                  const latestSlot = getLatestSelectedAppDate(item.selectedAppDates);
                                  const hasProposed = latestSlot?.proposed?.startDate && latestSlot?.proposed?.endDate;
                                  return hasProposed ? "Rebook Proposed" : "Rebook";
                                })()}
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
      {/* Slot selection modal */}
      <Modal isOpen={slotSelectOpen} onClose={() => setSlotSelectOpen(false)} isCentered size="lg" motionPreset="slideInBottom">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader pb={1}>
            <HStack justify="space-between">
              <Text fontSize="lg" fontWeight="bold">Select Base Slot</Text>
              <Tag size="sm" colorScheme="purple" variant="subtle">Multi-slot patient</Tag>
            </HStack>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pt={2} pb={4}>
            <VStack align="stretch" spacing={4} maxH="340px" overflowY="auto" pr={2}
              sx={{ '&::-webkit-scrollbar': { width: '6px' }, '&::-webkit-scrollbar-thumb': { background: '#CBD5E0', borderRadius: '4px' } }}>
              <Box bg={useColorModeValue('gray.50','gray.700')} px={4} py={3} borderRadius="md" fontSize="sm" lineHeight={1.3}>
                Choose which existing scheduled window the new <Tag size="sm" colorScheme="blue" variant="solid">Proposed</Tag> dates should attach to.
                If accepted later, this slot becomes the confirmed appointment.
              </Box>
              {slotSelectItem && (
                <RadioGroup value={selectedBaseSlotId} onChange={(v) => setSelectedBaseSlotId(v)}>
                  <VStack align="stretch" spacing={3}>
                    {(slotSelectItem.selectedAppDates || []).map((s: any, idx: number) => {
                      const isActive = String(s._id) === String(selectedBaseSlotId);
                      const hasProposal = s.proposed?.startDate && s.proposed?.endDate;
                      const baseRange = formatDateWS({ startDate: new Date(s.startDate), endDate: new Date(s.endDate) });
                      const proposedRange = hasProposal ? formatDateWS({ startDate: new Date(s.proposed.startDate), endDate: new Date(s.proposed.endDate) }) : null;
                      return (
                        <Box
                          key={s._id}
                          position="relative"
                          borderWidth="1px"
                          borderRadius="lg"
                          p={4}
                          transition="all 0.18s ease"
                          bg={isActive ? useColorModeValue('purple.50','purple.700') : useColorModeValue('white','gray.800')}
                          borderColor={isActive ? 'purple.400' : useColorModeValue('gray.200','gray.600')}
                          boxShadow={isActive ? '0 0 0 2px var(--chakra-colors-purple-200)' : 'sm'}
                          _hover={{ borderColor: 'purple.300', cursor: 'pointer' }}
                          onClick={() => setSelectedBaseSlotId(String(s._id))}
                        >
                          <HStack justify="space-between" align="start" mb={2} flexWrap="wrap">
                            <Tag size="sm" colorScheme={hasProposal ? 'orange' : 'green'} variant={hasProposal ? 'subtle':'solid'}>{hasProposal ? 'Has Proposal' : 'Base Slot'}</Tag>
                            <HStack spacing={2} fontSize="xs" color="gray.500">
                              <Text># {idx + 1}</Text>
                              {isActive && <Tag size="sm" colorScheme="purple">Selected</Tag>}
                            </HStack>
                          </HStack>
                          <Radio value={s._id} size="sm">
                            <VStack align="start" spacing={1} pl={1} fontSize="sm">
                              <HStack>
                                <Text fontWeight="medium">Current:</Text>
                                <Text>{baseRange}</Text>
                              </HStack>
                              {proposedRange && (
                                <HStack>
                                  <Text fontWeight="medium" color="blue.600">Existing Proposed:</Text>
                                  <Text color="blue.600">{proposedRange}</Text>
                                </HStack>
                              )}
                            </VStack>
                          </Radio>
                        </Box>
                      );
                    })}
                  </VStack>
                </RadioGroup>
              )}
              {slotSelectProposed && (
                <Box borderWidth="1px" borderRadius="md" p={3} fontSize="sm" bg={useColorModeValue('blue.50','blue.900')}>
                  <Text fontWeight="semibold" mb={1}>New Proposed Dates</Text>
                  <Tag colorScheme="blue" variant="solid" fontWeight="normal">
                    {formatDateWS({ startDate: slotSelectProposed.start, endDate: slotSelectProposed.end })}
                  </Tag>
                </Box>
              )}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <HStack w="100%" justify="space-between">
              <HStack spacing={3} color="gray.500" fontSize="xs">
                <HStack><Kbd>⏎</Kbd><Text>Confirm</Text></HStack>
                <HStack><Kbd>Esc</Kbd><Text>Close</Text></HStack>
              </HStack>
              <Flex gap={2}>
                <Button variant="ghost" onClick={() => setSlotSelectOpen(false)}>Cancel</Button>
                <Button
                  colorScheme="purple"
                  isDisabled={!slotSelectItem || !slotSelectProposed || !selectedBaseSlotId}
                  onClick={() => {
                    if (slotSelectItem && slotSelectProposed && selectedBaseSlotId) {
                      handleClick(
                        slotSelectItem,
                        slotSelectProposed.start,
                        slotSelectProposed.end,
                        selectedBaseSlotId
                      );
                      setSlotSelectOpen(false);
                    }
                  }}
                >Confirm</Button>
              </Flex>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </FadeInBox>
  );
};

export default CustomEventContent;
