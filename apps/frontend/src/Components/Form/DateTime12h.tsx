import React from "react";
import {
  Popover, PopoverTrigger, PopoverContent, PopoverBody,
  Button, HStack, VStack, Box, Text, Input, SimpleGrid, useColorModeValue
} from "@chakra-ui/react";

/** Utiles */
const pad2 = (n: number) => String(n).padStart(2, "0");
const to24h = (h12: number, ampm: "AM" | "PM") => (h12 % 12) + (ampm === "PM" ? 12 : 0);
const from24h = (h24: number) => {
  const ampm: "AM" | "PM" = h24 < 12 ? "AM" : "PM";
  const h12 = ((h24 + 11) % 12) + 1;
  return { h12, ampm };
};
const parseLocalString = (v?: string) => {
  if (!v) {
    const d = new Date();
    const date = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    const { h12, ampm } = from24h(d.getHours());
    const minute = pad2(d.getMinutes());
    return { date, h12, minute, ampm };
  }
  const [date, t = "09:00"] = v.split("T");
  const [h = 9, m = 0] = t.split(":").map((x) => parseInt(x, 10));
  const { h12, ampm } = from24h(h);
  return { date, h12, minute: pad2(m), ampm };
};
const fmtDisplay = (date: string, h12: number, minute: string, ampm: "AM" | "PM") => {
  if (!date) return "Select date and time";
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y} ${h12}:${minute} ${ampm}`;
};

/** Botoncito opción “ruedita” */
function WheelBtn({
  selected, onClick, children,
}: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  const bg = useColorModeValue("gray.50", "whiteAlpha.100");
  return (
    <Button
      onClick={onClick}
      size="sm"
      variant={selected ? "solid" : "ghost"}
      colorScheme={selected ? "teal" : undefined}
      borderRadius="full"
      w="3.25rem"
      _hover={{ bg: selected ? undefined : bg }}
    >
      {children}
    </Button>
  );
}

/** Picker 12 h premium con popover y valor local YYYY-MM-DDTHH:mm */
export function PremiumTimePicker12h({
  value,
  onChange,
  size = "md",
  minuteStep = 5,
  min,
  max,
  disabled,
}: {
  value?: string;                         // local YYYY-MM-DDTHH:mm
  onChange: (next: string) => void;       // devuelve el mismo formato
  size?: "sm" | "md" | "lg";
  minuteStep?: number;                    // 1, 5, 10, 15…
  min?: string;                           // opcional: YYYY-MM-DDTHH:mm
  max?: string;                           // opcional
  disabled?: boolean;
}) {
  const init = parseLocalString(value);
  const [date, setDate] = React.useState(init.date);
  const [h12, setH12] = React.useState<number>(init.h12);
  const [minute, setMinute] = React.useState<string>(init.minute);
  const [ampm, setAmPm] = React.useState<"AM" | "PM">(init.ampm);

  React.useEffect(() => {
    const p = parseLocalString(value);
    setDate(p.date); setH12(p.h12); setMinute(p.minute); setAmPm(p.ampm);
  }, [value]);

  const emit = (d = date, h = h12, m = minute, ap = ampm) => {
    if (!d) return;
    const h24 = to24h(h, ap);
    onChange(`${d}T${pad2(h24)}:${pad2(parseInt(m, 10) || 0)}`);
  };

  const minutes = React.useMemo(
    () => Array.from({ length: Math.floor(60 / minuteStep) }, (_, i) => pad2(i * minuteStep)),
    [minuteStep]
  );

  return (
    <Popover placement="bottom-start" isLazy>
      <PopoverTrigger>
        <Button
          size={size}
          variant="outline"
          isDisabled={disabled}
          justifyContent="space-between"
          rightIcon={<Box as="span" transform="translateY(1px)">▾</Box>}
        >
          <Text noOfLines={1}>{fmtDisplay(date, h12, minute, ampm)}</Text>
        </Button>
      </PopoverTrigger>

      <PopoverContent w="auto">
        <PopoverBody>
          <VStack align="stretch" spacing={3}>
            {/* Fecha */}
            <Box>
              <Text fontSize="xs" mb={1} color="gray.500">Date</Text>
              <Input
                type="date"
                size="sm"
                value={date}
                min={min?.split("T")[0]}
                max={max?.split("T")[0]}
                onChange={(e) => { setDate(e.target.value); emit(e.target.value); }}
              />
            </Box>

            {/* Rueditas: Hora - Min - AM/PM */}
            <SimpleGrid columns={3} spacing={3}>
              <VStack spacing={2}>
                <Text fontSize="xs" color="gray.500">Hour</Text>
                <HStack wrap="wrap" maxW="220px">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                    <WheelBtn key={h} selected={h === h12} onClick={() => { setH12(h); emit(undefined, h); }}>
                      {h}
                    </WheelBtn>
                  ))}
                </HStack>
              </VStack>

              <VStack spacing={2}>
                <Text fontSize="xs" color="gray.500">Minute</Text>
                <HStack wrap="wrap" maxW="220px">
                  {minutes.map((m) => (
                    <WheelBtn key={m} selected={m === minute} onClick={() => { setMinute(m); emit(undefined, undefined, m); }}>
                      {m}
                    </WheelBtn>
                  ))}
                </HStack>
              </VStack>

              <VStack spacing={2}>
                <Text fontSize="xs" color="gray.500">AM / PM</Text>
                <HStack>
                  <WheelBtn selected={ampm === "AM"} onClick={() => { setAmPm("AM"); emit(undefined, undefined, undefined, "AM"); }}>
                    AM
                  </WheelBtn>
                  <WheelBtn selected={ampm === "PM"} onClick={() => { setAmPm("PM"); emit(undefined, undefined, undefined, "PM"); }}>
                    PM
                  </WheelBtn>
                </HStack>
              </VStack>
            </SimpleGrid>

            <HStack justify="flex-end">
              <Button size="sm" onClick={() => emit()} colorScheme="teal">Apply</Button>
            </HStack>
          </VStack>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
}
