import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";
import { env } from "@/types";

function useEntryForm<T>(modelName: string) {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  const mutation = useMutation({
    mutationFn: async (formData: T) => {
      if (!isAuthenticated) throw new Error("Usuario no autenticado");

      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: env.AUTH0_AUDIENCE,
        },
      });

      // Incluye el modelName en el body para que el backend lo reciba
      const body = { ...formData, model: modelName };

      const response = await axios.post(`${env.VITE_APP_SERVER}`, body, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data;
    },
    onSuccess: (data) => {
      console.log("Éxito:", data);
    },
    onError: (error) => {
      console.error("Error al enviar:", error);
    },
  });

  return mutation;
}

export default useEntryForm;
