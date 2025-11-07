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
