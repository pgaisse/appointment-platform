import { Button, Flex, Icon, Skeleton, Stack, Tooltip } from "@chakra-ui/react";
import { QueryObserverResult, RefetchOptions } from "@tanstack/react-query";
import React, { useEffect, useMemo } from "react";
import { FieldError } from "react-hook-form";
import { Priority } from "@/types";
import { useGetCollection } from "@/Hooks/Query/useGetCollection";
import { FiCheckCircle } from "react-icons/fi";

type Props = {
  selected?: number;
  setSelected?: React.Dispatch<React.SetStateAction<number>>;
  setCatSelected?: React.Dispatch<React.SetStateAction<string>>;
  refetch?: (options?: RefetchOptions) => Promise<QueryObserverResult<unknown, Error>>;
  defaultBtn?: boolean;
  fontSize?: any; // ResponsiveValue<number | string>
  isPending?: boolean;
  gap?: string;
  btnSize?: number;
  value?: string;
  onChange?: (id: string, value: string, color?: string, duration?: number | null) => void;
  error?: FieldError;
};

/* Helpers de color */
const CHAKRA_BASE_TOKENS = new Set([
  "gray", "red", "orange", "yellow", "green", "teal", "blue",
  "cyan", "purple", "pink", "linkedin", "facebook", "messenger",
  "whatsapp", "twitter", "telegram", "blackAlpha", "whiteAlpha",
]);

const isHex = (c?: string) => !!c && /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(c);
const isToken = (c?: string) => !!c && (CHAKRA_BASE_TOKENS.has(c.split(".")[0]));

/** Devuelve un token base “blue” a partir de “blue.500” o el mismo si ya es base */
const baseToken = (c: string) => c.split(".")[0];

