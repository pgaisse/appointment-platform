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

const MotionBox = motion(Box);
const FadeInBox = motion(Box);
const MotionScrollBox = motion(Box);

const CARD_WIDTH = 320;
const CARD_MARGIN = 16;

interface Props {
  event: AppointmentGroup[];
}

const CustomEventContent: React.FC<Props> = ({ event }) => {
  // ✅ Usa mutateAsync para poder await/try-catch
  const { mutateAsync: updateItems, isPending: isUpdating } = useUpdateItems();
  const { mutateAsync: sendSMSAsync } = useSendAppointmentSMS();

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
    if (!id) {
      toast({ title: "Invalid appointment ID", status: "error" });
      return;
    }

    setRescheduleButton(id);

    // ⏱️ Normaliza a ISO para evitar problemas de TZ
    const startISO = new Date(start).toISOString();
    const endISO = new Date(end).toISOString();

    const payload = [
      {
        table: "Appointment",
        id_field: "_id",
        id_value: id,
        // Si tu backend requiere operador: usa $set
        // data: { $set: {
        //   "selectedAppDates.0.proposed.startDate": startISO,
        //   "selectedAppDates.0.proposed.endDate": endISO,
        // }},
        data: {
          "selectedAppDates.0.proposed.startDate": startISO,
          "selectedAppDates.0.proposed.endDate": endISO,
        },
      },
    ];

    try {
      // Espera a que el backend termine
      await updateItems(payload);

      // Envía SMS una vez confirmada la actualización
      await sendSMSAsync({ appointmentId: id });

      toast({
        title: "Confirmation SMS Sent",
        description: "The patient has been notified via SMS.",
        status: "info",
        duration: 3000,
        isClosable: true,
      });

      // Invalida una sola vez y espera antes de navegar
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["DraggableCards"] }),
        queryClient.invalidateQueries({ queryKey: ["PriorityList"] }),
        queryClient.invalidateQueries({ queryKey: ["Appointment"] }),
      ]);

      navigate("/appointments/priority-list");
    } catch (err: any) {
      toast({
        title: "Error Rescheduling Appointment",
        description:
          err?.message || "An error occurred while rescheduling the appointment.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      // Opcional: limpiar estado del botón
      // setRescheduleButton("");
    }
  };

  if (!group || !group.dateRange || !group.priorities?.length) {
    return <Text>No appointment data available</Text>;
  }

  return (
    <FadeInBox
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
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
          sx={{
            "&::-webkit-scrollbar": { display: "none" },
          }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {group.priorities.map((groupItem, index) => (
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
                p={1}
                borderRadius={10}
                border="1px"
                borderColor="gray.50"
                bg={`${groupItem.priority.color}.300`}
              >
                <CardHeader>
                  <Heading
                    size="sm"
                    mb={2}
                    bg={`${groupItem.priority.color}.200`}
                    p={3}
                    borderRadius="md"
                    width="fit-content"
                    display="flex"
                    alignItems="center"
                    gap={2}
                  >
                    {groupItem.priority.name}
                  </Heading>
                </CardHeader>

                <CardBody
                  p={3}
                  bg="white"
                  borderRadius="10px"
                  h="280px"
                  overflowY="auto"
                  overflowX="hidden"
                  sx={{
                    "&::-webkit-scrollbar": { width: "6px" },
                    "&::-webkit-scrollbar-thumb": {
                      backgroundColor: "#a0aec0",
                      borderRadius: "4px",
                    },
                    "&::-webkit-scrollbar-track": { backgroundColor: "#edf2f7" },
                  }}
                >
                  {groupItem.appointments.map((item, idx) => {
                    const { icon, color } = getMatchLevelIcon(item.matchLevel);

                    return (
                      <Grid
                        templateRows="repeat(4, auto)"
                        templateColumns="3fr"
                        border="1px solid"
                        borderColor="gray.100"
                        borderRadius="md"
                        key={idx}
                        w="100%"
                        gap={0}
                        mb={3}
                        py={2}
                        px={4}
                      >
                        <GridItem>
                          <HStack spacing={2}>
                            <Tooltip key={idx} label={`${item.matchLevel}`}>
                              <Icon as={icon} color={color} boxSize={5} />
                            </Tooltip>
                            {item.matchedBlocks?.map((block, i2) => (
                              <Tooltip key={i2} label={`${block.from} - ${block.to}`}>
                                <Tag>{block.short}</Tag>
                              </Tooltip>
                            ))}
                          </HStack>
                        </GridItem>

                        <GridItem>
                          <HStack spacing={2}>
                            <Icon as={CiUser} color="green" />
                            <Text fontWeight="bold" isTruncated>
                              {item.nameInput} {item.lastNameInput}
                            </Text>
                          </HStack>
                        </GridItem>

                        <GridItem>
                          <HStack>
                            <Icon as={PhoneIcon} color="green" />
                            <Text color="gray.500">
                              {formatAusPhoneNumber(item.phoneInput)}
                            </Text>
                          </HStack>
                        </GridItem>

                        <GridItem>
                          <Button
                            w="full"
                            size="sm"
                            colorScheme="green"
                            onClick={() =>
                              handleClick(
                                item._id,
                                new Date(group.dateRange.startDate),
                                new Date(group.dateRange.endDate)
                              )
                            }
                            isDisabled={isUpdating && rescheduleButton === item._id}
                            leftIcon={
                              isUpdating && rescheduleButton === item._id ? (
                                <Spinner color="white" />
                              ) : (
                                <RepeatIcon />
                              )
                            }
                          >
                            Re-Schedule
                          </Button>
                        </GridItem>
                      </Grid>
                    );
                  })}
                </CardBody>
              </Card>
            </MotionBox>
          ))}
        </MotionScrollBox>
      </Flex>
    </FadeInBox>
  );
};

export default CustomEventContent;
