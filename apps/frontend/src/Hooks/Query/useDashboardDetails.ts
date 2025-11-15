// apps/frontend/src/Hooks/Query/useDashboardDetails.ts
import { useQuery } from "@tanstack/react-query";
import { useAuth0 } from "@auth0/auth0-react";
import axios from "axios";
import type { Appointment } from "@/types";

interface Message {
  _id: string;
  to: string;
  body: string;
  time: Date;
  status: string;
  direction: string;
  author?: string;
  recipientName?: string | null;
  proxyAddress?: string;
  createdAt: Date;
  user?: {
    _id?: string;
    name?: string;
    email?: string;
    picture?: string;
  } | null;
}

// Hook para obtener appointments de hoy
export const useTodayAppointments = () => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  return useQuery({
    queryKey: ["dashboard-today-appointments"],
    enabled: isAuthenticated,
    queryFn: async () => {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });
      const url = `${import.meta.env.VITE_BASE_URL}/dashboard/appointments/today`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data as Appointment[];
    },
    staleTime: 60_000, // 1 minuto
  });
};

// Hook para obtener appointments de esta semana
export const useWeekAppointments = () => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  return useQuery({
    queryKey: ["dashboard-week-appointments"],
    enabled: isAuthenticated,
    queryFn: async () => {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });
      const url = `${import.meta.env.VITE_BASE_URL}/dashboard/appointments/week`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data as Appointment[];
    },
    staleTime: 60_000, // 1 minuto
  });
};

// Hook para obtener appointments pendientes
export const usePendingAppointments = () => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  return useQuery({
    queryKey: ["dashboard-pending-appointments"],
    enabled: isAuthenticated,
    queryFn: async () => {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });
      const url = `${import.meta.env.VITE_BASE_URL}/dashboard/appointments/pending`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data as Appointment[];
    },
    staleTime: 60_000, // 1 minuto
  });
};

// Hook para obtener mensajes de hoy
export const useTodayMessages = (direction: 'outbound' | 'inbound' | 'both' = 'outbound') => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  return useQuery({
    queryKey: ["dashboard-today-messages", direction],
    enabled: isAuthenticated,
    queryFn: async () => {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });
      const url = `${import.meta.env.VITE_BASE_URL}/dashboard/messages/today?direction=${direction}`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data as Message[];
    },
    staleTime: 60_000, // 1 minuto
  });
};

// Hook para obtener mensajes del mes
export const useMonthMessages = (direction: 'outbound' | 'inbound' | 'both' = 'outbound') => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  return useQuery({
    queryKey: ["dashboard-month-messages", direction],
    enabled: isAuthenticated,
    queryFn: async () => {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });
      const url = `${import.meta.env.VITE_BASE_URL}/dashboard/messages/month?direction=${direction}`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data as Message[];
    },
    staleTime: 60_000, // 1 minuto
  });
};

// Hook para obtener mensajes por rango custom (detallado)
export const useMessagesRange = (start?: string, end?: string, enabledParam?: boolean, direction: 'outbound' | 'inbound' | 'both' = 'outbound') => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  const enabled = Boolean(isAuthenticated && start && end && enabledParam);
  return useQuery({
    queryKey: ["dashboard-range-messages", { start, end, direction }],
    enabled,
    queryFn: async () => {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });
      const url = `${import.meta.env.VITE_BASE_URL}/dashboard/messages/range`;
      const params = new URLSearchParams({ start: String(start), end: String(end), detailed: "true", direction });
      const res = await axios.get(`${url}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data as Message[];
    },
    staleTime: 30_000,
  });
};

// Hook for new patients (appointments created this month)
export const useMonthNewPatients = () => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  return useQuery({
    queryKey: ['dashboard-month-new-patients'],
    enabled: isAuthenticated,
    queryFn: async () => {
      const token = await getAccessTokenSilently({ authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE } });
      const url = `${import.meta.env.VITE_BASE_URL}/dashboard/appointments/month`;
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      return res.data as Appointment[];
    },
    staleTime: 60_000,
  });
};

// Hook for appointments created in a custom range
export const useAppointmentsRange = (start?: string, end?: string, enabledParam: boolean = true) => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const enabled = Boolean(isAuthenticated && !!start && !!end && enabledParam);

  return useQuery({
    queryKey: ['dashboard-appointments-range', start, end],
    enabled,
    queryFn: async () => {
      const token = await getAccessTokenSilently({ authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE } });
      const params = new URLSearchParams({ start: String(start), end: String(end) });
      const url = `${import.meta.env.VITE_BASE_URL}/dashboard/appointments/range?${params.toString()}`;
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      return res.data as Appointment[];
    },
    staleTime: 30_000,
  });
};
