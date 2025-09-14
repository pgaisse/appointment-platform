// frontend/src/Components/Kanban/CardView.tsx
import { Box, Text, VStack, HStack, Tooltip } from '@chakra-ui/react';
import type { Card, LabelColor } from '@/types/kanban';
import CompletionRadio from '@/Components/Kanban/CompletionRadio';
import DeleteCardButton from '../Cards/DeleteCardButton';
import Gate from '@/auth/Gate';
import TokenLinkText from '../Mentions/TokenLinkText';

// Mapea tu LabelColor a tokens de Chakra
const colorToken = (c?: LabelColor | string) => {
  switch (c) {
    case 'green': return 'green.400';
    case 'yellow': return 'yellow.400';
    case 'orange': return 'orange.400';
    case 'red': return 'red.400';
    case 'purple': return 'purple.400';
    case 'blue': return 'blue.400';
    case 'lime': return 'lime.400';
    case 'sky': return 'cyan.400';
    case 'pink': return 'pink.400';
    case 'gray': return 'gray.400';
    case 'black': return 'blackAlpha.700';
    default: return 'gray.500';
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
      {/* Botón “X” arriba a la derecha (sin romper estilos ni lógica) */}
      <Box
        position="absolute"
        top="6px"
        right="6px"
        zIndex={2}
        // Forzamos al IconButton interno a verse como una “X”
        sx={{
          '[data-card-action="delete"]': {
            w: '22px',
            h: '22px',
            minW: '22px',
            p: 0,
            borderRadius: 'full',
            bg: 'transparent',
            _hover: { bg: 'whiteAlpha.200' },
          },
          '[data-card-action="delete"] svg': { display: 'none' }, // ocultar ícono de trash
          '[data-card-action="delete"]::after': {
            content: '"×"',
            fontWeight: 700,
            fontSize: '14px',
            lineHeight: '22px',
            display: 'inline-block',
            textAlign: 'center',
          },
        }}
      >
        <Gate requireAnyPerms={["card:delete"]} source="all">
          <DeleteCardButton
            cardId={card.id}
            cardTitle={card.title}
            size="xs"
            variant="ghost"
          />
        </Gate>
      </Box>

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
           <TokenLinkText text={card.title} />
          </Text>
        </HStack>

        {/* Descripción breve (opcional) */}
        {card.description ? (
          <Text fontSize="sm" color="gray.300" noOfLines={3}>
            <TokenLinkText text={card.description} />
          </Text>
        ) : null}
      </VStack>
    </Box>
  );
}
