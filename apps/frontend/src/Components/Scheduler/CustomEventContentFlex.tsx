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
import { useAuth0 } from "@auth0/auth0-react";
import ShowTemplateButton from "../Chat/CustomMessages/ShowTemplateButton";
import CreateMessageModal from "../Chat/CustomMessages/CreateCustomMessageModal";
import { MdOutlinePostAdd } from "react-icons/md";

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

  const handleClick = async (id: string, start: Date, end: Date) => {
    setRescheduleButton(id);

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

    mutate(payload, {
      onSuccess: async () => {
        try {
          sendSMS({ appointmentId: id, msg: templateTextByPatient[id] });
          toast({
            title: "Confirmation SMS Sent",
            description: "The patient has been notified via SMS.",
            status: "info",
            duration: 3000,
            isClosable: true,
          });
        } catch (err: any) {
          toast({
            title: "Failed to Send SMS",
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
          title: "Error Rescheduling Appointment",
          description:
            error?.message || "An error occurred while rescheduling the appointment.",
          status: "error",
          duration: 3000,
          isClosable: true,
        });
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ["Appointment"] });
        queryClient.invalidateQueries({ queryKey: ["DraggableCards"] });
        queryClient.refetchQueries({ queryKey: ["DraggableCards"] });
      },
    });
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
                                onClick={() =>
                                  handleClick(
                                    item._id,
                                    group.dateRange.startDate,
                                    group.dateRange.endDate
                                  )
                                }
                                leftIcon={
                                  isPending && rescheduleButton === item._id ? (
                                    <Spinner size="xs" color="white" />
                                  ) : (
                                    <RepeatIcon />
                                  )
                                }
                              >
                                Re-Schedule
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
    </FadeInBox>
  );
};

export default CustomEventContent;
