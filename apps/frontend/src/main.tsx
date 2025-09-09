// frontend/src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ChakraProvider } from "@chakra-ui/react";
import router from "./Routes";
import { RouterProvider } from "react-router-dom";
import { Auth0Provider } from "@auth0/auth0-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import theme from "./Components/Constants/Constants";
import DevExposeAuth from "./DevExposeAuth";
import OrgGate from "./org/OrgGate";
import AutoProvisionUser from "./Boot/AutoProvisionUser";

const queryClient = new QueryClient();

// Lee primero window.__ENV__ (si existe) y cae a import.meta.env
const WENV = (window as any).__ENV__ || {};
const cfg = {
  domain: WENV.AUTH0_DOMAIN ?? import.meta.env.VITE_AUTH0_DOMAIN,
  clientId: WENV.AUTH0_CLIENT_ID ?? import.meta.env.VITE_AUTH0_CLIENT_ID,
  audience: WENV.AUTH0_AUDIENCE ?? import.meta.env.VITE_AUTH0_AUDIENCE,
  orgId: WENV.AUTH0_ORG_ID ?? import.meta.env.VITE_AUTH0_ORG_ID, // opcional
};

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
          <DevExposeAuth />
          <OrgGate>
            <RouterProvider router={router} />
          </OrgGate>
        </Auth0Provider>
      </QueryClientProvider>
    </ChakraProvider>
  </StrictMode>
);
