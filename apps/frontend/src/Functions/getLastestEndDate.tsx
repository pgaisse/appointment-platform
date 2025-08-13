type DateRange = { startDate: Date; endDate: Date };

export function getDateRangeLimits(dates: DateRange[]): { min: Date; max: Date } | null {
  if (!dates || dates.length === 0) return null;

  let min = dates[0].startDate;
  let max = dates[0].endDate;

  for (const { startDate, endDate } of dates) {
    if (startDate < min) min = startDate;
    if (endDate > max) max = endDate;
  }

  return { min, max };
}
