import {
  Flex,
  Icon,
  Skeleton,
  Stack,
  Tooltip,
  Tag,
  TagLabel,
  TagRightIcon,
} from "@chakra-ui/react";
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
  btnSize?: number; // (se mantiene aunque ya no sean botones para no romper tipos)
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

/** Estilos de Tag según color (hex o token) y estado seleccionado */
function getTagStyles(color: string | undefined, selected: boolean) {
  const fallbackHex = "#4A5568"; // gray.600
  const c = color || fallbackHex;

  const common = {
    borderRadius: "2xl",
    transition: "transform 160ms ease, box-shadow 160ms ease, background 160ms ease",
    cursor: "pointer",
    px: { base: 3, md: 4 },
    py: { base: 2, md: 2 },
    height: "38px",
    fontWeight: 600,
    letterSpacing: "0.2px",
    _focusVisible: {
      outline: "none",
      boxShadow: "0 0 0 3px white, 0 0 0 6px rgba(0,0,0,0.25)",
    },
    _hover: {
      transform: "translateY(-1px)",
      boxShadow: "lg",
    },
    _active: {
      transform: "translateY(0)",
      boxShadow: "md",
    },
  } as const;

  if (isToken(c)) {
    const base = baseToken(c);
    return {
      chakraProps: {
        ...common,
        colorScheme: base,
        variant: "solid",
        bgGradient: selected
          ? `linear(to-br, ${base}.500, ${base}.700)`
          : `linear(to-br, ${base}.50, ${base}.100)`,
        color: selected ? "white" : `${base}.800`,
        border: selected ? `2px solid var(--chakra-colors-${base}-500)` : `1px solid var(--chakra-colors-${base}-200)`,
        boxShadow: selected ? `0 0 0 3px white, 0 0 0 6px var(--chakra-colors-${base}-400)` : "sm",
        _hover: {
          ...common._hover,
          bgGradient: selected
            ? `linear(to-br, ${base}.400, ${base}.700)`
            : `linear(to-br, ${base}.100, ${base}.200)`,
        },
      },
    };
  }

  // Hex
  const from = isHex(c) ? c : fallbackHex;
  const to = shadeHex(from, -18);
  const ring = shadeHex(from, -10);
  const text = "#ffffff";

  return {
    chakraProps: {
      ...common,
      variant: "solid",
      bgGradient: `linear(to-br, ${from}, ${to})`,
      color: text,
      border: selected ? `2px solid ${ring}` : "1px solid rgba(255,255,255,0.18)",
      boxShadow: selected ? `0 0 0 3px white, 0 0 0 6px ${ring}` : "sm",
      _hover: {
        ...common._hover,
        bgGradient: `linear(to-br, ${shadeHex(from, 4)}, ${shadeHex(to, -4)})`,
      },
      _active: {
        ...common._active,
        bgGradient: `linear(to-br, ${shadeHex(from, -4)}, ${shadeHex(to, -8)})`,
      },
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
    // evita duplicados por id (se mantiene la lógica original)
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

  const disabledProps = isPending
    ? { opacity: 0.6, pointerEvents: "none" as const, cursor: "not-allowed" as const, filter: "grayscale(0.2)" }
    : {};

  return (
    <Flex wrap="wrap" gap={gap}>
      {updatedOptions.map((option) => {
        const isSel = selected === option.id || value === option.name;
        const { chakraProps } = getTagStyles(option.color, isSel);

        return (
          <Tooltip
            key={option._id ?? option.id}
            hasArrow
            label={option.notes || option.description || option.name}
            placement="top"
            openDelay={120}
          >
            <Tag
              as="button"
              type="button"
              role="button"
              aria-pressed={isSel}
              onClick={() => {
                onChange?.(option._id ?? "", option.name, option.color, option.durationHours);
                setSelected?.(option.id);
                setCatSelected?.(option.name);
                refetch?.();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onChange?.(option._id ?? "", option.name, option.color, option.durationHours);
                  setSelected?.(option.id);
                  setCatSelected?.(option.name);
                  refetch?.();
                }
              }}
              fontSize={fontSize}
              width={{ base: "auto", md: "150px" }}
              minW={{ base: "56px", md: "150px" }}
              justifyContent="center"
              position="relative"
              data-value={option.durationHours}
              {...chakraProps}
              {...disabledProps}
            >
              <TagLabel noOfLines={1}>{option.name}</TagLabel>
              {isSel && (
                <TagRightIcon
                  as={FiCheckCircle}
                  // reforzamos legibilidad del check
                  boxSize={4}
                />
              )}
            </Tag>
          </Tooltip>
        );
      })}
    </Flex>
  );
}

export default CustomButtonGroup;
