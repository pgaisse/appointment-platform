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
import SessionTimeoutGuard from "./auth/SessionTimeoutGuard";
import { SessionValidator } from "./auth/SessionValidator";
import { useSocketInvalidate } from "./lib/useSocketInvalidate";

// Desactivar todos los console en producción
if (import.meta.env.PROD) {
  console.log = () => {};
  console.debug = () => {};
  console.info = () => {};
  console.warn = () => {};
  console.error = () => {};
}

// Global error handler para detectar errores de autenticación
const handleGlobalQueryError = (error: any) => {
  const status = error?.response?.status || error?.status || 0;
  
  // Si es 401 o 403, la sesión es inválida
  if (status === 401 || status === 403) {
    console.error('[QueryClient] Session invalid, redirecting to login...');
    
    // Prevenir loops de redirección
    if (sessionStorage.getItem('reauth_in_progress')) return;
    sessionStorage.setItem('reauth_in_progress', '1');
    
    // Limpiar estado
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem('reauth_in_progress', '1');
    
    // Redirigir al login
    const reason = status === 401 ? 'session_expired' : 'access_denied';
    window.location.href = `/login?reason=${encodeURIComponent(reason)}`;
  }
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount: number, error: any) => {
        const status = error?.response?.status || error?.status;
        
        // No reintentar errores de autenticación
        if (status === 401 || status === 403) {
          handleGlobalQueryError(error);
          return false;
        }
        
        if (status >= 500) return failureCount < 1; // solo 1 intento en 5xx
        if (status === 404) return false;           // no tiene sentido reintentar 404
        return failureCount < 2;                    // otros errores: máximo 2 intentos
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
    },
    mutations: {
      retry: (failureCount: number, error: any) => {
        const status = error?.response?.status || error?.status;
        
        // No reintentar errores de autenticación
        if (status === 401 || status === 403) {
          handleGlobalQueryError(error);
          return false;
        }
        
        // No reintentar mutaciones por defecto (son operaciones que cambian estado)
        return false;
      },
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

const isDev = import.meta.env.DEV;
const AppWrapper = isDev ? StrictMode : ({ children }: { children: React.ReactNode }) => <>{children}</>;

createRoot(document.getElementById("root")!).render(
  <AppWrapper>
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
          <SessionValidator />
          <AutoProvisionUser />
          <AuthAutoLogoutGuard />
          <SessionTimeoutGuard />
          <OrgGate>
            <SocketLayer />
            <RouterProvider router={router} />
          </OrgGate>
        </Auth0Provider>
      </QueryClientProvider>
    </ChakraProvider>
  </AppWrapper>
);
