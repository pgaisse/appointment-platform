import { useState, useMemo } from "react";
import { Message } from "@/types";

export function useOptimisticMessages(messages: Message[]) {
  const [optimistic, setOptimistic] = useState<Message[]>([]);

  // 📌 Agregar mensaje optimista
  const addOptimistic = (msg: Message) => {
    setOptimistic((prev) => [...prev, msg]);
  };

  // 📌 Remover por sid (ej: si falla)
  const removeOptimistic = (sid: string) => {
    setOptimistic((prev) => prev.filter((m) => m.sid !== sid));
  };

  // 📌 Limpiar todos (ej: después de un refetch con datos reales)
  const clearOptimistic = () => setOptimistic([]);

  // 📌 Fusiona optimistas + reales, ordenados por index
  const combined = useMemo(() => {
    return [...messages, ...optimistic].sort(
      (a, b) => Number(a.index) - Number(b.index)
    );
  }, [messages, optimistic]);

  return {
    messages: combined,
    addOptimistic,
    removeOptimistic,
    clearOptimistic,
  };
}
