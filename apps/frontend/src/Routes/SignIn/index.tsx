import { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  Box,
  Button,
  Container,
  Divider,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Icon,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  Link,
  Stack,
  Text,
  useColorModeValue,
  VStack,
  Spinner,
  FormErrorMessage,
  Alert,
  AlertIcon,
  AlertDescription,
  Checkbox,
} from "@chakra-ui/react";
import {
  FaEnvelope,
  FaLock,
  FaEye,
  FaEyeSlash,
} from "react-icons/fa";
import { useNavigate, useSearchParams, useOutletContext } from "react-router-dom";

const AUTH0_DOMAIN = import.meta.env.VITE_AUTH0_DOMAIN;
const AUTH0_CLIENT_ID = import.meta.env.VITE_AUTH0_CLIENT_ID;
const AUTH0_AUDIENCE = import.meta.env.VITE_AUTH0_AUDIENCE || "https://api.dev.iconicsmiles";

export default function Login() {
  const { isAuthenticated, isLoading, loginWithRedirect, loginWithPopup, getAccessTokenSilently } = useAuth0();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setHideNavigation } = useOutletContext<{ setHideNavigation: (hide: boolean) => void }>();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    // Ocultar header y sidebar en la página de login
    setHideNavigation(true);
    return () => {
      setHideNavigation(false);
    };
  }, [setHideNavigation]);

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    // Limpiar flag de reauth
    sessionStorage.removeItem("reauth_in_progress");
  }, []);

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Invalid email";
    }

    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSocialLogin = async (connection: string) => {
    try {
      setIsLoggingIn(true);
      setLoginError("");

      await loginWithPopup({
        authorizationParams: {
          connection,
          audience: AUTH0_AUDIENCE,
          scope: "openid profile email offline_access",
        },
      });

      // Obtener token para confirmar autenticación
      await getAccessTokenSilently({ authorizationParams: { audience: AUTH0_AUDIENCE } });

      navigate("/");
    } catch (error: any) {
      console.error("Error en social login:", error);
      setLoginError(error.message || "Error signing in with social provider");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleEmailPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setIsLoggingIn(true);
      setLoginError("");

      // Usar Universal Login con Auth0 (método seguro y recomendado)
      await loginWithRedirect({
        authorizationParams: {
          audience: AUTH0_AUDIENCE,
          scope: "openid profile email offline_access",
          screen_hint: "login", // Muestra pantalla de login directamente
          login_hint: email, // Pre-llena el email
          prompt: "login", // Fuerza autenticación
        },
        appState: { returnTo: "/" },
      });
    } catch (error: any) {
      console.error("Error en login:", error);
      const errorMessage = error.message || "Could not initiate login";
      setLoginError(errorMessage);
      setIsLoggingIn(false);
    }
  };

  if (isLoading || isLoggingIn) {
    return (
      <Flex minH="100vh" align="center" justify="center" bgGradient="linear(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)">
        <VStack spacing={4}>
          <Spinner size="xl" thickness="4px" color="white" />
          <Text fontSize="lg" color="white">
            Loading...
          </Text>
        </VStack>
      </Flex>
    );
  }

  return (
    <Flex
      minH="100vh"
      align="center"
      justify="center"
      bgGradient="linear(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)"
      position="relative"
      overflow="hidden"
    >
      {/* Elementos decorativos flotantes */}
      <Box
        position="absolute"
        top="10%"
        left="5%"
        w="60px"
        h="60px"
        borderRadius="full"
        bg="pink.300"
        opacity={0.6}
        animation="float 6s ease-in-out infinite"
      />
      <Box
        position="absolute"
        top="20%"
        right="10%"
        w="40px"
        h="40px"
        borderRadius="full"
        bg="blue.400"
        opacity={0.6}
        animation="float 8s ease-in-out infinite"
      />
      <Box
        position="absolute"
        bottom="15%"
        left="15%"
        w="50px"
        h="50px"
        borderRadius="full"
        bg="purple.300"
        opacity={0.6}
        animation="float 7s ease-in-out infinite"
      />
      <Box
        position="absolute"
        bottom="25%"
        right="5%"
        w="45px"
        h="45px"
        borderRadius="full"
        bg="pink.400"
        opacity={0.6}
        animation="float 9s ease-in-out infinite"
      />

      <Container maxW="6xl" px={4}>
        <Flex direction={{ base: "column", lg: "row" }} gap={8} align="center">
          {/* Lado izquierdo - Ilustración/Branding */}
          <Box
            flex="1"
            display={{ base: "none", lg: "block" }}
            textAlign="center"
          >
            <VStack spacing={6}>
              <Heading
                fontSize="5xl"
                color="white"
                fontWeight="bold"
                lineHeight="1.2"
              >
                The easiest way<br />
                <Text as="span" color="pink.300">to manage appointments</Text>.
              </Heading>
              <Text color="whiteAlpha.900" fontSize="lg">
                Schedule, reschedule and fill empty slots<br />
                in just a few clicks.
              </Text>

              {/* Ilustración del monitor con interfaz */}
              <Box
                position="relative"
                mt={8}
                w="full"
                maxW="500px"
              >
                <Box
                  bg="white"
                  borderRadius="2xl"
                  p={6}
                  boxShadow="2xl"
                  position="relative"
                >
                  {/* Simulación de interfaz */}
                  <VStack spacing={3} align="stretch">
                    <Flex gap={2}>
                      <Box w="12px" h="12px" borderRadius="full" bg="red.400" />
                      <Box w="12px" h="12px" borderRadius="full" bg="yellow.400" />
                      <Box w="12px" h="12px" borderRadius="full" bg="green.400" />
                    </Flex>
                    <Box bg="purple.100" h="40px" borderRadius="lg" />
                    <HStack>
                      <Box bg="blue.300" w="60px" h="60px" borderRadius="lg" />
                      <VStack flex="1" spacing={2}>
                        <Box bg="purple.200" h="20px" w="full" borderRadius="md" />
                        <Box bg="purple.200" h="20px" w="full" borderRadius="md" />
                      </VStack>
                    </HStack>
                    <Box bg="purple.400" h="35px" borderRadius="lg" />
                  </VStack>
                </Box>
              </Box>
            </VStack>
          </Box>

          {/* Lado derecho - Formulario */}
          <Box flex="1" maxW={{ base: "full", lg: "450px" }}>
            <Box
              bg="white"
              borderRadius="3xl"
              boxShadow="2xl"
              p={8}
              position="relative"
            >
              {/* Header del formulario */}
              <VStack spacing={1} align="stretch" mb={6}>
                <Heading size="xl" color="gray.800" fontWeight="bold">
                  Sign in Now
                </Heading>
                <Text color="gray.500" fontSize="sm">
                  Welcome back! Please login to your account.
                </Text>
              </VStack>

              <Stack spacing={5}>
                {/* Error Alert */}
                {loginError && (
                  <Alert status="error" borderRadius="lg" size="sm">
                    <AlertIcon />
                    <AlertDescription fontSize="sm">{loginError}</AlertDescription>
                  </Alert>
                )}



                {/* Email & Password Form */}
                <form onSubmit={handleEmailPasswordLogin}>
                  <Stack spacing={4}>
                    <FormControl isInvalid={!!errors.email}>
                      <FormLabel fontSize="xs" fontWeight="semibold" color="gray.600" mb={2}>
                        Username or Email
                      </FormLabel>
                      <InputGroup>
                        <InputLeftElement pointerEvents="none" color="gray.400">
                          <Icon as={FaEnvelope} />
                        </InputLeftElement>
                        <Input
                          type="email"
                          placeholder="name@email.com"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            setErrors({ ...errors, email: undefined });
                            setLoginError("");
                          }}
                          borderRadius="lg"
                          bg="gray.50"
                          border="none"
                          _focus={{ bg: "white", boxShadow: "0 0 0 1px #667eea" }}
                          isDisabled={isLoggingIn}
                          size="lg"
                        />
                      </InputGroup>
                      <FormErrorMessage fontSize="xs">{errors.email}</FormErrorMessage>
                    </FormControl>

                    <FormControl isInvalid={!!errors.password}>
                      <FormLabel fontSize="xs" fontWeight="semibold" color="gray.600" mb={2}>
                        Password
                      </FormLabel>
                      <InputGroup>
                        <InputLeftElement pointerEvents="none" color="gray.400">
                          <Icon as={FaLock} />
                        </InputLeftElement>
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            setErrors({ ...errors, password: undefined });
                            setLoginError("");
                          }}
                          borderRadius="lg"
                          bg="gray.50"
                          border="none"
                          _focus={{ bg: "white", boxShadow: "0 0 0 1px #667eea" }}
                          isDisabled={isLoggingIn}
                          size="lg"
                        />
                        <InputRightElement>
                          <IconButton
                            aria-label={showPassword ? "Hide password" : "Show password"}
                            icon={<Icon as={showPassword ? FaEyeSlash : FaEye} />}
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowPassword(!showPassword)}
                            isDisabled={isLoggingIn}
                          />
                        </InputRightElement>
                      </InputGroup>
                      <FormErrorMessage fontSize="xs">{errors.password}</FormErrorMessage>
                    </FormControl>

                    <HStack justify="space-between" fontSize="sm">
                      <Checkbox
                        isChecked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        colorScheme="purple"
                      >
                        <Text fontSize="xs" color="gray.600">Remember me</Text>
                      </Checkbox>
                      <Link
                        fontSize="xs"
                        color="purple.600"
                        fontWeight="medium"
                        _hover={{ textDecoration: "underline" }}
                      >
                        Forgot password?
                      </Link>
                    </HStack>

                    <Button
                      type="submit"
                      size="lg"
                      bgGradient="linear(to-r, purple.500, purple.600)"
                      color="white"
                      w="full"
                      fontWeight="bold"
                      isLoading={isLoggingIn}
                      loadingText="Signing in..."
                      _hover={{
                        bgGradient: "linear(to-r, purple.600, purple.700)",
                        transform: "translateY(-2px)",
                        boxShadow: "lg"
                      }}
                      _active={{
                        transform: "translateY(0)",
                      }}
                      transition="all 0.2s"
                      borderRadius="lg"
                      mt={2}
                    >
                      Sign In
                    </Button>
                  </Stack>
                </form>

                {/* Google Login */}
                <Box mt={6}>
                  <HStack mb={4}>
                    <Divider />
                    <Text fontSize="xs" color="gray.500" whiteSpace="nowrap">
                      Or continue with
                    </Text>
                    <Divider />
                  </HStack>

                  <Button
                    w="full"
                    variant="outline"
                    borderColor="gray.200"
                    onClick={() => handleSocialLogin("google-oauth2")}
                    isDisabled={isLoggingIn}
                    leftIcon={
                      <svg width="20" height="20" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                      </svg>
                    }
                    _hover={{ bg: "gray.50", borderColor: "gray.300" }}
                    size="lg"
                    borderRadius="lg"
                    fontWeight="medium"
                    color="gray.700"
                  >
                    Sign in with Google
                  </Button>
                </Box>
              </Stack>
            </Box>
          </Box>
        </Flex>
      </Container>

      <style>
        {`
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-20px); }
          }
        `}
      </style>
    </Flex>
  );
}
