// utils/extractNameFromTag.ts

/**
 * Extrae el nombre de un tag tipo #[Nombre|tipo:id] dentro de un string.
 * Ej.: "#[Claudia|appointment:6879...]" → "Claudia"
 *
 * - Tolera espacios extra.
 * - No requiere el '#' (lo acepta si está).
 * - Si no encuentra un tag válido, retorna fallback ('' por defecto) o null si lo configuras.
 */
export function extractNameFromTag(
  input: unknown,
  options?: { fallback?: string | null }
): string | null {
  const fallback = options?.fallback ?? '';
  if (typeof input !== 'string') return fallback;

  // Coincide con: #[   Nombre   | cualquierClave:cualquierValor ]
  // Captura solo "Nombre" (sin el '|', ']' ni espacios extra).
  const TAG_REGEX = /#?\[\s*([^|\]]+?)\s*\|[^:\]]+:[^\]]*]/;
  const match = input.match(TAG_REGEX);
  return match ? match[1].trim() : fallback;
}

/**
 * Variante: devuelve todos los nombres si hay múltiples tags en el mismo string.
 * Ej.: "Hola #[Ana|appointment:1] y #[Luis|appointment:2]" → ["Ana", "Luis"]
 */
export function extractAllNamesFromTags(input: unknown): string[] {
  if (typeof input !== 'string') return [];
  const TAG_REGEX_GLOBAL = /#?\[\s*([^|\]]+?)\s*\|[^:\]]+:[^\]]*]/g;
  const result: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = TAG_REGEX_GLOBAL.exec(input)) !== null) {
    result.push(m[1].trim());
  }
  return result;
}
