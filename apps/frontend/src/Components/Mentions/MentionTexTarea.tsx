import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  Box,
  Textarea,
  List,
  ListItem,
  HStack,
  Avatar,
  Text,
  Kbd,
  Spinner,
  Portal,
  useColorModeValue,
} from "@chakra-ui/react";

/** ===== Tipos ===== */
export type MentionApiItem = {
  _id: string;
  nameInput: string;
  avatarUrl?: string;
  phoneInput?: string;
  emailInput?: string;
  type?: string;
};

export type MentionItem = {
  id: string;
  nameInput: string;
  avatarUrl?: string;
  subtitle?: string;
  type?: string;
};

export type MentionTextareaProps = {
  value: string;
  onChange: (v: string) => void;

  apiBase?: string;              // default: "/api"
  endpointPath?: string;         // default: "/appointments/mentions"
  getToken?: () => Promise<string | null>;

  placeholder?: string;
  rows?: number;                 // default: 5
  maxSuggestions?: number;       // default: 5
  minQueryLength?: number;       // default: 1
  debounceMs?: number;           // default: 150
  requireBoundaryBeforeHash?: boolean; // default: false
  triggerChar?: string;          // default: "#"
  usePortal?: boolean;           // default: true

  insertMode?: "hash" | "token"; // default: "token"

  compact?: boolean;             // default: true
  matchParentBg?: boolean;       // default: true
  dropdownBg?: string;
  textColor?: string;
  chipTextColor?: string;
  autoFocus?: boolean;

  onEnter?: () => void;
  onEscape?: () => void;

  onMentionAdd?: (item: MentionItem) => void;
  isDisabled?: boolean;
  debug?: boolean;
};

