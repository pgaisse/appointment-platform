// src/Hooks/useTopicBoard.ts
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth0 } from '@auth0/auth0-react';
import type { BoardData, MoveCardArgs } from '@/types/kanban';

const BASE = import.meta.env.VITE_BASE_URL ?? 'http://localhost:3003/api';

async function fetchBoardReq(token: string, topicId: string): Promise<BoardData> {
  const { data } = await axios.get(`${BASE}/topics/${topicId}/board`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}
async function createColumnReq(token: string, topicId: string, title: string) {
  const { data } = await axios.post(
    `${BASE}/topics/${topicId}/columns`,
    { title },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
}
async function createCardReq(token: string, topicId: string, body: any) {
  const { data } = await axios.post(
    `${BASE}/topics/${topicId}/cards`,
    body,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
}
async function moveCardReq(token: string, payload: MoveCardArgs) {
  const { data } = await axios.patch(
    `${BASE}/cards/${payload.cardId}/move`,
    payload,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
}
async function updateCardReq(token: string, cardId: string, patch: any) {
  const payload: any = { ...patch };
  if (Array.isArray(patch?.labels)) {
    // Mandamos solo ids (separación “asignados” vs “creados”)
    payload.labels = patch.labels.map((l: any) => typeof l === 'string' ? l : l?.id).filter(Boolean);
  }
  const { data } = await axios.patch(`${BASE}/cards/${cardId}`, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}


export function useTopicBoard(topicId: string) {
  const qc = useQueryClient();
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!isAuthenticated) return setToken(null);
      const t = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });
      setToken(t);
    })();
  }, [getAccessTokenSilently, isAuthenticated]);

  const queryKey = ['topic-board', topicId, token] as const;

  const board = useQuery<BoardData>({
    queryKey,
    enabled: !!token && !!topicId,
    queryFn: () => fetchBoardReq(token!, topicId),
    placeholderData: { columns: [], cardsByColumn: {} },
    refetchOnWindowFocus: false,
  });

  const createColumn = useMutation({
    mutationFn: (title: string) => createColumnReq(token!, topicId, title),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const createCard = useMutation({
    mutationFn: (body: any) => createCardReq(token!, topicId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const moveCard = useMutation({
    mutationFn: (payload: MoveCardArgs) => moveCardReq(token!, payload),
  });

  const updateCard = useMutation({
    mutationFn: ({ cardId, patch }: { cardId: string; patch: any }) =>
      updateCardReq(token!, cardId, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  /** Actualización optimista para evitar el “rebote” visual */
  const onMoveCard = async (args: MoveCardArgs) => {
    const prev = qc.getQueryData<BoardData>(queryKey);
    if (!prev) {
      // fallback si todavía no hay datos en cache
      await moveCard.mutateAsync(args);
      await qc.invalidateQueries({ queryKey });
      return;
    }

    const {
      cardId, fromColumnId, toColumnId, toIndex, provisionalSortKey,
    } = args;

    const fromList = [...(prev.cardsByColumn[fromColumnId] || [])];
    const srcIdx = fromList.findIndex((c) => c.id === cardId);
    if (srcIdx < 0) {
      // si por alguna razón no está, solo muta sin optimismo
      await moveCard.mutateAsync(args);
      await qc.invalidateQueries({ queryKey });
      return;
    }

    const [moving] = fromList.splice(srcIdx, 1);

    // Destino: si es misma columna, partimos del fromList ya removido; si es otra, clonar lista destino
    const baseDest = fromColumnId === toColumnId
      ? fromList
      : [...(prev.cardsByColumn[toColumnId] || [])];

    // Ajuste de índice cuando se mueve dentro de la misma columna hacia abajo
    let insertIndex = toIndex;
    if (fromColumnId === toColumnId && srcIdx < toIndex) {
      insertIndex = Math.max(0, toIndex - 1);
    }

    const movedCard = {
      ...moving,
      columnId: toColumnId,
      sortKey: provisionalSortKey, // clave provisional para ordenar de inmediato
    };

    const destList = [
      ...baseDest.slice(0, insertIndex),
      movedCard,
      ...baseDest.slice(insertIndex),
    ];

    const next: BoardData = {
      ...prev,
      cardsByColumn: {
        ...prev.cardsByColumn,
        [fromColumnId]: fromColumnId === toColumnId ? destList : fromList,
        [toColumnId]: destList,
      },
    };

    // Set optimista
    qc.setQueryData(queryKey, next);

    try {
      await moveCard.mutateAsync(args);
    } catch (e) {
      // rollback si falla
      qc.setQueryData(queryKey, prev);
      throw e;
    } finally {
      // refresca para alinear sortKey final del server (si la recalcula)
      qc.invalidateQueries({ queryKey });
    }
  };

  return { board, createColumn, createCard, updateCard, onMoveCard };
}
