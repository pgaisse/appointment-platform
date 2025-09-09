import { useAuth0 } from "@auth0/auth0-react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef } from "react";

const NS = "https://letsmarter.com/";

// helpers
const toLowerArr = (a: unknown) =>
  (Array.isArray(a) ? a : [])
    .map((x) => (x == null ? "" : String(x)))
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

const pick = (claims: any, key: string) => claims?.[NS + key] ?? claims?.[key];

type Props = {
  /** si true: requiere sesión; si false: solo para NO logueados (ej. /signin) */
  reqAuth?: boolean;
  /** pasa si el usuario tiene AL MENOS UNO de estos roles */
  requireRole?: string[];
  /** requiere TODAS estas permissions */
  requireAllPerms?: string[];
  /** requiere AL MENOS UNA de estas permissions */
  requireAnyPerms?: string[];
  /** UI alternativa para 403 */
  fallback?: React.ReactNode;
};

function Spinner() {
  return <div style={{ padding: 24 }}>Cargando…</div>;
}

export default function AuthorizedUsers({
  reqAuth = true,
  requireRole,
  requireAllPerms,
  requireAnyPerms,
  fallback,
}: Props) {
  const { isAuthenticated, isLoading, user, loginWithRedirect } = useAuth0();
  const loc = useLocation();
  const tried = useRef(false);

  // roles/perms desde el ID Token (tu Action ya los agrega namespaced)
  const roles = useMemo(() => toLowerArr(pick(user, "roles")), [user]);
  const permissions = useMemo(
    () => toLowerArr(pick(user, "permissions")),
    [user]
  );

  // si requiere auth y no hay sesión -> redirige a Auth0
  useEffect(() => {
    if (!reqAuth) return;
    if (isLoading) return;
    if (isAuthenticated) return;
    if (tried.current) return;

    tried.current = true;
    loginWithRedirect({
      authorizationParams: {
        // organization: (window as any).__ENV__?.AUTH0_ORG_ID, // si corresponde
        scope: "openid profile email offline_access",
      },
      appState: { returnTo: loc.pathname + loc.search },
    });
  }, [reqAuth, isAuthenticated, isLoading, loginWithRedirect, loc]);

  if (isLoading) return <Spinner />;

  // rutas solo para NO logueados (ej. /signin)
  if (reqAuth === false && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (reqAuth && !isAuthenticated) {
    // mientras dispara loginWithRedirect
    return <Spinner />;
  }

  // checks de rol/permisos
  const lacksRole =
    requireRole && requireRole.length > 0
      ? !requireRole.some((r) => roles.includes(r.toLowerCase()))
      : false;

  const lacksAllPerms =
    requireAllPerms && requireAllPerms.length > 0
      ? !requireAllPerms.every((p) => permissions.includes(p.toLowerCase()))
      : false;

  const lacksAnyPerms =
    requireAnyPerms && requireAnyPerms.length > 0
      ? !requireAnyPerms.some((p) => permissions.includes(p.toLowerCase()))
      : false;

  if (lacksRole || lacksAllPerms || lacksAnyPerms) {
    return fallback ?? <Navigate to="/403" replace />;
  }

  return <Outlet />;
}
