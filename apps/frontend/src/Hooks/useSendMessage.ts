import { useCallback } from 'react';

export type UseSendMessageOpts = {
  socket?: { emit: (event: string, data: any) => void } | null;
  endpointUrl?: string;
  getToken?: () => Promise<string | null>;
};

export function useSendMessage({ socket, endpointUrl = '/sendMessage', getToken }: UseSendMessageOpts) {
  const send = useCallback(
    async (payload: import('@/Components/Chat/min').MessagePayload) => {
      if (socket) {
        socket.emit('smsSend', payload);
        return;
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (getToken) {
        const t = await getToken();
        if (t) headers['Authorization'] = `Bearer ${t}`;
      }
      const res = await fetch(endpointUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`sendMessage failed: ${res.status} ${text}`);
      }
    },
    [socket, endpointUrl, getToken]
  );

  return { send };
}
