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
  Text,
} from '@chakra-ui/react';
import React, { useEffect, useState, useRef } from 'react';
import { DateRange } from './CustomBestApp';
import { appointmentsSchemaFormData } from '@/schemas/AppointmentsSchema';
import { UseFormSetValue, UseFormTrigger } from 'react-hook-form';
import selectedDatesToSelectedDays from '@/Functions/selectedDatesToSelectedDays';
import { formatDateSingle } from '@/Functions/FormatDateSingle';
import { getDateRangeLimits } from '@/Functions/getDateRangeLimits';

export type TimeSlot = 'Early Morning' | 'Late Morning' | 'Early Afternoon' | 'Late Afternoon';
export type WeekDay = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

const days: { wd: WeekDay; short: string }[] = [
  { wd: 'Monday', short: 'Mon' },
  { wd: 'Tuesday', short: 'Tue' },
  { wd: 'Wednesday', short: 'Wed' },
  { wd: 'Thursday', short: 'Thu' },
  { wd: 'Friday', short: 'Fri' },
  { wd: 'Saturday', short: 'Sat' },
];

const timeSlots: {
  wd: TimeSlot;
  short: string;
  from: string;
  to: string;
}[] = [
    { wd: 'Early Morning', short: 'EMor', from: '09:30', to: '11:30' },
    { wd: 'Late Morning', short: 'LMor', from: '11:30', to: '13:00' },
    { wd: 'Early Afternoon', short: 'EAft', from: '14:00', to: '16:00' },
    { wd: 'Late Afternoon', short: 'LAft', from: '16:00', to: '18:00' },
  ];

type Props = {
  setSelectedDates?: React.Dispatch<React.SetStateAction<DateRange[]>>;
  selectedDates?: DateRange[];
  trigger?: UseFormTrigger<appointmentsSchemaFormData>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setValue?: UseFormSetValue<any>;
  modeInput: boolean;
  isPending?: boolean;
};

