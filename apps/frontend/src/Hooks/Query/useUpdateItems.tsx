import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";

export type UpdatePayload = {
  table: string;
  id_field: string;
  id_value: string;
  data: { [key: string]: any };
};

// Helper: junta base + endpoint sin dobles barras
const joinURL = (base: string, endpoint: string) => {
  if (!endpoint) throw new Error("Endpoint requerido");
  // Si ya es absoluta, úsala tal cual
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  const b = base?.replace(/\/+$/, "") ?? "";
  const e = endpoint.replace(/^\/+/, "");
  return `${b}/${e}`;
};

const updateItems = async ({
  payload,
  token,
  endpoint,
}: {
  payload: UpdatePayload[];
  token: string;
  endpoint: string; // ← ahora es dinámico
}) => {
  // Resolve API base from runtime window.__ENV__ first, then VITE, then fallback to "/api"
  const winAny = globalThis as unknown as { __ENV__?: { API_URL?: string } };
  const runtimeBase = winAny?.__ENV__?.API_URL;
  const envBase = (import.meta as any)?.env?.VITE_BASE_URL as string | undefined;
  const base = runtimeBase || envBase || "/api";

  // Accept endpoints with or without leading slash
  const safeEndpoint = endpoint?.trim() || "update-items";
  const url = joinURL(base, safeEndpoint);

  const res = await axios.patch(url, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

/**
 * Hook para actualizar items con endpoint configurable.
 * @param endpoint Ruta relativa (p.ej. "/update-items" o "appointments/update") o URL absoluta.
 * @param options  Config para cache (queryKey que optimizamos/invalida).
 */
export const useUpdateItems = (
  endpoint: string = "update-items",
  options?: {
    optimisticKey?: unknown[];        // key a optimizar (por defecto ["items"])
    invalidateKeys?: unknown[][];     // keys a invalidar al terminar
  }
) => {
  const queryClient = useQueryClient();
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  const optimisticKey = options?.optimisticKey ?? ["items"];
  const invalidateKeys = options?.invalidateKeys ?? [optimisticKey];

  return useMutation({
    mutationFn: async (payload: UpdatePayload[]) => {
      if (!isAuthenticated) throw new Error("Usuario no autenticado");
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });
      return await updateItems({ payload, token, endpoint });
    },

    // --- OPTIMISTIC UPDATE (igual que tu versión actual) ---
    onMutate: async (updatedPayload) => {
      await queryClient.cancelQueries({ queryKey: optimisticKey });
      const previousData = queryClient.getQueryData<any>(optimisticKey);

      queryClient.setQueryData(optimisticKey, (oldData: any) => {
        if (!oldData) return oldData;

        // Copia superficial y lógica de mover/ordenar que ya tenías
        const newData = oldData.map((col: any) => {
          let patients = col.patients ? [...col.patients] : [];

          updatedPayload.forEach((update) => {
            if (update.data.priority !== col._id) return;
            patients = patients.filter((p) => p._id !== update.id_value);
          });

          updatedPayload
            .filter((u) => u.data.priority === col._id)
            .sort((a, b) => a.data.position - b.data.position)
            .forEach((u) => {
              const updatedItem = (previousData as any)
                .flatMap((c: any) => c.patients)
                .find((p: any) => p._id === u.id_value);
              if (updatedItem) patients.splice(u.data.position, 0, updatedItem);
            });

          return { ...col, patients };
        });

        return newData;
      });

      return { previousData };
    },

    onError: (_err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(optimisticKey, context.previousData);
      }
    },

    onSettled: () => {
      invalidateKeys.forEach((key) =>
        queryClient.invalidateQueries({ queryKey: key })
      );
    },
  });
};
