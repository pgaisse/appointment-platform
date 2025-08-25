import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";

type SendSMSPayload = {
  to: string; // E.g. "+61411710260"
  message: string;
};

type SendSMSResponse = {
  message: string;
  sid: string;
};

export const useSendSMS = () => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  const mutation = useMutation<SendSMSResponse, Error, SendSMSPayload>({
    mutationFn: async (payload: SendSMSPayload) => {
      if (!isAuthenticated) {
        throw new Error("Usuario no autenticado");
      }

      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        },
      });

      const res = await axios.post(
        `${import.meta.env.VITE_BASE_URL}/sendSms`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return res.data;
    },
  });

  return mutation;
};
