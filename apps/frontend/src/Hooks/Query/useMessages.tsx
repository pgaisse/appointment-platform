import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";
import { Message, PaginatedMessages } from "@/types";

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
  page: number,
  limit: number
) => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  return useQuery<PaginatedMessages & { messages: Message[] }>({
    queryKey: ["messages", conversationId, page, limit],
    queryFn: async () => {
      if (!isAuthenticated) throw new Error("Not authenticated");
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });
      const data = await fetchMessages(conversationId, token, page, limit);

      // 🔒 ordenar por index (seguro y consistente)
      const sorted = [...data.messages].sort(
        (a, b) => Number(a.index) - Number(b.index)
      );

      return { ...data, messages: sorted };
    },
    enabled: !!conversationId && isAuthenticated,
    refetchOnWindowFocus: false,
  });
};
