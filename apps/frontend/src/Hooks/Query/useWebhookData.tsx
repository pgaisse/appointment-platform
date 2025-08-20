import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";
import { env } from "@/types";

interface UseWebhookDataProps<T> {
  manual?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: unknown) => void;
}

/**
 * Hook para obtener datos desde /getchats con token de Auth0, tipado y React Query
 */
export function useWebhookData<T = unknown>(props?: UseWebhookDataProps<T>) {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const fetchToken = async () => {
      if (isAuthenticated) {
        const newToken = await getAccessTokenSilently({
          authorizationParams: {
            audience: env.AUTH0_AUDIENCE,
          },
        });
        setToken(newToken);
      }
    };
    fetchToken();
  }, [getAccessTokenSilently, isAuthenticated]);

  const fetchWebhookData = async (): Promise<T> => {
    const res = await axios.get<T>(`${env.BASE_URL}/getchats`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.data;
  };

  return useQuery<T, unknown>({
    queryKey: ['webhook-data'],
    queryFn: fetchWebhookData,
    enabled: !!token && !props?.manual,
    refetchOnWindowFocus: false,
  });
}
