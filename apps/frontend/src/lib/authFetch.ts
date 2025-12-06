// apps/frontend/src/lib/authFetch.ts
import { useCallback } from "react";
import { useAuth0 } from "@auth0/auth0-react";

const AUDIENCE =
  (window as any).__ENV__?.AUTH0_AUDIENCE ?? import.meta.env.VITE_AUTH0_AUDIENCE;

// Helper para forzar re-autenticación sin dependencias circulares
const forceReauth = (reason: string) => {
  if (sessionStorage.getItem('reauth_in_progress')) return;
  sessionStorage.setItem('reauth_in_progress', '1');
  
  localStorage.clear();
  sessionStorage.clear();
  sessionStorage.setItem('reauth_in_progress', '1');
  
  window.location.href = `/login?reason=${encodeURIComponent(reason)}`;
};

export function useAuthFetch() {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  const authFetch = useCallback(
    async (input: string, init?: RequestInit & { signal?: AbortSignal }, retryCount = 0) => {
      // Verificar autenticación antes de hacer la petición
      if (!isAuthenticated) {
        console.error('[authFetch] Not authenticated');
        forceReauth('not_authenticated');
        throw new Error('Not authenticated');
      }

      try {
        const token = await getAccessTokenSilently({
          authorizationParams: { audience: AUDIENCE },
          cacheMode: retryCount > 0 ? 'off' : 'on', // Force refresh en retry
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

        // Manejo de errores de autenticación
        if ((res.status === 401 || res.status === 403) && retryCount === 0) {
          console.warn(`[authFetch] Received ${res.status}, attempting token refresh...`);
          return authFetch(input, init, retryCount + 1);
        }

        if ((res.status === 401 || res.status === 403) && retryCount > 0) {
          const reason = res.status === 401 ? 'token_expired' : 'access_denied';
          console.error(`[authFetch] Session invalid (${res.status}), redirecting to login`);
          forceReauth(reason);
          
          const errorMessage = res.status === 401 
            ? "Session expired. Please log in again."
            : "Access denied. Please log in again.";
          
          const error: any = new Error(errorMessage);
          error.status = res.status;
          error.response = { status: res.status };
          throw error;
        }

        if (!res.ok) {
          const msg = await res.text().catch(() => res.statusText);
          const error: any = new Error(`[authFetch] ${res.status} ${res.statusText} - ${msg}`);
          error.status = res.status;
          error.response = { status: res.status, data: msg };
          throw error;
        }
        
        return res;
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
          forceReauth(errorCode || 'auth_error');
        }

        throw error;
      }
    },
    [getAccessTokenSilently, isAuthenticated]
  );

  return authFetch;
}
