// apps/frontend/src/Hooks/Query/useInfiniteMessageTemplates.ts
import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuth0 } from "@auth0/auth0-react";
import { MessageTemplate } from "@/types";

type Page = {
  items: MessageTemplate[];
  nextCursor: string | null;
  hasMore: boolean;
};

type Params = {
  category?: string;
  q?: string;
  limit?: number;
  org_id?: string;
  enabled?: boolean;
  fields?: string; // ej: "title,content"
};

const AUDIENCE =
  (window as any).__ENV__?.AUTH0_AUDIENCE ?? import.meta.env.VITE_AUTH0_AUDIENCE;

export function useInfiniteMessageTemplates(params: Params = {}) {
  const { getAccessTokenSilently } = useAuth0();
  const { category, q, limit = 5, org_id, enabled = true, fields = "title,content,category" } = params;

  return useInfiniteQuery<Page>({
    queryKey: ["message-templates", { category, q, limit, org_id, fields }],
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const token = await getAccessTokenSilently({
        authorizationParams: AUDIENCE ? { audience: AUDIENCE } : undefined,
      });

      const qs = new URLSearchParams();
      if (category) qs.set("category", category);
      if (q) qs.set("q", q);
      if (org_id) qs.set("org_id", org_id);
      if (limit) qs.set("limit", String(limit));
      if (fields) qs.set("fields", fields);
      if (pageParam) qs.set("cursor", String(pageParam));

      const res = await fetch(`/api/message-templates?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Failed to load templates: ${res.status} ${t}`);
      }
      const data = (await res.json()) as Page;
      return data;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
