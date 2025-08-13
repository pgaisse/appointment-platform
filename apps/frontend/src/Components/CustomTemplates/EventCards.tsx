import {
  Box,
  Flex,
  Badge,
  VStack,
  StackDivider,
  useColorModeValue,
  Icon,
  Tooltip,
  Tag,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import {
  HiOutlineMail,
  HiOutlinePhone,
  HiOutlineClipboardList,
} from "react-icons/hi";
import { Appointment } from "@/types";
import { DateRange } from "@/Hooks/Handles/useSlotSelection";
import CustomText from "../Text/CustomText";
import { formatAusPhoneNumber } from "@/Functions/formatAusPhoneNumber";
import { iconMap } from "../CustomIcons";
import { MdLocalHospital } from "react-icons/md";
import { formatDateWS } from "@/Functions/FormatDateWS";

type Props = {
  data: Appointment;
};

const MotionBox = motion(Box);

export default function EventCards({ data }: Props) {
  const cardBg = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const highlightColor = useColorModeValue("blue.500", "blue.300");
  const tagBg = useColorModeValue("gray.100", "gray.700");

  const formattedDate =
    data.selectedAppDates?.length > 0
      ? formatDateWS({
          startDate: data.selectedAppDates[0].startDate,
          endDate: data.selectedAppDates[0].endDate,
        })
      : "No date provided";

  return (
    <VStack
      spacing={6}
      divider={<StackDivider borderColor={borderColor} />}
      p={6}
      maxW="100%"
      mx="auto"
      align="stretch"
    >
      <MotionBox
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        bg={cardBg}
        borderRadius="2xl"
        p={6}
        boxShadow="xl"
        border="1px solid"
        borderColor={borderColor}
        _hover={{
          boxShadow: "2xl",
          transform: "scale(1.01)",
        }}
      >
        <Flex align="center" mb={4} gap={3}>
          <Box
            w={4}
            h={4}
            borderRadius="full"
            bg={data.color || "gray.400"}
            border="2px solid"
            borderColor="gray.300"
            flexShrink={0}
          />
          <CustomText fontSize="xl" fontWeight="bold" flex="1">
            {data.nameInput} {data.lastNameInput}
          </CustomText>

          {data.reschedule && (
            <Tooltip
              label="This appointment was rescheduled"
              hasArrow
              bg="purple.500"
              color="white"
              fontSize="sm"
            >
              <Badge colorScheme="purple" fontSize="xs" px={3}>
                Rescheduled
              </Badge>
            </Tooltip>
          )}
        </Flex>

        <VStack spacing={3} align="start">
          {data.emailInput && (
            <Flex align="center" gap={2}>
              <Icon as={HiOutlineMail} color={highlightColor} />
              <CustomText>{data.emailInput}</CustomText>
            </Flex>
          )}

          <Flex align="center" gap={2}>
            <Icon as={HiOutlinePhone} color={highlightColor} />
            <CustomText fontWeight="bold">Phone:</CustomText>
            <CustomText>{formatAusPhoneNumber(data.phoneInput)}</CustomText>
          </Flex>

          <Flex align="center" gap={2}>
            <Icon as={HiOutlineClipboardList} color={highlightColor} />
            <CustomText fontWeight="bold">Appointment Date:</CustomText>
            <CustomText>{formattedDate}</CustomText>
          </Flex>

          <Flex align="center" gap={2}>
            <Icon as={HiOutlineClipboardList} color={highlightColor} />
            <CustomText fontWeight="bold">Notes:</CustomText>
            <CustomText>{data.note || "No notes provided"}</CustomText>
          </Flex>

          <Flex align="center" gap={3} wrap="wrap">
            <Icon as={MdLocalHospital} color={highlightColor} />
            <CustomText fontWeight="bold">Priority & Treatment:</CustomText>

            {data.priority?.name && (
              <Tag
                variant="subtle"
                colorScheme={data.priority.color || "gray"}
                fontWeight="medium"
                px={3}
                borderRadius="md"
              >
                {data.priority.name}
              </Tag>
            )}

            {data.treatment?.name && (
              <Tooltip
                label={data.treatment.name}
                placement="top"
                fontSize="sm"
                hasArrow
                bg="teal.500"
                color="white"
              >
                <Flex align="center" gap={1}>
                  <Icon
                    as={iconMap[data.treatment.minIcon]}
                    color={`${data.treatment.color || "gray"}.500`}
                    fontSize="22px"
                  />
                  <CustomText>{data.treatment.name}</CustomText>
                </Flex>
              </Tooltip>
            )}
          </Flex>
        </VStack>
      </MotionBox>
    </VStack>
  );
}
