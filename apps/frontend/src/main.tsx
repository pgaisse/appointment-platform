// frontend/src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ChakraProvider } from "@chakra-ui/react";
import router from "./Routes";
import { RouterProvider } from "react-router-dom";
import { Auth0Provider } from "@auth0/auth0-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import theme from "./Components/Constants/Constants";
import OrgGate from "./org/OrgGate";
import AutoProvisionUser from "./Boot/AutoProvisionUser";
import AuthAutoLogoutGuard from "./auth/AuthAutoLogoutGuard";
import { useSocketInvalidate } from "./lib/useSocketInvalidate";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount: number, error: any) => {
        const status = error?.response?.status || error?.status;
        if (status >= 500) return failureCount < 1; // solo 1 intento en 5xx
        if (status === 404) return false;           // no tiene sentido reintentar 404
        return failureCount < 2;                    // otros errores: máximo 2 intentos
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      staleTime: 30_000,
      cacheTime: 5 * 60_000,
    },
  },
});

// Lee primero window.__ENV__ (si existe) y cae a import.meta.env
const WENV = (window as any).__ENV__ || {};
const cfg = {
  domain: WENV.AUTH0_DOMAIN ?? import.meta.env.VITE_AUTH0_DOMAIN,
  clientId: WENV.AUTH0_CLIENT_ID ?? import.meta.env.VITE_AUTH0_CLIENT_ID,
  audience: WENV.AUTH0_AUDIENCE ?? import.meta.env.VITE_AUTH0_AUDIENCE,
  orgId: WENV.AUTH0_ORG_ID ?? import.meta.env.VITE_AUTH0_ORG_ID, // opcional
};
function SocketLayer() {
  // 👇 solo usarlo una vez en el árbol
  useSocketInvalidate();
  return null; // no renderiza nada
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ChakraProvider theme={theme}>
      <QueryClientProvider client={queryClient}>
        <Auth0Provider
          domain={cfg.domain}
          clientId={cfg.clientId}
          authorizationParams={{
            redirect_uri: window.location.origin,
            audience: cfg.audience,
            scope: "openid profile email offline_access",
            ...(cfg.orgId ? { organization: cfg.orgId } : {}),
          }}
          // Recomendado por seguridad:
          cacheLocation="localstorage"
          useRefreshTokens={true}
        /**
         * Si realmente necesitas persistir sesión entre recargas y múltiples pestañas,
         * puedes usar localstorage, pero es menos seguro frente a XSS:
         * cacheLocation="localstorage"
         */
        >
          <AutoProvisionUser />
           <AuthAutoLogoutGuard />
          <OrgGate>
            <SocketLayer />
            <RouterProvider router={router} />
          </OrgGate>
        </Auth0Provider>
      </QueryClientProvider>
    </ChakraProvider>
  </StrictMode>
);
