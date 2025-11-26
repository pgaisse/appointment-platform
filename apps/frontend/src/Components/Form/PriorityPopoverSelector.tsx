// PriorityPopoverSelector.tsx
// Selector de prioridad con Popover/Portal para mejor UX
import React, { useState, useMemo } from 'react';
import {
  Box,
  Button,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverBody,
  PopoverArrow,
  PopoverCloseButton,
  Portal,
  Flex,
  Icon,
  Spinner,
  Text,
  VStack,
  HStack,
  Badge,
  Tag,
  TagLabel,
} from '@chakra-ui/react';
import { MdExpandMore, MdCheckCircle } from 'react-icons/md';
import { useGetCollection } from '@/Hooks/Query/useGetCollection';
import { Priority } from '@/types';

/* Helpers de color */
const CHAKRA_BASE_TOKENS = new Set([
  'gray', 'red', 'orange', 'yellow', 'green', 'teal', 'blue',
  'cyan', 'purple', 'pink', 'linkedin', 'facebook', 'messenger',
  'whatsapp', 'twitter', 'telegram', 'blackAlpha', 'whiteAlpha',
]);

const isHex = (c?: string) => !!c && /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(c);
const isToken = (c?: string) => !!c && CHAKRA_BASE_TOKENS.has(c.split('.')[0]);
const baseToken = (c: string) => c.split('.')[0];

/** Sombrar/aclarecer hex mezclando con negro/blanco */
function shadeHex(hex: string, percent: number) {
  const p = Math.max(-100, Math.min(100, percent)) / 100;
  const int = (h: string) => parseInt(h, 16);
  let r = 0,
    g = 0,
    b = 0;
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    r = int(clean[0] + clean[0]);
    g = int(clean[1] + clean[1]);
    b = int(clean[2] + clean[2]);
  } else {
    r = int(clean.slice(0, 2));
    g = int(clean.slice(2, 4));
    b = int(clean.slice(4, 6));
  }
  const mix = p >= 0 ? 255 : 0;
  const f = (c: number) => Math.round((1 - Math.abs(p)) * c + Math.abs(p) * mix);
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(f(r))}${toHex(f(g))}${toHex(f(b))}`;
}

interface Props {
  value?: string; // Priority ID
  onChange?: (id: string, name: string, color?: string, duration?: number | null) => void;
  isDisabled?: boolean;
}

export const PriorityPopoverSelector: React.FC<Props> = ({
  value,
  onChange,
  isDisabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const { data: priorities = [], isSuccess, isFetching } = useGetCollection<Priority>(
    'PriorityList',
    { query: {}, limit: 50 }
  );

  const updatedPriorities = useMemo(() => {
    const seen = new Set<number>();
    return priorities.filter((p) => !seen.has(p.id) && seen.add(p.id));
  }, [priorities]);

  const selectedPriority = updatedPriorities.find((p) => p._id === value);

  const handleSelect = (priority: Priority) => {
    onChange?.(priority._id ?? '', priority.name, priority.color, priority.durationHours);
    setIsOpen(false);
  };

  const getColorStyles = (color: string | undefined) => {
    const fallbackHex = '#4A5568';
    const c = color || fallbackHex;

    if (isToken(c)) {
      const base = baseToken(c);
      return {
        bg: `${base}.100`,
        color: `${base}.800`,
        borderColor: `${base}.300`,
        hoverBg: `${base}.200`,
      };
    }

    const hex = isHex(c) ? c : fallbackHex;
    return {
      bg: hex,
      color: '#ffffff',
      borderColor: shadeHex(hex, -10),
      hoverBg: shadeHex(hex, -10),
    };
  };

  return (
    <Popover
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      placement="bottom-start"
      closeOnBlur={true}
      isLazy
      lazyBehavior="keepMounted"
    >
      <PopoverTrigger>
        <Button
          onClick={() => setIsOpen(!isOpen)}
          isDisabled={isDisabled}
          width="100%"
          justifyContent="space-between"
          rightIcon={<MdExpandMore />}
          variant="outline"
          size="md"
          borderRadius="md"
          px={4}
          py={2}
          fontWeight="normal"
          textAlign="left"
          bg="white"
          _hover={{ bg: 'gray.50', borderColor: 'blue.400' }}
          _focus={{ borderColor: 'blue.500', boxShadow: '0 0 0 1px #3182ce' }}
        >
          {selectedPriority ? (
            <HStack spacing={2}>
              <Box
                w={3}
                h={3}
                borderRadius="full"
                bg={selectedPriority.color}
              />
              <Text>{selectedPriority.name}</Text>
            </HStack>
          ) : (
            <Text color="gray.400">Select priority...</Text>
          )}
        </Button>
      </PopoverTrigger>

      <Portal>
        <PopoverContent
          maxW="400px"
          borderRadius="lg"
          boxShadow="2xl"
          border="1px solid"
          borderColor="gray.200"
        >
          <PopoverArrow />
          <PopoverCloseButton />
          <PopoverHeader fontWeight="bold" fontSize="md" borderBottomWidth="1px">
            Select Priority
          </PopoverHeader>

          <PopoverBody maxH="400px" overflowY="auto" p={2}>
            {isFetching ? (
              <Flex justify="center" py={6}>
                <Spinner />
              </Flex>
            ) : !isSuccess || updatedPriorities.length === 0 ? (
              <Text textAlign="center" py={6} color="gray.500">
                No priorities found.
              </Text>
            ) : (
              <VStack spacing={1} align="stretch">
                {updatedPriorities.map((priority) => {
                  const isSelected = value === priority._id;
                  const colorStyles = getColorStyles(priority.color);

                  return (
                    <Box
                      key={priority._id ?? priority.id}
                      as="button"
                      type="button"
                      onClick={() => handleSelect(priority)}
                      p={3}
                      borderRadius="md"
                      bg={isSelected ? colorStyles.hoverBg : 'transparent'}
                      border="1px solid"
                      borderColor={isSelected ? colorStyles.borderColor : 'transparent'}
                      _hover={{
                        bg: colorStyles.hoverBg,
                        borderColor: colorStyles.borderColor,
                      }}
                      transition="all 0.15s ease"
                      cursor="pointer"
                      width="100%"
                      textAlign="left"
                      position="relative"
                    >
                      <HStack spacing={3} justify="space-between">
                        <HStack spacing={3} flex={1}>
                          <Tag
                            size="md"
                            bg={colorStyles.bg}
                            color={colorStyles.color}
                            borderRadius="full"
                            px={3}
                            py={1}
                          >
                            <TagLabel fontWeight="semibold">{priority.name}</TagLabel>
                          </Tag>

                          {priority.description && (
                            <VStack align="start" spacing={0} flex={1}>
                              <Text fontSize="xs" color="gray.500" noOfLines={1}>
                                {priority.description}
                              </Text>
                            </VStack>
                          )}
                        </HStack>

                        {isSelected && (
                          <Icon
                            as={MdCheckCircle}
                            boxSize={5}
                            color={colorStyles.borderColor}
                          />
                        )}
                      </HStack>
                    </Box>
                  );
                })}
              </VStack>
            )}
          </PopoverBody>
        </PopoverContent>
      </Portal>
    </Popover>
  );
};
