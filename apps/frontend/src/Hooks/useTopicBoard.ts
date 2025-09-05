// frontend/src/Hooks/useTopicBoard.ts
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth0 } from '@auth0/auth0-react';
import type { BoardData, Card, MoveCardArgs } from '@/types/kanban';

/** ========= Env helpers (Vite + window.__ENV__) ========= */
const API_URL =
  (window as any).__ENV__?.API_URL ||
  (import.meta as any).env?.VITE_API_URL ||
  (import.meta as any).env?.VITE_BASE_URL ||
  'http://localhost:3003/api';

const AUTH0_AUDIENCE =
  (window as any).__ENV__?.AUTH0_AUDIENCE ||
  (import.meta as any).env?.VITE_AUTH0_AUDIENCE;

/** ========= Requests ========= */
async function fetchBoardReq(token: string, topicId: string): Promise<BoardData> {
  const { data } = await axios.get(`${API_URL}/topics/${topicId}/board`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}
async function createColumnReq(token: string, topicId: string, title: string) {
  const { data } = await axios.post(
    `${API_URL}/topics/${topicId}/columns`,
    { title },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
}
async function createCardReq(token: string, topicId: string, body: { columnId: string; title: string }) {
  const { data } = await axios.post(
    `${API_URL}/topics/${topicId}/cards`,
    body,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
}
async function moveCardReq(token: string, payload: MoveCardArgs) {
  const isId = (v?: string) => !!v && /^[0-9a-fA-F]{24}$/.test(v);
  const clean: MoveCardArgs = {
    cardId: payload.cardId,
    toColumnId: isId(payload.toColumnId) ? payload.toColumnId : payload.toColumnId, // puede ser mismo col id válido que ya tenga el card
    before: isId(payload.before) && payload.before !== payload.cardId ? payload.before : undefined,
    after:  isId(payload.after)  && payload.after  !== payload.cardId ? payload.after  : undefined,
  } as any;

  const { data } = await axios.patch(
    `${API_URL}/cards/${payload.cardId}/move`,
    clean,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
}

async function updateCardReq(token: string, cardId: string, patch: Partial<Card>) {
  const { data } = await axios.patch(
    `${API_URL}/cards/${cardId}`,
    patch,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
}

/** ========= Hook principal ========= */
export function useTopicBoard(topicId: string) {
  const qc = useQueryClient();
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const [token, setToken] = useState<string | null>(null);

  // Obtener token Auth0
  useEffect(() => {
    (async () => {
      if (!isAuthenticated) return setToken(null);
      const t = await getAccessTokenSilently({
        authorizationParams: { audience: AUTH0_AUDIENCE },
      });
      setToken(t);
    })();
  }, [getAccessTokenSilently, isAuthenticated]);

  // Clave de cache para el board
  const qk = ['topic-board', topicId, token];

  /** ===== Query: board ===== */
  const board = useQuery<BoardData>({
    queryKey: qk,
    enabled: !!token && !!topicId,
    queryFn: () => fetchBoardReq(token!, topicId),
    placeholderData: { columns: [], cardsByColumn: {} },
    refetchOnWindowFocus: false,
  });

  /** Helpers para optimistic updates */
  const getCardLocation = (bd: BoardData, cardId: string) => {
    for (const colId of Object.keys(bd.cardsByColumn)) {
      const idx = bd.cardsByColumn[colId].findIndex((c) => c.id === cardId);
      if (idx !== -1) return { colId, idx };
    }
    return null;
  };
  const cloneBoard = (bd: BoardData): BoardData => ({
    columns: bd.columns.map((c) => ({ ...c })),
    cardsByColumn: Object.fromEntries(
      Object.entries(bd.cardsByColumn).map(([k, v]) => [k, v.map((c) => ({ ...c }))])
    ),
  });

  /** ===== Mutation: create column ===== */
  const createColumn = useMutation({
    mutationFn: (title: string) => createColumnReq(token!, topicId, title),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk }),
  });

  /** ===== Mutation: create card ===== */
  const createCard = useMutation({
    mutationFn: (body: { columnId: string; title: string }) => createCardReq(token!, topicId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk }),
  });

  /** ===== Mutation: move card (optimistic) ===== */
  const moveCard = useMutation({
    mutationFn: (payload: MoveCardArgs) => moveCardReq(token!, payload),
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: qk });
      const prev = qc.getQueryData<BoardData>(qk);
      if (!prev) return { prev };

      const next = cloneBoard(prev);

      // localizar card y removerla de su columna actual
      const loc = getCardLocation(next, payload.cardId);
      if (!loc) return { prev }; // no encontrada
      const card = next.cardsByColumn[loc.colId].splice(loc.idx, 1)[0];
      // actualiza columnId local (opcional)
      (card as any).columnId = payload.toColumnId;

      // insertar en target segun before/after
      const target = next.cardsByColumn[payload.toColumnId] || (next.cardsByColumn[payload.toColumnId] = []);
      if (payload.before) {
        const i = target.findIndex((c) => c.id === payload.before);
        if (i >= 0) target.splice(i, 0, card);
        else target.push(card);
      } else if (payload.after) {
        const i = target.findIndex((c) => c.id === payload.after);
        if (i >= 0) target.splice(i + 1, 0, card);
        else target.push(card);
      } else {
        target.push(card);
      }

      qc.setQueryData(qk, next);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk }),
  });

  /** ===== Mutation: update card (optimistic for small patches e.g. completed) ===== */
  const updateCard = useMutation({
    mutationFn: ({ cardId, patch }: { cardId: string; patch: Partial<Card> }) =>
      updateCardReq(token!, cardId, patch),
    onMutate: async ({ cardId, patch }) => {
      await qc.cancelQueries({ queryKey: qk });
      const prev = qc.getQueryData<BoardData>(qk);
      if (!prev) return { prev };

      const next = cloneBoard(prev);
      const loc = getCardLocation(next, cardId);
      if (loc) {
        const card = next.cardsByColumn[loc.colId][loc.idx];
        next.cardsByColumn[loc.colId][loc.idx] = { ...card, ...patch };
      }
      qc.setQueryData(qk, next);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk }),
  });

  /** Handlers expuestos */
  const onMoveCard = async (args: MoveCardArgs) => {
    await moveCard.mutateAsync(args);
  };

  return {
    board,
    createColumn,
    createCard,
    updateCard,
    onMoveCard,
  };
}
