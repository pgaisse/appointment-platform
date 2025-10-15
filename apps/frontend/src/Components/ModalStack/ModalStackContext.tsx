import React, {
  createContext, useCallback, useContext, useEffect, useId,
  useMemo, useRef, useState
} from "react";

type StackCtx = {
  register: (id: string) => number;
  unregister: (id: string) => void;
  topIndex: number;
  getIndex: (id: string) => number;
};

const ModalStackContext = createContext<StackCtx | null>(null);

export const ModalStackProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [stack, setStack] = useState<string[]>([]);
  const stackRef = useRef<string[]>([]);
  useEffect(() => { stackRef.current = stack; }, [stack]);

  const register = useCallback((id: string) => {
    const exists = stackRef.current.includes(id);
    if (exists) return stackRef.current.indexOf(id);
    const idx = stackRef.current.length;
    const next = [...stackRef.current, id];
    stackRef.current = next;
    setStack(next);
    return idx;
  }, []);

  const unregister = useCallback((id: string) => {
    if (!stackRef.current.includes(id)) return;
    const next = stackRef.current.filter(x => x !== id);
    stackRef.current = next;
    setStack(next);
  }, []);

  const getIndex = useCallback((id: string) => stackRef.current.indexOf(id), []);
  const topIndex = stack.length ? stack.length - 1 : -1;

  const value = useMemo(() => ({ register, unregister, topIndex, getIndex }), [register, unregister, topIndex, getIndex]);
  return <ModalStackContext.Provider value={value}>{children}</ModalStackContext.Provider>;
};

export function useModalIndex(isOpen: boolean, opts?: { id?: string }) {
  const ctx = useContext(ModalStackContext);
  if (!ctx) throw new Error("useModalIndex must be used within <ModalStackProvider>.");

  const autoId = useId();
  // id estable por defecto; si te pasan uno por props, puede cambiar y lo manejamos abajo
  const [modalIndex, setModalIndex] = useState<number>(-1);
  const idRef = useRef<string>(opts?.id ?? autoId);

  // si el `id` externo cambia con el modal abierto, re-registra
  useEffect(() => {
    if (!opts?.id || opts.id === idRef.current) return;
    // si estaba registrado con el anterior, lo quitamos
    const prev = idRef.current;
    const wasRegistered = ctx.getIndex(prev) !== -1;
    if (wasRegistered) ctx.unregister(prev);
    idRef.current = opts.id;
    if (isOpen) {
      const idx = ctx.register(idRef.current);
      setModalIndex(idx);
    } else {
      setModalIndex(-1);
    }
  }, [opts?.id, isOpen, ctx]);

  // registra / desregistra en función de isOpen
  useEffect(() => {
    if (!isOpen) {
      // asegúrate de dejarlo limpio si estaba registrado
      const idx = ctx.getIndex(idRef.current);
      if (idx !== -1) ctx.unregister(idRef.current);
      setModalIndex(-1);
      return;
    }
    const idx = ctx.register(idRef.current);
    setModalIndex(idx);
    return () => {
      ctx.unregister(idRef.current);
      setModalIndex(-1);
    };
  }, [isOpen, ctx]);

  return { modalIndex, topModalIndex: ctx.topIndex };
}
