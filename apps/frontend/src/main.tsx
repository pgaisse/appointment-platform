import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ChakraProvider } from "@chakra-ui/react";
import router from "./Routes";
import { RouterProvider } from "react-router-dom";
import { Auth0Provider } from "@auth0/auth0-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import theme from "./Components/Constants/Constants";

const env = (window as any).__ENV__;
const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ChakraProvider theme={theme}>
      <QueryClientProvider client={queryClient}>
        <Auth0Provider
          domain={env.AUTH0_DOMAIN}
          clientId={env.AUTH0_CLIENT_ID}
          authorizationParams={{
            redirect_uri: window.location.origin,
            audience: env.AUTH0_AUDIENCE,
            scope: "openid profile email offline_access",
          }}
          cacheLocation="localstorage"
          useRefreshTokens={true}
          useRefreshTokensFallback={true}
        >
          <RouterProvider router={router} />
        </Auth0Provider>
      </QueryClientProvider>
    </ChakraProvider>
  </StrictMode>
);
