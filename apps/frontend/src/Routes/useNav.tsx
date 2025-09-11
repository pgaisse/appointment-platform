// apps/frontend/src/Routes/useNav.tsx
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useMemo, useState } from "react";
import type { RouteLink, GateLike } from "./routes.config";

const NS = "https://letsmarter.com/";
type NavItem = { name: string; path: string; icon?: any; order: number };

const toLowerArr = (a: unknown) =>
  (Array.isArray(a) ? a : [])
    .map((x) => (x == null ? "" : String(x)))
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

const matchesWithWildcard = (pattern: string, value: string) => {
  const p = (pattern || "").toLowerCase();
  const v = (value || "").toLowerCase();
  if (!p) return false;
  if (p === v) return true;
  if (p.endsWith("*")) return v.startsWith(p.slice(0, -1));
  return false;
};

function toGate(g?: boolean | GateLike): GateLike | undefined {
  if (g === true) return { requireAuth: true, source: "all" };
  if (g && typeof g === "object") return { source: "all", ...g };
  return undefined;
}

/** Acceso con herencia de Gate (requireAuth/perms) */
type FlatNode = RouteLink & {
  fullPath: string;
  effGate?: GateLike;
};

type Acc = {
  requireAuth: boolean;
  requireAnyPerms: string[];
  requireAllPerms: string[];
  forbidPerms: string[];
  source?: GateLike["source"];
};

const merge = (a?: string[], b?: string[]) => {
  const s = new Set<string>();
  (a || []).forEach((x) => s.add(String(x).toLowerCase()));
  (b || []).forEach((x) => s.add(String(x).toLowerCase()));
  return Array.from(s);
};

function inherit(nodes: RouteLink[], parent?: FlatNode, acc?: Acc): FlatNode[] {
  const out: FlatNode[] = [];
  const base: Acc = {
    requireAuth: acc?.requireAuth ?? false,
    requireAnyPerms: acc?.requireAnyPerms ?? [],
    requireAllPerms: acc?.requireAllPerms ?? [],
    forbidPerms: acc?.forbidPerms ?? [],
    source: acc?.source ?? "all",
  };

  for (const n of nodes) {
    const g = toGate(n.gate);
    const eff: Acc = {
      requireAuth: (g?.requireAuth ?? false) || base.requireAuth,
      requireAnyPerms: merge(base.requireAnyPerms, g?.requireAnyPerms),
      requireAllPerms: merge(base.requireAllPerms, g?.requireAllPerms),
      forbidPerms: merge(base.forbidPerms, g?.forbidPerms),
      source: g?.source ?? base.source,
    };

    let fullPath = n.path || "";
    if (fullPath && !fullPath.startsWith("/")) {
      const basePath = parent?.fullPath ?? "";
      fullPath = basePath.endsWith("/") ? basePath + fullPath : basePath + (fullPath ? "/" + fullPath : "");
    }

    const flat: FlatNode = {
      ...n,
      fullPath,
      effGate: {
        requireAuth: eff.requireAuth,
        requireAnyPerms: eff.requireAnyPerms,
        requireAllPerms: eff.requireAllPerms,
        forbidPerms: eff.forbidPerms,
        source: eff.source,
      },
    };

    out.push(flat);
    if (n.children?.length) out.push(...inherit(n.children, flat, eff));
  }

  return out;
}

