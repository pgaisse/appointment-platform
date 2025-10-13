import React from "react";
import { Box, HStack, Tag, TagLabel, Text } from "@chakra-ui/react";
import type { Provider } from "@/Hooks/Query/useProviders";

export function ProviderRow({
  p,
  highlight,
  onAdd,
  rightAdornment,
}: {
  p: Provider;
  highlight?: string;
  onAdd: (p: Provider) => void;
  rightAdornment?: React.ReactNode;
}) {
  const label = `${p.firstName} ${p.lastName}`.trim();

  const renderHighlighted = (text: string, q?: string) => {
    if (!q) return text;
    const parts = text.split(new RegExp(`(${q})`, "i"));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === q.toLowerCase() ? (
            <mark
              key={i}
              style={{ background: "transparent", color: "inherit", fontWeight: 700 }}
            >
              {part}
            </mark>
          ) : (
            <React.Fragment key={i}>{part}</React.Fragment>
          )
        )}
      </>
    );
  };

  return (
    <HStack
      as="button"
      type="button"
      w="100%"
      justify="space-between"
      px={2}
      py={2}
      borderRadius="md"
      _hover={{ bg: "blackAlpha.50" }}
      onClick={() => onAdd(p)}
    >
      <HStack overflow="hidden">
        <Box w="8px" h="8px" borderRadius="full" bg={p.color || "gray.300"} />
        <Text noOfLines={1}>{renderHighlighted(label, highlight)}</Text>
      </HStack>
      {rightAdornment}
    </HStack>
  );
}

export function SelectedProviderChips({
  providersList,
  values,
  onRemove,
  onMakePrimary,
  onMove,
}: {
  providersList: Provider[];
  values: string[];
  onRemove: (id: string) => void;
  onMakePrimary: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
}) {
  const byId = new Map(providersList.map((p) => [String(p._id), p]));
  const chips = values.map((id) => byId.get(String(id))).filter(Boolean) as Provider[];

  return (
    <Box
      role="list"
      aria-label="Selected providers"
      mb={2}
      px={2}
      py={1}
      borderWidth="1px"
      borderRadius="md"
      bg="blackAlpha.50"
      overflowX="auto"
      overflowY="hidden"
      whiteSpace="nowrap"
    >
      {chips.length === 0 ? (
        <Tag size="sm" colorScheme="gray" mr={2}>
          <TagLabel>No providers selected</TagLabel>
        </Tag>
      ) : (
        chips.map((p, i) => (
          <Tag key={String(p._id)} size="sm" variant="subtle" borderRadius="md" mr={2}>
            <Box w="8px" h="8px" borderRadius="full" bg={p.color || "gray.300"} mr={2} />
            <TagLabel maxW="160px" isTruncated>
              {p.firstName} {p.lastName}
            </TagLabel>
            <Box
              as="button"
              onClick={() => onMakePrimary(String(p._id))}
              title="Make primary"
              style={{ marginLeft: 8 }}
            >
              <Tag size="sm" colorScheme={i === 0 ? "green" : "gray"} variant="solid" borderRadius="md" mr={2}>
                {i === 0 ? "Primary" : "Make primary"}
              </Tag>
            </Box>
            <HStack spacing={1} ml={1}>
              <Box
                as="button"
                onClick={() => onMove(String(p._id), -1)}
                aria-label="Move left"
                disabled={i === 0}
                opacity={i === 0 ? 0.4 : 1}
              >
                ◀
              </Box>
              <Box
                as="button"
                onClick={() => onMove(String(p._id), +1)}
                aria-label="Move right"
                disabled={i === chips.length - 1}
                opacity={i === chips.length - 1 ? 0.4 : 1}
              >
                ▶
              </Box>
            </HStack>
            <Box
              as="button"
              onClick={() => onRemove(String(p._id))}
              aria-label="Remove"
              title="Remove"
              style={{ marginLeft: 8 }}
            >
              ✕
            </Box>
          </Tag>
        ))
      )}
    </Box>
  );
}