/** ===== Helpers ===== */
function useDebounced<T>(v: T, ms = 150) {
  const [val, setVal] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setVal(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return val;
}

// #[Display|type:id]
const TOKEN_OPEN = "#[";
const TOKEN_CLOSE = "]";
export const TOKEN_REGEX = /#\[([^\]|]+)\|([^:|\]]+):([^\]]+)\]/g;

function toMentionToken(display: string, type: string | undefined, id: string) {
  const t = (type || "entity").trim();
  return `${TOKEN_OPEN}${display}|${t}:${id}${TOKEN_CLOSE}`;
}

/** ===== Mirror para medir caret ===== */
function buildMirrorOverTextarea(textarea: HTMLTextAreaElement) {
  const div = document.createElement("div");
  const s = div.style;
  const cs = window.getComputedStyle(textarea);
  const taRect = textarea.getBoundingClientRect();

  // Igualamos layout del textarea
  s.whiteSpace = "pre-wrap";
  (s as any).wordWrap = "break-word";
  s.visibility = "hidden";
  s.position = "absolute";
  // Posicionar el mirror EXACTAMENTE sobre el textarea en coordenadas de página
  s.top = `${taRect.top + window.scrollY}px`;
  s.left = `${taRect.left + window.scrollX}px`;
  s.width = `${taRect.width}px`;
  s.height = `${taRect.height}px`;
  s.overflow = "hidden"; // reflejar viewport del textarea
  s.font = cs.font as string;
  (s as any).letterSpacing = cs.letterSpacing as string;
  (s as any).tabSize = (cs as any).tabSize as string;
  s.padding = cs.padding as string;
  s.lineHeight = cs.lineHeight as string;
  s.borderWidth = cs.borderWidth as string;
  s.boxSizing = cs.boxSizing as string;
  s.borderStyle = cs.borderStyle as string;
  s.borderColor = "transparent";

  document.body.appendChild(div);
  return div;
}

/**
 * Mide la posición del ancla (#) devolviendo:
 * - inlineLeft/inlineTop: relativos al textarea (para posicionamiento absolute)
 * - viewportLeft/viewportTop: coordenadas de viewport (para Portal, position: fixed)
 *
 * Ajusta por scroll interno (scrollTop/scrollLeft) del textarea.
 */
function measureAnchorPositions(
  textarea: HTMLTextAreaElement,
  fullText: string,
  anchorIndex: number
) {
  const mirror = buildMirrorOverTextarea(textarea);
  const before = fullText.slice(0, anchorIndex);
  const after = fullText.slice(anchorIndex);

  const esc = (t: string) =>
    t
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br/>");

  // Usamos bottom del span para anclar el dropdown debajo de la línea
  mirror.innerHTML = `${esc(before)}<span id="_anchor">&#8203;</span>${esc(after)}`;

  // Simular scroll interno del textarea
  const st = textarea.scrollTop;
  const sl = textarea.scrollLeft;
  (mirror as any).scrollTop = st;
  (mirror as any).scrollLeft = sl;

  const anchor = mirror.querySelector("#_anchor") as HTMLSpanElement | null;
  const aRect = anchor?.getBoundingClientRect();
  const taRect = textarea.getBoundingClientRect();
  mirror.remove();
  if (!aRect) return null;

  // +2px para despegar el popup de la línea
  const padY = 2;

  // Coordenadas relativas al textarea (para modo inline)
  const inlineLeft = aRect.left - taRect.left - sl;
  const inlineTop = aRect.bottom - taRect.top - st + padY;

  // Coordenadas de viewport (para Portal, position: fixed)
  const viewportLeft = aRect.left - sl;
  const viewportTop = aRect.bottom - st + padY;

  return { inlineLeft, inlineTop, viewportLeft, viewportTop, taRect };
}

/** ===== Highlighter (subraya #... y chips para tokens) ===== */
function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
const MENTION_REGEX_PLAIN = /(^|\s)(#[^\s#]+)/g;

function buildHighlightHTML(
  text: string,
  {
    chipBg,
    chipText,
    chipBorder,
  }: { chipBg: string; chipText: string; chipBorder: string }
) {
  // 1) Tokens -> chips
  let transformed = "";
  let lastIndex = 0;
  for (const m of text.matchAll(TOKEN_REGEX)) {
    const i = m.index!;
    transformed += escapeHtml(text.slice(lastIndex, i));
    const display = m[1];
    const type = m[2];
    const id = m[3];
    transformed += `<span class="mention-chip" data-type="${escapeHtml(
      type
    )}" data-id="${escapeHtml(id)}">${escapeHtml(display)}</span>`;
    lastIndex = i + m[0].length;
  }
  transformed += escapeHtml(text.slice(lastIndex));

  // 2) Subrayar menciones planas
  let out = "";
  lastIndex = 0;
  for (const m of transformed.matchAll(MENTION_REGEX_PLAIN)) {
    const i = m.index!;
    out += transformed.slice(lastIndex, i);
    out += escapeHtml(m[1] || "");
    out += `<span class="mention-underline">${escapeHtml(m[2])}</span>`;
    lastIndex = i + m[0].length;
  }
  out += transformed.slice(lastIndex);

  // 3) Saltos de línea
  out = out.replace(/\n/g, "<br/>");

  // 4) CSS de chips
  const style =
    `<style>
      .mention-chip{
        display:inline-flex;
        align-items:center;
        gap:0.35rem;
        padding:0.1rem 0.5rem;
        border-radius:999px;
        background:${chipBg};
        color:${chipText};
        border:1px solid ${chipBorder};
        line-height:1.2;
        vertical-align:middle;
      }
      .mention-underline{
        color: inherit;
        background-image: linear-gradient(transparent calc(100% - 2px), #14b8a6 0);
        background-repeat: no-repeat;
        background-size: 100% 100%;
      }
    </style>`;

  return style + out;
}

/** ===== Componente ===== */
export default function MentionTextarea({
  value,
  onChange,
  apiBase = "/api",
  endpointPath = "/appointments/mentions",
  getToken,
  placeholder,
  rows = 5,
  maxSuggestions = 5,
  minQueryLength = 1,
  debounceMs = 150,
  requireBoundaryBeforeHash = false,
  triggerChar = "#",
  usePortal = true,
  insertMode = "token",
  compact = true,
  matchParentBg = true,
  dropdownBg,
  textColor,
  chipTextColor,
  autoFocus,
  onEnter,
  onEscape,
  onMentionAdd,
  isDisabled,
  debug = false,
}: MentionTextareaProps) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const highRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [anchorIndex, setAnchorIndex] = useState<number | null>(null);

  const [posInline, setPosInline] = useState<{ left: number; top: number } | null>(null);
  const [posViewport, setPosViewport] = useState<{ left: number; top: number } | null>(null);

  const [active, setActive] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [suggestions, setSuggestions] = useState<MentionItem[]>([]);

  const [parentBgColor, setParentBgColor] = useState<string | null>(null);
  const debounced = useDebounced(query, debounceMs);

  // Colores
  const hoverBg = useColorModeValue("blackAlpha.50", "whiteAlpha.200");
  const borderClr = useColorModeValue("blackAlpha.200", "whiteAlpha.200");
  const chipBg = useColorModeValue("gray.100", "whiteAlpha.200");
  const chipTextDefault = useColorModeValue("gray.800", "whiteAlpha.900");
  const chipText = chipTextColor || chipTextDefault;
  const chipBorder = useColorModeValue("blackAlpha.200", "whiteAlpha.300");

  // Fondo del padre
  useEffect(() => {
    const el = wrapRef.current?.parentElement || wrapRef.current;
    if (!el) return;
    const bg = getComputedStyle(el).backgroundColor;
    setParentBgColor(bg && bg !== "rgba(0, 0, 0, 0)" ? bg : null);
  }, []);

  const dropdownBgColor =
    dropdownBg ||
    (matchParentBg && parentBgColor) ||
    "var(--chakra-colors-chakra-body-bg)";

  const triggerRe = useMemo(() => {
    const t = triggerChar.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    return requireBoundaryBeforeHash
      ? new RegExp(`(^|\\s)${t}([^${t}\\s]*)$`)
      : new RegExp(`${t}([^${t}\\s]*)$`);
  }, [triggerChar, requireBoundaryBeforeHash]);

  /** Fetch endpoint */
  const fetchSuggestions = useCallback(
    async (q: string): Promise<MentionItem[]> => {
      const key = q.trim();
      if (!key) return [];
      const url = `${apiBase}${endpointPath}?nameInput=${encodeURIComponent(
        key
      )}&limit=${maxSuggestions}&mode=contains`;

      const headers: Record<string, string> = {};
      try {
        if (getToken) {
          const tok = await getToken();
          if (tok) headers["Authorization"] = `Bearer ${tok}`;
        }
      } catch (e) {
        if (debug) console.log("[mentions] getToken error", e);
      }

      const res = await fetch(url, { headers });
      if (!res.ok) {
        if (debug) console.log("[mentions] HTTP", res.status, await res.text());
        return [];
      }
      const data = await res.json();
      const items: MentionItem[] = (data?.items ?? []).map((a: MentionApiItem) => ({
        id: String(a._id),
        nameInput: a.nameInput,
        avatarUrl: a.avatarUrl,
        subtitle: a.phoneInput || a.emailInput,
        type: a.type ?? "appointment",
      }));
      return items.slice(0, maxSuggestions);
    },
    [apiBase, endpointPath, getToken, maxSuggestions, debug]
  );

  useEffect(() => {
    let alive = true;
    async function go() {
      if (!open || debounced.length < minQueryLength) return;
      const list = await fetchSuggestions(debounced);
      if (!alive) return;
      startTransition(() => {
        setSuggestions(list);
        setActive(0);
      });
    }
    go();
    return () => { alive = false; };
  }, [open, debounced, minQueryLength, fetchSuggestions, startTransition]);

  /** Recompute caret + sync highlighter */
  const recompute = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;

    // sincroniza scroll del highlighter visual
    if (highRef.current) {
      highRef.current.scrollTop = ta.scrollTop;
      highRef.current.scrollLeft = ta.scrollLeft;
    }

    if (anchorIndex != null) {
      const m = measureAnchorPositions(ta, value, anchorIndex);
      if (!m) return;

      const padX = compact ? 6 : 8;
      // clamp horizontal dentro del textarea (modo inline)
      const taWidth = m.taRect.width;
      const clampedInlineLeft = Math.max(padX, Math.min(m.inlineLeft, taWidth - padX));

      setPosInline({ left: clampedInlineLeft, top: m.inlineTop });
      // viewport usa la coordenada ya ajustada por scroll
      setPosViewport({ left: m.viewportLeft, top: m.viewportTop });
    }
  }, [anchorIndex, value, compact]);

  useEffect(() => { recompute(); }, [value, anchorIndex, recompute]);
  useEffect(() => {
    const onWin = () => recompute();
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    return () => {
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
    };
  }, [recompute]);

  const onScroll = () => recompute();

  /** Detectar '#query' */
  const findTrigger = useCallback(
    (text: string, caret: number) => {
      const left = text.slice(0, caret);
      const m = left.match(triggerRe);
      if (!m) return null;
      const raw = (m[2] ?? m[1]) as string | undefined;
      const start = caret - (raw?.length ?? 0) - 1; // incluye '#'
      return { start, raw: raw ?? "" };
    },
    [triggerRe]
  );

  const onTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    onChange(next);
    const caret = e.target.selectionStart ?? next.length;
    const got = findTrigger(next, caret);
    if (got) {
      setOpen(true);
      setQuery(got.raw);
      setAnchorIndex(got.start);
    } else {
      setOpen(false);
      setQuery("");
      setAnchorIndex(null);
    }
  };

  /** Insertar selección */
  const insertAt = (text: string, start: number, end: number, insert: string) =>
    text.slice(0, start) + insert + text.slice(end);

  const selectItem = (item: MentionItem) => {
    if (anchorIndex == null) return;
    const insertStr =
      insertMode === "hash"
        ? `${triggerChar}${item.nameInput} `
        : `${toMentionToken(item.nameInput, item.type, item.id)} `;

    const next = insertAt(value, anchorIndex, anchorIndex + 1 + (query?.length ?? 0), insertStr);
    onChange(next);
    onMentionAdd?.(item);
    setOpen(false);
    setQuery("");
    setAnchorIndex(null);
    requestAnimationFrame(() => {
      const ta = taRef.current;
      if (!ta) return;
      const caretPos = (anchorIndex as number) + insertStr.length;
      ta.focus();
      ta.setSelectionRange(caretPos, caretPos);
      recompute();
    });
  };

  /** Teclado: VS Code-like + Submit/Escape del host */
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      if (open && suggestions[active]) {
        e.preventDefault();
        selectItem(suggestions[active]);
        return;
      }
      if (!e.shiftKey) {
        e.preventDefault();
        onEnter?.();
        return;
      }
    } else if (e.key === "Tab") {
      if (open && suggestions[active]) {
        e.preventDefault();
        selectItem(suggestions[active]);
        return;
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
        return;
      }
      onEscape?.();
    }

    if (open) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => Math.min(i + 1, suggestions.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
      }
    }
  };

  /** Apariencia compacta + chips */
  const avatarSize = compact ? "xs" : "sm";
  const itemPx = compact ? 2 : 3;
  const itemPy = compact ? 1.5 : 2;
  const minW = compact ? "220px" : "280px";
  const maxW = compact ? "360px" : "420px";
  const maxH = compact ? "220px" : "280px";
  const fontSize = compact ? "sm" : "md";
  const hintFontSize = compact ? "xs" : "sm";
  const kbdSize = compact ? "xs" : "sm";

  const Dropdown = (
    <Box
      bg={dropdownBgColor}
      color="inherit"
      borderRadius={compact ? "md" : "lg"}
      boxShadow="xl"
      borderWidth="1px"
      borderColor={useColorModeValue("blackAlpha.200", "whiteAlpha.200")}
      overflow="hidden"
      minW={minW}
      maxW={maxW}
      maxH={maxH}
      fontSize={fontSize}
    >
      <List role="listbox" overflowY="auto">
        {isPending && suggestions.length === 0 ? (
          <HStack p={3} spacing={3}>
            <Spinner size="sm" />
            <Text fontSize={hintFontSize}>Buscando…</Text>
          </HStack>
        ) : suggestions.length === 0 ? (
          <HStack p={3}>
            <Text fontSize={hintFontSize} color="gray.500">
              Sin resultados
            </Text>
          </HStack>
        ) : (
          suggestions.map((it, idx) => (
            <ListItem
              key={it.id}
              role="option"
              aria-selected={active === idx}
              bg={active === idx ? hoverBg : "transparent"}
              px={itemPx}
              py={itemPy}
              _hover={{ bg: hoverBg, cursor: "pointer" }}
              onMouseEnter={() => setActive(idx)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectItem(it)}
            >
              <HStack spacing={3} align="center">
                <Avatar size={avatarSize} name={it.nameInput} src={it.avatarUrl} />
                <Box>
                  <Text fontWeight="semibold" noOfLines={1}>
                    {it.nameInput}
                  </Text>
                  {it.subtitle && (
                    <Text fontSize="xs" color="gray.500" noOfLines={1}>
                      {it.subtitle}
                    </Text>
                  )}
                </Box>
                <Box flex={1} />
                {it.type && (
                  <Text fontSize="xs" color="gray.500">
                    {it.type}
                  </Text>
                )}
              </HStack>
            </ListItem>
          ))
        )}
      </List>

      <HStack px={2} py={1.5} borderTopWidth="1px" borderTopColor={useColorModeValue("blackAlpha.200", "whiteAlpha.200")}>
        <Text fontSize={hintFontSize} color="gray.500">
          Navega
        </Text>
        <Kbd fontSize={kbdSize}>↑</Kbd>
        <Kbd fontSize={kbdSize}>↓</Kbd>
        <Text fontSize={hintFontSize} color="gray.500">
          · Seleccionar
        </Text>
        <Kbd fontSize={kbdSize}>Enter</Kbd>
        <Text fontSize={hintFontSize} color="gray.500">
          o
        </Text>
        <Kbd fontSize={kbdSize}>Tab</Kbd>
      </HStack>
    </Box>
  );

  const highlightHTML = useMemo(
    () =>
      buildHighlightHTML(value, {
        chipBg,
        chipText,
        chipBorder,
      }),
    [value, chipBg, chipText, chipBorder]
  );

  return (
    <Box position="relative" ref={wrapRef}>
      {/* Highlighter detrás del textarea (incluye chips) */}
      <Box
        ref={highRef}
        aria-hidden="true"
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        overflow="auto"
        px={compact ? 2 : 3}
        pt={compact ? 2 : 2.5}
        fontFamily="inherit"
        fontSize={compact ? "sm" : "md"}
        lineHeight={compact ? "1.4" : "1.6"}
        whiteSpace="pre-wrap"
        color="transparent"
        pointerEvents="none"
        className="hashtag-highlighter"
        dangerouslySetInnerHTML={{ __html: highlightHTML }}
      />

      {/* Textarea real */}
      <Textarea
        ref={taRef}
        value={value}
        onChange={onTextChange}
        onKeyDown={onKeyDown}
        onScroll={onScroll}
        placeholder={placeholder}
        isDisabled={isDisabled}
        rows={rows}
        size="sm"
        fontSize={compact ? "sm" : "md"}
        lineHeight={compact ? "1.4" : "1.6"}
        bg="transparent"
        color={textColor || "inherit"}
        position="relative"
        zIndex={1}
        px={compact ? 2 : 3}
        pt={compact ? 2 : 2.5}
        autoFocus={autoFocus}
      />

      {/* Dropdown */}
      {open && (usePortal ? posViewport : posInline) && (
        usePortal ? (
          <Portal>
            <Box
              position="fixed"
              left={`${posViewport!.left}px`}
              top={`${posViewport!.top}px`}
              zIndex={2000}
              pointerEvents="auto"
            >
              {Dropdown}
            </Box>
          </Portal>
        ) : (
          <Box
            position="absolute"
            left={`${posInline!.left}px`}
            top={`${posInline!.top}px`}
            zIndex={2}
            pointerEvents="auto"
          >
            {Dropdown}
          </Box>
        )
      )}
    </Box>
  );
}
