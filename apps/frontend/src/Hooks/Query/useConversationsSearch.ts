// Hooks/Query/useConversationSearch.ts
import { useQuery } from "@tanstack/react-query";
import { useAuth0 } from "@auth0/auth0-react";
import axios from "axios";
import type { ConversationChat } from "@/types";

type Scope = "active" | "archived" | "all";
export type SearchResponse = {
  items: ConversationChat[];
  page: number;
  limit: number;
  hasMore: boolean;
};

function mapModeToScope(mode: "active" | "only" | "all"): Scope {
  if (mode === "only") return "archived";
  if (mode === "all") return "all";
  return "active";
}

export function useConversationSearch(
  term: string,
  archivedMode: "active" | "only" | "all" = "active",
  page = 1,
  limit = 20
) {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  return useQuery<SearchResponse>({
    queryKey: ["conversation-search", term, archivedMode, page, limit],
    enabled: isAuthenticated && term.trim().length >= 2,
    queryFn: async () => {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });

      const scope = mapModeToScope(archivedMode);
      const url = `${import.meta.env.VITE_BASE_URL}/conversations/search`;
      const params = { q: term, scope, page, limit };

      const { data } = await axios.get<SearchResponse>(url, {
        params,
        headers: { Authorization: `Bearer ${token}` },
      });
      return data;
    },
    staleTime: 30_000,
  });
}
