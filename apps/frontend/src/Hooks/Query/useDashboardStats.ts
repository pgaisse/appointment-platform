// apps/frontend/src/Hooks/Query/useDashboardStats.ts
import { useQuery } from "@tanstack/react-query";
import { useAuth0 } from "@auth0/auth0-react";
import axios from "axios";

export interface DashboardStats {
  appointments: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    pending: number;
    completed: number;
    cancelled: number;
  };
  messages: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    total: number;
  };
  contacts: {
    accessed: number;
    active: number;
    new: number;
  };
  pending: {
    total: number;
    urgent: number;
  };
}

const fetchDashboardStats = async (token: string): Promise<DashboardStats> => {
  const url = `${import.meta.env.VITE_BASE_URL}/dashboard/stats`;
  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

// Hook for monthly message statistics
export interface MonthlyMessageStat {
  month: number;
  year: number;
  count: number;
}

export const useMonthlyMessageStats = (months: number = 6) => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  return useQuery({
    queryKey: ["dashboard-monthly-messages", months],
    enabled: isAuthenticated,
    queryFn: async () => {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });
      const url = `${import.meta.env.VITE_BASE_URL}/dashboard/messages/monthly?months=${months}`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data.monthly as MonthlyMessageStat[];
    },
    staleTime: 5 * 60_000, // 5 minutes
    refetchOnWindowFocus: false,
  });
};

// Hook for message count in a specific date range
export const useMessageRangeStats = (start: string, end: string, enabled: boolean = true) => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  return useQuery({
    queryKey: ["dashboard-message-range", start, end],
    enabled: isAuthenticated && enabled && !!start && !!end,
    queryFn: async () => {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });
      const url = `${import.meta.env.VITE_BASE_URL}/dashboard/messages/range?start=${start}&end=${end}`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data as { start: string; end: string; count: number };
    },
    staleTime: 5 * 60_000, // 5 minutes
    refetchOnWindowFocus: false,
  });
};

export const useDashboardStats = () => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  return useQuery({
    queryKey: ["dashboard-stats"],
    enabled: isAuthenticated,
    queryFn: async () => {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });
      return fetchDashboardStats(token);
    },
    staleTime: 60_000, // 1 minuto
    refetchOnWindowFocus: true,
  });
};
