import {
    startOfWeek,
    endOfWeek,
    addWeeks,
    endOfMonth,
    isWithinInterval,
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

    return grouped
        .map((group) => {
            const filteredPatients = group.patients.filter((p) => {
                const raw = p.selectedAppDates?.[0]?.startDate;
                const date = raw instanceof Date ? raw : raw ? new Date(raw) : undefined;

                return date instanceof Date && isWithinInterval(date, { start, end });
            });

            return {
                ...group,
                patients: filteredPatients,
                count: filteredPatients.length,
            };
        })
        .filter((g) => g.count > 0);
}
