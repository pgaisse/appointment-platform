
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);


export default function formatDate(date: Date) {
  const dT = dayjs.utc(date).tz("Australia/Sydney");
  const dDay = dT.format("DD MMM YYYY"); // ejemplo: "Sat, 10 May 2025"
  const dHours = dT.format("HH:mm");
  return {dDay,dHours };
}
