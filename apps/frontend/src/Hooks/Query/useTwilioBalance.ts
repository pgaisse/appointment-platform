// apps/frontend/src/Hooks/Query/useTwilioBalance.ts
import { useQuery } from '@tanstack/react-query';
import { useAuthFetch } from '@/api/authFetch';

type TwilioBalanceResponse = {
  balance: string;
  currency: string;
};

export function useTwilioBalance(enabled = true) {
  const { authFetch } = useAuthFetch();

  return useQuery<TwilioBalanceResponse>({
    queryKey: ['twilio-balance'],
    queryFn: async () => {
      const url = `${import.meta.env.VITE_BASE_URL}/twilio/balance`;
      const response = await authFetch(url);
      return response;
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  });
}
