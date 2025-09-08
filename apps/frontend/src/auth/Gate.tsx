import { PropsWithChildren, useMemo } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useQuery } from "@tanstack/react-query";
import { useAuthZ } from "./authz";

type Source = "token" | "server" | "access" | "both" | "all";

type Props = {
  requireAuth?: boolean;
  requireRole?: string[];
  requireAllPerms?: string[];
  requireAnyPerms?: string[];
  forbidPerms?: string[];
  source?: Source;                // <-- ahora acepta "access" y "all"
  loadingFallback?: React.ReactNode;
  fallback?: React.ReactNode;     // default null = oculto
};

const NS = "https://letsmarter.com/";
const AUDIENCE =
  (window as any).__ENV__?.AUTH0_AUDIENCE ?? import.meta.env.VITE_AUTH0_AUDIENCE;

const norm = (v?: string) => (v ?? "").trim().toLowerCase();
const normArr = (a?: unknown) =>
  (Array.isArray(a) ? a : []).map((x) => norm(String(x))).filter(Boolean);

function matchesWithWildcard(pattern: string, value: string) {
  if (!pattern.includes("*")) return pattern === value;
  const escaped = pattern
    .split("*")
    .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  const rx = new RegExp(`^${escaped}$`);
  return rx.test(value);
}
function hasAny(required: string[], have: Set<string>) {
  return required.some((req) =>
    have.has(req) || Array.from(have).some((h) => matchesWithWildcard(req, h))
  );
}
function hasAll(required: string[], have: Set<string>) {
  return required.every((req) =>
    have.has(req) || Array.from(have).some((h) => matchesWithWildcard(req, h))
  );
}
function decodeJwtPayload(at: string): any {
  const b = at.split(".")[1];
  const s = b.replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(atob(s));
}

export default function Gate({
  requireAuth = true,
  requireRole,
  requireAllPerms,
  requireAnyPerms,
  forbidPerms,
  source = "token",
  loadingFallback = null,
  fallback = null,
  children,
}: PropsWithChildren<Props>) {
  const { isAuthenticated, isLoading: authLoading, getAccessTokenSilently } = useAuth0();
  const { roles: tokenRoles, permissions: tokenPerms } = useAuthZ();

  // --- SERVER (/api/me) ---
  const needsServer = (source === "server" || source === "both" || source === "all") && isAuthenticated;
  const meQuery = useQuery({
    enabled: needsServer,
    queryKey: ["me"],
    queryFn: async () => {
      const at = await getAccessTokenSilently({
        authorizationParams: { audience: AUDIENCE },
      });
      const r = await fetch("/api/me", { headers: { Authorization: `Bearer ${at}` } });
      if (!r.ok) throw new Error("me_fetch_failed");
      return r.json(); // { dbUser, tokenUser }
    },
    staleTime: 60_000,
  });

  // --- ACCESS TOKEN (nuevo) ---
  const needsAccess = (source === "access" || source === "all") && isAuthenticated;
  const atPermsQuery = useQuery({
    enabled: needsAccess,
    queryKey: ["at-perms"],
    queryFn: async () => {
      const at = await getAccessTokenSilently({
        authorizationParams: { audience: AUDIENCE },
      });
      const p = decodeJwtPayload(at);
      const perms = normArr(p.permissions || p[NS + "permissions"]);
      return perms;
    },
    staleTime: 60_000,
  });

  const loading = authLoading || (needsServer && meQuery.isLoading) || (needsAccess && atPermsQuery.isLoading);

  const serverRoles = normArr(meQuery.data?.dbUser?.roles);
  const serverPerms = normArr(meQuery.data?.dbUser?.permissions);
  const accessPerms = atPermsQuery.data ?? [];

  const roles = useMemo(() => {
    const set = new Set(normArr(tokenRoles));
    if (source === "server" || source === "both" || source === "all") {
      serverRoles.forEach((r) => set.add(r));
    }
    return set;
  }, [tokenRoles, serverRoles, source]);

  const perms = useMemo(() => {
    const set = new Set(normArr(tokenPerms));
    if (source === "server" || source === "both" || source === "all") {
      serverPerms.forEach((p) => set.add(p));
    }
    if (source === "access" || source === "all") {
      accessPerms.forEach((p) => set.add(p));
    }
    return set;
  }, [tokenPerms, serverPerms, accessPerms, source]);

  if (requireAuth && (loading || !isAuthenticated)) return <>{loadingFallback}</>;

  if (requireRole?.length) {
    const req = normArr(requireRole);
    const ok = req.some((r) => roles.has(r));
    if (!ok) return <>{fallback}</>;
  }
  if (requireAllPerms?.length) {
    const req = normArr(requireAllPerms);
    if (!hasAll(req, perms)) return <>{fallback}</>;
  }
  if (requireAnyPerms?.length) {
    const req = normArr(requireAnyPerms);
    if (!hasAny(req, perms)) return <>{fallback}</>;
  }
  if (forbidPerms?.length) {
    const req = normArr(forbidPerms);
    const hit =
      req.some((p) => perms.has(p)) ||
      req.some((p) => Array.from(perms).some((h) => matchesWithWildcard(p, h)));
    if (hit) return <>{fallback}</>;
  }

  return <>{children}</>;
}
