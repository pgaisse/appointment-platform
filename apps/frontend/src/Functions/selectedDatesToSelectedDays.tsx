import { TimeSlot, WeekDay } from "@/Components/CustomTemplates/AvailabilityDates";
import { DateRange } from "@/Components/CustomTemplates/CustomBestApp";

const daysMap: Record<number, WeekDay> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

const timeSlots: {
  full: TimeSlot;
  from: string;
  to: string;
}[] = [
  { full: "Early Morning", from: "09:30", to: "11:30" },
  { full: "Late Morning", from: "11:30", to: "13:00" },
  { full: "Early Afternoon", from: "14:00", to: "16:00" },
  { full: "Late Afternoon", from: "16:00", to: "18:00" },
];

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export default function selectedDatesToSelectedDays(
  selectedDates: DateRange[]
): Partial<Record<WeekDay, TimeSlot[]>> {
  const result: Partial<Record<WeekDay, Set<TimeSlot>>> = {};
const convertedDates = selectedDates.map((dateObj) => {
  const isString = typeof dateObj.startDate === 'string' && typeof dateObj.endDate === 'string';

  return isString
    ? dateObj // ya está en formato string
    : {
        startDate: dateObj.startDate.toISOString(),
        endDate: dateObj.endDate.toISOString(),
      };
});
  for (const item of convertedDates) {
    const start = new Date(item.startDate.toString());
    if (isNaN(start.getTime())) continue;

    const jsDay = start.getDay();
    const weekDay = daysMap[jsDay];
    if (!weekDay) continue;

    const currentMinutes = start.getHours() * 60 + start.getMinutes();

    const slot = timeSlots.find(({ from, to }) => {
      const fromMin = timeToMinutes(from);
      const toMin = timeToMinutes(to);
      return currentMinutes >= fromMin && currentMinutes < toMin;
    });

    if (!slot) continue;

    if (!result[weekDay]) result[weekDay] = new Set();
    result[weekDay].add(slot.full);
  }

  const finalResult: Partial<Record<WeekDay, TimeSlot[]>> = {};
  for (const day in result) {
    finalResult[day as WeekDay] = Array.from(result[day as WeekDay]!);
  }

  return finalResult;
}
