import { useMutation } from "@tanstack/react-query";
import axios, { AxiosResponse } from "axios";
import { useAuth0 } from "@auth0/auth0-react";

export type ProposeAppointmentPayload = {
  appointmentId: string;
  proposedStartDate: string; // ISO
  proposedEndDate: string;   // ISO
  currentStartDate?: string; // ISO (opcional)
  currentEndDate?: string;   // ISO (opcional)
  reason?: string;
  tz?: string;               // default Australia/Sydney en backend
  baseSlotId?: string;       // si se envía, se actualiza ese slot (no se crea uno nuevo)
};

export type ProposeAppointmentResponse = {
  success: boolean;
  appointmentId: string;
  slotId: string;
};

export const useProposeAppointmentDates = () => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  return useMutation<ProposeAppointmentResponse, Error, ProposeAppointmentPayload>({
    mutationFn: async (payload) => {
      if (!isAuthenticated) throw new Error("Usuario no autenticado");

      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        },
      });

      const url = `${import.meta.env.VITE_BASE_URL}/appointments/${payload.appointmentId}/propose`;
      const { appointmentId, ...body } = payload;

      const res: AxiosResponse<ProposeAppointmentResponse> = await axios.post(url, body, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data;
    },
  });
};
