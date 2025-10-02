// Hooks/Query/useArchiveConversation.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth0 } from '@auth0/auth0-react';
import type { ConversationChat } from '@/types';

export const useArchiveConversation = () => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      if (!isAuthenticated) throw new Error('Not authenticated');
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });
      const url = `${import.meta.env.VITE_BASE_URL}/conversations/${id}/${archived ? 'archive' : 'unarchive'}`;
      await axios.post(url, null, { headers: { Authorization: `Bearer ${token}` } });
    },
    onMutate: async ({ id, archived }) => {
      // Optimista: saca de la lista activa o añade a archivados
      const keys = [
        ["conversations", "active"],
        ["conversations", "only"],
        ["conversations", "all"],
      ] as const;

      const previous = keys.map((k) => [k, qc.getQueryData<ConversationChat[]>(k)] as const);

      // Actualiza caché
      qc.setQueryData<ConversationChat[]>(["conversations", "active"], (prev) =>
        archived ? (prev ?? []).filter(c => c.conversationId !== id)
                 : (prev ?? []).map(c => c.conversationId === id ? { ...c, archived: false } : c)
      );
      qc.setQueryData<ConversationChat[]>(["conversations", "only"], (prev) =>
        archived ? [ ...(prev ?? []), ...(qc.getQueryData<ConversationChat[]>(["conversations", "all"]) ?? []).filter(c => c.conversationId === id).map(c => ({ ...c, archived: true })) ]
                 : (prev ?? []).filter(c => c.conversationId !== id)
      );
      qc.setQueryData<ConversationChat[]>(["conversations", "all"], (prev) =>
        (prev ?? []).map(c => c.conversationId === id ? { ...c, archived } : c)
      );

      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      // revertir
      ctx?.previous?.forEach(([k, data]) => qc.setQueryData(k, data));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
    }
  });
};
