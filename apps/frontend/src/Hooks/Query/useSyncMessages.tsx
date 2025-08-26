import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";
import { Message } from "@/types";

// Tipado del mensaje (igual que en el historial)


// Tipado de la respuesta del sync
interface SyncMessages {
  newMessages: Message[];
  updatedMessages: Message[];
}

const fetchSyncMessages = async (
  conversationId: string,
  token: string,
  after?: string,
  updatedAfter?: string
): Promise<SyncMessages> => {
  const url = `${import.meta.env.VITE_BASE_URL}/messages/${conversationId}/sync`;
  const params: Record<string, string> = {};
  if (after) params.after = after;
  if (updatedAfter) params.updatedAfter = updatedAfter;

  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });
  return res.data;
};

export const useSyncMessages = (
  conversationId: string,
  after?: string,
  updatedAfter?: string
) => {
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

  return useQuery<SyncMessages>({
    queryKey: ["messagesSync", conversationId, after, updatedAfter],
    queryFn: () => fetchSyncMessages(conversationId, token!, after, updatedAfter),
    enabled: !!token && !!conversationId, // solo corre si hay token y conversación
    refetchOnWindowFocus: false,
  });
};
