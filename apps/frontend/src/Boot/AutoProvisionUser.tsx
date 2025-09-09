import { useEffect, useRef } from "react";
import { useAuth0 } from "@auth0/auth0-react";

const AUDIENCE =
  (window as any).__ENV__?.AUTH0_AUDIENCE ?? import.meta.env.VITE_AUTH0_AUDIENCE;

/**
 * Llama /api/me una sola vez por sesión de usuario para disparar el JIT upsert.
 * - Tolerante a StrictMode (no se duplica).
 * - Evita repeticiones por sesión del navegador usando sessionStorage.
 */
export default function AutoProvisionUser() {
  const { isAuthenticated, isLoading, getAccessTokenSilently, getIdTokenClaims } = useAuth0();
  const inited = useRef(false);

  useEffect(() => {
    if (inited.current) return;
    if (isLoading) return;
    if (!isAuthenticated) return;

    inited.current = true;

    (async () => {
      try {
        // Usamos el sub del ID Token para evitar repetir en esta sesión
        const idc = await getIdTokenClaims();
        const sub = (idc as any)?.sub || "unknown";
        const key = `__ap_called:${sub}`;

        if (sessionStorage.getItem(key)) {
          // ya lo llamamos en esta sesión del navegador
          return;
        }

        const token = await getAccessTokenSilently({
          authorizationParams: { audience: AUDIENCE },
        });

        const res = await fetch("/api/me", {
          headers: { Authorization: `Bearer ${token}` },
        });

        // No rompas la UI si falla; solo deja rastro para diagnóstico
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          console.warn("[AutoProvisionUser] /api/me ->", res.status, txt);
          return;
        }

        // Marcamos que ya se ejecutó en esta sesión
        sessionStorage.setItem(key, String(Date.now()));
        // (Opcional) Si quieres cachear el user para UI:
        // const me = await res.json();
        // window.__ME__ = me;
        // console.log("[AutoProvisionUser] provisionado:", me?.dbUser?._id);
      } catch (e) {
        console.warn("[AutoProvisionUser] error:", e);
      }
    })();
  }, [isAuthenticated, isLoading, getAccessTokenSilently, getIdTokenClaims]);

  return null;
}
