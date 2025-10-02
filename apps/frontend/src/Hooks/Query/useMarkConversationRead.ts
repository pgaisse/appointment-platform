// Hooks/Query/useMarkConversationRead.ts
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth0 } from '@auth0/auth0-react';

export const useMarkConversationRead = () => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      if (!isAuthenticated) throw new Error('Not authenticated');
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });
      const url = `${import.meta.env.VITE_BASE_URL}/conversations/${conversationId}/read`;
      console.log("url",url)
      await axios.post(url, null, { headers: { Authorization: `Bearer ${token}` } });
    },
  });
};
