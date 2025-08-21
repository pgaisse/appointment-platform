import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";
import { env } from "@/types";

type SendAppointmentSMSPayload = {
  appointmentId: string;
};

type SendAppointmentSMSResponse = {
  success: boolean;
  message: string;
  conversationSid?: string;
  messageSid?: string;
};

export const useSendAppointmentSMS = () => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  const mutation = useMutation<SendAppointmentSMSResponse, Error, SendAppointmentSMSPayload>({
    mutationFn: async (payload: SendAppointmentSMSPayload) => {
      if (!isAuthenticated) {
        throw new Error("Usuario no autenticado");
      }

      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        },
      });

      // Agrega la propiedad "source"
      const bodyWithSource = {
        ...payload,
        source: "frontend",
      };

      const res = await axios.post(
        `${import.meta.env.VITE_BASE_URL}/webhook2`,
        bodyWithSource,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return res.data;
    },
    onError: (error) => {
      console.error("❌ Error enviando SMS:", error.message);
    },
  });

  return mutation;
};
