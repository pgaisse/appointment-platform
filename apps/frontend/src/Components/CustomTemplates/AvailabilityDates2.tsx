import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  CheckboxGroup,
  Divider,
  GridItem,
  HStack,
  Radio,
  RadioGroup,
  SimpleGrid,
  Spinner,
  Stack,
  Tag,
  Text,
  Tooltip,
  Wrap,
  WrapItem,
} from "@chakra-ui/react";
import {
  UseFormSetValue,
  UseFormTrigger,
} from "react-hook-form";
import { TimeBlock, WeekDay } from "@/types";
import { useGetCollection } from "@/Hooks/Query/useGetCollection";
import { formatDateSingle } from "@/Functions/FormatDateSingle";
import { AppointmentForm } from "@/schemas/AppointmentsSchema";
import { ContactForm } from "@/schemas/ContactSchema";

// ---- TIPOS COMPARTIDOS CON EL PADRE ----
// Idealmente exporta esto desde un archivo común (p.ej. src/forms.types.ts)
// y úsalo también en el padre para evitar símbolos distintos.
type AppFormValues = AppointmentForm | ContactForm;

type SelectedDatesFormValue = {
  startDate: Date;
  endDate: Date;
  days: { weekDay: WeekDay; timeBlocks: { _id: string }[] }[];
};

const DAYS: { label: WeekDay; short: string }[] = [
  { label: "Monday", short: "Mon" },
  { label: "Tuesday", short: "Tue" },
  { label: "Wednesday", short: "Wed" },
  { label: "Thursday", short: "Thu" },
  { label: "Friday", short: "Fri" },
  { label: "Saturday", short: "Sat" },
];

type Props = {
  hasSubmitted?: boolean;
  setSelectedDaysResp?: React.Dispatch<
    React.SetStateAction<Partial<Record<WeekDay, TimeBlock[]>>>
  >;
  selectedDaysResp?: Partial<Record<WeekDay, TimeBlock[]>>;
  // ⬇️ Alineado con el padre: mismo tipo de valores del formulario
  trigger?: UseFormTrigger<AppFormValues>;
  setValue?: UseFormSetValue<AppFormValues>;
  modeInput: boolean;
  isPending?: boolean;

  /** Opcional: fecha base para calcular el rango (default: hoy) */
  baseStartDate?: Date;
  /** Opcional: duración en días (7, 14, 30) */
  initialDuration?: number;
  /** Mostrar panel resumen (default: true) */
  showSummary?: boolean;
  /** Notifica cambios en selectedDates */
  onSelectedDatesChange?: (v: SelectedDatesFormValue) => void;
};

