// apps/frontend/src/Hooks/authFetch.ts
import { useCallback } from "react";
import { useAuth0 } from "@auth0/auth0-react";

const AUDIENCE =
  (window as any).__ENV__?.AUTH0_AUDIENCE ?? import.meta.env.VITE_AUTH0_AUDIENCE;

export function useAuthFetch() {
  const { getAccessTokenSilently } = useAuth0();

  const authFetch = useCallback(
    async (input: string, init?: RequestInit & { signal?: AbortSignal }) => {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: AUDIENCE },
      });

      const res = await fetch(input, {
        ...init,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(init?.headers as any),
        },
        signal: init?.signal, // <-- clave para abortar
      });

      if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        throw new Error(`[authFetch] ${res.status} ${res.statusText} - ${msg}`);
      }
      return res;
    },
    [getAccessTokenSilently]
  );

  return authFetch;
}
