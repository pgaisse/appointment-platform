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
  VStack,
  HStack,
  Button,
  Text,
} from "@chakra-ui/react";
// (Opcional) PremiumDentalLanding si lo usas en esta pantalla
import PremiumDentalLanding from "@/Components/CustomTemplates/PremiumDentalLanding";
import { ExtractedMention, MentionItem } from "@/types";
import HashtagMentionInput from "@/Components/Hashtag/HashtagMentionInput";
import { extractMentions } from "@/utils/mentionToken";

// ⬇️ Ajusta esta ruta al lugar donde copiaste el componente

const Index = () => {
  const { error, isLoading, isAuthenticated, getAccessTokenSilently } = useAuth0();

  // Texto del composer + menciones detectadas
  const [text, setText] = React.useState("");
  const [mentions, setMentions] = React.useState<ExtractedMention[]>([]);

  // Para tus llamadas de API (usa tu convención de config)
  const API_BASE =
    (typeof window !== "undefined" && (window as any).__ENV__?.API_BASE) || "/api";

  // Conversation (ajústalo si lo pasas por props/router)
  const conversationId = "CH0656c4a8270e463ca1c8436bb917854e";

  // Cache en memoria para evitar refetch de la misma query
  const cacheRef = React.useRef(new Map<string, MentionItem[]>());

  // Mapea tu documento de la colección al formato MentionItem requerido
  const mapToMention = React.useCallback((p: any): MentionItem => {
    const display =
      p?.nameInput ??
      p?.name ??
      (`${p?.firstName ?? ""} ${p?.lastName ?? ""}`.trim() || p?._id);
    return {
      id: p?._id ?? p?.id,
      nameInput: display,
      type: "patient", // cambia si tu colección es otra cosa (e.g., "contact", "provider", etc.)
      avatarUrl: p?.avatar ?? p?.photoUrl,
      subtitle: p?.phone ?? p?.mobile ?? p?.email,
      ...p,
    };
  }, []);

  // Busca por nameInput en tu API protegida por Auth0 (debounced/cached desde el componente)
  const fetchByNameInput = React.useCallback(
    async (q: string): Promise<MentionItem[]> => {
      const key = q.trim();
      if (!key) return [];

      const token = await getAccessTokenSilently({
        authorizationParams: { audience: "https://api.dev.iconicsmiles" },
      });

      const res = await fetch(
        `${API_BASE}/appointments/mentions?nameInput=${encodeURIComponent(key)}&limit=8`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) return [];

      const data = await res.json();
      // Ya viene listo como MentionItem desde el backend:
      return (data?.items ?? []);
    },
    [API_BASE, getAccessTokenSilently]
  );

  // Enviar mensaje (ajusta el endpoint / payload si usas otro)
  const handleSend = React.useCallback(async () => {
    const body = text.trim();
    if (!body) return;

    try {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: "https://api.dev.iconicsmiles" },
      });

      // 🔧 Ajusta a tu endpoint real (por ejemplo: /messages/send o /sendMessage)
      const res = await fetch(`${API_BASE}/messages/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversationId,
          body, // ← incluye tokens de menciones: #[Display|type:id]
        }),
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }

      setText("");
      setMentions([]);
      console.log("✅ Sent:", { conversationId, body });
    } catch (e) {
      console.error("❌ Error sending message", e);
    }
  }, [API_BASE, conversationId, getAccessTokenSilently, text]);

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