export default function AvailabilityDates2({
  hasSubmitted,
  trigger,
  setValue,
  isPending,
  setSelectedDaysResp,
  selectedDaysResp,
  modeInput = true,
  baseStartDate,
  initialDuration = 7,
  showSummary = true,
  onSelectedDatesChange,
}: Props) {
  const { data: timeSlots, isFetching } = useGetCollection<TimeBlock>(
    "TimeBlock",
    { query: {}, limit: 50 }
  );

  const [duration, setDuration] = useState<number>(initialDuration);
  const [selectedDays, setSelectedDays] = useState<
    Partial<Record<WeekDay, TimeBlock[]>>
  >(selectedDaysResp ?? {});

  // Mantén sincronizado si el padre te cambia el estado controlado
  useEffect(() => {
    if (selectedDaysResp) setSelectedDays(selectedDaysResp);
  }, [selectedDaysResp]);

  const startDate = useMemo(() => {
    const d = baseStartDate ? new Date(baseStartDate) : new Date();
    return d;
  }, [baseStartDate]);

  const endDate = useMemo(() => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + duration);
    return d;
  }, [startDate, duration]);

  const selectedDatesObj: SelectedDatesFormValue = useMemo(
    () => ({
      startDate,
      endDate,
      days: Object.entries(selectedDays).map(([weekDay, timeBlocks]) => ({
        weekDay: weekDay as WeekDay,
        timeBlocks: (timeBlocks ?? []).map((b) => ({ _id: b._id ?? "" })),
      })),
    }),
    [startDate, endDate, selectedDays]
  );

  const totalDaysSelected = useMemo(
    () => Object.keys(selectedDays).length,
    [selectedDays]
  );
  const totalBlocksSelected = useMemo(
    () =>
      Object.values(selectedDays).reduce(
        (acc, arr) => acc + (arr?.length ?? 0),
        0
      ),
    [selectedDays]
  );

  // Empuja el valor al form (y valida si el usuario ya intentó enviar)
  useEffect(() => {
    if (!setValue) return;
    // Cast puntual para evitar choques de Path/PathValue en unión
    setValue("selectedDates" as any, selectedDatesObj as any, {
      shouldValidate: !!hasSubmitted,
    });
    if (hasSubmitted) {
      // Cast puntual por la misma razón
      trigger?.("selectedDates" as any);
    }
    onSelectedDatesChange?.(selectedDatesObj);
  }, [selectedDatesObj, hasSubmitted, setValue, trigger, onSelectedDatesChange]);

  // Propaga hacia el padre si quiere mantener una copia
  useEffect(() => {
    setSelectedDaysResp?.(selectedDays);
  }, [selectedDays, setSelectedDaysResp]);

  const toggleDay = (day: WeekDay) => {
    if (!modeInput || !timeSlots) return;
    setSelectedDays((prev) => {
      const isActive = !!prev[day];
      if (isActive) {
        const { [day]: _, ...rest } = prev;
        return rest;
      } else {
        return { ...prev, [day]: timeSlots };
      }
    });
  };

  const updateTimeSlots = (day: WeekDay, selectedIds: string[]) => {
    if (!timeSlots) return;
    const selected = timeSlots.filter((slot) =>
      selectedIds.includes(String(slot.blockNumber))
    );
    setSelectedDays((prev) => ({ ...prev, [day]: selected }));
  };

  const selectAllForDay = (day: WeekDay) => {
    if (!timeSlots) return;
    setSelectedDays((prev) => ({ ...prev, [day]: timeSlots }));
  };

  const clearDay = (day: WeekDay) => {
    setSelectedDays((prev) => {
      const { [day]: _, ...rest } = prev;
      return rest;
    });
  };

  return (
    <Box p={4} width="100%">
      {/* Duración / rango */}
      <HStack spacing={6} alignItems="center" mb={4}>
        <RadioGroup
          value={duration.toString()}
          onChange={(v) => setDuration(Number(v))}
          isDisabled={!modeInput}
        >
          <HStack spacing={6}>
            <Radio value="7" colorScheme="blue">
              One week
            </Radio>
            <Radio value="14" colorScheme="blue">
              Two weeks
            </Radio>
            <Radio value="30" colorScheme="blue">
              One month
            </Radio>
          </HStack>
        </RadioGroup>

        {showSummary && (
          <HStack spacing={3} flexWrap="wrap" ml={{ base: 0, md: 6 }} aria-live="polite">
            <Tag size="md" colorScheme="blue" variant="subtle">
              Range: {formatDateSingle(startDate)} - {formatDateSingle(endDate)}
            </Tag>
            <Tag size="md" colorScheme="purple" variant="subtle">
              Days: {totalDaysSelected}
            </Tag>
            <Tag size="md" colorScheme="green" variant="subtle">
              Blocks: {totalBlocksSelected}
            </Tag>
          </HStack>
        )}
      </HStack>

      <Divider mb={4} />

      {isFetching ? (
        <Spinner />
      ) : (
        <SimpleGrid columns={{ base: 2, md: 3, lg: 6 }} gap={4} alignItems="flex-start">
          {DAYS.map(({ label, short }) => {
            const active = !!selectedDays[label];
            const checkedIds =
              (selectedDays[label] ?? []).map((s) => String(s.blockNumber)) || [];

            return (
              <GridItem key={label}>
                {/* Header del día */}
                <HStack justify="space-between" align="center" mb={2}>
                  <Button
                    size="sm"
                    isDisabled={!modeInput}
                    onClick={() => toggleDay(label)}
                    variant={active ? "solid" : "outline"}
                    colorScheme={active ? "blue" : "gray"}
                    w="48"
                  >
                    {short}
                  </Button>

                  
                </HStack>

                {/* Bloques */}
                <CheckboxGroup
                  isDisabled={!modeInput}
                  value={checkedIds}
                  onChange={(ids) => updateTimeSlots(label, ids as string[])}
                >
                  <Stack spacing={2} mt={2} align="start">
                    {timeSlots?.map(({ blockNumber, short }) => (
                      <Checkbox key={blockNumber} value={String(blockNumber)}>
                        {short}
                      </Checkbox>
                    ))}
                  </Stack>
                </CheckboxGroup>

                {/* Chips por día */}
                {showSummary && (selectedDays[label]?.length ?? 0) > 0 && (
                  <Box mt={3}>
                    <Wrap spacing={2}>
                      {selectedDays[label]!.map((b) => (
                        <WrapItem key={`${label}-${b.blockNumber}`}>
                          <Tag size="sm" variant="subtle" colorScheme="blue">
                            {b.short}
                          </Tag>
                        </WrapItem>
                      ))}
                    </Wrap>
                  </Box>
                )}
              </GridItem>
            );
          })}
        </SimpleGrid>
      )}

      {showSummary && totalBlocksSelected > 0 && (
        <Box mt={6}>
          <Divider mb={3} />
          <Text fontWeight="semibold" mb={2}>
            Selected range
          </Text>
          <Text fontSize="sm" color="gray.600">
            {formatDateSingle(startDate)} - {formatDateSingle(endDate)} •{" "}
            {totalDaysSelected} day{totalDaysSelected !== 1 ? "s" : ""},{" "}
            {totalBlocksSelected} block{totalBlocksSelected !== 1 ? "s" : ""}
          </Text>
        </Box>
      )}
    </Box>
  );
}
