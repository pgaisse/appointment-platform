import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  Kbd,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Portal,
  Spinner,
  Text,
  useColorModeValue,
  Highlight,
} from '@chakra-ui/react';
import { ChevronDownIcon, CheckIcon, SearchIcon } from '@chakra-ui/icons';

type TopicItem = { id: string; title?: string; key?: string };
type Props = {
  value: string | null;
  options: TopicItem[] | undefined;
  onChange: (id: string | null) => void;
  isLoading?: boolean;
  placeholder?: string;
  size?: 'sm' | 'md' | 'lg';
  width?: string | number;
};

const TopicPicker: React.FC<Props> = ({
  value,
  options,
  onChange,
  isLoading = false,
  placeholder = 'Select a topic',
  size = 'sm',
  width = '260px',
}) => {
  const safeOptions = options ?? [];
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Colors that adapt to light/dark mode with good contrast
  const btnHover = useColorModeValue('blackAlpha.50', 'whiteAlpha.100');
  const btnActive = useColorModeValue('blackAlpha.100', 'whiteAlpha.200');
  const menuBg = useColorModeValue('white', 'gray.900');
  const menuBorder = useColorModeValue('blackAlpha.200', 'whiteAlpha.300');
  const itemHover = useColorModeValue('blackAlpha.50', 'whiteAlpha.200');
  const itemActive = useColorModeValue('blackAlpha.100', 'whiteAlpha.300');
  const muted = useColorModeValue('blackAlpha.600', 'whiteAlpha.600');
  const inputBg = useColorModeValue('blackAlpha.50', 'whiteAlpha.100');
  const inputBgHover = useColorModeValue('blackAlpha.100', 'whiteAlpha.200');
  const inputBorder = useColorModeValue('blackAlpha.200', 'whiteAlpha.300');

  const selected = useMemo(
    () => safeOptions.find(o => o.id === value) || null,
    [safeOptions, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return safeOptions;
    return safeOptions.filter(o => {
      const label = (o.title ?? o.key ?? o.id).toLowerCase();
      return label.includes(q);
    });
  }, [safeOptions, query]);

  // Focus search input when menu opens
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (open) {
      // small delay to ensure portal content is mounted
      const t = setTimeout(() => inputRef.current?.focus(), 10);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Keyboard shortcut: `/` focuses search when button is focused
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const renderLabel = (t: TopicItem) => t.title ?? t.key ?? t.id;

  return (
    <Menu
      placement="bottom-end"
      isLazy
      onOpen={() => setOpen(true)}
      onClose={() => { setOpen(false); setQuery(''); }}
    >
      <MenuButton
        as={Button}
        size={size}
        variant="outline"
        rightIcon={isLoading ? <Spinner size="xs" /> : <ChevronDownIcon />}
        width={width}
        justifyContent="space-between"
        rounded="lg"
        fontWeight="semibold"
        borderColor={menuBorder}
        _hover={{ bg: btnHover }}
        _active={{ bg: btnActive }}
      >
        <HStack justify="space-between" w="full" spacing={3}>
          <Text noOfLines={1} opacity={selected ? 1 : 0.8}>
            {selected ? renderLabel(selected) : placeholder}
          </Text>
        </HStack>
      </MenuButton>

      {/* Portal so it always overlays parents */}
      <Portal>
        <MenuList
          minW={width}
          p={2}
          bg={menuBg}
          borderColor={menuBorder}
          rounded="lg"
          boxShadow="xl"
          zIndex={3000}
        >
          {/* Search box */}
          <Box p={2} pt={1}>
            <InputGroup size="sm">
              <InputLeftElement pointerEvents="none">
                <SearchIcon color={muted} />
              </InputLeftElement>
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search topics…"
                rounded="md"
                bg={inputBg}
                borderColor={inputBorder}
                _hover={{ bg: inputBgHover }}
                _focus={{ borderColor: 'blue.400', boxShadow: '0 0 0 1px var(--chakra-colors-blue-400)' }}
              />
            </InputGroup>
            <HStack mt={1} spacing={2} color={muted} fontSize="xs">
              <Text>Press</Text>
              <Kbd>/</Kbd>
              <Text>to search</Text>
            </HStack>
          </Box>

          {/* Options */}
          <Box
            maxH="300px"
            overflowY="auto"
            mt={1}
            sx={{
              '&::-webkit-scrollbar': { width: '8px' },
              '&::-webkit-scrollbar-thumb': { background: useColorModeValue('#0000001a','#ffffff33'), borderRadius: '8px' },
            }}
          >
            {filtered.length === 0 ? (
              <Box px={3} py={2} color={muted} fontSize="sm">
                No results
              </Box>
            ) : (
              filtered.map((t) => {
                const label = renderLabel(t);
                const isActive = t.id === value;
                return (
                  <MenuItem
                    key={t.id}
                    onClick={() => onChange(t.id)}
                    _hover={{ bg: itemHover }}
                    _active={{ bg: itemActive }}
                    bg={isActive ? itemHover : 'transparent'}
                    rounded="md"
                    height="36px"
                    display="flex"
                    alignItems="center"
                    justifyContent="space-between"
                    gap={3}
                  >
                    <Highlight
                      query={query}
                      styles={{ px: '1', py: '0.5', rounded: 'sm', bg: useColorModeValue('blackAlpha.100', 'whiteAlpha.200') }}
                    >
                      {label}
                    </Highlight>
                    {isActive && <CheckIcon boxSize={3} color="green.300" />}
                  </MenuItem>
                );
              })
            )}
          </Box>

          {/* Clear selection */}
          {value && (
            <Box px={2} pt={2}>
              <Button
                size="xs"
                variant="ghost"
                width="full"
                onClick={() => onChange(null)}
              >
                Clear selection
              </Button>
            </Box>
          )}
        </MenuList>
      </Portal>
    </Menu>
  );
};

export default TopicPicker;
