import { ColorScale } from '@/Functions/ColorScale';
import { formatAusPhoneNumber } from '@/Functions/formatAusPhoneNumber';
import { formatDateWS } from '@/Functions/FormatDateWS';
import { useEditItem } from '@/Hooks/Query/useEditItem';
import {
  AddIcon,
  CalendarIcon,
  InfoIcon,
  PhoneIcon,
  StarIcon
} from '@chakra-ui/icons';
import {
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Icon,
  Stack,
  Stat,
  StatLabel,
  StatNumber,
  useToast,
} from '@chakra-ui/react';
import React from 'react';
import { FaCalendarCheck } from 'react-icons/fa';
import CustomText from '../Text/CustomText';
import { Data } from './CustomBestApp';

type Props = {
  data: Data;
};

const CustomShowInfo: React.FC<Props> = ({ data:_data }:Props) => {
    console.log("_data", _data)
     console.log("CONCHETUMARE")
  const {
    id,
    phoneInput,
    note,
    cat,
    name,
    lastName,
    start,
    end,
    data,
    selectedStart,
    selectedEnd,
  } = _data;

  const toast = useToast();
  const formattedSlot = formatDateWS({
    startDate: new Date(start ?? ''),
    endDate: new Date(end ?? ''),
  });

  const formattedSelected = formatDateWS({
    startDate: new Date(selectedStart ?? ''),
    endDate: new Date(selectedEnd ?? ''),
  });

  const [p = '', q = '', f = '', s = ''] = data ?? [];
  const formattedPhone = phoneInput ? formatAusPhoneNumber(phoneInput) : '';
  const { mutate } = useEditItem({model:"Appointments"});
  const handleClick = (id: string) => {
    mutate(
      {
        id,
        data: { reschedule:  true,  selectedAppDates: [
    {
      startDate: start ,
      endDate: end ,
    }
  ] }, // solo este campo se actualizará
      },
      {
        onSuccess: () => {
          toast({
            title: "Form submitted.",
            description: "Your information was sent successfully.",
            status: "success",
            duration: 3000,
            isClosable: true,
          });
        },
      }
    );

    console.log(id);
  };


  return (
    <Box
    zIndex={19999}
      borderWidth="1px"
      borderRadius="2xl"
      p={5}
      boxShadow="md"
      bg="white"
      maxW="lg"
    >
      <Flex justify="space-between" align="center" mb={4}>
        <Heading size="md">
          {name} {lastName}
        </Heading>
        <Badge colorScheme="orange">{cat}</Badge>
      </Flex>

      <Stack spacing={4}>
        {formattedPhone && (
          <HStack spacing={2}>
            <Icon as={PhoneIcon} color="blue.500" />
            <CustomText fontWeight="medium" color="blue.600">
              {formattedPhone}
            </CustomText>
          </HStack>
        )}

        <Box>
          <HStack>
            <Icon as={CalendarIcon} color="gray.600" />
            <CustomText fontWeight="semibold">Slot Selected:</CustomText>
          </HStack>
          <CustomText>{formattedSlot}</CustomText>
        </Box>

        <Box>
          <HStack>
            <Icon as={FaCalendarCheck} color="green.500" />
            <CustomText fontWeight="semibold">Matching Selected Date:</CustomText>
          </HStack>
          <CustomText>{formattedSelected}</CustomText>
        </Box>

        <Box>
          <HStack>
            <Icon as={InfoIcon} color="purple.500" />
            <CustomText fontWeight="semibold">Note:</CustomText>
          </HStack>
          <CustomText whiteSpace="pre-line">{note}</CustomText>
        </Box>

        <Box>
          <HStack mb={2}>
            <Icon as={StarIcon} color="yellow.400" />
            <CustomText fontWeight="semibold">Metrics:</CustomText>
          </HStack>
          <Flex gap={4} wrap="wrap">
            <Stat>
              <StatLabel>Priority</StatLabel>
              <StatNumber color={ColorScale(p)}>{p}</StatNumber>
            </Stat>
            <Stat>
              <StatLabel>Arrival Order</StatLabel>
              <StatNumber color={ColorScale(q)}>{q}</StatNumber>
            </Stat>
            <Stat>
              <StatLabel>Selected Time</StatLabel>
              <StatNumber color={ColorScale(f)}>{f}</StatNumber>
            </Stat>
            <Stat>
              <StatLabel>Match %</StatLabel>
              <StatNumber color={ColorScale(s)}>{s}</StatNumber>
            </Stat>
          </Flex>
        </Box>

        <Flex justify="flex-end">
          <Button
            leftIcon={<AddIcon />}
            colorScheme="blue"
            onClick={() => handleClick(id ?? '')}
          >
            Add to Schedule
          </Button>
        </Flex>
      </Stack>
    </Box>
  );
};

export default CustomShowInfo;
