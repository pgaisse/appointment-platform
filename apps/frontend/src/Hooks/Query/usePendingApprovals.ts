import { useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";
import type { Appointment } from "@/types";

// Stable key to make invalidation easy (no filters in the key)
export const PENDING_APPROVALS_QK = ["pending-approvals"] as const satisfies QueryKey;

type Options = {
  limit?: number;
};

// Shared mongo query for "Pending Approvals"
const pendingQuery = {
  $and: [
    { unknown: false },
    { selectedAppDates: { $elemMatch: { status: { $regex: "^pending$", $options: "i" } } } },
  ],
};

export function usePendingApprovals(opts: Options = {}) {
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
    queryKey: PENDING_APPROVALS_QK,
    enabled: !!token,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const url = `${import.meta.env.VITE_BASE_URL}/query/Appointment`;
      const params: Record<string, any> = {
        query: JSON.stringify(pendingQuery),
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

// Small helper to invalidate from any component without importing QueryClient everywhere
export function useInvalidatePendingApprovals() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: PENDING_APPROVALS_QK });
}
