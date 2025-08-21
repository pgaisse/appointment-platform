import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";
import { env, Priority } from "@/types";

const fetchTreatments = async (token: string) => {
  const res = await axios.get(`${import.meta.env.VITE_BASE_URL}/treatments`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return res.data;
};

export const useTreatments = () => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const getToken = async () => {
      if (isAuthenticated) {
        const token = await getAccessTokenSilently({
          authorizationParams: {
            audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          },
        });
       // console.log("Token obtenido (treatments):", token);
        setToken(token);
      }
    };
    getToken();
  }, [getAccessTokenSilently, isAuthenticated]);

  const { data, isLoading, error, refetch, isSuccess, isFetching } = useQuery<Priority[]>({
    queryKey: ["treatments"],
    queryFn: () => fetchTreatments(token!),
    enabled: !!token, // Solo ejecuta la consulta si hay token
    refetchOnWindowFocus: false,
  });

  return { data, isLoading, error, refetch, isSuccess, isFetching };
};
