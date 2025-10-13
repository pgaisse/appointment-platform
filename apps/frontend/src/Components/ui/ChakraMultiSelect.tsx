import React, { useMemo, useState } from "react";
import {
  Box,
  Input,
  Tag,
  TagLabel,
  TagCloseButton,
  Wrap,
  WrapItem,
  IconButton,
  Spinner,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  PopoverHeader,
  PopoverArrow,
  Checkbox,
  VStack,
  HStack,
  Button,
  Text,
  useDisclosure,
  Divider,
} from "@chakra-ui/react";
import { ChevronDownIcon, CloseIcon } from "@chakra-ui/icons";

export type Option = { value: string; label: string };

export interface ChakraMultiSelectProps {
  options: Option[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  isLoading?: boolean;
  noOptionsText?: string;
  maxBadges?: number; // number of chips to display before "+N more"
}

function toggleValue(list: string[], v: string): string[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export default function ChakraMultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  isLoading = false,
  noOptionsText = "No options",
  maxBadges = 3,
}: ChakraMultiSelectProps) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [q, setQ] = useState("");

  const normalized = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

  const filtered = useMemo(() => {
    if (!q) return options;
    const nq = normalized(q);
    return options.filter((o) => normalized(o.label).includes(nq));
  }, [q, options]);

  const selected = useMemo(
    () => value.map((v) => options.find((o) => o.value === v)).filter(Boolean) as Option[],
    [value, options]
  );

  const allVisibleSelected = filtered.length > 0 && filtered.every((o) => value.includes(o.value));
  const someVisibleSelected = filtered.some((o) => value.includes(o.value));

  const applySelectAllVisible = () => {
    const visibleValues = filtered.map((o) => o.value);
    const set = new Set(value);
    visibleValues.forEach((v) => set.add(v));
    onChange([...set]);
  };

  const applyClearVisible = () => {
    const visibleValues = new Set(filtered.map((o) => o.value));
    onChange(value.filter((v) => !visibleValues.has(v)));
  };

  const clearAll = () => onChange([]);

  return (
    <Popover isOpen={isOpen} onClose={onClose} placement="bottom-start" closeOnBlur>
      <PopoverTrigger>
        <Box
          onClick={onOpen}
          p={2}
          borderWidth="1px"
          borderRadius="lg"
          cursor="pointer"
          _hover={{ borderColor: "gray.400" }}
        >
          {selected.length ? (
            <HStack justify="space-between" align="start">
              <Wrap spacing={2} maxW="calc(100% - 2rem)">
                {selected.slice(0, maxBadges).map((opt) => (
                  <WrapItem key={opt.value}>
                    <Tag size="sm" borderRadius="md" variant="subtle" colorScheme="teal">
                      <TagLabel>{opt.label}</TagLabel>
                      <TagCloseButton
                        onClick={(e) => {
                          e.stopPropagation();
                          onChange(value.filter((v) => v !== opt.value));
                        }}
                      />
                    </Tag>
                  </WrapItem>
                ))}
                {selected.length > maxBadges && (
                  <WrapItem>
                    <Tag size="sm" borderRadius="md" variant="subtle">
                      +{selected.length - maxBadges} more
                    </Tag>
                  </WrapItem>
                )}
              </Wrap>
              <ChevronDownIcon mt={1} />
            </HStack>
          ) : (
            <HStack color="gray.500" justify="space-between">
              <Text>{placeholder}</Text>
              <ChevronDownIcon />
            </HStack>
          )}
        </Box>
      </PopoverTrigger>

      <PopoverContent w="sm">
        <PopoverArrow />
        <PopoverHeader>
          <HStack>
            <Input
              size="sm"
              placeholder="Search…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
            />
            {isLoading ? (
              <Spinner size="sm" />
            ) : (
              <IconButton
                size="sm"
                aria-label="Clear"
                icon={<CloseIcon boxSize={2.5} />}
                onClick={() => setQ("")}
                variant="ghost"
              />
            )}
          </HStack>
          <HStack mt={2} spacing={2}>
            <Button
              size="xs"
              variant={allVisibleSelected ? "solid" : "outline"}
              colorScheme="teal"
              onClick={applySelectAllVisible}
              isDisabled={!filtered.length}
            >
              Select visible
            </Button>
            <Button
              size="xs"
              variant="outline"
              onClick={applyClearVisible}
              isDisabled={!someVisibleSelected}
            >
              Clear visible
            </Button>
            <Button size="xs" variant="ghost" onClick={clearAll} isDisabled={!value.length}>
              Clear all
            </Button>
          </HStack>
        </PopoverHeader>

        <Divider />

        <PopoverBody maxH="260px" overflowY="auto" pt={2}>
          <VStack align="stretch" spacing={1}>
            {filtered.length === 0 ? (
              <Box px={2} py={1} color="gray.500" fontSize="sm">
                {noOptionsText}
              </Box>
            ) : (
              filtered.map((opt) => {
                const checked = value.includes(opt.value);
                return (
                  <HStack
                    key={opt.value}
                    px={2}
                    py={1}
                    borderRadius="md"
                    _hover={{ bg: "blackAlpha.50" }}
                    onClick={() => onChange(toggleValue(value, opt.value))}
                    cursor="pointer"
                  >
                    <Checkbox
                      isChecked={checked}
                      onChange={() => onChange(toggleValue(value, opt.value))}
                    />
                    <Box flex="1">{opt.label}</Box>
                  </HStack>
                );
              })
            )}
          </VStack>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
}
