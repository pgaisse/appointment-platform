// src/utils/phoneAU.ts
export function toE164AU(input: string) {
  const raw = String(input || "").replace(/[^\d+0-9]/g, "");
  if (/^\+61\d{9}$/.test(raw)) return raw;
  if (/^61\d{9}$/.test(raw)) return `+${raw}`;
  if (/^0\d{9}$/.test(raw)) return `+61${raw.slice(1)}`;
  throw new Error("Invalid AU phone");
}
