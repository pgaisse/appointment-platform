import React, { useMemo } from "react";
import { Skeleton, Tag } from "@chakra-ui/react";
import { ProviderRow } from "./ProviderRow";
import { useProviderAvailability, type Provider } from "@/Hooks/Query/useProviders";

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

export function ProviderRowAvailability({
  p,
  windowIso,
  skillId,
  onAdd,
  qHighlight,
  onlyFits = false,
  allowPartial = true,
}: {
  p: Provider;
  windowIso: { fromIso: string; toIso: string } | null;
  skillId?: string;
  onAdd: (p: Provider) => void;
  qHighlight?: string;
  onlyFits?: boolean;
  allowPartial?: boolean;
}) {
  const enabled = Boolean(windowIso && p?._id);
  const params = useMemo(
    () =>
      windowIso
        ? { from: windowIso.fromIso, to: windowIso.toIso, treatmentId: skillId }
        : undefined,
    [windowIso, skillId]
  );

  const { data, isFetching } = useProviderAvailability(p._id, params, { enabled });

  if (!windowIso) {
    return (
      <ProviderRow
        p={p}
        onAdd={onAdd}
        highlight={qHighlight}
        rightAdornment={<Tag size="sm">Availability unknown</Tag>}
      />
    );
  }

  const from = new Date(windowIso.fromIso).getTime();
  const to = new Date(windowIso.toIso).getTime();

  const merged = useMemo(() => mergeSlots(data || [], 60_000), [data]);
  const fits = useMemo(() => merged.some(b => b.start <= from && b.end >= to), [merged, from, to]);
  const partial = useMemo(() => !fits && merged.some(b => overlaps(b.start, b.end, from, to)), [merged, fits, from, to]);

  if (isFetching) return <Skeleton height="28px" borderRadius="md" />;

  if (onlyFits && !fits) return null;
  if (!allowPartial && partial) return null;
  if (!fits && !partial) return null;

  return (
    <ProviderRow
      p={p}
      onAdd={onAdd}
      highlight={qHighlight}
      rightAdornment={
        fits ? (
          <Tag size="sm" colorScheme="green">Fits</Tag>
        ) : (
          <Tag size="sm" colorScheme="yellow">Partial</Tag>
        )
      }
    />
  );
}
