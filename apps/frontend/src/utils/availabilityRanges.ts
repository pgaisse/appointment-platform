// apps/frontend/src/utils/availabilityRanges.ts
// Utilities to merge availability slots into continuous ranges
// and convert those ranges into react-big-calendar events.
// No other files are modified.

export type ISO8601 = string;

export type Slot = {
  startUtc: ISO8601;
  endUtc: ISO8601;
  localLabel: string;
  meta?: {
    location?: string;
    chair?: string;
    dayKey?: string;
    // You can include any extra fields your API returns
    [k: string]: any;
  };
};

export type SlotRange = {
  startUtc: ISO8601;
  endUtc: ISO8601;
  slots: Slot[];          // original slots merged into this range
  meta?: Slot["meta"];    // retained meta from grouped slots
};

export type MergeOptions = {
  /**
   * Maximum gap (in ms) allowed between consecutive slots to be merged.
   * Use 0 to merge only strictly contiguous/overlapping intervals.
   * Small positive tolerance (e.g., 1000) is useful for rounding jitter.
   */
  maxGapMs?: number;

  /**
   * If true (default), only merge slots that share the same "meta group".
   * The grouping key is built from (location|chair|dayKey) unless you
   * override it via `groupKey`.
   */
  respectMeta?: boolean;

  /**
   * Optional custom grouping key for meta.
   * When provided, it overrides the default (location|chair|dayKey).
   */
  groupKey?: (s: Slot) => string | number;
};

/**
 * Merge consecutive (or overlapping) slots into continuous ranges.
 * - Sorts by start time
 * - Merges if:
 *   - group key matches (when respectMeta = true), AND
 *   - gap between previous.end and next.start <= maxGapMs (default 0)
 *   - OR intervals overlap
 */
export function mergeConsecutiveSlots(
  input: Slot[] | unknown,
  opts: MergeOptions = {}
): SlotRange[] {
  const slots: Slot[] = Array.isArray(input) ? input.filter(Boolean) : [];
  if (slots.length === 0) return [];

  const {
    maxGapMs = 0,
    respectMeta = true,
    groupKey,
  } = opts;

  const keyFn =
    groupKey ??
    ((s: Slot) =>
      `${s.meta?.location ?? ""}|${s.meta?.chair ?? ""}|${s.meta?.dayKey ?? ""}`);

  // Sort by start ascending
  const sorted = [...slots].sort(
    (a, b) => new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime()
  );

  const ranges: SlotRange[] = [];
  let curr: SlotRange | null = null;
  let currKey: string | number | null = null;

  for (const s of sorted) {
    const sStart = new Date(s.startUtc).getTime();
    const sEnd = new Date(s.endUtc).getTime();

    if (!curr) {
      curr = { startUtc: new Date(sStart).toISOString(), endUtc: new Date(sEnd).toISOString(), slots: [s], meta: s.meta };
      currKey = keyFn(s);
      continue;
    }

    const cEnd = new Date(curr.endUtc).getTime();
    const gap = sStart - cEnd;
    const sameGroup = !respectMeta || currKey === keyFn(s);

    const canMerge = sameGroup && gap <= Math.max(0, maxGapMs);

    if (canMerge) {
      // extend end if needed
      if (sEnd > cEnd) curr.endUtc = new Date(sEnd).toISOString();
      curr.slots.push(s);
    } else {
      ranges.push(curr);
      curr = { startUtc: new Date(sStart).toISOString(), endUtc: new Date(sEnd).toISOString(), slots: [s], meta: s.meta };
      currKey = keyFn(s);
    }
  }

  if (curr) ranges.push(curr);
  return ranges;
}

// ———————————————————————————————————————————————
// react-big-calendar compatible event shape
// (matches your CustomCalendar.Data type)
export type CalendarEvent = {
  _id: string;
  title: string;
  start: Date;
  end: Date;
  desc: string;
  name: string;
  lastName: string;
  color?: string;
  colorScheme?: string;
};

export type ToEventsOptions = {
  provider?: { _id?: string; firstName?: string; lastName?: string };
  title?: string;               // default: "Available"
  colorScheme?: string;         // default: "teal"
  /**
   * Optional label formatter for the event `desc`.
   * Defaults to Australia/Sydney "HH:mm" range.
   */
  labelFormatter?: (startIso: ISO8601, endIso: ISO8601) => string;
};

function defaultSydneyLabel(startIso: ISO8601, endIso: ISO8601) {
  const fmt: Intl.DateTimeFormatOptions = {
    timeZone: "Australia/Sydney",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  };
  const s = new Date(startIso).toLocaleString("en-AU", fmt);
  const e = new Date(endIso).toLocaleString("en-AU", fmt);
  return `${s} – ${e}`;
}

/**
 * Convert merged ranges to events consumable by react-big-calendar.
 */
export function slotRangesToCalendarEvents(
  ranges: SlotRange[] | unknown,
  opts: ToEventsOptions = {}
): CalendarEvent[] {
  const list: SlotRange[] = Array.isArray(ranges) ? ranges : [];
  const {
    provider,
    title = "Available",
    colorScheme = "teal",
    labelFormatter = defaultSydneyLabel,
  } = opts;

  const name = (provider?.firstName ?? "").trim();
  const lastName = (provider?.lastName ?? "").trim();
  const pid = provider?._id ?? "prov";

  return list.map((r, i) => ({
    _id: `${pid}-range-${i}`,
    title,
    start: new Date(r.startUtc),
    end: new Date(r.endUtc),
    desc: labelFormatter(r.startUtc, r.endUtc),
    name,
    lastName,
    colorScheme,
  }));
}

/**
 * Convenience: merge raw slots then output calendar events in one go.
 */
export function slotsToCalendarEvents(
  slots: Slot[] | unknown,
  merge: MergeOptions = {},
  toEvents: ToEventsOptions = {}
): CalendarEvent[] {
  const ranges = mergeConsecutiveSlots(slots, merge);
  return slotRangesToCalendarEvents(ranges, toEvents);
}
