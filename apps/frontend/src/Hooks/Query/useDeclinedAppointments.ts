import { useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";
import type { Appointment } from "@/types";

export const DECLINED_APPTS_QK = ["declined-appointments"] as const satisfies QueryKey;

type Options = {
  limit?: number;
};

const declinedQuery = {
  $and: [
    { unknown: false },
    { selectedAppDates: { $elemMatch: { status: { $regex: "^(declined|rejected)$", $options: "i" } } } },
  ],
};

export function useDeclinedAppointments(opts: Options = {}) {
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
    queryKey: DECLINED_APPTS_QK,
    enabled: !!token,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const url = `${import.meta.env.VITE_BASE_URL}/query/Appointment`;
      const params: Record<string, any> = {
        query: JSON.stringify(declinedQuery),
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

export function useInvalidateDeclinedAppointments() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: DECLINED_APPTS_QK });
}
