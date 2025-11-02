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
export const useTodayMessages = () => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  return useQuery({
    queryKey: ["dashboard-today-messages"],
    enabled: isAuthenticated,
    queryFn: async () => {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });
      const url = `${import.meta.env.VITE_BASE_URL}/dashboard/messages/today`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data as Message[];
    },
    staleTime: 60_000, // 1 minuto
  });
};

// Hook para obtener mensajes del mes
export const useMonthMessages = () => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  return useQuery({
    queryKey: ["dashboard-month-messages"],
    enabled: isAuthenticated,
    queryFn: async () => {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });
      const url = `${import.meta.env.VITE_BASE_URL}/dashboard/messages/month`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data as Message[];
    },
    staleTime: 60_000, // 1 minuto
  });
};

// Hook para obtener mensajes por rango custom (detallado)
export const useMessagesRange = (start?: string, end?: string, enabledParam?: boolean) => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  const enabled = Boolean(isAuthenticated && start && end && enabledParam);
  return useQuery({
    queryKey: ["dashboard-range-messages", { start, end }],
    enabled,
    queryFn: async () => {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });
      const url = `${import.meta.env.VITE_BASE_URL}/dashboard/messages/range`;
      const params = new URLSearchParams({ start: String(start), end: String(end), detailed: "true" });
      const res = await axios.get(`${url}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data as Message[];
    },
    staleTime: 30_000,
  });
};
