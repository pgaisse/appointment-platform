// frontend/src/Components/Kanban/CardView.tsx
import React from 'react';
import { Box, Text, VStack, HStack, Tooltip } from '@chakra-ui/react';
import type { Card, LabelColor } from '@/types/kanban';
import CompletionRadio from '@/Components/Kanban/CompletionRadio';

// Mapea tu LabelColor a tokens de Chakra
const colorToken = (c?: LabelColor | string) => {
  switch (c) {
    case 'green':  return 'green.400';
    case 'yellow': return 'yellow.400';
    case 'orange': return 'orange.400';
    case 'red':    return 'red.400';
    case 'purple': return 'purple.400';
    case 'blue':   return 'blue.400';
    case 'lime':   return 'lime.400';
    case 'sky':    return 'cyan.400';
    case 'pink':   return 'pink.400';
    case 'gray':   return 'gray.400';
    case 'black':  return 'blackAlpha.700';
    default:       return 'gray.500';
  }
};

export default function CardView({
  card,
  onOpen,
  onToggleComplete,
}: {
  card: Card;
  onOpen?: (card: Card) => void;
  onToggleComplete?: (cardId: string, next: boolean) => void;
}) {
  const labels = card.labels ?? [];

  return (
    <Box
      role="group" // para _groupHover del radio
      position="relative"
      p={3}
      rounded="md"
      borderWidth="1px"
      bg="gray.700"
      _hover={{ bg: 'gray.650', borderColor: 'gray.500' }}
      cursor="pointer"
      onClick={() => onOpen?.(card)}
    >
      <VStack align="stretch" spacing={2}>
        {/* --- Row de labels (barras finas) --- */}
        {labels.length > 0 && (
          <HStack spacing={1} mb={1}>
            {labels.map((l) => (
              <Tooltip key={l.id} label={l.name}>
                <Box
                  h="6px"
                  w="38px"
                  rounded="full"
                  bg={colorToken(l.color)}
                />
              </Tooltip>
            ))}
          </HStack>
        )}

        {/* --- Título + radio inline a la izquierda --- */}
        <HStack spacing={0} align="center">
          <CompletionRadio
            inline
            checked={!!card.completed}
            onToggle={() => onToggleComplete?.(card.id, !card.completed)}
          />
          <Text fontWeight="semibold" lineHeight="1.2">
            {card.title}
          </Text>
        </HStack>

        {/* Descripción breve (opcional) */}
        {card.description ? (
          <Text fontSize="sm" color="gray.300" noOfLines={3}>
            {card.description}
          </Text>
        ) : null}
      </VStack>
    </Box>
  );
}
