import { useQueryClient, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth0 } from '@auth0/auth0-react';
import type { BoardData, Card } from '@/types/kanban';

const BASE =
  (window as any).__ENV__?.API_URL ??
  (import.meta as any).env?.VITE_BASE_URL ??
  'http://localhost:3003/api';

export function useDeletion(topicId?: string) {
  const qc = useQueryClient();
  const { getAccessTokenSilently, loginWithRedirect, isAuthenticated } = useAuth0();

  const audience =
    (window as any).__ENV__?.AUTH0_AUDIENCE ??
    (import.meta as any).env?.VITE_AUTH0_AUDIENCE;

  const authHeaders = async () => {
    if (!isAuthenticated) {
      await loginWithRedirect();
      throw new Error('Not authenticated');
    }
    const token = await getAccessTokenSilently({
      authorizationParams: { audience },
    });
    return { Authorization: `Bearer ${token}` };
  };

  /** Utils para tocar el cache del tablero actual */
  const getBoardEntries = () =>
    qc.getQueriesData<BoardData>({ queryKey: ['topic-board'] });

  const removeCardFromBoard = (data: BoardData | undefined, cardId: string): BoardData | undefined => {
    if (!data) return data;
    const next: BoardData = {
      columns: data.columns.slice(),
      cardsByColumn: { ...data.cardsByColumn },
    };
    let changed = false;

    for (const colId of Object.keys(next.cardsByColumn)) {
      const list = next.cardsByColumn[colId] ?? [];
      const filtered = list.filter((c: Card) => c.id !== cardId);
      if (filtered.length !== list.length) {
        next.cardsByColumn[colId] = filtered;
        changed = true;
      }
    }
    return changed ? next : data;
  };

  const invalidateBoard = async () => {
    // invalida cualquier query que empiece con 'topic-board'
    await qc.invalidateQueries({ queryKey: ['topic-board'] });
    await qc.invalidateQueries({ queryKey: ['topics'] });
  };

  const deleteCard = useMutation({
    mutationFn: async ({ cardId }: { cardId: string }) => {
      const headers = await authHeaders();
      const { data } = await axios.delete(`${BASE}/cards/${cardId}`, { headers });
      return data;
    },
    // Optimistic update
    onMutate: async ({ cardId }) => {
      // Pausar refetch
      await qc.cancelQueries({ queryKey: ['topic-board'] });

      // Snapshot de todas las entradas del tablero
      const entries = getBoardEntries();
      const prev: Array<[unknown[], BoardData | undefined]> = entries.map(
        ([key, data]) => [key as unknown[], data]
      );

      // Actualizar cada cache que corresponda al topic (si topicId se pasó, filtramos por él)
      for (const [key, data] of entries) {
        const includeThis = topicId ? (key as unknown[]).includes(topicId) : true;
        if (!includeThis) continue;
        const next = removeCardFromBoard(data, cardId);
        if (next !== data) qc.setQueryData(key, next);
      }

      // Contexto para rollback
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      // Rollback si falló
      if (ctx?.prev) {
        for (const [key, data] of ctx.prev) {
          qc.setQueryData(key as any, data);
        }
      }
    },
    onSettled: invalidateBoard,
  });

  const deleteColumn = useMutation({
    mutationFn: async ({ columnId }: { columnId: string }) => {
      const headers = await authHeaders();
      const { data } = await axios.delete(`${BASE}/columns/${columnId}`, { headers });
      return data;
    },
    onMutate: async ({ columnId }) => {
      await qc.cancelQueries({ queryKey: ['topic-board'] });
      const entries = getBoardEntries();
      const prev = entries.map(([key, data]) => [key as unknown[], data]) as Array<[unknown[], BoardData | undefined]>;

      for (const [key, data] of entries) {
        const includeThis = topicId ? (key as unknown[]).includes(topicId) : true;
        if (!includeThis || !data) continue;

        const next: BoardData = {
          columns: data.columns.filter(c => c.id !== columnId),
          cardsByColumn: Object.fromEntries(
            Object.entries(data.cardsByColumn).filter(([cid]) => cid !== columnId)
          ),
        };
        qc.setQueryData(key, next);
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) {
        for (const [key, data] of ctx.prev) {
          qc.setQueryData(key as any, data);
        }
      }
    },
    onSettled: invalidateBoard,
  });

  const deleteTopic = useMutation({
    mutationFn: async (arg: string | { topicId: string }) => {
      const id = typeof arg === 'string' ? arg : arg.topicId;
      const headers = await authHeaders();
      const { data } = await axios.delete(`${BASE}/topics/${id}`, { headers });
      return data;
    },
    onMutate: async (_vars) => {
      await qc.cancelQueries({ queryKey: ['topics'] });
      const prevTopics = qc.getQueryData<any>(['topics']);
      // opcional: podrías quitar el topic aquí si lo tienes a mano
      return { prevTopics };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prevTopics) qc.setQueryData(['topics'], ctx.prevTopics);
    },
    onSettled: invalidateBoard,
  });

  return { deleteCard, deleteColumn, deleteTopic };
}
