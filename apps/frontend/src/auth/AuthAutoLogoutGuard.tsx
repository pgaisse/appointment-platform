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

    // opcional: revalidar periódico (por si expira en background)
    const id = setInterval(() => {
      getToken().catch(() => {});
    }, 4 * 60 * 1000);

    return () => clearInterval(id);
  }, [isAuthenticated, getToken]);

  return null;
}
