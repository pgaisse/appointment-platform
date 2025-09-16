import { Appointment } from '@/Components/Modal/AppointmentModal';
import { useQuery } from '@tanstack/react-query';
// Usa tu tipo central si lo exportas desde otra ruta

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/$/, '');

const POPULATE = [
  { path: "priority",       select: "id description notes durationHours name color org_id" },
  { path: "treatment",      select: "_id name duration icon minIcon color category active" },
  { path: "selectedDates.days.timeBlocks", select: "_id org_id blockNumber label short from to" },
  { path: "selectedAppDates.contactedId",  select: "status startDate endDate context cSid pSid createdAt updatedAt" },
] as const;

function buildQueryParams(id: string) {
  const params = new URLSearchParams();
  params.set('query', JSON.stringify({ _id: id }));
  params.set('convertObjectId', 'true');  // convierte _id a ObjectId en servidor
  params.set('populate', JSON.stringify(POPULATE));
  // params.set('select', '...');          // opcional
  // params.set('projection', JSON.stringify({ ... })); // opcional
  // params.set('sort', JSON.stringify({ createdAt: -1 })); // opcional en findOne
  return params.toString();
}

export function useAppointmentOne(id: string) {
  return useQuery({
    queryKey: ['appointment:one', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const qs = buildQueryParams(id);
      const res = await fetch(`${API_BASE}/api/queryOne/Appointment?${qs}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        let msg = 'Request failed';
        try { msg = (await res.json())?.error || msg; } catch {}
        throw new Error(msg);
      }
      // La API devuelve el documento plano (no {data: ...})
      const doc = (await res.json()) as Appointment;
      return doc;
    },
    // Opcionales:
    // staleTime: 60_000,
    // refetchOnWindowFocus: false,
  });
}
