import { useAuth0 } from "@auth0/auth0-react";


export function detectOrgSlug(): string | null {
  // 1) Subdominio: acme.dev.letsmarter.com → "acme"
  const host = window.location.host; // p.ej. "acme.dev.letsmarter.com"
  const parts = host.split(".");
  const maybeSub = parts[0];
  const isLikelySub = parts.length >= 3 && !["www", "dev"].includes(maybeSub);
  if (isLikelySub) return maybeSub;

  // 2) Ruta: /o/:slug/...
  const m = window.location.pathname.match(/^\/o\/([^/]+)/);
  if (m) return m[1];

  // 3) Query: ?org=acme
  const q = new URLSearchParams(window.location.search).get("org");
  return q || null;
}

/** Opcional: resuelve slug→org_id desde tu backend si usas slugs human-friendly */
export async function resolveOrgId(slugOrId: string): Promise<string> {
  // Si ya te llega un ORG ID (empieza con "org_"), úsalo directo:
  if (slugOrId.startsWith("org_")) return slugOrId;
  // Si usas slugs, consulta tu backend (crea /public/orgs/resolve?slug=...):
  const res = await fetch(`/public/orgs/resolve?slug=${encodeURIComponent(slugOrId)}`);
  if (!res.ok) throw new Error("Cannot resolve org");
  const data = await res.json(); // { org_id: "org_XXXXX" }
  return data.org_id;
}

export function useOrgAuth() {
  const { loginWithRedirect, getAccessTokenSilently } = useAuth0();
  const audience = (window as any).__ENV__?.AUTH0_AUDIENCE ?? import.meta.env.VITE_AUTH0_AUDIENCE;

  return {
    /** Login explícito para una org (redirige a Universal Login con esa org) */
    loginForOrg: async (orgId: string, returnTo?: string) => {
      await loginWithRedirect({
        authorizationParams: {
          organization: orgId,
          audience,
          scope: "openid profile email offline_access",
          redirect_uri: returnTo || window.location.origin + window.location.pathname + window.location.search,
        },
      });
    },

    /** Token silencioso para una org. Si no hay sesión para esa org, lanzará error. */
    getTokenForOrg: async (orgId?: string) => {
      return getAccessTokenSilently({
        authorizationParams: {
          audience,
          ...(orgId ? { organization: orgId } : {}),
          // redirect_uri no es necesario aquí
        },
      });
    },
  };
}
