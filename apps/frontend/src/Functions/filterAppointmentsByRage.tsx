import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  endOfMonth,
} from "date-fns";
import { GroupedAppointment } from "@/types";

export type RangeOption = "week" | "2weeks" | "month" | "custom";

export function filterAppointmentsByRange(
  grouped: GroupedAppointment[],
  range: RangeOption,
  customStart?: Date,
  customEnd?: Date
): GroupedAppointment[] {
  const now = new Date();
  let start: Date;
  let end: Date;

  switch (range) {
    case "week":
      start = startOfWeek(now, { weekStartsOn: 1 });
      end = endOfWeek(now, { weekStartsOn: 1 });
      break;
    case "2weeks":
      start = startOfWeek(now, { weekStartsOn: 1 });
      end = addWeeks(start, 2);
      break;
    case "month":
      start = startOfWeek(now, { weekStartsOn: 1 });
      end = endOfMonth(now);
      break;
    case "custom":
      if (!customStart || !customEnd) return grouped;
      start = customStart;
      end = customEnd;
      break;
    default:
      return grouped;
  }

  // Asegura orden de fechas por si vienen invertidas
  if (start > end) [start, end] = [end, start];

  const overlapsWindow = (a?: { startDate?: Date | string; endDate?: Date | string }) => {
    if (!a?.startDate) return false;
    const s = new Date(a.startDate);
    const e = a.endDate ? new Date(a.endDate) : s;
    if (isNaN(s.getTime())) return false;
    // Solapamiento básico: [s, e] cruza [start, end]
    return s <= end && e >= start;
  };

  return grouped.map((group) => {
    const filteredPatients = (group.patients ?? []).filter((p) => {
      const slots = Array.isArray(p.selectedAppDates) ? p.selectedAppDates : [];
      // Mantén al paciente si CUALQUIER rango seleccionado solapa la ventana
      return slots.some(overlapsWindow);
    });

    return {
      ...group,
      patients: filteredPatients,
      count: filteredPatients.length,
    };
  });

  // Importante: NO filtrar por g.count > 0. Así siempre vuelven TODAS las prioridades.
}
