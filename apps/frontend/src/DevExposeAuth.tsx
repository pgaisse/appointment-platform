// src/DevExposeAuth.tsx
import { useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";

declare global {
  interface Window {
    getToken?: () => Promise<string>;
    getIdClaims?: () => Promise<Record<string, unknown>>;
    login?: () => Promise<void>;
    logoutApp?: () => void;
    __authExposeReady?: number;
  }
}

export default function DevExposeAuth() {
  const { getAccessTokenSilently, getIdTokenClaims, loginWithRedirect, logout, isAuthenticated } = useAuth0();

  useEffect(() => {
    // Señal de montaje
    window.__authExposeReady = Date.now();
    console.log(
      "%c[DevExposeAuth] montado. isAuthenticated=%s",
      "color:#22c55e",
      isAuthenticated
    );

    // Exponer helpers
    window.getToken = async () => {
      const t = await getAccessTokenSilently();
      console.log("[getToken] access_token:", t);
      return t;
    };
    window.getIdClaims = async () => {
      const c = await getIdTokenClaims();
      console.log("[getIdClaims] id_token claims:", c);
      return (c || {}) as any;
    };
    window.login = () => loginWithRedirect();
    window.logoutApp = () => logout({ logoutParams: { returnTo: window.location.origin } });

    console.log(
      "%c[DevExposeAuth] listo: getToken(), getIdClaims(), login(), logoutApp()",
      "color:#22c55e"
    );
  }, [getAccessTokenSilently, getIdTokenClaims, loginWithRedirect, logout, isAuthenticated]);

  return null;
}
