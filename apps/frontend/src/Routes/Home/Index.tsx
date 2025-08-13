import { useAuth0 } from "@auth0/auth0-react";
import { Alert, AlertDescription, AlertIcon, AlertTitle, Box, Spinner, Center } from '@chakra-ui/react';
import CustomHero from '@/Components/CustomTemplates/CustomHero';
import PremiumDentalLanding from "@/Components/CustomTemplates/PremiumDentalLanding";
import { CustomUser } from "@/types";

const Index = () => {
  const { user, error, isLoading, isAuthenticated } = useAuth0();
  const typedUser = user as CustomUser;
  const imageUrl = `${window.location.origin}/img/logo.png`;

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
        <Alert status='error'>
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
        <Alert status='warning'>
          <AlertIcon />
          <AlertTitle>Not authenticated</AlertTitle>
          <AlertDescription>Please sign in to continue.</AlertDescription>
        </Alert>
      </Box>
    );
  }

  return (
    <>
      <Box p={10}>
        {/* Aquí puedes mostrar información del usuario si lo deseas */}
      </Box>
      <PremiumDentalLanding />
      {/* <CustomHero /> */}
    </>
  );
};

export default Index;
