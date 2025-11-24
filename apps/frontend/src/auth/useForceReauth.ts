import { useAuth0 } from "@auth0/auth0-react";
import { useCallback } from "react";

type ForceOpts = { reason?: string; federated?: boolean };

export function useForceReauth() {
  const { logout } = useAuth0();

  // Cierra sesión localmente y redirige directamente al login
  return useCallback(({ reason, federated }: ForceOpts = {}) => {
    // evita loops si ya estamos reautenticando
    if (sessionStorage.getItem("reauth_in_progress")) return;
    sessionStorage.setItem("reauth_in_progress", "1");

    // Limpiar estado local
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem("reauth_in_progress", "1"); // Restaurar flag después de clear

    // Si necesitas logout completo de Auth0 (federated), usa logout
    if (federated) {
      const returnTo = `${window.location.origin}/login?reason=${encodeURIComponent(
        reason ?? "session_expired"
      )}`;
      
      logout({
        logoutParams: {
          returnTo,
          federated: true,
        } as any,
      });
    } else {
      // Para expiración de sesión, redirigir directamente a nuestro login personalizado
      const reasonParam = reason ? `?reason=${encodeURIComponent(reason)}` : '';
      window.location.href = `/login${reasonParam}`;
    }
  }, [logout]);
}
