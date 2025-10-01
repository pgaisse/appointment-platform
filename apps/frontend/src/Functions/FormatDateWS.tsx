import { DateRange } from "@/Hooks/Handles/useSlotSelection";

const TZ = "Australia/Sydney";

const formatYMD = (d: Date) => {
  // en-CA da YYYY-MM-DD (fijo), lo convertimos a YYYY/MM/DD
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const [y, m, day] = ymd.split("-");
  return `${y}/${m}/${day}`;
};

const formatTime12h = (d: Date) =>
  new Intl.DateTimeFormat("en-AU", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d); // Ej: "07:05 am"

export const formatDateWS = ({ startDate, endDate }: DateRange): string => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const dateStr = formatYMD(start);
  const startTime = formatTime12h(start);
  const endTime = formatTime12h(end);

  return `${dateStr} ${startTime} – ${endTime}`;
};
