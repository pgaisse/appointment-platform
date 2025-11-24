import { useAuth0 } from "@auth0/auth0-react";
import { useCallback } from "react";
import { useForceReauth } from "../auth/useForceReauth";

const AUDIENCE = import.meta.env.VITE_AUTH0_AUDIENCE || "https://api.dev.iconicsmiles";

export function useAuthFetch() {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const forceReauth = useForceReauth();

  const authFetch = useCallback(async (input: RequestInfo, init: RequestInit = {}, retryCount = 0): Promise<any> => {
    if (!isAuthenticated) {
      forceReauth({ reason: "not_authenticated" });
      throw new Error("Not authenticated");
    }

    try {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: AUDIENCE },
        cacheMode: retryCount > 0 ? 'off' : 'on', // Force refresh en retry
      });

      const res = await fetch(input, {
        ...init,
        headers: {
          ...(init.headers || {}),
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      // Manejo de 401: Token expirado o inválido
      if (res.status === 401 && retryCount === 0) {
        console.warn('[authFetch] Received 401, attempting token refresh...');
        // Retry una vez con token refrescado
        return authFetch(input, init, retryCount + 1);
      }

      // Si después del retry sigue siendo 401, forzar re-autenticación
      if (res.status === 401 && retryCount > 0) {
        console.error('[authFetch] Token refresh failed, forcing re-authentication');
        forceReauth({ reason: "token_expired" });
        throw new Error("Session expired. Please log in again.");
      }

      if (!res.ok) {
        let body: any = null;
        try { body = await res.json(); } catch {}
        throw new Error(body?.error || body?.message || `HTTP ${res.status}`);
      }

      // intenta json, si no hay, retorna null
      try { return await res.json(); } catch { return null; }
    } catch (error: any) {
      // Manejo de errores de Auth0
      const errorCode = error?.error || error?.code || '';
      const shouldReauth = 
        errorCode.includes('login_required') ||
        errorCode.includes('consent_required') ||
        errorCode.includes('missing_refresh_token') ||
        errorCode.includes('invalid_grant');

      if (shouldReauth) {
        console.error('[authFetch] Auth0 error, forcing re-authentication:', errorCode);
        forceReauth({ reason: errorCode || "auth_error" });
      }

      throw error;
    }
  }, [isAuthenticated, getAccessTokenSilently, forceReauth]);

  return { authFetch };
}
