import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth0 } from '@auth0/auth0-react';
import type { Topic } from '@/types/kanban';

const BASE = import.meta.env.VITE_BASE_URL ?? 'http://localhost:3003/api';

async function listTopicsReq(token: string): Promise<Topic[]> {
  const { data } = await axios.get(`${BASE}/topics`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}
async function createTopicReq(token: string, body: { title: string; key?: string }) {
  const { data } = await axios.post(`${BASE}/topics`, body, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data.topic as Topic;
}

export function useTopics() {
  const qc = useQueryClient();
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!isAuthenticated) return setToken(null);
      const t = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });
      setToken(t);
    })();
  }, [getAccessTokenSilently, isAuthenticated]);

  const topics = useQuery<Topic[]>({
    queryKey: ['topics', token],
    enabled: !!token,
    queryFn: () => listTopicsReq(token!),
    placeholderData: [],
  });

  const createTopic = useMutation({
    mutationFn: (b: { title: string; key?: string }) => createTopicReq(token!, b),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['topics', token] }),
  });

  return { topics, createTopic, token };
}
