export function compactObject<T extends Record<string, any>>(obj: T) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => {
      if (v == null) return false;                          // null / undefined
      if (typeof v === "string") return v.trim().length > 0; // "" -> fuera
      if (Array.isArray(v)) return v.length > 0;             // [] -> fuera
      if (v instanceof Date) return true;                    // Date -> mantener
      if (typeof v === "object") return Object.keys(v).length > 0; // {} -> fuera
      return true;                                           // números, booleanos, etc.
    })
  ) as Partial<T>;
}