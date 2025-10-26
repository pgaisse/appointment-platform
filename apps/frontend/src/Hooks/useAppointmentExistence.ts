import { useAuth0 } from "@auth0/auth0-react";
import { useQuery } from "@tanstack/react-query";

export type Existence = "exists" | "missing" | "unknown";

/**
 * Fetches whether a given appointment exists.
 * Uses GET because the backend doesn't implement HEAD.
 */
async function fetchAppointmentExistence(
  id: string,
  getToken?: () => Promise<string>
): Promise<Existence> {
  const headers: HeadersInit = { Accept: "application/json" };

  if (getToken) {
    try {
      const token = await getToken();
      if (token) (headers as any).Authorization = `Bearer ${token}`;
    } catch {
      // continue without token
    }
  }

  try {
    const res = await fetch(`/api/appointments/${id}`, {
      method: "GET",
      headers,
      credentials: "include",
    });

    if (res.ok) return "exists";
    if (res.status === 404) return "missing";
    return "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Hook to check appointment existence via React Query + Auth0.
 * Caches results for 10 minutes and retries once on failure.
 */
export function useAppointmentExistence(id?: string | null) {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  return useQuery<Existence>({
    queryKey: ["appointment-existence", id],
    enabled: !!id,
    queryFn: async () =>
      fetchAppointmentExistence(
        id!,
        isAuthenticated ? getAccessTokenSilently : undefined
      ),
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    retry: 1,
  });
}
