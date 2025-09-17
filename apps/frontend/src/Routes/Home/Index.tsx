import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  Box, Center, Spinner, Alert, AlertIcon, AlertTitle, AlertDescription,
  VStack, HStack, Button
} from "@chakra-ui/react";
import MentionTextarea from "@/Components/Mentions/MentionTexTarea";

export default function MentionDemo() {
  const { isLoading, error, isAuthenticated, getAccessTokenSilently } = useAuth0();
  const [text, setText] = React.useState("");

  const getToken = React.useCallback(async () => {
    try {
      return await getAccessTokenSilently({
        authorizationParams: { audience: "https://api.dev.iconicsmiles" },
      });
    } catch {
      return null;
    }
  }, [getAccessTokenSilently]);

  if (isLoading) return <Center minH="100vh"><Spinner size="xl" /></Center>;
  if (error) {
    return (
      <Box p={10}>
        <Alert status="error">
          <AlertIcon /><AlertTitle>Auth error</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      </Box>
    );
  }
  if (!isAuthenticated) {
    return (
      <Box p={10}>
        <Alert status="warning">
          <AlertIcon /><AlertTitle>Not authenticated</AlertTitle>
          <AlertDescription>Sign in to test mentions.</AlertDescription>
        </Alert>
      </Box>
    );
  }
console.log("text",text)
  return (
    <>
      
    </>
  );
}
