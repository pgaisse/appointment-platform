import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";
import { env } from "@/types";
type Projection = Record<string, number | { $slice: number }>;
// Tipado opcional para los filtros
type CollectionFilters = {
  mongoQuery?: Record<string, any>;
  convertObjectId?: boolean;
  projection?: Projection
  [key: string]: any; // permite otros parámetros como limit, populate, etc.
};

// Función genérica para obtener datos de cualquier colección
const fetchCollection = async function <T>(
  collection: string,
  token: string,
  filters: CollectionFilters = {}
): Promise<T[]> {
  const { mongoQuery, convertObjectId, params, ...rest } = filters;



  const finalParams: Record<string, any> = {
    ...(mongoQuery ? { query: JSON.stringify(mongoQuery) } : {}),
    ...(convertObjectId ? { convertObjectId: true } : {}),
    ...(filters.projection ? { projection: JSON.stringify(filters.projection) } : {}),
  };

  // 🔁 Serializa populate si es un objeto o array
  if (rest.populate) {
    finalParams.populate = JSON.stringify(rest.populate);
  }

  if (rest.limit) {
    finalParams.limit = rest.limit;
  }


  const url = `${env.VITE_APP_SERVER}/query/${collection}`;
  console.log("📡 useGetCollection → fetching:", {
    url,
    headers: { Authorization: `Bearer ${token?.slice(0, 20)}...` },
    params: finalParams,
  });
  const res = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    params: finalParams,
  });
  return res.data;
};

// Hook genérico con soporte de Auth0 y filtros avanzados
export const useGetCollection = <T = unknown>(
  collection: string,
  filters: CollectionFilters = {}
) => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const getToken = async () => {
      if (isAuthenticated) {
        const newToken = await getAccessTokenSilently({
          authorizationParams: {
            audience: env.AUTH0_AUDIENCE,
          },
        });
        setToken(newToken);
      }
    };
    getToken();
  }, [getAccessTokenSilently, isAuthenticated]);

  return useQuery<T[]>({
    queryKey: [collection, filters],
    queryFn: async () => fetchCollection<T>(collection, token!, filters),
    enabled: !!token,
    refetchOnWindowFocus: false,
  });
};
