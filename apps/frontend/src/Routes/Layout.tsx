// apps/frontend/src/Routes/Layout.tsx
import Header from "@/Components/Header";
import SideBar from "@/Components/SideBar";
import { useAuth0 } from "@auth0/auth0-react";
import { Box } from "@chakra-ui/react";
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useEffect,
} from "react";
import { Outlet } from "react-router-dom";
import { SocketNotification } from "@/Components/Socket/SocketNotification";

import paths, { navLinks, NavLink } from "./path";
import { FaUserCircle } from "react-icons/fa";

const NS = "https://letsmarter.com/";
const AUDIENCE =
  (window as any).__ENV__?.AUTH0_AUDIENCE ?? import.meta.env.VITE_AUTH0_AUDIENCE;

// ───────────────────────── helpers ─────────────────────────
const toLowerArr = (a: unknown) =>
  (Array.isArray(a) ? a : [])
    .map((x) => (x == null ? "" : String(x)))
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

const uniq = (arr: string[]) => Array.from(new Set(arr));

const match = (pattern: string, value: string) => {
  const p = (pattern || "").toLowerCase();
  const v = (value || "").toLowerCase();
  if (!p) return false;
  if (p === v) return true;
  if (p.endsWith("*")) return v.startsWith(p.slice(0, -1));
  return false;
};

