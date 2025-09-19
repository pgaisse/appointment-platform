// apps/frontend/src/lib/useSocketInvalidate.ts
import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '@/Hooks/Query/useSocket';

type WireKey = Array<string | number>;
type Payload = { keys: WireKey[]; exact?: boolean };

const debounce = <T extends (...a: any[]) => void>(fn: T, ms = 60) => {
  let t: any;
  return (...a: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
};

export function useSocketInvalidate() {
  const { socket, connected } = useSocket();
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (!socket || !connected) return;

    const flush = debounce((keys: WireKey[], exact?: boolean) => {
      keys.forEach((k) => {
        // k debe ser algo como ['topic-board', topicId] o ['card', cardId]
        queryClient.invalidateQueries({ queryKey: k as any, exact: !!exact });
      });
    }, 60);

    const onInvalidate = (p: Payload) => {
      if (!p?.keys?.length) return;
      flush(p.keys, p.exact);
    };
    console.log("Debug: Subscribing to rq.invalidate");
    socket.on('rq.invalidate', onInvalidate);
    return () => {
      socket.off('rq.invalidate', onInvalidate);
    };
  }, [socket, connected, queryClient]);
}
