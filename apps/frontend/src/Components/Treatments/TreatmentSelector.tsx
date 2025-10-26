import {
  Box,
  Flex,
  Icon,
  Spinner,
  Text,
} from "@chakra-ui/react";
import React from "react";
import * as RiIcons from "react-icons/ri";
import * as MdIcons from "react-icons/md";
import * as GiIcons from "react-icons/gi";
import * as FaIcons from "react-icons/fa";
import * as FiIcons from "react-icons/fi";
import type { IconType } from "react-icons";
import { useGetCollection } from "@/Hooks/Query/useGetCollection";
import { Treatment } from "@/types";

// 🔹 Registro de librerías
const ICON_SETS: Record<string, Record<string, IconType>> = {
  fi: FiIcons,
  fa: FaIcons,
  md: MdIcons,
  ri: RiIcons,
  gi: GiIcons,
};

// 🔹 Fallback para íconos inexistentes
const ICON_FALLBACKS: Record<string, string> = {
  "gi:GiToothImplant": "gi:GiTooth", // reemplazo porque no existe GiToothImplant
};

// 🔹 Normalizador: agrega prefijo si falta
function normalizeIconKey(key: string): string {
  if (!key) return "";
  if (key.includes(":")) return key;
  if (key.startsWith("Fi")) return `fi:${key}`;
  if (key.startsWith("Fa")) return `fa:${key}`;
  if (key.startsWith("Md")) return `md:${key}`;
  if (key.startsWith("Ri")) return `ri:${key}`;
  if (key.startsWith("Gi")) return `gi:${key}`;
  return key;
}

// 🔹 Busca el componente de ícono dinámicamente
function getIconComponent(key?: string): IconType | undefined {
  if (!key) return undefined;
  const normKey = normalizeIconKey(key);
  const fixedKey = ICON_FALLBACKS[normKey] || normKey;
  const [pack, name] = fixedKey.split(":");
  const set = ICON_SETS[pack?.toLowerCase?.()];
  return set ? set[name] : undefined;
}

interface Props {
  onSelect: (treatment: Treatment) => void;
  selectedId?: string;
  query?: object;
  limit?: number;
  selected: number;
  onChange?: (id: string, value: string, color?: string, duration?: number | null) => void;
}

export const TreatmentSelector = React.memo(({
  onChange,
  onSelect,
  selectedId,
  query = {},
  limit = 20,
}: Props) => {
  const { data, isSuccess, isFetching } = useGetCollection<Treatment>("Treatment", { query, limit });

  // ⚡ OPTIMIZACIÓN: Memoizar handler de click
  const handleClick = React.useCallback((t: Treatment) => {
    onChange?.(t._id ?? "", t.name, t.color, t.duration);
    onSelect(t);
  }, [onChange, onSelect]);

  if (isFetching) {
    return (
      <Flex justify="center" py={4}>
        <Spinner />
      </Flex>
    );
  }

  if (!isSuccess || data.length === 0) {
    return (
      <Box textAlign="center" py={4} color="gray.500">
        No treatments found.
      </Box>
    );
  }

  return (
    <Box overflowX="auto" whiteSpace="nowrap" pb={4}>
      <Flex gap={4} px={2} minW="max-content">
        {data.map((t) => {
          const IconComponent = getIconComponent(t.icon);

          return (
            <Box
              key={t._id}
              bg={`${t.color}.100`}
              borderRadius="xl"
              px={4}
              py={3}
              minW="90px"
              boxShadow={selectedId === t._id ? "lg" : "sm"}
              border={selectedId === t._id ? "2px solid #3182CE" : "none"}
              cursor="pointer"
              onClick={() => handleClick(t)}
              transition="all 0.2s ease"
              _hover={{ transform: "scale(1.03)" }}
            >
              <Flex direction="column" align="center" justify="center">
                {IconComponent && <Icon as={IconComponent} boxSize={4} mb={2} />}
                <Text fontWeight="bold" fontSize="sm" textAlign="center">
                  {t.name}
                </Text>
                <Text fontSize="xs" color="gray.600">
                  {t.duration} min
                </Text>
              </Flex>
            </Box>
          );
        })}
      </Flex>
    </Box>
  );
});
