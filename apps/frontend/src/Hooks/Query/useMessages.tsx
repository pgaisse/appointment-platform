import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";
import { PaginatedMessages } from "@/types";



const fetchMessages = async (
  conversationId: string,
  token: string,
  page: number,
  limit: number
): Promise<PaginatedMessages> => {
  const url = `${import.meta.env.VITE_BASE_URL}/messages/${conversationId}`;
  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
    params: { page, limit },
  });
  return res.data;
};

export const useMessages = (
  conversationId: string,
  page = 1,
  limit = 50
) => {
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

  return useQuery<PaginatedMessages>({
    queryKey: ["messages", conversationId, page, limit],
    queryFn: () => fetchMessages(conversationId, token!, page, limit),
    enabled: !!token && !!conversationId,   // 👈 evita el fetch sin ID
    refetchOnWindowFocus: false,
  });
};
