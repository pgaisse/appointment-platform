// src/Hooks/useAppointmentsExist.ts
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth0 } from '@auth0/auth0-react';
import { useEffect, useMemo, useState } from 'react';

const BASE = import.meta.env.VITE_BASE_URL ?? '/api';
const OID_RE = /^[0-9a-fA-F]{24}$/;

function uniqValid(ids: string[]) {
  const set = new Set<string>();
  for (const id of ids) {
    const v = String(id || '').trim();
    if (v && OID_RE.test(v)) set.add(v);
  }
  return Array.from(set);
}

async function postExists(token: string, ids: string[]) {
  const url = `${BASE}/appointments/exists`;
  const { data } = await axios.post(
    url,
    { ids },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return (data?.exists ?? {}) as Record<string, boolean>;
}

/**
 * Devuelve un mapa { [id]: boolean } indicando si existe ese Appointment en BD.
 * - Autenticado con Auth0 (audience de VITE_AUTH0_AUDIENCE)
 * - Lote único por render (sin N requests)
 * - Mantiene resultado previo mientras llega el nuevo (placeholderData)
 */
export function useAppointmentsExist(rawIds: string[]) {
  const cleaned = useMemo(() => uniqValid(rawIds), [rawIds]);
  const keyPart = cleaned.length ? cleaned.slice().sort().join(',') : 'none';

  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!isAuthenticated) { setToken(null); return; }
      try {
        const t = await getAccessTokenSilently({
          authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
        });
        if (mounted) setToken(t);
      } catch {
        if (mounted) setToken(null);
      }
    })();
    return () => { mounted = false; };
  }, [getAccessTokenSilently, isAuthenticated]);

  return useQuery<Record<string, boolean>>({
    queryKey: ['appt-exists', keyPart, !!token],
    enabled: !!token && cleaned.length > 0,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
    placeholderData: (prev) => prev ?? {},
    queryFn: async () => postExists(token!, cleaned),
  });
}
