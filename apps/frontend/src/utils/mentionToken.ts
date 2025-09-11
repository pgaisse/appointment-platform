import type { ExtractedMention } from "../types";

export const TOKEN_OPEN = "#[";
export const TOKEN_CLOSE = "]";

export function toMentionToken(display: string, type: string | undefined, id: string) {
  const t = type?.trim() || "entity";
  return `${TOKEN_OPEN}${display}|${t}:${id}${TOKEN_CLOSE}`;
}

// #[Display|type:id]
export const MENTION_REGEX = /#\[([^\]|]+)\|([^:|\]]+):([^\]]+)\]/g;

export function extractMentions(text: string): ExtractedMention[] {
  const out: ExtractedMention[] = [];
  for (const m of text.matchAll(MENTION_REGEX)) {
    const display = m[1];
    const type = m[2];
    const id = m[3];
    if (m.index != null) out.push({ display, type, id, start: m.index, end: m.index + m[0].length });
  }
  return out;
}
