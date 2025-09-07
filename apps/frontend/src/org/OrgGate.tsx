import { useAuth0 } from "@auth0/auth0-react";
import { Center, Spinner } from "@chakra-ui/react";
import React from "react";
import { detectOrgSlug, resolveOrgId, useOrgAuth } from "./authOrg";

export default function OrgGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth0();
  const { loginForOrg, getTokenForOrg } = useOrgAuth();
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      // Espera a que Auth0 esté listo
      if (isLoading) return;

      // 1) Detecta la org de la URL
      const slug = detectOrgSlug(); // "acme" o "org_XXXX"
      if (!slug) {
        // Si tu app necesita org siempre, podrías redirigir a una pantalla de selección.
        setReady(true);
        return;
      }
      const orgId = await resolveOrgId(slug).catch(() => null);
      if (!orgId) {
        setReady(true);
        return;
      }

      try {
        // 2) Intenta obtener token silencioso para esa org (si ya hay sesión para esa org)
        await getTokenForOrg(orgId);
        setReady(true);
      } catch {
        // 3) Si no hay sesión para esa org, inicia login para esa org
        await loginForOrg(orgId);
        // no continúa: redirige al login y volverá
      }
    })();
  }, [isLoading, isAuthenticated, loginForOrg, getTokenForOrg]);

  if (!ready) {
    return (
      <Center h="100vh">
        <Spinner size="lg" />
      </Center>
    );
  }
  return <>{children}</>;
}
