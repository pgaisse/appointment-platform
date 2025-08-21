import { useAuth0 } from "@auth0/auth0-react";
import { Alert, AlertDescription, AlertIcon, AlertTitle, Box, Spinner, Center } from '@chakra-ui/react';
import PremiumDentalLanding from "@/Components/CustomTemplates/PremiumDentalLanding";
import { CustomUser } from "@/types";
import React from "react";

const Index = () => {
  const { user, error, isLoading, isAuthenticated, getAccessTokenSilently } = useAuth0();
  const typedUser = user as CustomUser;
  const [token, setToken] = React.useState<string | null>(null);


  // 🚀 Pedir el access_token automáticamente al autenticar
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isAuthenticated) {
        try {
          const t = await getAccessTokenSilently({
            authorizationParams: {
              audience: "https://api.dev.iconicsmiles", // 👈 tu Audience de Auth0
            },
          });
          if (!cancelled) {
            setToken(t);
            console.log("✅ Access Token:", t);
          }
        } catch (e) {
          console.error("❌ Error getting access token", e);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, getAccessTokenSilently]);

  if (isLoading) {
    return (
      <Center minH="100vh">
        <Spinner size="xl" />
      </Center>
    );
  }

  if (error) {
    return (
      <Box p={10}>
        <Alert status="error">
          <AlertIcon />
          <AlertTitle>Something is wrong:</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      </Box>
    );
  }

  if (!isAuthenticated) {
    return (
      <Box p={10}>
        <Alert status="warning">
          <AlertIcon />
          <AlertTitle>Not authenticated cm</AlertTitle>
          <AlertDescription>Please sign in to continue.</AlertDescription>
        </Alert>
      </Box>
    );
  }

  return (
    <>
      <Box p={10}>
        {/* 👇 Aquí puedes mostrar el token, o usarlo para fetch */}
        <div>Logged in as:caja2</div>
        <div>Access Token: {token ? token.slice(0, 25) + "..." : "Loading..."}</div>
      </Box>
      <PremiumDentalLanding />
    </>
  );
};

export default Index;