// Decodificador mínimo de JWT (sin dependencias)
function jwtPayload<T = any>(token: string | null | undefined): T | null {
  try {
    if (!token) return null;
    const [, payloadB64] = token.split(".");
    if (!payloadB64) return null;
    const json = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch {
    return null;
  }
}

/**
 * Verifica visibilidad según sesión y permisos.
 * Usa claims (roles/permisos) ya "fusionados" en el objeto recibido.
 * Extra: roles generan "permisos virtuales" rol:* (Admin → admin:*)
 */
function hasAccess(link: NavLink, isAuthenticated: boolean, claims: any) {
  if (link.requireAuth && !isAuthenticated) return false;

  const roles = toLowerArr(claims?.[NS + "roles"] ?? claims?.roles);
  const perms = toLowerArr(claims?.[NS + "permissions"] ?? claims?.permissions);

  const derived = new Set<string>(perms);
  for (const r of roles) derived.add(`${r}:*`);

  if (link.requireAllPerms?.length) {
    const needed = link.requireAllPerms.map((p) => p.toLowerCase());
    const ok = needed.every((p) => Array.from(derived).some((h) => match(p, h)));
    if (!ok) return false;
  }

  if (link.requireAnyPerms?.length) {
    const any = link.requireAnyPerms.map((p) => p.toLowerCase());
    const ok = any.some((p) => Array.from(derived).some((h) => match(p, h)));
    if (!ok) return false;
  }

  if (link.forbidPerms?.length) {
    const forb = link.forbidPerms.map((p) => p.toLowerCase());
    const hit = forb.some((p) => Array.from(derived).some((h) => match(p, h)));
    if (hit) return false;
  }

  return true;
}

// orden estable
const ord = (n: unknown): number =>
  typeof n === "number" && Number.isFinite(n) ? n : 1_000_000;

const byOrderThenLabel = (
  a: { order?: number; label?: string },
  b: { order?: number; label?: string }
): number => {
  const d = ord(a.order) - ord(b.order);
  if (d !== 0) return d;
  return String(a.label ?? "").localeCompare(String(b.label ?? ""), undefined, {
    sensitivity: "base",
  });
};

// ───────────────────────── Layout ─────────────────────────
export default function Layout({ children }: { children?: React.ReactNode }) {
  const { isAuthenticated, user, getAccessTokenSilently } = useAuth0();

  // Claims desde el ACCESS TOKEN (Auth0 Management/API audience)
  const [accessPerms, setAccessPerms] = useState<string[]>([]);
  const [accessRoles, setAccessRoles] = useState<string[]>([]);

  // Cargar y decodificar el access token para extraer permisos/roles
  useEffect(() => {
    let cancelled = false;

    async function loadAccessClaims() {
      try {
        if (!isAuthenticated || !AUDIENCE) {
          if (!cancelled) {
            setAccessPerms([]);
            setAccessRoles([]);
          }
          return;
        }
        const token = await getAccessTokenSilently({ authorizationParams: { audience: AUDIENCE } });
        const payload: any = jwtPayload(token) || {};

        // Permisos típicos en Auth0: payload.permissions (array de strings)
        const permsFromAT: string[] =
          Array.isArray(payload?.permissions)
            ? payload.permissions
            : Array.isArray(payload?.[NS + "permissions"])
            ? payload[NS + "permissions"]
            : [];

        // Roles si los inyectas al AT (vía Action/Rule) en tu namespace
        const rolesFromAT: string[] =
          Array.isArray(payload?.[NS + "roles"])
            ? payload[NS + "roles"]
            : [];

        if (!cancelled) {
          setAccessPerms(permsFromAT);
          setAccessRoles(rolesFromAT);
        }
      } catch (_e) {
        // Silencioso: si falla, solo usamos los claims del ID token
        if (!cancelled) {
          setAccessPerms([]);
          setAccessRoles([]);
        }
      }
    }

    loadAccessClaims();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, getAccessTokenSilently]);

  // Fusionar claims: ID token (user) + Access Token
  // Resultado se pasa a hasAccess sin cambiar tu lógica.
  const computedClaims = useMemo(() => {
    const userRoles =
      toLowerArr((user as any)?.[NS + "roles"] ?? (user as any)?.roles) ?? [];
    const userPerms =
      toLowerArr((user as any)?.[NS + "permissions"] ?? (user as any)?.permissions) ??
      [];

    const mergedRoles = uniq([...userRoles, ...toLowerArr(accessRoles)]);
    const mergedPerms = uniq([...userPerms, ...toLowerArr(accessPerms)]);

    return {
      ...(user || {}),
      [NS + "roles"]: mergedRoles,
      [NS + "permissions"]: mergedPerms,
      // También como llaves "planas" por si tu lógica futura las usa:
      roles: mergedRoles,
      permissions: mergedPerms,
    };
  }, [user, accessPerms, accessRoles]);

  // Refs + medidas dinámicas
  const headerRef = useRef<HTMLDivElement>(null);
  const sidebarShellRef = useRef<HTMLDivElement>(null); // wrapper fijo del sidebar
  const [headerHeight, setHeaderHeight] = useState(0);
  const [sidebarWidth, setSidebarWidth] = useState(0);

  // Observa tamaño del header y sidebar (premium: 0 parpadeos y siempre alineado)
  useLayoutEffect(() => {
    const headerEl = headerRef.current;
    const sidebarEl = sidebarShellRef.current;

    if (!headerEl && !sidebarEl) return;

    const onHeaderResize = (entries: ResizeObserverEntry[]) => {
      const box = entries[0]?.contentRect;
      if (box) setHeaderHeight(Math.round(box.height));
    };
    const onSidebarResize = () => {
      if (sidebarShellRef.current) {
        // offsetWidth incluye borde y padding → mejor alineación visual
        setSidebarWidth(sidebarShellRef.current.offsetWidth);
      }
    };

    const roHeader = new ResizeObserver(onHeaderResize);
    const roSidebar = new ResizeObserver(onSidebarResize);

    if (headerEl) roHeader.observe(headerEl);
    if (sidebarEl) roSidebar.observe(sidebarEl);

    // 1er cálculo inmediato
    if (headerEl) setHeaderHeight(Math.round(headerEl.getBoundingClientRect().height));
    if (sidebarEl) setSidebarWidth(sidebarEl.offsetWidth);

    return () => {
      roHeader.disconnect();
      roSidebar.disconnect();
    };
  }, []);

  // Recalcula ante cambios de viewport (fallback adicional)
  useEffect(() => {
    const onWinResize = () => {
      if (headerRef.current) {
        setHeaderHeight(Math.round(headerRef.current.getBoundingClientRect().height));
      }
      if (sidebarShellRef.current) {
        setSidebarWidth(sidebarShellRef.current.offsetWidth);
      }
    };
    window.addEventListener("resize", onWinResize);
    return () => window.removeEventListener("resize", onWinResize);
  }, []);

  // Header items (excluye signin/logout; esos van como linkSession)
  const headerItems = useMemo(
    () =>
      navLinks
        .filter((l) => l.show.includes("header") && !["signin", "logout"].includes(l.key))
        .filter((l) => hasAccess(l, !!isAuthenticated, computedClaims))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map(({ label, path, icon }) => ({
          name: label,
          path,
          icon: icon ?? FaUserCircle,
        })),
    [isAuthenticated, computedClaims]
  );

  // Session links (derecha del Header)
  const linkSession = isAuthenticated
    ? [{ name: "Log out", path: paths.logout, icon: FaUserCircle }]
    : [{ name: "Sign in", path: paths.signin, icon: FaUserCircle }];

  // Sidebar arriba
  const sidebarMain = useMemo(
    () =>
      navLinks
        .filter((l) => l.show.includes("sidebar") && (l.sidebarZone ?? "main") === "main")
        .filter((l) => hasAccess(l, !!isAuthenticated, computedClaims))
        .sort(byOrderThenLabel)
        .map(({ label, path, icon }) => ({
          name: label,
          path,
          icon: icon ?? FaUserCircle,
          color: "blue.500",
        })),
    [isAuthenticated, computedClaims]
  );

  // Sidebar abajo
  const sidebarBottom = useMemo(
    () =>
      navLinks
        .filter((l) => l.show.includes("sidebar") && (l.sidebarZone ?? "main") === "bottom")
        .filter((l) => hasAccess(l, !!isAuthenticated, computedClaims))
        .sort(byOrderThenLabel)
        .map(({ label, path, icon }) => ({
          name: label,
          path,
          icon: icon ?? FaUserCircle,
          color: "black.500",
        })),
    [isAuthenticated, computedClaims]
  );

  return (
    <>
      {/* Header en flujo normal; su altura define el offset del sidebar */}
      <Box
        ref={headerRef}
        as="header"
        zIndex={1100}
        position="relative"
        bg="white"
        // sombra sutil premium
        boxShadow="sm"
      >
        <Header linkItems={headerItems} linkSession={linkSession} />
      </Box>

      {/* Sidebar fijo, ANCHO DINÁMICO (se adapta a sus iconos) */}
      <Box
        ref={sidebarShellRef}
        as="aside"
        position="fixed"
        left={0}
        top={`${headerHeight}px`} // empieza justo debajo del header
        height={`calc(100vh - ${headerHeight}px)`}
        // w auto + minW max-content → shrink-to-fit al contenido (iconos + padding)
        w="auto"
        minW="max-content"
        overflow="hidden"
        bg="white"
        borderRight="1px solid"
        borderColor="gray.200"
        zIndex={1000} // debajo del header
      >
        <SideBar linkItems={sidebarMain} linkConfig={sidebarBottom} />
      </Box>

      {/* Contenido principal desplazado EXACTAMENTE el ancho del sidebar en desktop */}
      <Box
        as="main"
        ml={{ base: 0, md: `${sidebarWidth}px` }}
        height={`calc(100dvh - ${headerHeight}px)`} // ocupa todo el alto menos el header
        overflowY="auto"                            // scroll dentro de main
        px={{ base: 3, md: 6 }}
        py={{ base: 3, md: 4 }}
        bg="white"
        h={"full"}
      >
        <SocketNotification />
        <Outlet />
        {children}
      </Box>
    </>
  );
}
