// src/utils/ymdInTZ.ts
export function ymdInTZ(
  dateInput: Date | string | number,
  timeZone = "Australia/Sydney"
): string {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find(p => p.type === "year")!.value;
  const m = parts.find(p => p.type === "month")!.value;
  const day = parts.find(p => p.type === "day")!.value;
  return `${y}-${m}-${day}`; // YYYY-MM-DD en la TZ indicada
}
