// auth/SessionValidator.tsx
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Componente que valida la sesión y redirige al login si detecta errores de autenticación
 * Se monta en el árbol principal de la aplicación
 */
export function SessionValidator() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Listener global para errores de queries
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'observerResultsUpdated') {
        const query = event.query;
        const state = query.state;

        if (state.status === 'error' && state.error) {
          const error = state.error as any;
          const status = error?.status || error?.response?.status || 0;

          // Si es 401 o 403, la sesión es inválida
          if (status === 401 || status === 403) {
            console.error('[SessionValidator] Detected auth error, redirecting to login...');
            
            // Prevenir loops de redirección
            if (sessionStorage.getItem('reauth_in_progress')) return;
            sessionStorage.setItem('reauth_in_progress', '1');
            
            // Limpiar estado
            localStorage.clear();
            sessionStorage.clear();
            sessionStorage.setItem('reauth_in_progress', '1');
            
            // Redirigir al login
            const reason = status === 401 ? 'session_expired' : 'access_denied';
            window.location.href = `/login?reason=${encodeURIComponent(reason)}`;
          }
        }
      }
    });

    // Cleanup
    return () => unsubscribe();
  }, [queryClient]);

  return null; // No renderiza nada
}
