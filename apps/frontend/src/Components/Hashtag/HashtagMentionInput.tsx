import React, { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import {
  Box,
  Textarea,
  Portal,
  List,
  ListItem,
  HStack,
  Avatar,
  Text,
  Kbd,
  Spinner,
  useToken,
} from "@chakra-ui/react";
import { HashtagMentionInputProps, MentionItem } from "@/types";
import { extractMentions, toMentionToken } from "@/utils/mentionToken";
import { useDebounced } from "@/utils/useDebounced";
import { measureAnchorPosition } from "@/utils/measureAnchor";
export function HashtagMentionInput({
  value,
  onChange,
  onMentionAdd,
  onMentionsChange,
  fetchSuggestions,
  renderItem,
  placeholder,
  isDisabled,
  maxSuggestions = 8,
  requireBoundaryBeforeHash = true,
  minQueryLength = 1,
  debounceMs = 150,
  rows = 5,
}: HashtagMentionInputProps) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [anchorIndex, setAnchorIndex] = useState<number | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [active, setActive] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [suggestions, setSuggestions] = useState<MentionItem[]>([]);
  const [zPopover] = useToken("zIndices", ["modal"]);
  const listboxId = useId();

  // Sync parsed mentions out
  useEffect(() => {
    onMentionsChange?.(extractMentions(value));
  }, [value, onMentionsChange]);

  const debouncedQuery = useDebounced(query, debounceMs);

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
        // ignore
      }
    }
    run();
    return () => { alive = false; };
  }, [open, debouncedQuery, fetchSuggestions, maxSuggestions, minQueryLength, startTransition]);

  const findHashQuery = useCallback((text: string, caret: number) => {
    const left = text.slice(0, caret);
    const re = requireBoundaryBeforeHash
      ? /(^|\s)#([^#\s]*)$/
      : /#([^#\s]*)$/;
    const m = left.match(re);
    if (!m) return null;
    const raw = (m[2] ?? m[1]) as string | undefined;
    const start = caret - (raw?.length ?? 0) - 1;
    return { start, raw: raw ?? "" };
  }, [requireBoundaryBeforeHash]);

  const updateAnchorPosition = useCallback(() => {
    const ta = taRef.current;
    if (!ta || anchorIndex == null) return;
    requestAnimationFrame(() => {
      const p = measureAnchorPosition(ta, value, anchorIndex);
      if (p) setPos(p);
    });
  }, [anchorIndex, value]);

  useEffect(() => { updateAnchorPosition(); }, [value, anchorIndex, updateAnchorPosition]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    onChange(next);
    const caret = e.target.selectionStart ?? next.length;
    const found = findHashQuery(next, caret);
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

  const insertAt = (text: string, start: number, end: number, insert: string) =>
    text.slice(0, start) + insert + text.slice(end);

  const selectItem = useCallback((item: MentionItem) => {
    if (anchorIndex == null) return;
    const display = item.nameInput || item.id;
    const token = toMentionToken(display, item.type, item.id);
    const next = insertAt(value, anchorIndex, anchorIndex + 1 + (query?.length ?? 0), token);
    onChange(next);
    onMentionAdd?.(item);
    setOpen(false);
    setQuery("");
    setAnchorIndex(null);
    requestAnimationFrame(() => {
      const ta = taRef.current;
      if (!ta) return;
      const caretPos = anchorIndex + token.length;
      ta.focus();
      ta.setSelectionRange(caretPos, caretPos);
    });
  }, [anchorIndex, onChange, onMentionAdd, query, value]);

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

  useEffect(() => {
    const onWin = () => updateAnchorPosition();
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    return () => {
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
    };
  }, [updateAnchorPosition]);

  return (
    <Box position="relative">
      <Textarea
        ref={taRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        isDisabled={isDisabled}
        rows={rows}
        aria-activedescendant={open ? `${listboxId}-item-${active}` : undefined}
        aria-controls={open ? listboxId : undefined}
        aria-autocomplete="list"
      />

      {open && pos && (
        <Portal>
          <Box
            position="absolute"
            zIndex={zPopover}
            style={(function () {
              const ta = taRef.current;
              if (!ta) return {} as React.CSSProperties;
              const r = ta.getBoundingClientRect();
              return {
                left: `${r.left + pos.x}px`,
                top: `${r.top + pos.y}px`,
              } as React.CSSProperties;
            })()}
          >
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
                    <Text fontSize="sm">Searching…</Text>
                  </HStack>
                ) : suggestions.length === 0 ? (
                  <HStack p={3}><Text fontSize="sm" color="gray.300">No results</Text></HStack>
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
                      onMouseDown={(e) => { e.preventDefault(); }}
                      onClick={() => handleClickItem(idx)}
                    >
                      {renderItem ? (
                        renderItem(it, active === idx)
                      ) : (
                        <HStack spacing={3} align="center">
                          <Avatar size="sm" name={it.nameInput} src={it.avatarUrl} />
                          <Box>
                            <Text fontWeight="semibold" noOfLines={1}>{it.nameInput}</Text>
                            {it.subtitle && (
                              <Text fontSize="xs" color="gray.300" noOfLines={1}>{it.subtitle}</Text>
                            )}
                          </Box>
                          <Box flex={1} />
                          {it.type && (
                            <Text fontSize="xs" color="gray.400">{it.type}</Text>
                          )}
                        </HStack>
                      )}
                    </ListItem>
                  ))
                )}
              </List>

              <HStack px={3} py={2} borderTopWidth="1px" borderTopColor="whiteAlpha.200">
                <Text fontSize="xs" color="gray.300">Navigate</Text>
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd>
                <Text fontSize="xs" color="gray.300">·</Text>
                <Text fontSize="xs" color="gray.300">Select</Text>
                <Kbd>Enter</Kbd>
                <Text fontSize="xs" color="gray.300">or</Text>
                <Kbd>Tab</Kbd>
              </HStack>
            </Box>
          </Box>
        </Portal>
      )}
    </Box>
  );
}

export default HashtagMentionInput;
