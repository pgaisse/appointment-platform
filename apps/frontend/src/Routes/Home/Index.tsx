// src/Pages/Index.tsx
import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Spinner,
  Center,
} from "@chakra-ui/react";
// (Opcional) PremiumDentalLanding si lo usas en esta pantalla
import { ExtractedMention } from "@/types";

// ⬇️ Ajusta esta ruta al lugar donde copiaste el componente

const Index = () => {
  const { error, isLoading, isAuthenticated } = useAuth0();

  // Texto del composer + menciones detectadas
  const [] = React.useState("");
  const [] = React.useState<ExtractedMention[]>([]);

  // Para tus llamadas de API (usa tu convención de config)

  // Conversation (ajústalo si lo pasas por props/router)

  // Cache en memoria para evitar refetch de la misma query

  // Mapea tu documento de la colección al formato MentionItem requerido

  // Busca por nameInput en tu API protegida por Auth0 (debounced/cached desde el componente)

  // Enviar mensaje (ajusta el endpoint / payload si usas otro)

  // --------- Estados de Auth0 ---------
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
          <AlertTitle>Not authenticated</AlertTitle>
          <AlertDescription>Please sign in to continue.</AlertDescription>
        </Alert>
      </Box>
    );
  }

  // --------- UI ---------
  return (
    <>
      
    </>
  );
};

export default Index;
