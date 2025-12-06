import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  endOfMonth,
  startOfDay,
  endOfDay,
  addMonths,
} from "date-fns";
import { GroupedAppointment } from "@/types";
import { getSlotStart, getSlotEnd } from "./getLatestSelectedAppDate";

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
      // Desde el inicio de esta semana hasta el final de esta semana
      start = startOfDay(startOfWeek(now, { weekStartsOn: 1 }));
      end = endOfDay(endOfWeek(now, { weekStartsOn: 1 }));
      break;
    case "2weeks":
      // Desde HOY hasta dentro de 2 semanas (14 días)
      start = startOfDay(now);
      end = endOfDay(addWeeks(now, 2));
      break;
    case "month":
      // Desde HOY hasta el final del próximo mes (para cubrir ~60 días)
      start = startOfDay(now);
      end = endOfDay(endOfMonth(addMonths(now, 1)));
      break;
    case "custom":
      if (!customStart || !customEnd) return grouped;
      // Normalizar al inicio y fin del día para incluir todas las citas de esos días
      start = startOfDay(customStart);
      end = endOfDay(customEnd);
      break;
    default:
      return grouped;
  }

  // Asegura orden de fechas por si vienen invertidas
  if (start > end) [start, end] = [end, start];

  console.log(`📅 Date Range Filter: ${range}`, {
    start: start.toISOString(),
    end: end.toISOString(),
    startLocal: start.toLocaleString(),
    endLocal: end.toLocaleString(),
  });

  const overlapsWindow = (slot: any) => {
    const s = getSlotStart(slot);
    const e = getSlotEnd(slot) || s;
    if (!s) return false;
    return s <= end && (e ?? s) >= start;
  };

  let totalBeforeFilter = 0;
  let totalAfterFilter = 0;

  const result = grouped.map((group) => {
    totalBeforeFilter += group.patients?.length || 0;
    
    const filteredPatients = (group.patients ?? []).filter((p) => {
      const slots = Array.isArray(p.selectedAppDates) ? p.selectedAppDates : [];
      
      // ✅ SIEMPRE incluir si tiene al menos un slot con status Complete o Confirmed
      const hasCompleteOrConfirmed = slots.some((slot: any) => {
        const st = String(slot?.status || "").toLowerCase();
        return st === "complete" || st === "confirmed";
      });

      if (hasCompleteOrConfirmed) {
        return true;
      }

      // Para el resto, verificar si algún slot está en el rango (CUALQUIER status)
      return slots.some((slot: any) => {
        return overlapsWindow(slot);
      });
    });

    totalAfterFilter += filteredPatients.length;

    return {
      ...group,
      patients: filteredPatients,
      count: filteredPatients.length,
    };
  });

  console.log(`📊 Filter Results for "${range}":`, {
    totalBeforeFilter,
    totalAfterFilter,
    filtered: totalBeforeFilter - totalAfterFilter,
    groups: result.map(g => ({ priority: g.priorityName || 'Unknown', count: g.count }))
  });

  return result;

  // Importante: NO filtrar por g.count > 0. Así siempre vuelven TODAS las prioridades.
}
