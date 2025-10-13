// Hooks/Query/useProviders.ts (or where it's defined)
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export function useProviderAvailability(
  providerId: string,
  params?: { from: string; to: string; treatmentId?: string },
  options?: { enabled?: boolean }
) {
  const enabled =
    !!providerId &&
    !!params?.from &&
    !!params?.to &&
    (options?.enabled ?? true);

  return useQuery({
    queryKey: ["providerAvailability", providerId, params],
    enabled,
    queryFn: async () => {
      const { data } = await axios.get(
        `${import.meta.env.VITE_BASE_URL}/providers/${providerId}/availability`,
        { params }
      );
      return data as Array<{ startUtc: string; endUtc: string }>;
    },
    staleTime: 60_000,
  });
}
