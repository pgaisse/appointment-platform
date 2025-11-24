import { useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useTokenOrLogout } from "./useTokenOrLogout";

export default function AuthAutoLogoutGuard() {
  const { isAuthenticated } = useAuth0();
  const { getToken } = useTokenOrLogout();

  useEffect(() => {
    if (!isAuthenticated) return;

    // chequeo inmediato
    getToken().catch(() => { /* forzado en hook */ });

    // Verificar cada 2 minutos para detectar expiración más rápido
    const id = setInterval(() => {
      getToken().catch(() => {
        console.warn('[AuthAutoLogoutGuard] Token validation failed');
      });
    }, 2 * 60 * 1000); // Cada 2 minutos

    return () => clearInterval(id);
  }, [isAuthenticated, getToken]);

  return null;
}
