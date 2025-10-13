import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";

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
  const id = opts?.id ?? autoId;
  const [modalIndex, setModalIndex] = useState<number>(() => (isOpen ? ctx.register(id) : -1));

  useEffect(() => {
    if (isOpen) {
      const idx = ctx.register(id);
      setModalIndex(idx);
      return () => {
        ctx.unregister(id);
        setModalIndex(-1);
      };
    } else {
      if (ctx.getIndex(id) !== -1) {
        ctx.unregister(id);
        setModalIndex(-1);
      }
    }
  }, [isOpen, id]); // eslint-disable-line react-hooks/exhaustive-deps

  return { modalIndex, topModalIndex: ctx.topIndex };
}
