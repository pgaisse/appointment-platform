import { useAuth0 } from "@auth0/auth0-react";
import { useCallback } from "react";

type ForceOpts = { reason?: string; federated?: boolean };

export function useForceReauth() {
  const { logout } = useAuth0();

  // Cierra sesión y te manda a /login (donde gatillamos loginWithRedirect)
  return useCallback(({ reason, federated }: ForceOpts = {}) => {
    // evita loops si ya estamos reautenticando
    if (sessionStorage.getItem("reauth_in_progress")) return;
    sessionStorage.setItem("reauth_in_progress", "1");

    const returnTo = `${window.location.origin}/login?reason=${encodeURIComponent(
      reason ?? "session_expired"
    )}`;

    logout({
      logoutParams: {
        returnTo,
        // Si quieres cerrar sesión SSO del IdP (Google, etc), habilita:
        ...(federated ? { federated: true } : {}),
      } as any, // federated es compatible vía query param
    });
  }, [logout]);
}
