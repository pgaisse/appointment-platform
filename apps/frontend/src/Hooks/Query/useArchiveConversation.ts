// Hooks/Query/useArchiveConversation.ts
import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useAuth0 } from "@auth0/auth0-react";
import axios from "axios";
import type { ConversationChat } from "@/types";
import type { ConversationsPage } from "@/Hooks/Query/useConversationsInfinite";

// ----- helpers for cache manipulation -----
type ConvInfinite = InfiniteData<ConversationsPage>;
type Mode = "active" | "only" | "all";

function findConversationInCaches(
  caches: Array<[unknown, ConvInfinite | undefined]>,
  conversationId: string
): ConversationChat | undefined {
  for (const [, data] of caches) {
    if (!data) continue;
    for (const page of data.pages) {
      const hit = page.items.find((c) => c.conversationId === conversationId);
      if (hit) return hit;
    }
  }
  return undefined;
}

function removeFromCache(
  data: ConvInfinite | undefined,
  conversationId: string
): ConvInfinite | undefined {
  if (!data) return data;
  return {
    pageParams: data.pageParams,
    pages: data.pages.map((p) => ({
      ...p,
      items: p.items.filter((c) => c.conversationId !== conversationId),
    })),
  };
}

function insertAtTop(
  data: ConvInfinite | undefined,
  conversation: ConversationChat | undefined
): ConvInfinite | undefined {
  if (!data || !conversation) return data;
  // remove if already exists (avoid duplicates)
  const without = removeFromCache(data, conversation.conversationId)!;
  const first = without.pages[0];
  const newFirst = { ...first, items: [conversation, ...first.items] };
  return {
    pageParams: without.pageParams,
    pages: [newFirst, ...without.pages.slice(1)],
  };
}

function flipArchivedInCache(
  data: ConvInfinite | undefined,
  conversationId: string,
  archived: boolean
): ConvInfinite | undefined {
  if (!data) return data;
  return {
    pageParams: data.pageParams,
    pages: data.pages.map((p) => ({
      ...p,
      items: p.items.map((c) =>
        c.conversationId === conversationId ? { ...c, archived } : c
      ),
    })),
  };
}

export const useArchiveConversation = () => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      if (!isAuthenticated) throw new Error("Not authenticated");
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });
      const url = `${import.meta.env.VITE_BASE_URL}/conversations/${id}/${archived ? "archive" : "unarchive"}`;
      await axios.post(url, null, { headers: { Authorization: `Bearer ${token}` } });
    },

    // Optimistic update for infinite lists
    onMutate: async ({ id, archived }) => {
      // cancel any outgoing refetches for the conversations infinite lists
      await qc.cancelQueries({ queryKey: ["conversations-infinite"] });

      // snapshot current state to rollback if needed
      const snapshot = qc.getQueriesData<ConvInfinite>({
        queryKey: ["conversations-infinite"],
      });

      // find a full conversation object to move/insert
      const existing = findConversationInCaches(snapshot, id);
      const updatedObj: ConversationChat | undefined =
        existing ? { ...existing, archived } : undefined;

      // update each cached list (active / only / all, any page size)
      for (const [key, data] of snapshot) {
        const keyArr = key as [string, Mode, number?]; // ["conversations-infinite", mode, pageSize]
        const mode = keyArr[1];

        if (archived) {
          // move from Active -> Archived
          if (mode === "active") {
            qc.setQueryData<ConvInfinite>(keyArr, (prev) => removeFromCache(prev, id));
          } else if (mode === "only") {
            // insert at top for immediate feedback
            qc.setQueryData<ConvInfinite>(keyArr, (prev) => insertAtTop(prev, updatedObj));
          } else if (mode === "all") {
            qc.setQueryData<ConvInfinite>(keyArr, (prev) => flipArchivedInCache(prev, id, true));
          }
        } else {
          // move from Archived -> Active
          if (mode === "only") {
            qc.setQueryData<ConvInfinite>(keyArr, (prev) => removeFromCache(prev, id));
          } else if (mode === "active") {
            qc.setQueryData<ConvInfinite>(keyArr, (prev) => insertAtTop(prev, updatedObj));
          } else if (mode === "all") {
            qc.setQueryData<ConvInfinite>(keyArr, (prev) => flipArchivedInCache(prev, id, false));
          }
        }
      }

      return { snapshot };
    },

    onError: (_err, _vars, ctx) => {
      // rollback to snapshot
      if (!ctx?.snapshot) return;
      for (const [key, data] of ctx.snapshot) {
        qc.setQueryData(key, data);
      }
    },

    onSettled: () => {
      // ensure server truth wins afterwards
      qc.invalidateQueries({ queryKey: ["conversations-infinite"] });
    },
  });
};
