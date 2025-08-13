import { DateRange } from "@/Hooks/Handles/useSlotSelection";

export const formatDateWS = ({ startDate, endDate }: DateRange): string => {
  const startDatep=new Date(startDate)
  const endDatep=new Date(endDate)
  const pad = (n: number) => n.toString().padStart(2, '0');

  const year = startDatep.getFullYear();
  const month = pad(startDatep.getMonth() + 1);
  const day = pad(startDatep.getDate());

  const startHour = pad(startDatep.getHours());
  const startMinute = pad(startDatep.getMinutes());

  const endHour = pad(endDatep.getHours());
  const endMinute = pad(endDatep.getMinutes());

  return `${year}/${month}/${day} ${startHour}:${startMinute} - ${endHour}:${endMinute}`;
};