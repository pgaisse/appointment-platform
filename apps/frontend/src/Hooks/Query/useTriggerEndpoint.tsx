import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";
import { env } from "@/types";

/**
 * Hook para hacer POST a un endpoint dinámico autenticado, sin esperar respuesta.
 * @param endpoint - Ruta relativa del endpoint (ej: "/start-process")
 */
export const useTriggerEndpoint = (endpoint: string) => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!isAuthenticated) {
        throw new Error("Usuario no autenticado");
      }

      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        },
      });

      // POST sin body, sin retorno de datos
      await axios.post(
        `${import.meta.env.VITE_BASE_URL}${endpoint}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
    },
  });

  return mutation;
};
