export function isAUComplete(raw?: string) {
  if (!raw) return false;
  const s = String(raw).replace(/\s+/g, "");
  return /^04\d{8}$/.test(s) || /^\+61\d{9}$/.test(s) || /^61\d{9}$/.test(s);
}
