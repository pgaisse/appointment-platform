// apps/frontend/src/Hooks/useCardComments.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth0 } from '@auth0/auth0-react';

const BASE = import.meta.env.VITE_BASE_URL ?? 'http://localhost:3003/api';

export type CardComment = {
  id: string;
  text: string;
  createdAt?: string;
  author?: { id: string; name?: string | null; email?: string | null; picture?: string | null } | null;
};

export function useCardComments(cardId?: string | null) {
  const qc = useQueryClient();
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  const audience: string | undefined = (window as any).__ENV__?.AUTH0_AUDIENCE;
  const enabled = Boolean(cardId) && isAuthenticated;

  const getToken = async () => {
    // Pide token; si hay audience, úsala; si no, llama sin params
    return audience
      ? getAccessTokenSilently({ authorizationParams: { audience } })
      : getAccessTokenSilently();
  };

  const list = useQuery<CardComment[]>({
    queryKey: ['card-comments', cardId],
    enabled,
    queryFn: async ({ signal }) => {
      const token = await getToken();
      const { data } = await axios.get(`${BASE}/cards/${cardId}/comments`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      return data as CardComment[];
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const add = useMutation({
    mutationFn: async (text: string) => {
      const token = await getToken();
      const { data } = await axios.post(
        `${BASE}/cards/${cardId}/comments`,
        { text },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return data.comment as CardComment;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['card-comments', cardId] }),
  });

  const remove = useMutation({
    mutationFn: async (commentId: string) => {
      const token = await getToken();
      const { data } = await axios.delete(`${BASE}/cards/${cardId}/comments/${commentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['card-comments', cardId] }),
  });

  return { list, add, remove };
}
