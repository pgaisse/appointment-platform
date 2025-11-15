import { useMutation } from "@tanstack/react-query";
import axios, { AxiosResponse } from "axios";
import { useAuth0 } from "@auth0/auth0-react";

// =========================
// Tipos (compatibles con tu versión)
// =========================
type SendAppointmentSMSPayload = {
  appointmentId: string;
  msg: string;
  // opcionales para programado
  scheduleWithTwilio?: boolean;
  whenISO?: string;           // e.g. "2025-10-21T10:00:00"
  tz?: string;                // default "Australia/Sydney"
  slotId?: string;            // opcional: slot al que corresponde el SMS (para evitar duplicados)
};

type SendAppointmentSMSResponse = {
  success: boolean;
  scheduled: boolean;
  docs?: any;                 // instantáneo (Conversations)
  messagingSid?: string;      // programado (SM...)
  to?: string;                // programado
  runAt?: string;             // programado
  tz?: string;                // programado
};

// =========================
// Hook
// =========================
export const useSendAppointmentSMS = () => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  return useMutation<SendAppointmentSMSResponse, Error, SendAppointmentSMSPayload>({
    mutationFn: async (payload) => {
      if (!isAuthenticated) {
        throw new Error("Usuario no autenticado");
      }



      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        },
      });

      const res: AxiosResponse<SendAppointmentSMSResponse> = await axios.post(
        `${import.meta.env.VITE_BASE_URL}/sendMessageAsk`,
        { ...payload, source: "frontend" }, // incluimos slotId si viene
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return res.data;
    },
    retry: 0, // evita reintentos automáticos en errores 4xx de validación
    onError: (error) => {
      console.error("❌ Error enviando SMS:", error.message);
    },
  });
};
