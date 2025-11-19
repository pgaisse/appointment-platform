import { useQuery } from '@tanstack/react-query';
import { useAuthFetch } from '@/api/authFetch';

export type ConversationHealthRow = {
  appointmentId: string;
  name: string;
  lastName: string;
  phone: string;
  email?: string;
  sid: string;
  unknown: boolean;
  status: 'ok' | 'invalid' | 'missing' | 'error' | 'unchecked';
  reason?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ConversationHealthResponse = {
  items: ConversationHealthRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
};

export const CONVERSATION_HEALTH_QK = (page: number, limit: number, validate: boolean, q?: string) => [
  'conversation-health',
  { page, limit, validate, q: q || '' }
] as const;

export function useConversationHealth(params: { page: number; limit?: number; validate?: boolean; q?: string }) {
  const { authFetch } = useAuthFetch();
  const page = Math.max(params.page || 1, 1);
  const limit = Math.max(params.limit ?? 50, 1);
  const validate = params.validate ?? true;
  const q = (params.q || '').trim();

  return useQuery<ConversationHealthResponse>({
    queryKey: CONVERSATION_HEALTH_QK(page, limit, validate, q),
    queryFn: async () => {
      // NOTE: authFetch (from '@/api/authFetch') already returns parsed JSON (not a Response)
      // so we just return it directly. Previous version incorrectly treated it as Response and always threw.
      const base = `${import.meta.env.VITE_BASE_URL}/conversations/health?page=${page}&limit=${limit}&validate=${validate ? '1' : '0'}`;
      const url = q ? `${base}&q=${encodeURIComponent(q)}` : base;
      const data = await authFetch(url);
      // Ensure shape matches ConversationHealthResponse
      if (!data || typeof data !== 'object') throw new Error('Empty response for conversation health');
      return data as ConversationHealthResponse;
    },
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });
}