export default function AvailabilityDates({
  modeInput = true,
  isPending = false,
  setValue,
  trigger,
  selectedDates,
  setSelectedDates,
}: Props) {
  const [selectedDays, setSelectedDays] = useState<Partial<Record<WeekDay, TimeSlot[]>>>({});
  const [isCharguing, setIsCharguing] = useState<boolean>(false);

  // Evita loop con una ref para saber si estamos sincronizando selectedDates -> selectedDays
  const syncingRef = useRef(false);

  // Sincroniza selectedDays cuando selectedDates cambia externamente
  useEffect(() => {
    if (!selectedDates) return;

    const newSelectedDays = selectedDatesToSelectedDays(selectedDates);

    const isSame = JSON.stringify(selectedDays) === JSON.stringify(newSelectedDays);
    if (isSame) return;

    syncingRef.current = true; // Avisamos que estamos sincronizando
    setSelectedDays(newSelectedDays);
  }, [selectedDates]);

  // Cuando selectedDays cambia, actualizamos selectedDates
  const [duration, setDuration] = useState<number>(7);

  useEffect(() => {
    if (syncingRef.current) {
      // Acabamos la sincronización, no generamos fechas para evitar loop
      syncingRef.current = false;
      return;
    }

    const tempDates: DateRange[] = [];
    const today = new Date();

    for (let i = 0; i < duration; i++) {
      const current = new Date(today);
      current.setDate(today.getDate() + i);
      const jsDay = current.getDay();
      const weekDay = days[jsDay - 1]?.wd;

      if (weekDay && selectedDays[weekDay]?.length) {
        selectedDays[weekDay].forEach((slot) => {
          const slotInfo = timeSlots.find((s) => s.wd === slot);
          if (slotInfo) {
            const [fromHour, fromMin] = slotInfo.from.split(':').map(Number);
            const [toHour, toMin] = slotInfo.to.split(':').map(Number);

            const start = new Date(current);
            start.setHours(fromHour, fromMin, 0, 0);

            const end = new Date(current);
            end.setHours(toHour, toMin, 0, 0);

            tempDates.push({ startDate: start, endDate: end });
          }
        });
      }
    }

    // Comparamos con selectedDates para no actualizar si es igual
    const oldDatesString = JSON.stringify(selectedDates);
    const newDatesString = JSON.stringify(tempDates);
    if (oldDatesString !== newDatesString) {
      if (setSelectedDates) setSelectedDates(tempDates);
      if (setValue) setValue('selectedDates', tempDates);
      if (trigger) trigger('selectedDates');
    }
  }, [selectedDays, duration, setSelectedDates, selectedDates, setValue, trigger]);

const toggleDay = (day: WeekDay) => {
  setSelectedDays((prev) => {
    const isActive = !!prev[day];
    if (isActive) {
      const { [day]: _, ...rest } = prev;
      return rest;
    } else {
      // Marcar automáticamente todos los rangos horarios
      const allSlots: TimeSlot[] = timeSlots.map((slot) => slot.wd);
      return { ...prev, [day]: allSlots };
    }
  });
};

  const updateTimeSlots = (day: WeekDay, slots: TimeSlot[]) => {
    setSelectedDays((prev) => ({ ...prev, [day]: slots }));
  };
  const HendleFillButton = () => {
    setIsCharguing(true);
    const newSelectedDays: Partial<Record<WeekDay, TimeSlot[]>> = {};
    days.forEach(({ wd }) => {
      newSelectedDays[wd] = timeSlots.map((slot) => slot.wd);
    });
    setSelectedDays(newSelectedDays);
    setTimeout(() => {
      setIsCharguing(false);
    }, 10); // Simula un retraso de 2 segundos  
  };

  // Lógica previa al return
  let minFormatted = '';
  let maxFormatted = '';

  if (!modeInput && selectedDates?.length) {
    const limits = getDateRangeLimits(selectedDates);
    minFormatted = limits ? formatDateSingle(limits.min) : '';
    maxFormatted = limits ? formatDateSingle(limits.max) : '';
  }

  return (
    <Box p={4} width={'fit-content'}>
      <Grid
        templateColumns={{ base: 'repeat(6, max-content)', '2xl': 'repeat(6, max-content)' }}
        gap={4}
      >
        {days.map(({ wd, short }) => (
          <Button
            isDisabled={!modeInput || isPending}
            key={wd}
            variant={selectedDays[wd] ? 'solid' : 'outline'}
            colorScheme="blue"
            onClick={() => toggleDay(wd)}
            minW="56px"
            px={2}
          >
            {short}
          </Button>
        ))}

        {days.map(({ wd }) => (
          <Box key={wd} textAlign="left" minHeight="120px" minW="56px">
            {selectedDays[wd] !== undefined && (
              <CheckboxGroup
                isDisabled={!modeInput || isPending}
                value={selectedDays[wd] || []}
                onChange={(slots) => updateTimeSlots(wd, slots as TimeSlot[])}
              >
                <Stack spacing={2} mt={2} align="start">
                  {timeSlots.map(({ wd: slot, short }) => (
                    <Checkbox key={slot} value={slot}>
                      {short}
                    </Checkbox>
                  ))}
                </Stack>
              </CheckboxGroup>
            )}
          </Box>
        ))}
      </Grid>

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
          <Button
            isDisabled={!modeInput || isPending}
            colorScheme="gray"
            width="100px"
            onClick={HendleFillButton}
          >
            {isCharguing ? <Spinner size="sm" /> : "Fill All"}
          </Button>
        </HStack>
      </Box>

      <Box my={4} display={!modeInput ? 'block' : 'none'}>
        <HStack>
          <Text fontSize="sm" color="gray.500">
            {`Availability from ${minFormatted} to ${maxFormatted}`}
          </Text>
        </HStack>
      </Box>
    </Box>
  );

}
