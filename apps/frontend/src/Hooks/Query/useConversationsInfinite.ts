// Hooks/Query/useConversationsInfinite.ts
import { useInfiniteQuery } from "@tanstack/react-query";
import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";
import type { ConversationChat } from "@/types";

type Mode = "active" | "only" | "all";

export interface ConversationsPage {
  items: ConversationChat[];
  pagination: { page: number; limit: number; total: number; hasMore: boolean };
}

const fetchPage = async (
  token: string,
  mode: Mode,
  page: number,
  limit: number
): Promise<ConversationsPage> => {
  const archivedParam = mode === "only" ? "1" : mode === "all" ? "all" : "0";
  const url = `${import.meta.env.VITE_BASE_URL}/conversations?archived=${archivedParam}&page=${page}&limit=${limit}`;
  const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
  return res.data;
};

export const useConversationsInfinite = (mode: Mode, pageSize = 10) => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  return useInfiniteQuery<ConversationsPage, Error>({
    queryKey: ["conversations-infinite", mode, pageSize],
    enabled: isAuthenticated,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });
      return fetchPage(token, mode, pageParam as number, pageSize);
    },
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    gcTime: 5 * 60 * 1000,
    staleTime: 60 * 1000,
  });
};
