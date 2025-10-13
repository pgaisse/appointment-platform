import React, { useMemo } from "react";
import { Box, VStack } from "@chakra-ui/react";
import type { Provider } from "@/Hooks/Query/useProviders";
import { ProviderAvailabilityCompareRow } from "./ProviderAvailabilityCompareRow";

export function ProviderAvailabilityComparisonList({
  selectedIds,
  allActive,
  windowIso,
  treatmentId,
  onRemove,
}: {
  selectedIds: string[];
  allActive: Provider[];
  windowIso: { fromIso: string; toIso: string } | null;
  treatmentId?: string;
  onRemove?: (id: string) => void;
}) {
  const byId = useMemo(() => new Map(allActive.map(p => [String(p._id), p])), [allActive]);
  const rows = selectedIds.map(id => byId.get(id)).filter(Boolean) as Provider[];

  if (!rows.length) {
    return (
      <Box borderWidth="1px" borderRadius="md" p={3} color="gray.500">
        No providers selected.
      </Box>
    );
  }

  return (
    <VStack align="stretch" spacing={1} borderWidth="1px" borderRadius="md" p={2} maxH="220px" overflowY="auto">
      {rows.map((p) => (
        <ProviderAvailabilityCompareRow
          key={String(p._id)}
          provider={p}
          windowIso={windowIso}
          treatmentId={treatmentId}
          onRemove={onRemove}
        />
      ))}
    </VStack>
  );
}
