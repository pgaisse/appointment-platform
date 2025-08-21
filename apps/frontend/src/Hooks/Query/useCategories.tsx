import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";
import { env } from "@/types";

const fetchCategories = async (token: string) => {
  const res = await axios.get(`${import.meta.env.VITE_BASE_URL}/categories`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return res.data;
};

export const useCategories = () => {
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
        setToken(token);
      }
    };
    getToken();
  }, [getAccessTokenSilently, isAuthenticated]);

  const query = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      if (!token) return []; // <- evita error si aún no hay token
      return fetchCategories(token);
    },
    enabled: !!token,
    refetchOnWindowFocus: false,
    staleTime: 0,
  });

  return query;
};
