import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";
import { ConversationChat } from "@/types";

const fetchConversations = async (token: string): Promise<ConversationChat[]> => {
  const url = `${import.meta.env.VITE_BASE_URL}/conversations`;
  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

export const useConversations = () => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  return useQuery<ConversationChat[]>({
    queryKey: ["conversations"],
    queryFn: async () => {
      if (!isAuthenticated) throw new Error("Not authenticated");
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });
      return fetchConversations(token);
    },
    enabled: isAuthenticated,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    staleTime: Infinity,   // ⛑️ nunca se marca como "stale"
  });
};

