// apps/frontend/src/Routes/routerFactory.tsx
import { JSX } from "react";
import { createBrowserRouter, Outlet, type RouteObject, Navigate } from "react-router-dom";
import Gate from "@/auth/Gate";
import type { RouteLink, GateLike } from "./routes.config";
import { getElementByKey } from "./routes.registry";

/** Normaliza 'gate' (boolean → objeto) y aplica defaults escalables */
function toGateProps(gate?: boolean | GateLike): GateLike | undefined {
  if (gate === true) return { requireAuth: true, source: "all", redirectToOnUnauthed: "/signin" };
  if (gate && typeof gate === "object") {
    return { source: "all", ...gate }; // default: leer de ambos tokens
  }
  return undefined;
}

/** Envuelve el elemento con <Gate {...gate}/> y soporta redirectToOnUnauthed */
function withGate(node: RouteLink, el: JSX.Element): JSX.Element {
  const g = toGateProps(node.gate);
  if (!g) return el;

  // Si pidió redirect cuando no hay sesión y requiereAuth, montamos fallback Navigate.
  const fallback =
    g.requireAuth && g.redirectToOnUnauthed
      ? <Navigate to={g.redirectToOnUnauthed} replace />
      : g.fallback;
  return (
    <Gate
      requireAuth={g.requireAuth}
      requireRole={g.requireRole}
      requireAllPerms={g.requireAllPerms}
      requireAnyPerms={g.requireAnyPerms}
      forbidPerms={g.forbidPerms}
      source={g.source}
      loadingFallback={g.loadingFallback}
      fallback={fallback}
    >
      {el}
    </Gate>
  );
}

function buildRoute(node: RouteLink): RouteObject {
  const children = (node.children ?? []).map(buildRoute);
  const hasChildren = children.length > 0;
  const el = node.componentKey ? getElementByKey(node.componentKey) : undefined;

  // Con Gate como único guard: si hay gate y hay element, lo envolvemos.
  if (el) {
    const wrapped = withGate(node, el);
    if (hasChildren) {
      return { path: node.path, element: wrapped, children };
    } else {
      if (!node.path || node.path === "") {
        return { index: true, element: wrapped };
      }
      return { path: node.path, element: wrapped };
    }
  }

  // Nodo contenedor (sin componentKey)
  return { path: node.path, element: <Outlet />, children: hasChildren ? children : undefined };
}

export function createAppRouter(links: RouteLink[]) {
  const tree = links.map(buildRoute);
  return createBrowserRouter(tree);
}
