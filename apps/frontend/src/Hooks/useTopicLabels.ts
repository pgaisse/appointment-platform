import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth0 } from '@auth0/auth0-react';
import type { LabelDef } from '@/types/kanban';

const BASE = (window as any).__ENV__?.API_URL ?? import.meta.env.VITE_BASE_URL ?? 'http://localhost:3003/api';
const AUD  = (window as any).__ENV__?.AUTH0_AUDIENCE ?? import.meta.env.VITE_AUTH0_AUDIENCE;

async function listLabelsReq(token: string, topicId: string): Promise<LabelDef[]> {
  const { data } = await axios.get(`${BASE}/topics/${topicId}/labels`, { headers: { Authorization: `Bearer ${token}` } });
  return data;
}
async function createLabelReq(token: string, topicId: string, body: Omit<LabelDef,'id'>) {
  const { data } = await axios.post(`${BASE}/topics/${topicId}/labels`, body, { headers: { Authorization: `Bearer ${token}` } });
  return data.label as LabelDef;
}
async function updateLabelReq(token: string, topicId: string, labelId: string, patch: Partial<Omit<LabelDef,'id'>>) {
  const { data } = await axios.patch(`${BASE}/topics/${topicId}/labels/${labelId}`, patch, { headers: { Authorization: `Bearer ${token}` } });
  return data.label as LabelDef;
}
async function deleteLabelReq(token: string, topicId: string, labelId: string) {
  const { data } = await axios.delete(`${BASE}/topics/${topicId}/labels/${labelId}`, { headers: { Authorization: `Bearer ${token}` } });
  return data;
}

export function useTopicLabels(topicId: string) {
  const qc = useQueryClient();
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => { (async () => {
    if (!isAuthenticated) return setToken(null);
    const t = await getAccessTokenSilently({ authorizationParams: { audience: AUD } });
    setToken(t);
  })(); }, [getAccessTokenSilently, isAuthenticated]);

  const labels = useQuery<LabelDef[]>({
    queryKey: ['topic-labels', topicId, token],
    enabled: !!token && !!topicId,
    queryFn: () => listLabelsReq(token!, topicId),
    placeholderData: [],
    refetchOnWindowFocus: false,
  });

  const createLabel = useMutation({
    mutationFn: (b: Omit<LabelDef,'id'>) => createLabelReq(token!, topicId, b),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['topic-labels', topicId, token] });
      qc.invalidateQueries({ queryKey: ['topic-board', topicId, token] });
    },
  });

  const updateLabel = useMutation({
    mutationFn: ({ labelId, patch }: { labelId: string; patch: Partial<Omit<LabelDef,'id'>> }) =>
      updateLabelReq(token!, topicId, labelId, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['topic-labels', topicId, token] });
      qc.invalidateQueries({ queryKey: ['topic-board', topicId, token] });
    },
  });

  const deleteLabel = useMutation({
    mutationFn: (labelId: string) => deleteLabelReq(token!, topicId, labelId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['topic-labels', topicId, token] });
      qc.invalidateQueries({ queryKey: ['topic-board', topicId, token] });
    },
  });

  return { labels, createLabel, updateLabel, deleteLabel, token };
}
