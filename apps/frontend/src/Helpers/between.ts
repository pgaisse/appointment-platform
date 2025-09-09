// Crea una clave ordenable entre a y b (compat con backend).
export function between(a?: string | null, b?: string | null): string {
  const toNum = (s?: string | null) => (s == null ? null : parseInt(String(s), 10));
  const pad = (n: number) => String(n);
  if (a == null && b == null) return '10';
  const na = toNum(a);
  const nb = toNum(b);
  if (na != null && nb != null) {
    if (nb - na > 1) return pad(na + Math.floor((nb - na) / 2));
    return pad(na + 1);
  }
  if (na != null && nb == null) return pad(na + 10);
  if (na == null && nb != null) return pad(Math.max(0, (nb as number) - 5));
  return '10';
}
