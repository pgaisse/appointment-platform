// apps/frontend/src/Hooks/Query/useAppointmentsPaginated.ts
import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthFetch } from "@/lib/authFetch";

export type PageResp<T> = {
  items: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

type Opts = { filter?: Record<string, any>; sort?: Record<string, any> };

// ───────────────────────── keys helpers ─────────────────────────
export const appointmentsKeys = {
  root: ["appointments"] as const,
  // Todas las listas (útil para invalidar todo lo paginado)
  lists: () => [...appointmentsKeys.root, "list"] as const,
  // Lista específica con sus parámetros
  list: (params: { page: number; limit: number; filter?: object; sort?: object }) =>
    [...appointmentsKeys.lists(), params] as const,
  // Detalle por id (si algún día lo usas)
  detail: (id: string) => [...appointmentsKeys.root, "detail", { id }] as const,
};

// Normaliza objetos para que el key sea estable (ordena claves)
const normalizeObj = (o?: Record<string, any>) => {
  if (!o) return undefined;
  const entries = Object.entries(o).sort(([a], [b]) => a.localeCompare(b));
  return entries.reduce<Record<string, any>>((acc, [k, v]) => {
    acc[k] = v;
    return acc;
  }, {});
};

export function useAppointmentsPaginated<T = any>(
  page: number,
  limit: number,
  options?: Opts
) {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();

  // Objetos normalizados para que el queryKey no cambie por orden de propiedades
  const norm = useMemo(
    () => ({
      page,
      limit,
      filter: normalizeObj(options?.filter),
      sort: normalizeObj(options?.sort),
    }),
    [page, limit, options?.filter, options?.sort]
  );

  const search = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (norm.filter) params.set("filter", JSON.stringify(norm.filter));
    if (norm.sort) params.set("sort", JSON.stringify(norm.sort));
    
    // ✅ Agregar populate para poblar treatment y priority de cada slot en selectedAppDates
    const populate = [
      { path: "priority", select: "id description notes durationHours name color org_id" },
      { path: "treatment", select: "_id name duration icon minIcon color category active" },
      { path: "providers" },
      { path: "selectedAppDates.treatment", select: "_id name duration icon minIcon color category active" },
      { path: "selectedAppDates.priority", select: "id description notes durationHours name color org_id" },
      { path: "selectedAppDates.providers", select: "_id firstName lastName email phone" },
      { path: "selectedDates.days.timeBlocks", select: "_id org_id blockNumber label short from to" },
      { path: "user", select: "auth0_id name email" },
      { path: "representative.appointment", select: "nameInput lastNameInput phoneInput phoneE164 emailLower sid proxyAddress" },
    ];
    params.set("populate", JSON.stringify(populate));
    
    return params.toString();
  }, [page, limit, norm.filter, norm.sort]);

  const queryKey = appointmentsKeys.list(norm);

  const query = useQuery<PageResp<T>>({
    queryKey,
    queryFn: async ({ signal }) => {
      const res = await authFetch(`/api/appointment-manager?${search}`, { signal });
      return res.json();
    },
    staleTime: 30_000,
  });

  // Atajo para invalidar exactamente esta lista
  const invalidate = () => qc.invalidateQueries({ queryKey, exact: true });

  return { ...query, queryKey, invalidate };
}
