// useSyncMessages.ts
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";
import { Message } from "@/types";

const fetchSyncMessages = async (
  conversationId: string,
  token: string,
  after?: string,
  updatedAfter?: string
): Promise<Message[]> => {
  console.log("se ha llamado  a sync")
  const url = `${import.meta.env.VITE_BASE_URL}/messages/${conversationId}/sync`;
  const params: Record<string, string> = {};
  if (after) params.after = after;
  if (updatedAfter) params.updatedAfter = updatedAfter;

  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });

  // 🔄 Normalizar: { newMessages, updatedMessages } → Message[]
  const { newMessages = [], updatedMessages = [] } = res.data;
  return [...newMessages, ...updatedMessages];
};

export const useSyncMessages = (
  conversationId: string,
  after?: string,
  updatedAfter?: string
) => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  return useQuery<Message[]>({
    queryKey: ["messagesSync", conversationId], // 👈 estable
    queryFn: async () => {
      if (!isAuthenticated) return [];
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });
      return fetchSyncMessages(conversationId, token, after, updatedAfter);
    },
    enabled: Boolean(conversationId && isAuthenticated),
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: 5_000, // 5s en cache como "fresco"
    gcTime: 60_000,   // ⬅️ antes era cacheTime en v4
  });
};
