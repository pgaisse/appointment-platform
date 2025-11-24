import React, { useMemo, useState } from "react";
import { Box, HStack, Input, InputGroup, InputLeftElement, Kbd, VStack } from "@chakra-ui/react";
import { FiSearch } from "react-icons/fi";
import type { Provider } from "@/Hooks/Query/useProviders";
import { ProviderRowAvailability } from "./ProviderRowAvailability";

function useDebounced<T>(value: T, delay = 250) {
  const [v, setV] = useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

export function ProviderFinderInline({
  providers,
  skillId,
  selectedIds,
  onAdd,
  windowIso,
  onlyFits = false,
  allowPartial = true,
}: {
  providers: Provider[];
  skillId?: string;
  selectedIds: string[];
  onAdd: (p: Provider) => void;
  windowIso: { fromIso: string; toIso: string } | null;
  onlyFits?: boolean;
  allowPartial?: boolean;
}) {
  const [query, setQuery] = useState("");
  const q = useDebounced(query, 200);

  const baseFiltered = useMemo(() => {
    let arr = providers.filter((p) => !selectedIds.includes(String(p._id)));
    if (skillId) {
      const sid = String(skillId);
      arr = arr.filter((p) => (p.skills || []).map(String).includes(sid));
    }
    if (q) {
      const qq = q.trim().toLowerCase();
      arr = arr.filter((p) => `${capitalize(p.firstName)} ${capitalize(p.lastName)}`.toLowerCase().includes(qq));
    }
    return arr;
  }, [providers, selectedIds, q, skillId]);

  return (
    <VStack align="stretch" spacing={2}>
      <InputGroup>
        <InputLeftElement pointerEvents="none">
          <FiSearch />
        </InputLeftElement>
        <Input
          placeholder="Search provider by name"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </InputGroup>

      <Box borderWidth="1px" borderRadius="md" maxH="240px" overflowY="auto" px={1} py={1}>
        {baseFiltered.length === 0 ? (
          <Box p={3} color="gray.500">No providers found.</Box>
        ) : (
          baseFiltered.map((p) => (
            <ProviderRowAvailability
              key={p._id}
              p={p}
              windowIso={windowIso}
              skillId={skillId}
              onAdd={onAdd}
              qHighlight={q}
              onlyFits={onlyFits}
              allowPartial={allowPartial}
            />
          ))
        )}
      </Box>

      <HStack color="gray.500" fontSize="xs">
        <Kbd>Enter</Kbd> / click to add · <Kbd>Esc</Kbd> to clear
      </HStack>
    </VStack>
  );
}
