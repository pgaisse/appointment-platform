import { useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";
import type { Appointment } from "@/types";

export const ARCHIVED_APPTS_QK = ["archived-appointments"] as const satisfies QueryKey;

type Options = {
  limit?: number;
};

const archivedQuery = {
  $and: [ { unknown: false }, { position: -1 } ],
};

export function useArchivedAppointments(opts: Options = {}) {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const [token, setToken] = useState<string | null>(null);
  const limit = typeof opts.limit === "number" ? opts.limit : 100;

  useEffect(() => {
    const getToken = async () => {
      if (isAuthenticated) {
        const t = await getAccessTokenSilently({
          authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
        });
        setToken(t);
      }
    };
    getToken();
  }, [getAccessTokenSilently, isAuthenticated]);

  return useQuery<Appointment[]>({
    queryKey: ARCHIVED_APPTS_QK,
    enabled: !!token,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const url = `${import.meta.env.VITE_BASE_URL}/query/Appointment`;
      const params: Record<string, any> = {
        query: JSON.stringify(archivedQuery),
        limit,
      };
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      return res.data as Appointment[];
    },
  });
}

export function useInvalidateArchivedAppointments() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ARCHIVED_APPTS_QK });
}
