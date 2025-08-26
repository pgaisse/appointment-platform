import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";
import { ConversationChat } from "@/types";



const fetchConversations = async (token: string): Promise<ConversationChat[]> => {
  const url = `${import.meta.env.VITE_BASE_URL}/conversations`;
  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};

export const useConversations = () => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const getToken = async () => {
      if (isAuthenticated) {
        const newToken = await getAccessTokenSilently({
          authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE }
        });
        setToken(newToken);
      }
    };
    getToken();
  }, [getAccessTokenSilently, isAuthenticated]);

  return useQuery<ConversationChat[]>({
    queryKey: ["conversations"],
    queryFn: () => fetchConversations(token!),
    enabled: !!token,
    refetchOnWindowFocus: false,
  });
};
