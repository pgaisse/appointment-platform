import React, {
  useCallback,
  useEffect,
  useId,
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
} from "@chakra-ui/react";

export type MentionItem = {
  id: string;
  nameInput: string;          // Texto a mostrar e insertar tras '#'
  type?: string;              // "appointment" | "patient" | etc.
  avatarUrl?: string;
  subtitle?: string;
  [k: string]: any;
};

export type HashtagMentionInputProps = {
  value: string;
  onChange: (value: string) => void;
  fetchSuggestions: (query: string) => Promise<MentionItem[]>;
  onMentionAdd?: (item: MentionItem) => void;
  renderItem?: (item: MentionItem, isActive: boolean) => React.ReactNode;
  placeholder?: string;
  isDisabled?: boolean;
  maxSuggestions?: number;              // default 5
  requireBoundaryBeforeHash?: boolean;  // default false — permite "hola#ana"
  minQueryLength?: number;              // default 1
  debounceMs?: number;                  // default 150
  rows?: number;                        // default 5
  triggerChar?: string;                 // default '#'
  insertMode?: "plain" | "token";       // default 'plain'
  plainInsert?: (item: MentionItem, triggerChar: string) => string; // default "#Nombre "
  usePortal?: boolean;                  // default true (monta el dropdown en <body>)
};

