import { useMemo } from "react";
import { Badge, Box, HStack, Skeleton, Tag, Text } from "@chakra-ui/react";
import { useProviderAvailability } from "@/Hooks/Query/useProviders";
import type { Provider } from "@/types";

const SYD_TZ = "Australia/Sydney";

function mergeSlots(
  slots: { startUtc: string; endUtc: string }[],
  toleranceMs = 60_000
): { start: number; end: number }[] {
  if (!slots?.length) return [];
  const arr = [...slots]
    .map(s => ({ start: new Date(s.startUtc).getTime(), end: new Date(s.endUtc).getTime() }))
    .filter(s => s.end > s.start)
    .sort((a, b) => a.start - b.start);

  const merged: { start: number; end: number }[] = [];
  let curr = { ...arr[0] };
  for (let i = 1; i < arr.length; i++) {
    const s = arr[i];
    if (s.start <= curr.end + toleranceMs) {
      curr.end = Math.max(curr.end, s.end);
    } else {
      merged.push(curr);
      curr = { ...s };
    }
  }
  merged.push(curr);
  return merged;
}
function overlaps(a0: number, a1: number, b0: number, b1: number) {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0)) > 0;
}

function fmtSydney(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-AU", {
    timeZone: SYD_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}
function fmtSydneyTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-AU", {
    timeZone: SYD_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function ProviderAvailabilityCompareRow({
  provider,
  windowIso,
  treatmentId,
  onRemove,
}: {
  provider: Provider;
  windowIso: { fromIso: string; toIso: string } | null;
  treatmentId?: string;
  onRemove?: (id: string) => void;
}) {
  const params = useMemo(
    () =>
      windowIso
        ? { from: windowIso.fromIso, to: windowIso.toIso, treatmentId }
        : undefined,
    [windowIso, treatmentId]
  );

  const { data, isFetching } = useProviderAvailability(provider._id, params);

  if (!windowIso) {
    return (
      <HStack justify="space-between">
        <HStack>
          <Box w="8px" h="8px" borderRadius="full" bg={provider.color || "gray.300"} />
          <Text>{capitalize(provider.firstName)} {capitalize(provider.lastName)}</Text>
        </HStack>
        <Tag>Pick an appointment date</Tag>
      </HStack>
    );
  }

  const fromTs = new Date(windowIso.fromIso).getTime();
  const toTs = new Date(windowIso.toIso).getTime();

  const merged = useMemo(() => mergeSlots(data || [], 60_000), [data]);
  const fits = useMemo(() => merged.some(b => b.start <= fromTs && b.end >= toTs), [merged, fromTs, toTs]);
  const partial = useMemo(() => !fits && merged.some(b => overlaps(b.start, b.end, fromTs, toTs)), [merged, fits, fromTs, toTs]);

  return (
    <HStack justify="space-between" align="center" px={2} py={1} borderRadius="md" _hover={{ bg: "blackAlpha.50" }}>
      <HStack overflow="hidden">
        <Box w="8px" h="8px" borderRadius="full" bg={provider.color || "gray.300"} />
        <Text noOfLines={1}>{capitalize(provider.firstName)} {capitalize(provider.lastName)}</Text>
        <Badge>{provider.initials || ""}</Badge>
      </HStack>

      {isFetching ? (
        <Skeleton h="22px" w="120px" borderRadius="md" />
      ) : fits ? (
        <HStack>
          <Tag colorScheme="green">Covers window</Tag>
          <Badge variant="outline">
            {fmtSydney(windowIso.fromIso)} – {fmtSydneyTime(windowIso.toIso)}
          </Badge>
          {onRemove && (
            <Tag size="sm" variant="subtle" as="button" onClick={() => onRemove(String(provider._id))}>
              Remove
            </Tag>
          )}
        </HStack>
      ) : partial ? (
        <HStack>
          <Tag colorScheme="yellow">Partial</Tag>
          {onRemove && (
            <Tag size="sm" variant="subtle" as="button" onClick={() => onRemove(String(provider._id))}>
              Remove
            </Tag>
          )}
        </HStack>
      ) : (
        <HStack>
          <Tag colorScheme="red">Unavailable</Tag>
          {onRemove && (
            <Tag size="sm" variant="subtle" as="button" onClick={() => onRemove(String(provider._id))}>
              Remove
            </Tag>
          )}
        </HStack>
      )}
    </HStack>
  );
}
