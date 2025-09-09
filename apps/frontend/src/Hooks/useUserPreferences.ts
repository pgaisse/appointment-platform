import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth0 } from '@auth0/auth0-react';

const API_URL =
  (window as any).__ENV__?.API_URL ??
  import.meta.env.VITE_BASE_URL ??
  'http://localhost:3003/api';

type Prefs = { theme: 'light' | 'dark' | 'system'; colorblindMode: boolean };

async function fetchPrefs(token: string): Promise<Prefs> {
  const { data } = await axios.get(`${API_URL}/users/me/preferences`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

async function updatePrefs(token: string, patch: Partial<Prefs>): Promise<Prefs> {
  const { data } = await axios.put(`${API_URL}/users/me/preferences`, patch, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export function useUserPreferences() {
  const qc = useQueryClient();
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => { (async () => {
    if (!isAuthenticated) return setToken(null);
    const t = await getAccessTokenSilently({
      authorizationParams: { audience: (window as any).__ENV__?.AUTH0_AUDIENCE ?? import.meta.env.VITE_AUTH0_AUDIENCE }
    });
    setToken(t);
  })(); }, [getAccessTokenSilently, isAuthenticated]);

  const prefs = useQuery<Prefs>({
    queryKey: ['user-prefs', token],
    enabled: !!token,
    queryFn: () => fetchPrefs(token!),
  });

  const save = useMutation({
    mutationFn: (patch: Partial<Prefs>) => updatePrefs(token!, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-prefs', token] }),
  });

  return { prefs, save, token };
}
