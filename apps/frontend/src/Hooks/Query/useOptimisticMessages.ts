import { useState, useMemo } from "react";
import { Message } from "@/types";

export function useOptimisticMessages(messages: Message[]) {
  const [optimistic, setOptimistic] = useState<Message[]>([]);

  // Agregar mensaje optimista
  const addOptimistic = (msg: Message) => {
    setOptimistic((prev) => [...prev, msg]);
  };

  // Remover por sid (ej: si falla)
  const removeOptimistic = (sid: string) => {
    setOptimistic((prev) => prev.filter((m) => m.sid !== sid));
  };

  // Actualizar un optimista (ej: reemplazar temp sid por real sid)
  const updateOptimistic = (tempSid: string, patch: Partial<Message>) => {
    setOptimistic((prev) => prev.map((m) => (m.sid === tempSid ? { ...m, ...patch } : m)));
  };

  // Limpiar todos
  const clearOptimistic = () => setOptimistic([]);

  // Fusionar evitando duplicados:
  //  - Si un optimista tiene misma sid que uno real, se descarta el optimista
  //  - Si coincide por autor+body+direction y está en pending y hay real ya enviado (sent/delivered/read)
  //    dentro de una ventana de tiempo cercana (<5s), se descarta el optimista
  const combined = useMemo(() => {
    const bySid: Map<string, Message> = new Map();
    for (const m of messages) {
      bySid.set(m.sid, m);
    }

    const WINDOW_MS = 5000;
    const realCandidates = messages.filter((m) => m.direction === "outbound");

    for (const om of optimistic) {
      // Skip if real already exists with same sid
      if (bySid.has(om.sid)) continue;

      // Attempt heuristic match
      const createdAtOm = new Date(om.createdAt).getTime();
      const match = realCandidates.find((rm) => {
        if (rm.status === "pending") return false; // need a progressed status
        if (rm.author !== om.author) return false;
        if ((rm.body || "") !== (om.body || "")) return false;
        if (rm.direction !== om.direction) return false;
        if ((rm.media?.length || 0) !== (om.media?.length || 0)) return false;
        const dt = Math.abs(new Date(rm.createdAt).getTime() - createdAtOm);
        return dt < WINDOW_MS;
      });
      if (match) continue; // drop optimistic duplicate
      bySid.set(om.sid, om);
    }

    return Array.from(bySid.values()).sort((a, b) => Number(a.index) - Number(b.index));
  }, [messages, optimistic]);

  return {
    messages: combined,
    addOptimistic,
    removeOptimistic,
    updateOptimistic,
    clearOptimistic,
  };
}
