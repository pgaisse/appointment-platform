import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";
import { env } from "@/types";

// Función genérica para insertar datos en cualquier colección
const insertToCollection = async function<T>(
  collection: string,
  token: string,
  data: Record<string, any>
): Promise<T> {
  const res = await axios.post(
    `${import.meta.env.VITE_BASE_URL}/add`,
    {
      modelName: collection,
      data,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return res.data;
};

// Hook genérico para inserción con soporte Auth0 y envío de datos dinámicos
export const useInsertToCollection = <T = unknown>(collection: string) => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const getToken = async () => {
      if (isAuthenticated) {
        const newToken = await getAccessTokenSilently({
          authorizationParams: {
            audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          },
        });
        setToken(newToken);
      }
    };
    getToken();
  }, [getAccessTokenSilently, isAuthenticated]);

  const mutation = useMutation<T, unknown, Record<string, any>>({
    mutationFn: (data: Record<string, any>) => {
      if (!token) return Promise.reject("No auth token");
      return insertToCollection<T>(collection, token, data);
    },
  });

  return mutation;
};
