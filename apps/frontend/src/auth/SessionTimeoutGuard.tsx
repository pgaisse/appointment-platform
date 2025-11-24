import { useEffect, useRef, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useToast } from '@chakra-ui/react';
import { useForceReauth } from './useForceReauth';

const SESSION_DURATION_MS = 10 * 60 * 60 * 1000; // 10 horas
const WARNING_BEFORE_MS = 5 * 60 * 1000; // Avisar 5 minutos antes
const SESSION_START_KEY = 'auth_session_start';
const CHECK_INTERVAL_MS = 1000; // Verificar cada segundo

export default function SessionTimeoutGuard() {
  const { isAuthenticated } = useAuth0();
  const forceReauth = useForceReauth();
  const toast = useToast();
  const warningShownRef = useRef(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) {
      // Limpiar datos de sesión al desautenticarse
      localStorage.removeItem(SESSION_START_KEY);
      warningShownRef.current = false;
      return;
    }

    // Obtener o crear timestamp de inicio de sesión
    let sessionStart = localStorage.getItem(SESSION_START_KEY);
    if (!sessionStart) {
      sessionStart = Date.now().toString();
      localStorage.setItem(SESSION_START_KEY, sessionStart);
    }

    // Verificar sesión continuamente
    const checkSession = () => {
      const start = localStorage.getItem(SESSION_START_KEY);
      if (!start) return;

      const startTime = parseInt(start, 10);
      const now = Date.now();
      const elapsed = now - startTime;
      const remaining = SESSION_DURATION_MS - elapsed;

      // Si ya pasaron 10 horas, cerrar sesión inmediatamente
      if (remaining <= 0) {
        console.warn('[SessionTimeout] Session expired immediately');
        toast({
          title: 'Session Expired',
          description: 'Your session has expired. Please sign in again.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        localStorage.removeItem(SESSION_START_KEY);
        forceReauth({ reason: 'session_timeout' });
        return;
      }

      // Mostrar advertencia si faltan 5 minutos o menos
      if (remaining <= WARNING_BEFORE_MS && !warningShownRef.current) {
        warningShownRef.current = true;
        const minutesLeft = Math.ceil(remaining / 60000);
        toast({
          title: 'Session Expiring Soon',
          description: `Your session will expire in ${minutesLeft} minute(s). Please save your work.`,
          status: 'warning',
          duration: 10000,
          isClosable: true,
        });
      }

      // Forzar re-render para actualizar UI
      setTick(t => t + 1);
    };

    // Verificación inicial
    checkSession();

    // Verificar cada segundo
    const interval = setInterval(checkSession, CHECK_INTERVAL_MS);

    // Cleanup
    return () => {
      clearInterval(interval);
    };
  }, [isAuthenticated, forceReauth, toast]);

  return null;
}