export function useHeaderNav(manifest: RouteLink[]) {
  const { isAuthenticated, user, getAccessTokenSilently } = useAuth0();

  // Claims del ID token
  const rolesToken = toLowerArr((user as any)?.[NS + "roles"] ?? (user as any)?.roles);
  const permsToken = toLowerArr((user as any)?.[NS + "permissions"] ?? (user as any)?.permissions);

  // Access token (solo si alguna ruta pide source que incluya "access")
  const [permsAccess, setPermsAccess] = useState<string[]>([]);
  const needsAccess = useMemo(() => {
    const all = inherit(manifest);
    return all.some((n) => (n.effGate?.source ?? "all") !== "token");
  }, [manifest]);

  useEffect(() => {
    let mounted = true;
    async function grab() {
      if (!needsAccess) return;
      try {
        const token = await getAccessTokenSilently({
          authorizationParams: { audience: (import.meta as any).env?.VITE_AUTH0_AUDIENCE },
        });
        const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
        const perms = toLowerArr(payload?.[NS + "permissions"] ?? payload?.permissions);
        if (mounted) setPermsAccess(perms);
      } catch {
        if (mounted) setPermsAccess([]);
      }
    }
    grab();
    return () => { mounted = false; };
  }, [needsAccess, getAccessTokenSilently]);

  return useMemo<NavItem[]>(() => {
    const flats = inherit(manifest);
    return flats
      .filter((r) => r.show?.includes("header") && r.label)
      .filter((r) => {
        const g = r.effGate;
        if (!g) return true;
        if (g.requireAuth && !isAuthenticated) return false;

        const source = g.source ?? "all";
        const perms =
          source === "token" ? permsToken :
          source === "access" ? permsAccess :
          Array.from(new Set([...permsToken, ...permsAccess]));

        if (g.requireAllPerms?.length) {
          const all = g.requireAllPerms.map((p) => p.toLowerCase());
          if (!all.every((p) => perms.includes(p) || perms.some((h) => matchesWithWildcard(p, h)))) return false;
        }
        if (g.requireAnyPerms?.length) {
          const any = g.requireAnyPerms.map((p) => p.toLowerCase());
          if (
            !any.some((p) => perms.includes(p)) &&
            !any.some((p) => perms.some((h) => matchesWithWildcard(p, h)))
          ) return false;
        }
        if (g.forbidPerms?.length) {
          const fb = g.forbidPerms.map((p) => p.toLowerCase());
          const hit =
            fb.some((p) => perms.includes(p)) ||
            fb.some((p) => perms.some((h) => matchesWithWildcard(p, h)));
          if (hit) return false;
        }
        return true;
      })
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((r) => ({ name: r.label!, path: r.fullPath || r.path, icon: r.icon, order: r.order ?? 0 }));
  }, [manifest, isAuthenticated, permsToken, permsAccess]);
}

export function useSidebarNav(manifest: RouteLink[]) {
  const { isAuthenticated, user, getAccessTokenSilently } = useAuth0();

  const rolesToken = toLowerArr((user as any)?.[NS + "roles"] ?? (user as any)?.roles);
  const permsToken = toLowerArr((user as any)?.[NS + "permissions"] ?? (user as any)?.permissions);

  const [permsAccess, setPermsAccess] = useState<string[]>([]);
  const needsAccess = useMemo(() => {
    const all = inherit(manifest);
    return all.some((n) => (n.effGate?.source ?? "all") !== "token");
  }, [manifest]);

  useEffect(() => {
    let mounted = true;
    async function grab() {
      if (!needsAccess) return;
      try {
        const token = await getAccessTokenSilently({
          authorizationParams: { audience: (import.meta as any).env?.VITE_AUTH0_AUDIENCE },
        });
        const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
        const perms = toLowerArr(payload?.[NS + "permissions"] ?? payload?.permissions);
        if (mounted) setPermsAccess(perms);
      } catch {
        if (mounted) setPermsAccess([]);
      }
    }
    grab();
    return () => { mounted = false; };
  }, [needsAccess, getAccessTokenSilently]);

  return useMemo<NavItem[]>(() => {
    const flats = inherit(manifest);
    return flats
      .filter((r) => r.show?.includes("sidebar") && r.label)
      .filter((r) => {
        const g = r.effGate;
        if (!g) return true;
        if (g.requireAuth && !isAuthenticated) return false;

        const source = g.source ?? "all";
        const perms =
          source === "token" ? permsToken :
          source === "access" ? permsAccess :
          Array.from(new Set([...permsToken, ...permsAccess]));

        if (g.requireAllPerms?.length) {
          const all = g.requireAllPerms.map((p) => p.toLowerCase());
          if (!all.every((p) => perms.includes(p) || perms.some((h) => matchesWithWildcard(p, h)))) return false;
        }
        if (g.requireAnyPerms?.length) {
          const any = g.requireAnyPerms.map((p) => p.toLowerCase());
          if (
            !any.some((p) => perms.includes(p)) &&
            !any.some((p) => perms.some((h) => matchesWithWildcard(p, h)))
          ) return false;
        }
        if (g.forbidPerms?.length) {
          const fb = g.forbidPerms.map((p) => p.toLowerCase());
          const hit =
            fb.some((p) => perms.includes(p)) ||
            fb.some((p) => perms.some((h) => matchesWithWildcard(p, h)));
          if (hit) return false;
        }
        return true;
      })
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((r) => ({ name: r.label!, path: r.fullPath || r.path, icon: r.icon, order: r.order ?? 0 }));
  }, [manifest, isAuthenticated, permsToken, permsAccess]);
}
