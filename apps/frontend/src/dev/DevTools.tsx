// apps/frontend/src/dev/DevTools.tsx
import {
  Box,
  Button,
  HStack,
  Text,
  VStack,
  useToast,
  Badge,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Select,
  Divider,
} from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

const SESSION_START_KEY = 'auth_session_start';

interface DevToolsProps {
  isDev?: boolean;
}

export default function DevTools({ isDev = true }: DevToolsProps) {
  const { isAuthenticated } = useAuth0();
  const toast = useToast();
  const [remaining, setRemaining] = useState<number | null>(null);
  const [customMinutes, setCustomMinutes] = useState<number>(5);
  const [timeUnit, setTimeUnit] = useState<'minutes' | 'hours'>('minutes');

  useEffect(() => {
    if (!isAuthenticated) return;

    const updateRemaining = () => {
      const start = localStorage.getItem(SESSION_START_KEY);
      if (!start) return;
      
      const startTime = parseInt(start, 10);
      const elapsed = Date.now() - startTime;
      const total = 10 * 60 * 60 * 1000; // 10 horas
      const left = Math.max(0, total - elapsed);
      setRemaining(left);
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // No mostrar en producción
  if (!isDev || !isAuthenticated) return null;

  const formatTime = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const expireImmediately = () => {
    // Simular que ya pasaron 10 horas + 1 segundo
    const expiredTime = Date.now() - (10 * 60 * 60 * 1000 + 1000);
    localStorage.setItem(SESSION_START_KEY, expiredTime.toString());
    
    toast({
      title: '⚡ Immediate Expiration',
      description: 'Session will expire in 1 second...',
      status: 'error',
      duration: 1500,
    });

    // El SessionTimeoutGuard detectará el cambio automáticamente en el próximo tick (1 segundo)
    // No necesitamos recargar la página
  };

  const expireInCustomTime = () => {
    const timeInMs = timeUnit === 'hours' 
      ? customMinutes * 60 * 60 * 1000 
      : customMinutes * 60 * 1000;
    
    const targetExpiration = 10 * 60 * 60 * 1000; // 10 horas total
    const timeToExpire = targetExpiration - timeInMs;
    
    // Establecer que ya pasó el tiempo necesario para que expire en X minutos/horas
    const adjustedTime = Date.now() - timeToExpire;
    localStorage.setItem(SESSION_START_KEY, adjustedTime.toString());
    
    const timeStr = timeUnit === 'hours' ? `${customMinutes}h` : `${customMinutes}m`;
    
    toast({
      title: `⏱️ Will Expire in ${timeStr}`,
      description: 'SessionTimeoutGuard will detect it automatically',
      status: 'warning',
      duration: 3000,
    });
  };

  const simulate5MinWarning = () => {
    // Simular que faltan 4 minutos
    const warningTime = Date.now() - (9 * 60 * 60 * 1000 + 56 * 60 * 1000);
    localStorage.setItem(SESSION_START_KEY, warningTime.toString());
    
    toast({
      title: '⚠️ 5-Minute Warning',
      description: 'You will see the warning in 1-2 seconds',
      status: 'info',
      duration: 2000,
    });
  };

  const resetSession = () => {
    localStorage.setItem(SESSION_START_KEY, Date.now().toString());
    toast({
      title: '🔄 Session Reset',
      description: 'Timer reset to 10 hours',
      status: 'success',
      duration: 2000,
    });
    setRemaining(10 * 60 * 60 * 1000);
  };

  return (
    <Box
      bg="blackAlpha.800"
      color="white"
      p={4}
      borderRadius="lg"
      boxShadow="2xl"
      maxW="400px"
      w="100%"
    >
      <VStack align="stretch" spacing={3}>
        <HStack justify="space-between">
          <Text fontWeight="bold" fontSize="sm">🛠️ Dev Tools - Session</Text>
          <Badge colorScheme="purple" variant="solid">DEV ONLY</Badge>
        </HStack>

        {remaining !== null && (
          <Box bg="whiteAlpha.200" p={2} borderRadius="md">
            <Text fontSize="xs" opacity={0.7} mb={1}>Time Remaining:</Text>
            <Text fontSize="lg" fontWeight="bold" fontFamily="mono">
              {formatTime(remaining)}
            </Text>
          </Box>
        )}

        <Divider />

        {/* Expiración Inmediata */}
        <Button
          size="sm"
          colorScheme="red"
          onClick={expireImmediately}
          leftIcon={<span>⚡</span>}
        >
          Expire Immediately
        </Button>

        <Divider />

        {/* Expiración Personalizada */}
        <Text fontSize="xs" fontWeight="bold" opacity={0.8}>
          Expire in specific time:
        </Text>
        
        <HStack spacing={2}>
          <NumberInput
            size="sm"
            value={customMinutes}
            onChange={(_, val) => setCustomMinutes(val)}
            min={1}
            max={timeUnit === 'hours' ? 10 : 600}
            flex={1}
          >
            <NumberInputField />
            <NumberInputStepper>
              <NumberIncrementStepper color="white" />
              <NumberDecrementStepper color="white" />
            </NumberInputStepper>
          </NumberInput>

          <Select
            size="sm"
            value={timeUnit}
            onChange={(e) => setTimeUnit(e.target.value as 'minutes' | 'hours')}
            w="110px"
          >
            <option value="minutes">Minutes</option>
            <option value="hours">Hours</option>
          </Select>
        </HStack>

        <Button
          size="sm"
          colorScheme="orange"
          onClick={expireInCustomTime}
          leftIcon={<span>⏱️</span>}
        >
          Apply Custom Time
        </Button>

        <Divider />

        {/* Acciones Rápidas */}
        <VStack spacing={2} align="stretch">
          <Button
            size="sm"
            colorScheme="yellow"
            onClick={simulate5MinWarning}
            leftIcon={<span>⚠️</span>}
          >
            5-Min Warning
          </Button>

          <Button
            size="sm"
            colorScheme="green"
            onClick={resetSession}
            leftIcon={<span>🔄</span>}
          >
            Reset Timer
          </Button>
        </VStack>

        <Text fontSize="xs" opacity={0.5} textAlign="center" mt={2}>
          Only visible in development mode
        </Text>
      </VStack>
    </Box>
  );
}
