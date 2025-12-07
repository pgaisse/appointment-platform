import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  HStack,
  IconButton,
  Spinner,
  Text,
  Tooltip,
  useColorModeValue,
  VStack,
} from "@chakra-ui/react";
import { CheckIcon, CloseIcon } from "@chakra-ui/icons";
import { TimeBlock, WeekDay } from "@/types";
import { useGetCollection } from "@/Hooks/Query/useGetCollection";
import { formatDateSingle } from "@/Functions/FormatDateSingle";

// ============================================================================
// TIPOS EXPORTADOS
// ============================================================================

export type SelectedDatesValue = {
  startDate: Date;
  endDate: Date;
  days: { weekDay: WeekDay; timeBlocks: { _id: string }[] }[];
};

export type SelectedDaysState = Partial<Record<WeekDay, TimeBlock[]>>;

const WEEK_DAYS: WeekDay[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const WEEK_DAYS_ENGLISH: Record<WeekDay, string> = {
  Monday: "Monday",
  Tuesday: "Tuesday",
  Wednesday: "Wednesday",
  Thursday: "Thursday",
  Friday: "Friday",
  Saturday: "Saturday",
  Sunday: "Sunday",
};

// ============================================================================
// PROPS (MODO CONTROLADO vs NO CONTROLADO)
// ============================================================================

type BaseProps = {
  /** Si true, componente es readonly */
  readOnly?: boolean;
  
  /** Fecha base para calcular el rango (default: hoy) */
  baseStartDate?: Date;
  
  /** Duración inicial en días (7, 14, 30) */
  initialDuration?: 7 | 14 | 30;
  
  /** Mostrar panel resumen (default: true) */
  showSummary?: boolean;
  
  /** Mostrar controles de duración (default: true) */
  showDurationControl?: boolean;
  
  /** Mostrar botones de selección rápida (default: true) */
  showQuickActions?: boolean;
  
  /** Permitir cambiar duración en modo controlled (default: true) */
  allowDurationChange?: boolean;
  
  /** Mensaje cuando no hay selección */
  emptyMessage?: string;
  
  /** Validación externa: retorna string de error o null */
  validate?: (value: SelectedDatesValue) => string | null;
  
  /** Error externo para mostrar */
  error?: string;
  
  /** Callback cuando cambia el valor */
  onChange?: (value: SelectedDatesValue) => void;
  
  /** Callback cuando cambia la duración */
  onDurationChange?: (days: number) => void;
  
  /** Texto de ayuda debajo del componente */
  helpText?: string;
};

type ControlledProps = BaseProps & {
  /** MODO CONTROLADO: valor controlado por el padre */
  value: SelectedDaysState;
  /** MODO CONTROLADO: callback obligatorio */
  onChange: (value: SelectedDatesValue) => void;
  /** MODO CONTROLADO: no usar defaultValue */
  defaultValue?: never;
};

type UncontrolledProps = BaseProps & {
  /** MODO NO CONTROLADO: valor inicial */
  defaultValue?: SelectedDaysState;
  /** MODO NO CONTROLADO: onChange opcional */
  onChange?: (value: SelectedDatesValue) => void;
  /** MODO NO CONTROLADO: no usar value */
  value?: never;
};

type Props = ControlledProps | UncontrolledProps;

// ============================================================================
// HELPERS
// ============================================================================

const isControlled = (props: Props): props is ControlledProps => {
  return props.value !== undefined;
};

const normalizeToStartOfDay = (date: Date): Date => {
  const normalized = new Date(date);
  normalized.setHours(9, 0, 0, 0); // 9:00 AM
  return normalized;
};

const calculateEndDate = (start: Date, durationDays: number): Date => {
  const end = new Date(start);
  end.setDate(end.getDate() + durationDays);
  end.setHours(23, 59, 59, 999); // Final del día
  return end;
};

const buildSelectedDatesValue = (
  startDate: Date,
  endDate: Date,
  selectedDays: SelectedDaysState
): SelectedDatesValue => ({
  startDate,
  endDate,
  days: Object.entries(selectedDays).map(([weekDay, timeBlocks]) => ({
    weekDay: weekDay as WeekDay,
    // Pass complete TimeBlock objects instead of stripping to just { _id }
    timeBlocks: timeBlocks ?? [],
  })),
});

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function AvailabilityDates2(props: Props) {
  const {
    readOnly = false,
    baseStartDate,
    initialDuration = 7,
    showSummary = true,
    allowDurationChange = true,
    validate,
    error: externalError,
    onChange,
    onDurationChange,
    helpText,
  } = props;

  // Colores adaptativos
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const activeDayBg = useColorModeValue("blue.50", "blue.900");
  const inactiveDayBg = useColorModeValue("white", "gray.800");
  const textMuted = useColorModeValue("gray.600", "gray.400");

  // ============================================================================
  // STATE
  // ============================================================================

  const { data: timeSlots, isLoading: isLoadingTimeSlots } = useGetCollection<TimeBlock>(
    "TimeBlock",
    { query: {}, limit: 50 }
  );

  const [duration, setDuration] = useState<number>(initialDuration);
  
  // Estado interno (modo no controlado) o derivado (modo controlado)
  const [internalSelectedDays, setInternalSelectedDays] = useState<SelectedDaysState>(
    () => (isControlled(props) ? props.value : props.defaultValue ?? {})
  );

  const selectedDays = isControlled(props) ? props.value : internalSelectedDays;

  // ============================================================================
  // MEMOIZED VALUES
  // ============================================================================

  const startDate = useMemo(() => {
    const base = baseStartDate ? new Date(baseStartDate) : new Date();
    return normalizeToStartOfDay(base);
  }, [baseStartDate]);

  const endDate = useMemo(() => {
    return calculateEndDate(startDate, duration);
  }, [startDate, duration]);

  const selectedDatesValue = useMemo(() => {
    return buildSelectedDatesValue(startDate, endDate, selectedDays);
  }, [startDate, endDate, selectedDays]);

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

  const validationError = useMemo(() => {
    if (externalError) return externalError;
    if (validate) return validate(selectedDatesValue);
    return null;
  }, [externalError, validate, selectedDatesValue]);

  const isEmpty = totalBlocksSelected === 0;

  // ============================================================================
  // CALLBACKS
  // ============================================================================

  const updateSelectedDays = useCallback(
    (newSelectedDays: SelectedDaysState) => {
      if (readOnly) return;

      console.log('🔄 updateSelectedDays called:', { 
        isControlled: isControlled(props), 
        newSelectedDays,
        hasOnChange: !!onChange 
      });

      if (isControlled(props)) {
        // Modo controlado: notificar al padre
        const newValue = buildSelectedDatesValue(startDate, endDate, newSelectedDays);
        console.log('📤 Calling parent onChange with:', newValue);
        onChange?.(newValue);
      } else {
        // Modo no controlado: actualizar estado interno
        console.log('💾 Updating internal state');
        setInternalSelectedDays(newSelectedDays);
      }
    },
    [readOnly, props, startDate, endDate, onChange]
  );

  const toggleDay = useCallback(
    (day: WeekDay) => {
      if (readOnly || !timeSlots) return;

      const isActive = !!selectedDays[day];
      const newSelectedDays = { ...selectedDays };

      if (isActive) {
        delete newSelectedDays[day];
      } else {
        newSelectedDays[day] = timeSlots;
      }

      updateSelectedDays(newSelectedDays);
    },
    [readOnly, timeSlots, selectedDays, updateSelectedDays]
  );

  const updateTimeSlots = useCallback(
    (day: WeekDay, selectedIds: string[]) => {
      if (readOnly || !timeSlots) return;

      console.log('🔄 updateTimeSlots called:', { day, selectedIds, timeSlots: timeSlots.map(s => s.blockNumber) });

      const selected = timeSlots.filter((slot) => {
        const included = selectedIds.includes(String(slot.blockNumber));
        console.log(`  Block ${slot.blockNumber}: ${included ? '✓ included' : '✗ excluded'}`);
        return included;
      });

      console.log('✅ Selected blocks:', selected.map(s => s.blockNumber));

      const newSelectedDays = { ...selectedDays };
      
      if (selected.length === 0) {
        delete newSelectedDays[day];
        console.log(`🗑️ Removed ${day} (no blocks selected)`);
      } else {
        newSelectedDays[day] = selected;
        console.log(`💾 Updated ${day} with ${selected.length} blocks`);
      }

      updateSelectedDays(newSelectedDays);
    },
    [readOnly, timeSlots, selectedDays, updateSelectedDays]
  );

  const selectAllForDay = useCallback(
    (day: WeekDay) => {
      if (readOnly || !timeSlots) return;

      const newSelectedDays = { ...selectedDays, [day]: timeSlots };
      updateSelectedDays(newSelectedDays);
    },
    [readOnly, timeSlots, selectedDays, updateSelectedDays]
  );

  const clearDay = useCallback(
    (day: WeekDay) => {
      if (readOnly) return;

      const newSelectedDays = { ...selectedDays };
      delete newSelectedDays[day];
      updateSelectedDays(newSelectedDays);
    },
    [readOnly, selectedDays, updateSelectedDays]
  );

  const handleDurationChange = useCallback(
    (value: string) => {
      if (readOnly || !allowDurationChange) return;
      
      const newDuration = Number(value);
      setDuration(newDuration);
      onDurationChange?.(newDuration);
    },
    [readOnly, allowDurationChange, onDurationChange]
  );

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Notificar cambios al padre (solo en modo no controlado)
  // Usar ref para evitar loops infinitos
  const lastNotifiedValueRef = useRef<string>("");
  
  useEffect(() => {
    if (!isControlled(props) && onChange) {
      // Crear una firma única del valor para comparación
      const valueSignature = JSON.stringify({
        start: selectedDatesValue.startDate.toISOString(),
        end: selectedDatesValue.endDate.toISOString(),
        days: selectedDatesValue.days.map(d => `${d.weekDay}:${d.timeBlocks.length}`)
      });
      
      // Solo notificar si el valor realmente cambió
      if (valueSignature !== lastNotifiedValueRef.current) {
        lastNotifiedValueRef.current = valueSignature;
        onChange(selectedDatesValue);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDatesValue]);

  // ============================================================================
  // RENDER
  // ============================================================================

  if (isLoadingTimeSlots) {
    return (
      <VStack justify="center" w="full" p={8} aria-label="Loading time blocks">
        <Spinner size="md" />
        <Text fontSize="sm" color={textMuted}>
          Loading time blocks...
        </Text>
      </VStack>
    );
  }

  return (
    <Box w="full">
      {/* Header compacto con duración y resumen */}
      {!readOnly && (
        <HStack justify="space-between" mb={4} wrap="wrap" spacing={4}>
          {/* Duration Selector - Botones en lugar de radios */}
          {allowDurationChange && (
            <HStack spacing={2}>
              <Text fontSize="sm" fontWeight="medium" color={textMuted}>
                Period:
              </Text>
              {[7, 14, 30].map((days) => (
                <Button
                  key={days}
                  size="sm"
                  variant={duration === days ? "solid" : "outline"}
                  colorScheme="blue"
                  onClick={() => handleDurationChange(String(days))}
                  isDisabled={readOnly}
                >
                  {days} days
                </Button>
              ))}
            </HStack>
          )}

          {/* Summary compacto */}
          {showSummary && totalBlocksSelected > 0 && (
            <HStack spacing={2}>
              <Badge colorScheme="purple" fontSize="xs">
                {totalDaysSelected} day{totalDaysSelected !== 1 ? "s" : ""}
              </Badge>
              <Badge colorScheme="green" fontSize="xs">
                {totalBlocksSelected} block{totalBlocksSelected !== 1 ? "s" : ""}
              </Badge>
            </HStack>
          )}
        </HStack>
      )}

      {/* Validation Error */}
      {validationError && (
        <Alert status="error" borderRadius="md" mb={3} size="sm">
          <AlertIcon />
          <Text fontSize="sm">{validationError}</Text>
        </Alert>
      )}

      {/* Day Selection - Vista simplificada */}
      {!readOnly && (
        <VStack spacing={2} align="stretch">
          {WEEK_DAYS.map((day) => {
            const isActive = !!selectedDays[day];
            const daySlots = selectedDays[day] ?? [];
            const allSelected = isActive && daySlots.length === (timeSlots?.length ?? 0);

            return (
              <Box
                key={day}
                borderWidth="1px"
                borderRadius="lg"
                p={3}
                bg={isActive ? activeDayBg : inactiveDayBg}
                borderColor={isActive ? "blue.400" : borderColor}
                transition="all 0.2s"
                _hover={{ borderColor: isActive ? "blue.500" : "gray.300" }}
              >
                <HStack justify="space-between" mb={isActive ? 2 : 0}>
                  <HStack spacing={3} flex={1}>
                    <Checkbox
                      isChecked={isActive}
                      onChange={() => toggleDay(day)}
                      size="lg"
                      colorScheme="blue"
                      aria-label={`Select ${WEEK_DAYS_ENGLISH[day]}`}
                    >
                      <Text fontWeight="semibold" fontSize="md">
                        {WEEK_DAYS_ENGLISH[day]}
                      </Text>
                    </Checkbox>
                    
                    {isActive && (
                      <Badge colorScheme={allSelected ? "green" : "blue"} fontSize="xs">
                        {allSelected ? "Complete" : `${daySlots.length} of ${timeSlots?.length ?? 0}`}
                      </Badge>
                    )}
                  </HStack>

                  {isActive && (
                    <HStack spacing={1}>
                      <Tooltip label="Select all" placement="top">
                        <IconButton
                          icon={<CheckIcon />}
                          size="sm"
                          variant="ghost"
                          colorScheme="green"
                          onClick={() => selectAllForDay(day)}
                          aria-label="Select all"
                          isDisabled={allSelected}
                        />
                      </Tooltip>
                      <Tooltip label="Clear" placement="top">
                        <IconButton
                          icon={<CloseIcon />}
                          size="sm"
                          variant="ghost"
                          colorScheme="red"
                          onClick={() => clearDay(day)}
                          aria-label="Clear"
                        />
                      </Tooltip>
                    </HStack>
                  )}
                </HStack>

                {isActive && timeSlots && (
                  <HStack spacing={2} mt={2} wrap="wrap">
                    {timeSlots.map((slot) => {
                      const isSelected = daySlots.some(s => s.blockNumber === slot.blockNumber);
                      return (
                        <Tooltip 
                          key={slot.blockNumber}
                          label={`${slot.from} - ${slot.to}`}
                          placement="top"
                          hasArrow
                        >
                          <Button
                            size="sm"
                            variant={isSelected ? "solid" : "outline"}
                            colorScheme={isSelected ? "blue" : "gray"}
                            onClick={() => {
                              console.log('🖱️ Button clicked:', { 
                                day, 
                                slotBlockNumber: slot.blockNumber, 
                                isSelected,
                                currentSlots: daySlots.map(s => s.blockNumber)
                              });
                              
                              const currentIds = daySlots.map(s => String(s.blockNumber));
                              const slotId = String(slot.blockNumber);
                              const newIds = isSelected
                                ? currentIds.filter(id => id !== slotId)
                                : [...currentIds, slotId];
                              
                              console.log('📤 Calling updateTimeSlots with:', { day, newIds });
                              updateTimeSlots(day, newIds);
                            }}
                            fontSize="xs"
                            px={3}
                            py={1}
                            h="auto"
                          >
                            {slot.short}
                          </Button>
                        </Tooltip>
                      );
                    })}
                  </HStack>
                )}
              </Box>
            );
          })}
        </VStack>
      )}

      {/* Summary View (Read-Only Mode) */}
      {readOnly && (
        <VStack spacing={2} align="stretch" mt={4}>
          <HStack justify="space-between" mb={2}>
            <Text fontWeight="bold" fontSize="md">
              Availability
            </Text>
            {showSummary && !isEmpty && (
              <HStack spacing={2}>
                <Badge colorScheme="blue" fontSize="xs">
                  {formatDateSingle(startDate)} - {formatDateSingle(endDate)}
                </Badge>
                <Badge colorScheme="purple" fontSize="xs">
                  {totalDaysSelected} day{totalDaysSelected !== 1 ? "s" : ""}
                </Badge>
              </HStack>
            )}
          </HStack>

          {isEmpty ? (
            <Alert status="info" borderRadius="md" size="sm">
              <AlertIcon />
              <Text fontSize="sm">No availability registered</Text>
            </Alert>
          ) : (
            Object.entries(selectedDays).map(([day, blocks]) => (
              <Box
                key={day}
                p={3}
                borderWidth="1px"
                borderRadius="md"
                bg={inactiveDayBg}
              >
                <Text fontWeight="semibold" fontSize="sm" mb={2}>
                  {WEEK_DAYS_ENGLISH[day as WeekDay]}
                </Text>
                <HStack spacing={2} wrap="wrap">
                  {blocks.map((block) => (
                    <Tooltip
                      key={block.blockNumber}
                      label={`${block.from} - ${block.to}`}
                      placement="top"
                      hasArrow
                    >
                      <Badge colorScheme="teal" fontSize="xs" px={2} py={1}>
                        {block.short}
                      </Badge>
                    </Tooltip>
                  ))}
                </HStack>
              </Box>
            ))
          )}
        </VStack>
      )}

      {/* Help Text */}
      {helpText && (
        <Text fontSize="xs" color={textMuted} mt={3} fontStyle="italic">
          {helpText}
        </Text>
      )}
    </Box>
  );
}
