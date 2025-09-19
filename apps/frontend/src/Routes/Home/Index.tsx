// apps/frontend/src/Pages/Index.tsx
import React from "react";
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  Center,
  Code,
  Spinner,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { useAuth0 } from "@auth0/auth0-react";

/**
 * Lee config de runtime si existe (tu app usa window.__ENV__).
 * Asegúrate de inyectar __ENV__ en index.html o por script en producción.
 */
declare global {
  interface Window {
    __ENV__?: Record<string, string | undefined>;
  }
}
const API_BASE =
  (typeof window !== "undefined" && window.__ENV__?.API_BASE_URL) ||
  "/api"; // fallback a proxy /api (Vite/Nginx)

const AUDIENCE =
  (typeof window !== "undefined" && window.__ENV__?.AUTH0_AUDIENCE) ||
  "https://api.dev.iconicsmiles";

/**
 * Página principal protegida:
 * - Obtiene access_token con Auth0 (silent).
 * - Llama al backend GET {API_BASE}/secure/me para verificar JWT y sesión de DB.
 * - Muestra estados claros (loading, no auth, error, ok).
 */
const Index: React.FC = () => {
  const toast = useToast();
  const {
    isLoading: authLoading,
    isAuthenticated,
    error: authError,
    getAccessTokenSilently,
    loginWithRedirect,
    logout,
    user,
  } = useAuth0();

  const [token, setToken] = React.useState<string | null>(null);
  const [checking, setChecking] = React.useState(false);
  const [apiError, setApiError] = React.useState<string | null>(null);
  const [me, setMe] = React.useState<any>(null);

  // 1) Obtener token cuando haya sesión
  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!isAuthenticated) return;
      try {
        const t = await getAccessTokenSilently({
          authorizationParams: { audience: AUDIENCE },
        });
        if (!cancelled) setToken(t);
      } catch (e: any) {
        // Si el silent flow falla, forzamos login interactivo
        if (e?.error === "login_required" || e?.message?.includes("login_required")) {
          await loginWithRedirect({ authorizationParams: { audience: AUDIENCE } });
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
  }, [isAuthenticated, getAccessTokenSilently, loginWithRedirect, toast]);

  // 2) Chequear backend /secure/me cuando tenemos token
  const checkBackend = React.useCallback(async () => {
    if (!token) return;
    setChecking(true);
    setApiError(null);
    setMe(null);
    const url = `${import.meta.env.VITE_BASE_URL}/me`;
    try {
      console.log("URL",url)
      const res = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Backend ${res.status}: ${txt || res.statusText}`);
      }
      const json = await res.json();
      setMe(json);
    } catch (e: any) {
      setApiError(e?.message ?? "Unknown backend error");
    } finally {
      setChecking(false);
    }
  }, [token]);

  React.useEffect(() => {
    if (token) checkBackend();
  }, [token, checkBackend]);

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

  // C) No autenticado
  if (!isAuthenticated) {
    return (
      <Box p={10}>
        <Alert status="warning">
          <AlertIcon />
          <AlertTitle>Not authenticated</AlertTitle>
          <AlertDescription>Please sign in to continue.</AlertDescription>
        </Alert>
        <Button
          mt={4}
          colorScheme="blue"
          onClick={() => loginWithRedirect({ authorizationParams: { audience: AUDIENCE } })}
        >
          Sign in
        </Button>
      </Box>
    );
  }

  // D) Autenticado pero error en backend
  if (apiError) {
    return (
      <Box p={10}>
        <VStack align="stretch" spacing={4}>
          <Alert status="error">
            <AlertIcon />
            <Box>
              <AlertTitle>Backend check failed</AlertTitle>
              <AlertDescription>
                <Text>URL: {`${API_BASE}/secure/me`}</Text>
                <Text mt={2}>
                  {apiError.length > 600 ? `${apiError.slice(0, 600)}…` : apiError}
                </Text>
              </AlertDescription>
            </Box>
          </Alert>

          <Button
            colorScheme="blue"
            onClick={async () => {
              try {
                setApiError(null);
                const t = await getAccessTokenSilently({
                  authorizationParams: { audience: AUDIENCE },
                });
                setToken(t);
                await checkBackend();
              } catch (e: any) {
                setApiError(e?.message ?? "Failed to refresh token");
              }
            }}
            isLoading={checking}
          >
            Retry
          </Button>

          <Button
            variant="ghost"
            onClick={() =>
              logout({
                logoutParams: { returnTo: window.location.origin },
              })
            }
          >
            Sign out
          </Button>
        </VStack>
      </Box>
    );
  }

  // E) OK
  return (
    <></>
/*
    <Box p={10}>
      <VStack align="stretch" spacing={4}>
        <Alert status="success">
          <AlertIcon />
          <Box>
            <AlertTitle>Authenticated</AlertTitle>
            <AlertDescription>
              Welcome{user?.given_name ? `, ${user.given_name}` : ""}. Your token and backend are ok.
            </AlertDescription>
          </Box>
        </Alert>

        <Box>
          <Text fontWeight="semibold" mb={2}>
            API Base
          </Text>
          <Code display="block" p={2} whiteSpace="pre-wrap">
            {API_BASE}
          </Code>
        </Box>

        {me && (
          <Box>
            <Text fontWeight="semibold" mb={2}>
              /secure/me response
            </Text>
            <Code display="block" p={2} whiteSpace="pre-wrap">
              {JSON.stringify(me, null, 2)}
            </Code>
          </Box>
        )}

        <Box>
          <Button colorScheme="blue" onClick={checkBackend} isLoading={checking}>
            Re-check backend
          </Button>
          <Button
            ml={3}
            variant="ghost"
            onClick={() =>
              logout({
                logoutParams: { returnTo: window.location.origin },
              })
            }
          >
            Sign out
          </Button>
        </Box>
      </VStack>
    </Box>
*/
  );
  
};

export default Index;
