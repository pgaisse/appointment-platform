import {
  Box,
  Button,
  Checkbox,
  CheckboxGroup,
  Grid,
  HStack,
  Radio,
  RadioGroup,
  Spinner,
  Stack,
} from '@chakra-ui/react';
import React, { useEffect, useState } from 'react';
import { appointmentsSchemaFormData, SelectedDatesSchema } from '@/schemas/AppointmentsSchema';
import { FieldError, FieldErrors, UseFormSetValue, UseFormTrigger } from 'react-hook-form';
import { SelectedDates, TimeBlock, WeekDay } from '@/types';
import { useGetCollection } from '@/Hooks/Query/useGetCollection';
import { formatDateSingle } from '@/Functions/FormatDateSingle';
import { error } from 'console';

const days: { label: WeekDay; short: string }[] = [
  { label: 'Monday', short: 'Mon' },
  { label: 'Tuesday', short: 'Tue' },
  { label: 'Wednesday', short: 'Wed' },
  { label: 'Thursday', short: 'Thu' },
  { label: 'Friday', short: 'Fri' },
  { label: 'Saturday', short: 'Sat' },
];

type Props = {
  hasSubmitted?: boolean;
  setSelectedDaysResp?: React.Dispatch<React.SetStateAction<Partial<Record<WeekDay, TimeBlock[]>>>>
  selectedDaysResp?: Partial<Record<WeekDay, TimeBlock[]>>
  trigger?: UseFormTrigger<appointmentsSchemaFormData>;
  setValue?: UseFormSetValue<any>;
  modeInput: boolean;
  isPending?: boolean;
};

export default function AvailabilityDates2({ hasSubmitted, trigger, setValue, isPending, setSelectedDaysResp, selectedDaysResp,
  modeInput = true,
}: Props) {
  const query = {
  };
  const limit = 20;

  const {
    data: timeSlots,
    isSuccess: timeSlotsIsSuccess,
    isFetching: timeSlotsIsFetching,
  } = useGetCollection<TimeBlock>('TimeBlock', { query, limit });
  const [duration, setDuration] = useState<number>(7);

  const [buildSelectedDates, setBuildSelectedDates] = useState<SelectedDatesSchema>();

  const [selectedDays, setSelectedDays] = useState<Partial<Record<WeekDay, TimeBlock[]>>>(selectedDaysResp ?? {});

  const toggleDay = (day: WeekDay) => {
    setSelectedDays((prev) => {
      const isActive = !!prev[day];
      if (isActive) {
        const { [day]: _, ...rest } = prev;
        return rest;
      } else {
        const allSlots: TimeBlock[] = timeSlots ?? [];
        return { ...prev, [day]: allSlots };
      }
    });

  };

  const updateTimeSlots = (day: WeekDay, selectedIds: string[]) => {
    const selected = timeSlots?.filter((slot) =>
      selectedIds.includes(String(slot.blockNumber))
    ) ?? [];
    setSelectedDays((prev) => ({ ...prev, [day]: selected }));
  };

  useEffect(() => {

    const startDate = new Date(); // O recibilo como prop
    const endDate = new Date(startDate); // crear copia para no modificar startDate
    endDate.setDate(endDate.getDate() + duration); // sumar 7 días

    const newSelectedDates: appointmentsSchemaFormData["selectedDates"] = {
    startDate,
    endDate,
    days: Object.entries(selectedDays).map(([weekDay, timeBlocks]) => ({
      weekDay: weekDay as WeekDay,
      timeBlocks: timeBlocks.map((block) => ({ _id: block._id ?? '' })),
    })),
  };
    if (setValue) {
      if (hasSubmitted) {
        setValue('selectedDates', newSelectedDates, { shouldValidate: true });
      } else {
        setValue('selectedDates', newSelectedDates);
      }
    }
console.log("Selected Days:", selectedDays);
console.log("hasSubmitted:", hasSubmitted);
console.log("newSelectedDates:", newSelectedDates);


  }, [selectedDays, duration, setBuildSelectedDates, hasSubmitted]);
  return (
    <Box p={4} width={'fit-content'}>
      {timeSlotsIsFetching ? (
        <Spinner />
      ) : (
        <Grid
          templateColumns={{
            base: 'repeat(6, max-content)',
            '2xl': 'repeat(6, max-content)',
          }}
          gap={4}
        >
          {/* Botones por día */}
          {days.map(({ label, short }) => (
            <Button
              isDisabled={!modeInput}
              key={label}
              colorScheme="blue"
              onClick={() => toggleDay(label)}
              minW="56px"
              px={2}
            >
              {short}
            </Button>
          ))}

          {/* Checkboxes por bloque */}
          {days.map(({ label }) => (
            <Box key={label} textAlign="left" minHeight="120px" minW="56px">
              <CheckboxGroup
                isDisabled={!modeInput}
                value={(selectedDays[label] ?? []).map((slot) =>
                  String(slot.blockNumber)
                )}
                onChange={(selectedIds) =>
                  updateTimeSlots(label, selectedIds as string[])
                }
              >
                <Stack spacing={2} mt={2} align="start">
                  {timeSlots?.map(({ blockNumber, short }) => (
                    <Checkbox key={blockNumber} value={String(blockNumber)}>
                      {short}
                    </Checkbox>
                  ))}
                </Stack>
              </CheckboxGroup>
            </Box>


          ))}

        </Grid>

      )}
      <Box mt={6} display={modeInput ? 'block' : 'none'}>
        <HStack spacing={4} alignItems="center">
          <RadioGroup
            value={duration.toString()}
            onChange={(value) => setDuration(Number(value))}
          >
            <HStack spacing={6}>
              <Radio value="7" colorScheme="blue">One week</Radio>
              <Radio value="14" colorScheme="blue">Two weeks</Radio>
              <Radio value="30" colorScheme="blue">One month</Radio>
            </HStack>
          </RadioGroup>
        </HStack>
      </Box>
    </Box>
  );
}