/** Sombrar/aclarecer hex mezclando con negro/blanco */
function shadeHex(hex: string, percent: number) {
  // percent: negativo oscurece, positivo aclara (–100 a 100)
  const p = Math.max(-100, Math.min(100, percent)) / 100;
  const int = (h: string) => parseInt(h, 16);
  let r = 0, g = 0, b = 0;
  const clean = hex.replace("#", "");
  if (clean.length === 3) {
    r = int(clean[0] + clean[0]);
    g = int(clean[1] + clean[1]);
    b = int(clean[2] + clean[2]);
  } else {
    r = int(clean.slice(0, 2));
    g = int(clean.slice(2, 4));
    b = int(clean.slice(4, 6));
  }
  const mix = p >= 0 ? 255 : 0;
  const f = (c: number) => Math.round((1 - Math.abs(p)) * c + Math.abs(p) * mix);
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(f(r))}${toHex(f(g))}${toHex(f(b))}`;
}

/** Estilos de botón según color (hex o token) y estado seleccionado */
function getButtonStyles(color: string | undefined, selected: boolean) {
  const fallbackHex = "#4A5568"; // gray.600
  const c = color || fallbackHex;

  if (isToken(c)) {
    const base = baseToken(c);
    return {
      chakraProps: {
        colorScheme: base,
        variant: selected ? "solid" : "outline",
        bgGradient: `linear(to-br, ${base}.500, ${base}.700)`,
        _hover: {
          transform: "scale(1.03)",
          bgGradient: `linear(to-br, ${base}.400, ${base}.800)`,
          boxShadow: "xl",
        },
        _active: {
          transform: "scale(0.97)",
          bgGradient: `linear(to-br, ${base}.400, ${base}.800)`,
        },
        boxShadow: selected ? `0 0 0 3px white, 0 0 0 6px ${base}.500` : "md",
        border: selected ? `3px solid var(--chakra-colors-${base}-500)` : "none",
        color: "white",
      },
    };
  }

  // Hex
  const from = isHex(c) ? c : fallbackHex;
  const to = shadeHex(from, -20);
  const ring = shadeHex(from, -10);
  return {
    chakraProps: {
      variant: "solid",
      bgGradient: `linear(to-br, ${from}, ${to})`,
      _hover: {
        transform: "scale(1.03)",
        bgGradient: `linear(to-br, ${shadeHex(from, 5)}, ${shadeHex(to, -5)})`,
        boxShadow: "xl",
      },
      _active: {
        transform: "scale(0.97)",
        bgGradient: `linear(to-br, ${shadeHex(from, -5)}, ${shadeHex(to, -10)})`,
      },
      boxShadow: selected ? `0 0 0 3px white, 0 0 0 6px ${ring}` : "md",
      border: selected ? `3px solid ${ring}` : "none",
      color: "white",
    },
  };
}

function CustomButtonGroup({
  selected,
  isPending,
  setSelected,
  onChange,
  value,
  gap = "15px",
  setCatSelected,
  refetch,
  defaultBtn = false,
  fontSize,
}: Props) {
  const query = {};
  const limit = 50;
  const { data: options, isSuccess, isFetching } = useGetCollection<Priority>("PriorityList", { query, limit });

  const updatedOptions: Priority[] = useMemo(() => {
    const base = options ?? [];
    const withAny = defaultBtn
      ? [
          {
            _id: "any",
            id: -1,
            description: "Any priority",
            notes: "Any priority",
            durationHours: 0,
            name: "Any",
            color: "gray",
          } as Priority,
          ...base,
        ]
      : base;
    // evita duplicados por id
    const seen = new Set<number>();
    return withAny.filter((o) => (o?.id ?? NaN, !seen.has(o.id) && seen.add(o.id)));
  }, [options, defaultBtn]);

  // Si hay defaultBtn y no hay selección inicial, fija “Any” una sola vez
  useEffect(() => {
    if (!defaultBtn) return;
    const hasSelection = selected != null;
    if (!hasSelection) {
      onChange?.("any", "Any", "gray", 0);
      setCatSelected?.("Any");
    }
    // no refetch acá
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultBtn]);

  // Mantén onChange sincronizado cuando cambia `selected` externamente
  useEffect(() => {
    if (selected == null || !updatedOptions.length) return;
    const matched = updatedOptions.find((opt) => opt.id === selected);
    if (matched) {
      onChange?.(matched._id ?? "", matched.name, matched.color, matched.durationHours);
      setCatSelected?.(matched.name);
      refetch?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, updatedOptions]);

  if (isFetching) {
    return (
      <Stack>
        <Skeleton height="20px" />
        <Skeleton height="20px" />
        <Skeleton height="20px" />
      </Stack>
    );
  }

  if (!isSuccess || !updatedOptions.length) {
    return <></>;
  }

  return (
    <Flex wrap="wrap" gap={gap}>
      {updatedOptions.map((option) => {
        const isSel = selected === option.id || value === option.name;
        const { chakraProps } = getButtonStyles(option.color, isSel);
        return (
          <Tooltip
            key={option._id ?? option.id}
            hasArrow
            label={option.notes || option.description || option.name}
            placement="top"
          >
            <Button
              isDisabled={isPending}
              onClick={() => {
                onChange?.(option._id ?? "", option.name, option.color, option.durationHours);
                setSelected?.(option.id);
                setCatSelected?.(option.name);
                refetch?.();
              }}
              borderRadius="2xl"
              width={{ base: "auto", md: "150px" }}
              minW={{ base: "44px", md: "150px" }}
              position="relative"
              fontSize={fontSize}
              data-value={option.durationHours}
              {...chakraProps}
            >
              {option.name}
              {isSel && (
                <Icon
                  as={FiCheckCircle}
                  color="white"
                  borderRadius="full"
                  boxSize={4}
                  position="absolute"
                  top="6px"
                  right="6px"
                />
              )}
            </Button>
          </Tooltip>
        );
      })}
    </Flex>
  );
}

export default CustomButtonGroup;
