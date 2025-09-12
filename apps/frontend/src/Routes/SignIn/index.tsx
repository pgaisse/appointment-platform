import { useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";

export default function Login() {
  const { loginWithRedirect, isAuthenticated } = useAuth0();

  useEffect(() => {
    if (isAuthenticated) return; // ya logueado (quizá por back/refresh)
    // limpio la bandera de loop aquí
    sessionStorage.removeItem("reauth_in_progress");
    loginWithRedirect({
      authorizationParams: {
        audience: import.meta.env.VITE_AUTH0_AUDIENCE || "https://api.dev.iconicsmiles",
        scope: "openid profile email offline_access",
        prompt: "login",
      },
      appState: { returnTo: window.location.pathname + window.location.search },
    });
  }, [loginWithRedirect, isAuthenticated]);

  return null;
}
