// apps/frontend/src/Routes/Layout.tsx
import Header from "@/Components/Header";
import SideBar from "@/Components/SideBar";
import { useAuth0 } from "@auth0/auth0-react";
import { Grid, GridItem } from "@chakra-ui/react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Outlet } from "react-router-dom";
import { SocketNotification } from "@/Components/Socket/SocketNotification";

import paths, { navLinks, NavLink } from "./path";
import type { LinkItem as LinkItemType } from "@/types";
import { FaUserCircle } from "react-icons/fa";

const NS = "https://letsmarter.com/";

// helpers
const toLowerArr = (a: unknown) =>
  (Array.isArray(a) ? a : [])
    .map((x) => (x == null ? "" : String(x)))
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

const match = (pattern: string, value: string) => {
  const p = (pattern || "").toLowerCase();
  const v = (value || "").toLowerCase();
  if (!p) return false;
  if (p === v) return true;
  if (p.endsWith("*")) return v.startsWith(p.slice(0, -1));
  return false;
};

/**
 * Verifica visibilidad según sesión y permisos.
 * Usa SOLO claims del ID token (user), como tenías "antes".
 * Extra: los roles generan "permisos virtuales" rol:* (p.ej. Admin → admin:*)
 */
function hasAccess(link: NavLink, isAuthenticated: boolean, user: any) {
  // auth
  if (link.requireAuth && !isAuthenticated) return false;

  const roles = toLowerArr(user?.[NS + "roles"] ?? user?.roles);
  const perms = toLowerArr(user?.[NS + "permissions"] ?? user?.permissions);

  // Derivamos perms virtuales desde roles (Admin → admin:*)
  const derived = new Set<string>(perms);
  for (const r of roles) derived.add(`${r}:*`);

  // requireAllPerms
  if (link.requireAllPerms?.length) {
    const needed = link.requireAllPerms.map((p) => p.toLowerCase());
    const ok = needed.every(
      (p) => Array.from(derived).some((h) => match(p, h))
    );
    if (!ok) return false;
  }

  // requireAnyPerms
  if (link.requireAnyPerms?.length) {
    const any = link.requireAnyPerms.map((p) => p.toLowerCase());
    const ok = any.some((p) => Array.from(derived).some((h) => match(p, h)));
    if (!ok) return false;
  }

  // forbidPerms
  if (link.forbidPerms?.length) {
    const forb = link.forbidPerms.map((p) => p.toLowerCase());
    const hit = forb.some((p) => Array.from(derived).some((h) => match(p, h)));
    if (hit) return false;
  }

  return true;
}
// --- helpers de orden ---
const ord = (n: unknown): number =>
  typeof n === "number" && Number.isFinite(n) ? n : 1_000_000;

const byOrderThenLabel = (
  a: { order?: number; label?: string },
  b: { order?: number; label?: string }
): number => {
  const d = ord(a.order) - ord(b.order);
  if (d !== 0) return d;
  return String(a.label ?? "").localeCompare(String(b.label ?? ""), undefined, { sensitivity: "base" });
};


export default function Layout({ children }: { children?: React.ReactNode }) {
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(64);
  useLayoutEffect(() => {
    if (headerRef.current) setHeaderHeight(headerRef.current.getBoundingClientRect().height);
  }, []);

  const { isAuthenticated, user } = useAuth0();

  // Header items (excluimos signin/logout aquí; se manejan como "linkSession")
  const headerItems = useMemo(
    () =>
      navLinks
        .filter((l) => l.show.includes("header") && !["signin", "logout"].includes(l.key))
        .filter((l) => hasAccess(l, !!isAuthenticated, user))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map(({ label, path, icon }) => ({ name: label, path, icon: icon ?? FaUserCircle })),
    [isAuthenticated, user]
  );

  // Session links (derecha del Header)
  const linkSession = isAuthenticated
    ? [{ name: "Log out", path: paths.logout, icon: FaUserCircle }]
    : [{ name: "Sign in", path: paths.signin, icon: FaUserCircle }];

  // Sidebar (linkItems)


  // Sidebar (linkConfig) — sección inferior (Settings cuando está logueado)
  // Arriba
  const sidebarMain = useMemo(() =>
    navLinks
      .filter(l => l.show.includes("sidebar") && (l.sidebarZone ?? "main") === "main")
      .filter(l => hasAccess(l, !!isAuthenticated, user))
      .sort(byOrderThenLabel)
      .map(({ label, path, icon }) => ({ name: label, path, icon: icon ?? FaUserCircle, color: "blue.500" })),
    [isAuthenticated, user]
  );

  // Abajo
  const sidebarBottom = useMemo(() =>
    navLinks
      .filter(l => l.show.includes("sidebar") && (l.sidebarZone ?? "main") === "bottom")
      .filter(l => hasAccess(l, !!isAuthenticated, user))
      .sort(byOrderThenLabel)  // ⬅️ aquí se respeta order
      .map(({ label, path, icon }) => ({ name: label, path, icon: icon ?? FaUserCircle, color: "black.500" })),
    [isAuthenticated, user]
  );

  // Pásalos tal cual:



  return (
    <Grid
      templateAreas={{
        base: `"header" "main"`,
        md: `"header header" "sidebar main"`,
      }}
      gridTemplateRows="auto 1fr"
      gridTemplateColumns={{ base: "1fr", md: "auto 1fr" }}
      minH="100vh"
      bg="white"
      h="100dvh"
      w="100dvw"
    >
      <GridItem area="header" ref={headerRef} zIndex={999}>
        <Header linkItems={headerItems} linkSession={linkSession} />
      </GridItem>

      <GridItem
        area={{ base: "main", md: "sidebar" }}
        display={{ base: "none", md: "block" }}
        bg="white"
        height={`calc(100vh - ${headerHeight}px)`}   // ⬅️ ocupa todo el alto disponible
        overflow="hidden"                             // ⬅️ el scroll va ADENTRO del SideBar
      >
        <SideBar linkItems={sidebarMain} linkConfig={sidebarBottom} />
      </GridItem>

      <GridItem area="main" bg="white" height={`calc(100vh - ${headerHeight}px)`} pl="2">
        <SocketNotification />
        <Outlet />
        {children}
      </GridItem>
    </Grid>
  );
}
