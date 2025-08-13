import { DateRange } from "@/Hooks/Handles/useSlotSelection";

export const normalizeDateRanges = (ranges: DateRange[] | undefined): DateRange[] => {
  if (!ranges) return [];

  return ranges.map(({ startDate, endDate }) => ({
    startDate: new Date(startDate),
    endDate: new Date(endDate),
  }));
};
