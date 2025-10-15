// tu archivo del hook de inserción
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";
import { parseAxiosError, ApiError } from "@/utils/apiError";

const insertToCollection = async function<T>(
  collection: string,
  token: string,
  data: Record<string, any>
): Promise<T> {
  try {
    const res = await axios.post(
      `${import.meta.env.VITE_BASE_URL}/add`,
      { modelName: collection, data },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data as T;
  } catch (e) {
    throw parseAxiosError(e);
  }
};

export const useInsertToCollection = <T = unknown>(collection: string) => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const getToken = async () => {
      if (isAuthenticated) {
        const newToken = await getAccessTokenSilently({
          authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
        });
        setToken(newToken);
      }
    };
    getToken();
  }, [getAccessTokenSilently, isAuthenticated]);

  // Nota: tipamos el error como ApiError para usar status en onError
  const mutation = useMutation<T, ApiError, Record<string, any>>({
    mutationFn: (data: Record<string, any>) => {
      if (!token) return Promise.reject(parseAxiosError(new Error("No auth token")));
      return insertToCollection<T>(collection, token, data);
    },
  });

  return mutation;
};
