// Hooks/Query/useInfiniteMessages.ts
import { useInfiniteQuery } from "@tanstack/react-query";
import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";
import type { Message, PaginatedMessages } from "@/types";

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

const cmp = (a: Message, b: Message) => {
  // Si hay índice numérico, úsalo. Si no, fallback a createdAt
  const ai = Number(a.index), bi = Number(b.index);
  if (!Number.isNaN(ai) && !Number.isNaN(bi)) return ai - bi;
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
};

export const useInfiniteMessages = (
  conversationId: string | undefined,
  limit = 50
) => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  return useInfiniteQuery<PaginatedMessages>({
    queryKey: ["messages", conversationId], // <- misma key para que tu invalidación del padre siga pegando
    enabled: !!conversationId && isAuthenticated,
    refetchOnWindowFocus: false,
    staleTime: 0,
    placeholderData: (prev) => prev, // mantiene mientras llegan nuevas páginas/refetch
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      if (!conversationId) throw new Error("No conversationId");
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });
      const data = await fetchMessages(conversationId, token, pageParam as number, limit);
      // Normalizamos cada página en orden ascendente para facilitar merge en el UI
      const asc = [...data.messages].sort(cmp);
      return { ...data, messages: asc };
    },
    getNextPageParam: (lastPage) => {
      return lastPage?.pagination?.hasMore
        ? (lastPage.pagination.page || 1) + 1
        : undefined;
    },
  });
};
