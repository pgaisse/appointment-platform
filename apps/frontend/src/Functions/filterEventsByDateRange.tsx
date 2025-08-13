
import { DateRange } from "@/Hooks/Handles/useSlotSelection";
import { Appointment } from "@/types";
const defaultDateRange: DateRange = {
  startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 días atrás
  endDate: new Date(), // hoy
};
export function filterEventsByDateRange(events: Appointment[], range: DateRange=defaultDateRange): Appointment[] {
  return events.filter(event =>
    event.selectedAppDates?.some(({ startDate, endDate }) => {
      const eventStart = new Date(startDate).getTime();
      const eventEnd = new Date(endDate).getTime();
      const rangeStart = range.startDate.getTime();
      const rangeEnd = range.endDate.getTime();
      // Verifica que los rangos se superpongan
      return eventStart <= rangeEnd && eventEnd >= rangeStart;
    }) ?? false
  );
}