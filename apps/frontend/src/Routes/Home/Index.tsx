// apps/frontend/src/Pages/Index.tsx
import React from "react";
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Center,
  Spinner,
  useToast,
} from "@chakra-ui/react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";
import Dashboard from "./Dashboard";
import DevTools from "@/dev/DevTools";

/**
 * Lee config de runtime si existe (tu app usa window.__ENV__).
 * Asegúrate de inyectar __ENV__ en index.html o por script en producción.
 */
declare global {
  interface Window {
    __ENV__?: Record<string, string | undefined>;
  }
}

const AUDIENCE =
  (typeof window !== "undefined" && window.__ENV__?.AUTH0_AUDIENCE) ||
  "https://api.dev.iconicsmiles";

/**
 * Página principal protegida:
 * - Muestra el Dashboard cuando está autenticado
 * - Gestiona estados de carga y error
 */
const Index: React.FC = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const {
    isLoading: authLoading,
    isAuthenticated,
    error: authError,
    getAccessTokenSilently,
  } = useAuth0();

  const [tokenReady, setTokenReady] = React.useState(false);

  // 1) Obtener token cuando haya sesión
  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!isAuthenticated) return;
      try {
        await getAccessTokenSilently({
          authorizationParams: { audience: AUDIENCE },
        });
        if (!cancelled) setTokenReady(true);
      } catch (e: any) {
        // Si el silent flow falla, redirigimos al login
        if (e?.error === "login_required" || e?.message?.includes("login_required")) {
          navigate("/login");
          return;
        }
        console.error("Error getting access token:", e);
        if (!cancelled) {
          toast({
            title: "Token error",
            description: e?.message ?? "Failed to get token",
            status: "error",
            duration: 4000,
            isClosable: true,
          });
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, getAccessTokenSilently, navigate, toast]);

  // --- Renders ---

  // A) Cargando Auth0
  if (authLoading) {
    return (
      <Center minH="100vh">
        <Spinner size="xl" />
      </Center>
    );
  }

  // B) Error en Auth0
  if (authError) {
    return (
      <Box p={10}>
        <Alert status="error">
          <AlertIcon />
          <AlertTitle>Auth error</AlertTitle>
          <AlertDescription>{authError.message}</AlertDescription>
        </Alert>
      </Box>
    );
  }

  // C) No autenticado - Redirigir al login personalizado
  React.useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/login");
    }
  }, [authLoading, isAuthenticated, navigate]);

  if (!isAuthenticated) {
    return (
      <Center minH="100vh">
        <Spinner size="xl" />
      </Center>
    );
  }

  // D) Autenticado - Mostrar Dashboard
  if (!tokenReady) {
    return (
      <Center minH="100vh">
        <Spinner size="xl" />
      </Center>
    );
  }

  const isDev = import.meta.env.DEV;

  return (
    <Box position="relative">
      <Dashboard />
      {/* DevTools solo en desarrollo */}
      {isDev && (
        <Box position="fixed" bottom={4} right={4} zIndex={9999}>
          <DevTools isDev={isDev} />
        </Box>
      )}
    </Box>
  );
};

export default Index;
