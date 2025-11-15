import { Appointment } from "@/types";

type Slot = Appointment["selectedAppDates"][number];

// Safely parse a date-like value into a Date, or null if invalid
const asDate = (v: unknown): Date | null => {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

// Try to resolve a slot's start and end using common fields used in the app
export const getSlotStart = (slot: Slot): Date | null => {
  if (!slot) return null;
  // Prefer explicit startDate, then proposed.startDate, then propStartDate (legacy)
  return (
    asDate(slot.startDate) ||
    asDate(slot?.proposed?.startDate) ||
    asDate(slot.propStartDate)
  );
};

export const getSlotEnd = (slot: Slot): Date | null => {
  if (!slot) return null;
  return (
    asDate(slot.endDate) ||
    asDate(slot?.proposed?.endDate) ||
    asDate(slot.propEndDate)
  );
};

/**
 * Returns the most recent (latest) slot by startDate.
 * If multiple slots have no valid date, returns undefined.
 */
export const getLatestSelectedAppDate = (
  slots?: Slot[] | null
): Slot | undefined => {
  if (!Array.isArray(slots) || slots.length === 0) return undefined;

  // Filter slots that have a detectable start date
  const withDates = slots
    .map((s) => ({ slot: s, start: getSlotStart(s) }))
    .filter((x): x is { slot: Slot; start: Date } => x.start !== null);

  if (withDates.length === 0) return undefined;

  // Sort by start ascending and take the last (latest)
  withDates.sort((a, b) => a.start.getTime() - b.start.getTime());
  return withDates[withDates.length - 1].slot;
};

/** Convenience: returns [start,end] dates resolved for the latest slot */
export const getLatestSelectedAppDateRange = (
  slots?: Slot[] | null
): { start: Date; end: Date } | null => {
  const latest = getLatestSelectedAppDate(slots);
  if (!latest) return null;
  const start = getSlotStart(latest);
  const end = getSlotEnd(latest);
  return start && end ? { start, end } : null;
};

/**
 * pickDisplaySlot: prefer the latest Confirmed slot by start time; if none, use the latest slot overall.
 */
export const pickDisplaySlot = (
  slots?: Slot[] | null
): Slot | undefined => {
  if (!Array.isArray(slots) || slots.length === 0) return undefined;
  const confirmed = slots
    .map((s) => ({ slot: s, start: getSlotStart(s) }))
    .filter((x): x is { slot: Slot; start: Date } => x.start !== null && String((x.slot as any)?.status || "").toLowerCase() === "confirmed")
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  if (confirmed.length > 0) return confirmed[confirmed.length - 1].slot;
  return getLatestSelectedAppDate(slots);
};

/** Convenience: range for display slot (confirmed latest fallback to overall) */
export const getDisplaySlotRange = (
  slots?: Slot[] | null
): { start: Date; end: Date } | null => {
  const s = pickDisplaySlot(slots);
  if (!s) return null;
  const start = getSlotStart(s);
  const end = getSlotEnd(s);
  return start && end ? { start, end } : null;
};

/** Latest slot by insertion time (ObjectId timestamp). Fallback to known dates. */
export const getLatestByInsertionSlot = (
  slots?: Slot[] | null
): Slot | undefined => {
  if (!Array.isArray(slots) || slots.length === 0) return undefined;
  const oidTime = (val: any): number => {
    const hex = String(val ?? '').trim();
    if (/^[0-9a-fA-F]{24}$/.test(hex)) {
      const secs = parseInt(hex.slice(0, 8), 16);
      if (!Number.isNaN(secs)) return secs * 1000;
    }
    return 0;
  };

  const scored = slots.map((s: any, idx: number) => {
    const idScore = oidTime(s?._id);
    const decided = s?.confirmation?.decidedAt ? new Date(s.confirmation.decidedAt).getTime() : 0;
    const sent = s?.confirmation?.sentAt ? new Date(s.confirmation.sentAt).getTime() : 0;
    const proposedCreated = s?.proposed?.createdAt ? new Date(s.proposed.createdAt).getTime() : 0;
    // Classification should be by insertion/decision time, not by future startDate
    const alt = Math.max(decided, sent, proposedCreated);
    const score = Math.max(idScore, alt);
    return { s: s as Slot, score, idx };
  });

  // Sort by score desc; on tie, prefer last occurrence in the array (idx desc)
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.idx - a.idx;
  });
  return scored[0]?.s;
};
