import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth0 } from '@auth0/auth0-react';

const BASE =
  import.meta.env.VITE_BASE_URL ??
  (window as any).__ENV__?.API_URL ??
  'http://localhost:3003/api';

export type TopicAppearance = {
  background?: { type: 'color' | 'image'; color?: string; imageUrl?: string };
  overlay?: { blur?: number; brightness?: number };
};

async function getAppearance(token: string, topicId: string): Promise<TopicAppearance> {
  const { data } = await axios.get(`${BASE}/topics/${topicId}/appearance`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

async function patchAppearance(
  token: string,
  topicId: string,
  body: TopicAppearance
): Promise<TopicAppearance> {
  const { data } = await axios.patch(`${BASE}/topics/${topicId}/appearance`, body, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export function useTopicAppearance(topicId: string, opts?: { enabled?: boolean }) {
  const qc = useQueryClient();
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!isAuthenticated) return setToken(null);
      const t = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE ?? (window as any).__ENV__?.AUTH0_AUDIENCE },
      });
      setToken(t);
    })();
  }, [getAccessTokenSilently, isAuthenticated]);

  const appearance = useQuery({
    queryKey: ['topic-appearance', topicId, token],
    enabled: !!token && !!topicId && (opts?.enabled ?? true),
    queryFn: () => getAppearance(token!, topicId),
  });

  const saveAppearance = useMutation({
    mutationFn: (body: TopicAppearance) => patchAppearance(token!, topicId, body),
    onSuccess: (data) => {
      qc.setQueryData(['topic-appearance', topicId, token], data);
    },
  });

  return { appearance, saveAppearance };
}
