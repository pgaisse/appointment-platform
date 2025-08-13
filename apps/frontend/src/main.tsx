import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ChakraProvider } from "@chakra-ui/react";
import router from "./Routes";
import { RouterProvider } from "react-router-dom";
import { Auth0Provider } from "@auth0/auth0-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import theme from "./Components/Constants/Constants";

const queryClient = new QueryClient();
createRoot(document.getElementById("root")!).render(
  <StrictMode>

    <ChakraProvider theme={theme}>
      <QueryClientProvider client={queryClient}>

        <Auth0Provider
          domain={import.meta.env.VITE_AUTH0_DOMAIN}
          clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
          authorizationParams={{
            redirect_uri: window.location.origin,
            audience: import.meta.env.VITE_AUTH0_AUDIENCE,
            // para refresh tokens (ver punto 2), añade también scope:
            scope: 'openid profile email offline_access'
          }}
          cacheLocation="localstorage"       // <— persiste sesión tras refresh
          useRefreshTokens={true}            // <— usa refresh tokens
          useRefreshTokensFallback={true}    // opcional, por si falla la rotación
        >

          <RouterProvider router={router} />
        </Auth0Provider>
      </QueryClientProvider>
    </ChakraProvider>

  </StrictMode>
);
