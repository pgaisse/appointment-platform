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
import {
  PhoneIcon,
  RepeatIcon,
} from "@chakra-ui/icons";
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
  const { mutate, isPending } = useUpdateItems();
  const { mutate: sendSMS } = useSendAppointmentSMS();
  const toast = useToast();
  const queryClient = useQueryClient();
  const group = event?.[0];
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleCards, setVisibleCards] = useState(3);
  const [showLeftShadow, setShowLeftShadow] = useState(false);
  const [showRightShadow, setShowRightShadow] = useState(true);
  const [rescheduleButton, setRescheduleButton] = useState<string>("")
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
      // Solo mover horizontalmente si hay desplazamiento vertical
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault(); // prevenir scroll vertical
        const SCROLL_SPEED = 2; // ajusta esto según tu sensación
        el.scrollLeft += e.deltaY * SCROLL_SPEED;
        console.log("el.scrollLeft", el.scrollLeft)
      }
    };

    updateUI();
    window.addEventListener("resize", updateUI);
    el.addEventListener("wheel", onWheel, { passive: false }); // importante passive:false

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

        // ✅ Enviar SMS después del éxito del reschedule
        try {
          sendSMS({ appointmentId: id });
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
      onError: (error) => {
        toast({
          title: "Error Rescheduling Appointment",
          description:
            error.message ||
            "An error occurred while rescheduling the appointment.",
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
    <FadeInBox
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}

    >
      {/*<Box alignContent="center" display="flex" justifyContent="center" mb={4}   >
        <VStack>
          <Heading>Suggested Patients for this Available Slot</Heading>
          <HStack spacing={4}>
            <Tag size="lg" variant="solid" colorScheme="blue" bg="none" color="blue.600">
              <TagLabel p={2} color="black" fontWeight="normal">
                {`Range selected: ${formatDateWS(group.dateRange)}`}
              </TagLabel>
              <TagRightIcon as={MdDateRange} />
            </Tag>
          </HStack>
        </VStack>
      </Box>*/}

      <Flex justify="center" align="center" position="relative" >
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
              //whileHover={{ scale: 1.02 }}
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
                  h="280px" // Altura visible fija
                  overflowY="auto"
                  overflowX="hidden"
                  sx={{
                    "&::-webkit-scrollbar": {
                      width: "6px",
                    },
                    "&::-webkit-scrollbar-thumb": {
                      backgroundColor: "#a0aec0", // color gris premium
                      borderRadius: "4px",
                    },
                    "&::-webkit-scrollbar-track": {
                      backgroundColor: "#edf2f7",
                    },
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
                            {item.matchedBlocks?.map((block, idx) => (
                              <Tooltip key={idx} label={`${block.from} - ${block.to}`}>
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
                                group.dateRange.startDate,
                                group.dateRange.endDate
                              )
                            }
                            leftIcon={isPending && rescheduleButton === item._id ? <Spinner color='white' /> : <RepeatIcon />}
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
