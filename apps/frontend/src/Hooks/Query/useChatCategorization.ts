// src/hooks/useChatCategorization.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";

/* =========================
 * Tipos mínimos
 * ========================= */
export type ChatCategory = {
  _id: string;
  org_id: string;
  key: string;
  name: string;
  color?: string;
  icon?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ConversationChatCategoryItem = {
  _id: string;
  chat_category_id: string;
  createdAt: string;
  chatCategory: {
    _id: string;
    key: string;
    name: string;
    color?: string;
    icon?: string;
  };
};

/* =========================
 * Token helper (mismo patrón que tu modelo)
 * ========================= */
const useAuthToken = () => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const getToken = async () => {
      if (isAuthenticated) {
        const newToken = await getAccessTokenSilently({
          authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
        });
        setToken(newToken);
      }
    };
    getToken();
  }, [getAccessTokenSilently, isAuthenticated]);

  return token;
};

const API_BASE = `${import.meta.env.VITE_BASE_URL}`;
const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

/* =========================
 * CATEGORIES
 * ========================= */

// GET /api/chat/categories?search=...
export const useChatCategories = (search?: string) => {
  const token = useAuthToken();
  return useQuery<ChatCategory[]>({
    queryKey: ["chat-categories", { search }],
    enabled: !!token,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data } = await axios.get(`${API_BASE}/categories`, {
        headers: authHeader(token!),
        params: search ? { search } : undefined,
      });
      return data;
    },
  });
};

// POST /api/chat/categories
export type CreateChatCategoryInput = {
  key: string;
  name: string;
  color?: string;
  icon?: string;
};
export const useCreateChatCategory = () => {
  const token = useAuthToken();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateChatCategoryInput) => {
      const { data } = await axios.post(`${API_BASE}/categories`, payload, {
        headers: authHeader(token!),
      });
      return data as ChatCategory;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-categories"] });
    },
  });
};

// PATCH /api/chat/categories/:id
export type UpdateChatCategoryInput = {
  id: string;
  patch: Partial<Pick<ChatCategory, "name" | "key" | "color" | "icon" | "isActive">>;
};
export const useUpdateChatCategory = () => {
  const token = useAuthToken();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, patch }: UpdateChatCategoryInput) => {
      const { data } = await axios.patch(`${API_BASE}/categories/${id}`, patch, {
        headers: authHeader(token!),
      });
      return data as ChatCategory;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-categories"] });
    },
  });
};

/* =========================
 * CONVERSATION ↔ CATEGORY
 * ========================= */

// GET /api/chat/conversations/:sid/categories
export const useConversationChatCategories = (conversationSid: string) => {
  const token = useAuthToken();
  return useQuery<ConversationChatCategoryItem[]>({
    queryKey: ["conversation-categories", conversationSid],
    enabled: !!token && !!conversationSid,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data } = await axios.get(
        `${API_BASE}/conversations/${conversationSid}/categories`,
        { headers: authHeader(token!) }
      );
      return data;
    },
  });
};

// POST /api/chat/conversations/:sid/categories
export type AssignCategoryToConversationInput = {
  conversationSid: string;
  chatCategoryKey?: string;   // puedes usar key...
  chatCategoryId?: string;    // ...o _id
};
export const useAssignCategoryToConversation = () => {
  const token = useAuthToken();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ conversationSid, ...body }: AssignCategoryToConversationInput) => {
      const { data } = await axios.post(
        `${API_BASE}/conversations/${conversationSid}/categories`,
        body,
        { headers: authHeader(token!) }
      );
      return data;
    },
    onSuccess: (_data, vars) => {
      // refresca categorías de esa conversación
      qc.invalidateQueries({ queryKey: ["conversation-categories", vars.conversationSid] });
    },
  });
};

// DELETE /api/chat/conversations/:sid/categories/:chatCategoryId
export type UnassignCategoryFromConversationInput = {
  conversationSid: string;
  chatCategoryId: string;
};
export const useUnassignCategoryFromConversation = () => {
  const token = useAuthToken();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ conversationSid, chatCategoryId }: UnassignCategoryFromConversationInput) => {
      const { data } = await axios.delete(
        `${API_BASE}/conversations/${conversationSid}/categories/${chatCategoryId}`,
        { headers: authHeader(token!) }
      );
      return data as { deleted: number };
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["conversation-categories", vars.conversationSid] });
    },
  });
};
