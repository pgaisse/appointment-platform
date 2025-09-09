import { PropsWithChildren, useEffect, useRef } from "react";
import { useLocation, Navigate } from "react-router-dom";
import { useAuthZ } from "./authz";

function Spinner() {
  return <div style={{ padding: 24 }}>Cargando…</div>;
}

/** Requiere estar logueado (redirige a Auth0 si no) */
export function RequireAuthOnly({ children }: PropsWithChildren) {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuthZ();
  const loc = useLocation();
  const tried = useRef(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !tried.current) {
      tried.current = true;
      loginWithRedirect({
        authorizationParams: {
          // si usas orgs dinámicas, pásala aquí si aplica
          // organization: window.__ENV__?.AUTH0_ORG_ID,
        },
        appState: { returnTo: loc.pathname + loc.search },
      });
    }
  }, [isAuthenticated, isLoading, loginWithRedirect, loc]);

  if (isLoading || (!isAuthenticated && !tried.current)) return <Spinner />;
  if (!isAuthenticated) return <Navigate to="/403" replace />;
  return <>{children}</>;
}

/** Requiere tener al menos uno de estos roles */
export function RequireRole({ anyOf, children }: PropsWithChildren<{ anyOf: string[] }>) {
  const { isAuthenticated, isLoading, hasRole } = useAuthZ();
  if (isLoading) return <Spinner />;
  if (!isAuthenticated) return <Navigate to="/403" replace />;
  if (!hasRole(...anyOf)) return <Navigate to="/403" replace />;
  return <>{children}</>;
}

/** Requiere TODAS estas permissions */
export function RequireAllPerms({ perms, children }: PropsWithChildren<{ perms: string[] }>) {
  const { isAuthenticated, isLoading, hasAllPermissions } = useAuthZ();
  if (isLoading) return <Spinner />;
  if (!isAuthenticated) return <Navigate to="/403" replace />;
  if (!hasAllPermissions(...perms)) return <Navigate to="/403" replace />;
  return <>{children}</>;
}

/** Requiere AL MENOS UNA de estas permissions */
export function RequireAnyPerm({ perms, children }: PropsWithChildren<{ perms: string[] }>) {
  const { isAuthenticated, isLoading, hasAnyPermission } = useAuthZ();
  if (isLoading) return <Spinner />;
  if (!isAuthenticated) return <Navigate to="/403" replace />;
  if (!hasAnyPermission(...perms)) return <Navigate to="/403" replace />;
  return <>{children}</>;
}
