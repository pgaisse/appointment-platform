// Hooks/Query/useConversations.ts
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";
import { ConversationChat } from "@/types";

type ListOpts = { archived?: 'active' | 'only' | 'all' }; // default 'active'

const fetchConversations = async (token: string, opts?: ListOpts): Promise<ConversationChat[]> => {
  const mode = opts?.archived ?? 'active';
  const archivedParam = mode === 'only' ? '1' : mode === 'all' ? 'all' : '0';
  const url = `${import.meta.env.VITE_BASE_URL}/conversations?archived=${archivedParam}`;
  const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
  return res.data;
};

export const useConversations = (opts?: ListOpts) => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  return useQuery<ConversationChat[]>({
    queryKey: ["conversations", opts?.archived ?? 'active'],
    queryFn: async () => {
      if (!isAuthenticated) throw new Error("Not authenticated");
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });
      return fetchConversations(token, opts);
    },
    enabled: isAuthenticated,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    staleTime: Infinity,
  });
};
