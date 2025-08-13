import { DateRange } from "@/Hooks/Handles/useSlotSelection";


export function getDayRange(dateInput: Date): DateRange {
  const date = new Date(dateInput);

  const startDate = new Date(date);
  startDate.setHours(9, 0, 0, 0); // 9:00 AM

  const endDate = new Date(date);
  endDate.setHours(21, 0, 0, 0); // 9:00 PM
  
  const currentDate:DateRange={ startDate, endDate}

  return currentDate;
}
