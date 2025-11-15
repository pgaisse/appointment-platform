import { DateRange } from "@/Hooks/Handles/useSlotSelection";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = "Australia/Sydney";

/**
 * Formats a date range like providers:
 *  Wed, 12 Nov • 3:45 PM – 4:15 PM
 * If different days:
 *  Wed, 12 Nov • 3:45 PM → Thu, 13 Nov • 4:15 PM
 */
export const formatDateWS = ({ startDate, endDate }: DateRange): string => {
  const s = dayjs.utc(startDate).tz(TZ);
  const e = dayjs.utc(endDate).tz(TZ);

  const sameDay = s.format("YYYY-MM-DD") === e.format("YYYY-MM-DD");
  if (sameDay) {
    return `${s.format("ddd, DD MMM • h:mm A")} – ${e.format("h:mm A")}`;
  }
  return `${s.format("ddd, DD MMM • h:mm A")} → ${e.format("ddd, DD MMM • h:mm A")}`;
};
