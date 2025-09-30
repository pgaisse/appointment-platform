// ======================
// File: apps/frontend/src/hooks/useMeta.ts
// ======================
import { useMemo } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type Priority = {
  _id?: string;
  org_id?: string;
  id: number;
  name: string;
  description: string;
  notes?: string;
  durationHours: number;
  color: string;
};

export type Treatment = {
    id:string;
  _id?: string;
  org_id?: string;
  name: string;
  duration: number; // minutes
  icon: string; // e.g., "fi:FiScissors"
  minIcon: string; // e.g., "md:MdContentCut"
  color: string;
  category?: string;
  active?: boolean;
};
const API = `${import.meta.env.VITE_BASE_URL}/priorities` || "/api/priorities";
const AUDIENCE = (window as any).__ENV__?.AUTH0_AUDIENCE || (import.meta as any).env?.VITE_AUTH0_AUDIENCE;

async function authedFetch(getToken: any, input: RequestInfo, init?: RequestInit) {
  const token = await getToken({ audience: AUDIENCE });
  const res = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return res.json();
}

export function useMeta() {
  const { getAccessTokenSilently } = useAuth0();
  const qc = useQueryClient();

  const prioritiesQ = useQuery<Priority[]>({
    queryKey: ["meta", "priorities"],
    queryFn: () => authedFetch(getAccessTokenSilently, `${API}/meta/priorities`),
  });

  const treatmentsQ = useQuery<Treatment[]>({
    queryKey: ["meta", "treatments"],
    queryFn: () => authedFetch(getAccessTokenSilently, `${API}/meta/treatments`),
  });

  const suggestedPriorityId = useMemo(() => {
    const ids = (prioritiesQ.data || []).map(p => p.id);
    return ids.length ? Math.max(...ids) + 1 : 1;
  }, [prioritiesQ.data]);

  // Priority mutations
  const createPriorityM = useMutation({
    mutationFn: (payload: Partial<Priority>) => authedFetch(getAccessTokenSilently, `${API}/meta/priorities`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meta", "priorities"] }),
  });

  const updatePriorityM = useMutation({
    mutationFn: ({ id, payload }: { id: string | number; payload: Partial<Priority> }) => authedFetch(getAccessTokenSilently, `${API}/meta/priorities/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meta", "priorities"] }),
  });

  const deletePriorityM = useMutation({
    mutationFn: ({ id }: { id: string | number }) => authedFetch(getAccessTokenSilently, `${API}/meta/priorities/${id}`, {
      method: "DELETE",
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meta", "priorities"] }),
  });

  // Treatment mutations
  const createTreatmentM = useMutation({
    mutationFn: (payload: Partial<Treatment>) => authedFetch(getAccessTokenSilently, `${API}/meta/treatments`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meta", "treatments"] }),
  });

  const updateTreatmentM = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Treatment> }) => authedFetch(getAccessTokenSilently, `${API}/meta/treatments/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
    onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["treatments"] })
        qc.invalidateQueries({ queryKey: ["meta", "treatments"] })},
  });

  const deleteTreatmentM = useMutation({
    mutationFn: ({ id }: { id: string }) => authedFetch(getAccessTokenSilently, `${API}/meta/treatments/${id}`, {
      method: "DELETE",
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meta", "treatments"] }),
  });

  return {
    priorities: prioritiesQ.data,
    treatments: treatmentsQ.data,
    isLoadingPriorities: prioritiesQ.isLoading,
    isLoadingTreatments: treatmentsQ.isLoading,
    suggestedPriorityId,

    createPriority: createPriorityM.mutateAsync,
    updatePriority: updatePriorityM.mutateAsync,
    deletePriority: deletePriorityM.mutateAsync,

    createTreatment: createTreatmentM.mutateAsync,
    updateTreatment: updateTreatmentM.mutateAsync,
    deleteTreatment: deleteTreatmentM.mutateAsync,
  };
}