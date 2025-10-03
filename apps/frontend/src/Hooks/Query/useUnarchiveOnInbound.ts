// Hooks/Query/useUnarchiveOnInbound.ts
import { useMutation } from "@tanstack/react-query";
import { useAuth0 } from "@auth0/auth0-react";
import axios from "axios";

export const useUnarchiveOnInbound = () => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      if (!isAuthenticated) return;
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });
      const url = `${import.meta.env.VITE_BASE_URL}/conversations/${conversationId}/unarchive`;
      await axios.post(url, null, { headers: { Authorization: `Bearer ${token}` } });
    },
  });
};