function useDebounced<T>(value: T, delay = 150) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Subraya #menciones (modo plain)
const PLAIN_MENTION_REGEX = /(^|\s)(#[^\s#]+)/g;
function buildHighlightHTML(text: string) {
  let out = "";
  let last = 0;
  for (const m of text.matchAll(PLAIN_MENTION_REGEX)) {
    const idx = m.index!;
    out += escapeHtml(text.slice(last, idx));
    out += escapeHtml(m[1] || "");
    out += `<span class="mention-underline">${escapeHtml(m[2])}</span>`;
    last = idx + m[0].length;
  }
  out += escapeHtml(text.slice(last));
  return out.replace(/\n/g, "<br/>");
}

// Div espejo para medir posición de caret/ancla
function buildMirror(textarea: HTMLTextAreaElement) {
  const div = document.createElement("div");
  const s = div.style;
  const cs = window.getComputedStyle(textarea);
  s.whiteSpace = "pre-wrap";
  (s as any).wordWrap = "break-word";
  s.visibility = "hidden";
  s.position = "absolute";
  s.top = "0";
  s.left = "-9999px";
  s.font = cs.font as string;
  (s as any).letterSpacing = cs.letterSpacing as string;
  (s as any).tabSize = (cs as any).tabSize as string;
  s.padding = cs.padding as string;
  s.width = cs.width as string;
  s.lineHeight = cs.lineHeight as string;
  s.borderWidth = cs.borderWidth as string;
  s.boxSizing = cs.boxSizing as string;
  document.body.appendChild(div);
  return div;
}

function measureAnchorInline(
  textarea: HTMLTextAreaElement,
  fullText: string,
  anchorIndex: number
) {
  const mirror = buildMirror(textarea);
  const before = fullText.slice(0, anchorIndex);
  const after = fullText.slice(anchorIndex);
  const esc = (t: string) =>
    t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>");

  mirror.innerHTML = esc(before) + '<span id="_caret_anchor"></span>' + esc(after);
  const mark = mirror.querySelector("#_caret_anchor") as HTMLSpanElement | null;
  const rect = mark?.getBoundingClientRect();
  const taRect = textarea.getBoundingClientRect();
  mirror.remove();
  if (!rect) return null;
  const fontSize = parseFloat(getComputedStyle(textarea).fontSize || "16");
  return {
    left: rect.left - taRect.left,
    top: rect.top - taRect.top + fontSize * 1.25,
  };
}

export default function HashtagMentionInput({
  value,
  onChange,
  fetchSuggestions,
  onMentionAdd,
  renderItem,
  placeholder,
  isDisabled,
  maxSuggestions = 5,
  requireBoundaryBeforeHash = false,
  minQueryLength = 1,
  debounceMs = 150,
  rows = 5,
  triggerChar = "#",
  insertMode = "plain",
  plainInsert,
  usePortal = true,
}: HashtagMentionInputProps) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const highRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [anchorIndex, setAnchorIndex] = useState<number | null>(null);
  const [anchorPos, setAnchorPos] = useState<{ left: number; top: number } | null>(null);           // relativo al textarea
  const [anchorViewport, setAnchorViewport] = useState<{ left: number; top: number } | null>(null); // coords absolutas
  const [active, setActive] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [suggestions, setSuggestions] = useState<MentionItem[]>([]);
  const listboxId = useId();

  const debouncedQuery = useDebounced(query, debounceMs);

  // patrón para disparar con '#'
  const triggerRegex = useMemo(() => {
    const t = triggerChar.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    return requireBoundaryBeforeHash
      ? new RegExp(`(^|\\s)${t}([^${t}\\s]*)$`)
      : new RegExp(`${t}([^${t}\\s]*)$`);
  }, [triggerChar, requireBoundaryBeforeHash]);

  // fetch sugerencias
  useEffect(() => {
    let alive = true;
    async function run() {
      if (!open || debouncedQuery.length < minQueryLength) return;
      try {
        const list = await fetchSuggestions(debouncedQuery);
        if (!alive) return;
        startTransition(() => {
          setSuggestions(list.slice(0, maxSuggestions));
          setActive(0);
        });
      } catch {
        /* noop */
      }
    }
    run();
    return () => {
      alive = false;
    };
  }, [open, debouncedQuery, fetchSuggestions, maxSuggestions, minQueryLength, startTransition]);

  // recalcular posición de ancla y sync de scroll del highlighter
  const recompute = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    if (highRef.current) {
      highRef.current.scrollTop = ta.scrollTop;
      highRef.current.scrollLeft = ta.scrollLeft;
    }
    if (anchorIndex != null) {
      const pos = measureAnchorInline(ta, value, anchorIndex);
      if (!pos) return;
      const pad = 8;
      const taRect = ta.getBoundingClientRect();
      const maxLeft = taRect.width - pad;
      const clampedLeft = Math.max(pad, Math.min(pos.left, maxLeft));
      setAnchorPos({ left: clampedLeft, top: pos.top });
      setAnchorViewport({ left: taRect.left + pos.left, top: taRect.top + pos.top });
    }
  }, [anchorIndex, value]);

  useEffect(() => {
    recompute();
  }, [value, anchorIndex, recompute]);

  useEffect(() => {
    const onWin = () => recompute();
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    return () => {
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
    };
  }, [recompute]);

  const handleScroll = () => recompute();

  const findTriggerQuery = useCallback(
    (text: string, caret: number) => {
      const left = text.slice(0, caret);
      const m = left.match(triggerRegex);
      if (!m) return null;
      const raw = (m[2] ?? m[1]) as string | undefined;
      const start = caret - (raw?.length ?? 0) - 1; // incluye '#'
      return { start, raw: raw ?? "" };
    },
    [triggerRegex]
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    onChange(next);
    const caret = e.target.selectionStart ?? next.length;
    const found = findTriggerQuery(next, caret);
    if (found) {
      setOpen(true);
      setQuery(found.raw);
      setAnchorIndex(found.start);
    } else {
      setOpen(false);
      setQuery("");
      setAnchorIndex(null);
    }
  };

  // insertar texto
  const insertAt = (text: string, start: number, end: number, insert: string) =>
    text.slice(0, start) + insert + text.slice(end);

  const selectItem = useCallback(
    (item: MentionItem) => {
      if (anchorIndex == null) return;
      const insertStr =
        insertMode === "plain"
          ? (plainInsert ? plainInsert(item, triggerChar) : `${triggerChar}${item.nameInput} `)
          : `${triggerChar}${item.nameInput} `;
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
    },
    [anchorIndex, insertMode, onChange, onMentionAdd, plainInsert, query, triggerChar, value, recompute]
  );

  // teclado
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" || e.key === "Tab") {
      if (suggestions[active]) {
        e.preventDefault();
        selectItem(suggestions[active]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const handleClickItem = (idx: number) => {
    const item = suggestions[idx];
    if (item) selectItem(item);
  };

  const highlightHTML = useMemo(() => buildHighlightHTML(value), [value]);

  const Dropdown = (
    <Box
      bg="gray.800"
      color="white"
      borderRadius="lg"
      boxShadow="xl"
      overflow="hidden"
      minW="280px"
      maxW="420px"
      maxH="280px"
    >
      <List role="listbox" id={listboxId} overflowY="auto">
        {isPending && suggestions.length === 0 ? (
          <HStack p={3} spacing={3}>
            <Spinner size="sm" />
            <Text fontSize="sm">Buscando…</Text>
          </HStack>
        ) : suggestions.length === 0 ? (
          <HStack p={3}>
            <Text fontSize="sm" color="gray.300">
              Sin resultados
            </Text>
          </HStack>
        ) : (
          suggestions.map((it, idx) => (
            <ListItem
              key={it.id}
              id={`${listboxId}-item-${idx}`}
              role="option"
              aria-selected={active === idx}
              bg={active === idx ? "gray.700" : "transparent"}
              px={3}
              py={2}
              _hover={{ bg: "gray.700", cursor: "pointer" }}
              onMouseEnter={() => setActive(idx)}
              onMouseDown={(e) => e.preventDefault()} // evita blur del textarea
              onClick={() => handleClickItem(idx)}
            >
              {renderItem ? (
                renderItem(it, active === idx)
              ) : (
                <HStack spacing={3} align="center">
                  <Avatar 
                    size="sm" 
                    name={it.nameInput?.[0] || it.nameInput} 
                    src={it.avatarUrl}
                    {...(() => {
                      const color = (it as any).color;
                      if (!color) return {};
                      if (!color.startsWith('#') && !color.includes('.')) {
                        return { bg: `${color}.500`, color: "white" };
                      }
                      if (color.includes(".")) {
                        const [base] = color.split(".");
                        return { bg: `${base}.500`, color: "white" };
                      }
                      const hex = color.replace("#", "");
                      const int = parseInt(hex.length === 3 ? hex.split("").map((c: string) => c+c).join("") : hex, 16);
                      const r = (int >> 16) & 255, g = (int >> 8) & 255, b = int & 255;
                      const yiq = (r * 299 + g * 587 + b * 114) / 1000;
                      const text = yiq >= 128 ? "black" : "white";
                      return { bg: color, color: text };
                    })()}
                    boxShadow="0 1px 4px rgba(0,0,0,0.1)"
                  />
                  <Box>
                    <Text fontWeight="semibold" noOfLines={1}>
                      {it.nameInput}
                    </Text>
                    {it.subtitle && (
                      <Text fontSize="xs" color="gray.300" noOfLines={1}>
                        {it.subtitle}
                      </Text>
                    )}
                  </Box>
                  <Box flex={1} />
                  {it.type && (
                    <Text fontSize="xs" color="gray.400">
                      {it.type}
                    </Text>
                  )}
                </HStack>
              )}
            </ListItem>
          ))
        )}
      </List>

      <HStack px={3} py={2} borderTopWidth="1px" borderTopColor="whiteAlpha.200">
        <Text fontSize="xs" color="gray.300">
          Navega
        </Text>
        <Kbd>↑</Kbd>
        <Kbd>↓</Kbd>
        <Text fontSize="xs" color="gray.300">
          · Seleccionar
        </Text>
        <Kbd>Enter</Kbd>
        <Text fontSize="xs" color="gray.300">
          o
        </Text>
        <Kbd>Tab</Kbd>
      </HStack>
    </Box>
  );

  return (
    <Box position="relative" ref={wrapRef}>
      {/* Highlighter detrás del textarea */}
      <Box
        ref={highRef}
        aria-hidden="true"
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        overflow="auto"
        px={3}
        pt={2.5}
        fontFamily="inherit"
        fontSize="inherit"
        lineHeight="inherit"
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
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onScroll={handleScroll}
        placeholder={placeholder}
        isDisabled={isDisabled}
        rows={rows}
        aria-activedescendant={open ? `${listboxId}-item-${active}` : undefined}
        aria-controls={open ? listboxId : undefined}
        aria-autocomplete="list"
        bg="transparent"
        position="relative"
        zIndex={1}
        px={3}
        pt={2.5}
        onFocus={recompute}
      />

      {/* Dropdown: Portal por defecto (tipo VS Code) */}
      {open && (usePortal ? anchorViewport : anchorPos) && (
        usePortal ? (
          <Portal>
            <Box
              position="fixed"
              left={`${anchorViewport!.left}px`}
              top={`${anchorViewport!.top}px`}
              zIndex={2000}
              pointerEvents="auto"
            >
              {Dropdown}
            </Box>
          </Portal>
        ) : (
          <Box
            position="absolute"
            left={`${anchorPos!.left}px`}
            top={`${anchorPos!.top}px`}
            zIndex={2}
            pointerEvents="auto"
          >
            {Dropdown}
          </Box>
        )
      )}

      <style>{`
        .hashtag-highlighter .mention-underline{
          color: inherit;
          background-image: linear-gradient(transparent calc(100% - 2px), #14b8a6 0);
          background-repeat: no-repeat;
          background-size: 100% 100%;
        }
      `}</style>
    </Box>
  );
}
