// frontend/src/Components/Kanban/CardView.tsx
import { Box, Text, VStack, HStack, Tooltip, Avatar } from '@chakra-ui/react';
import type { Card, LabelColor } from '@/types/kanban';
import CompletionRadio from '@/Components/Kanban/CompletionRadio';
import DeleteCardButton from '../Cards/DeleteCardButton';
import Gate from '@/auth/Gate';
import TokenLinkText from '../Mentions/TokenLinkText';
import { useSystemUsers } from '@/Hooks/useSystemUsers';

// ------- helpers -------
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

// colores determinísticos para avatares (cuando no hay foto)
const AVATAR_COLORS = ['orange.400','cyan.500','pink.400','purple.500','green.500','blue.500','red.400','yellow.500','teal.500','linkedin.500'];
const pickAvatarColor = (seed?: string | null) => {
  if (!seed) return 'gray.500';
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h << 5) - h + seed.charCodeAt(i);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
};
const initialsFrom = (name?: string | null, email?: string | null, id?: string) => {
  const base = (name || email || id || '').trim();
  if (!base) return '•';
  // Si es email, toma la parte previa a @
  const cleaned = base.includes('@') ? base.split('@')[0] : base;
  const parts = cleaned.replace(/[_\-\.]+/g, ' ').split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

export default function CardView({card,onOpen,onToggleComplete,}: {card: Card;onOpen?: (card: Card) => void; onToggleComplete?: (cardId: string, next: boolean) => void;
}) {
  const labels = card.labels ?? [];
  const memberIds = card.members ?? [];

  // Un único fetch/cache para todo el board (key estable: ['', 'all'])
  const { byId: usersById } = useSystemUsers('', true);

  // Prepara data de miembros visuales
  const visualMembers = memberIds.map((id) => {
    const u = usersById.get(id);
    const name = u?.name ?? null;
    const email = u?.email ?? null;
    const picture = u?.picture ?? null;
    const initials = initialsFrom(name, email, id);
    const bg = pickAvatarColor(name ?? email ?? id);
    return { id, name, email, picture, initials, bg };
  });

  const MAX_SHOWN = 5;
  const shown = visualMembers.slice(0, MAX_SHOWN);
  const extra = visualMembers.length - shown.length;

  return (
    <Box
      role="group"
      position="relative"
      p={3}
      rounded="md"
      borderWidth="1px"
      bg="gray.700"
      _hover={{ bg: 'gray.650', borderColor: 'gray.500' }}
      cursor="pointer"
      onClick={() => onOpen?.(card)}
    >
      {/* Botón “X” arriba derecha */}
      <Box
        position="absolute"
        top="6px"
        right="6px"
        zIndex={2}
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
          '[data-card-action="delete"] svg': { display: 'none' },
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
        <Gate requireAnyPerms={['card:delete']} source="all">
          <DeleteCardButton
            cardId={card.id}
            cardTitle={card.title}
            size="xs"
            variant="ghost"
          />
        </Gate>
      </Box>

      <VStack align="stretch" spacing={2}>
        {/* Labels barras finas */}
        {labels.length > 0 && (
          <HStack spacing={1} mb={1}>
            {labels.map((l) => (
              <Tooltip key={l.id} label={l.name}>
                <Box h="6px" w="38px" rounded="full" bg={colorToken(l.color)} />
              </Tooltip>
            ))}
          </HStack>
        )}

        {/* Título + radio */}
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

        {/* Descripción breve */}
        {card.description ? (
          <Text fontSize="sm" color="gray.300" noOfLines={3}>
            <TokenLinkText text={card.description} />
          </Text>
        ) : null}

        {/* Miembros (avatares) */}
        {visualMembers.length > 0 && (
          <HStack spacing={1.5} justify="flex-end" pt={1}>
            {shown.map((m) => (
              <Tooltip key={m.id} label={m.name || m.email || 'User'}>
                <Avatar
                  size="xs"
                  name={m.name || m.email || m.initials}
                  src={m.picture || undefined}
                  bg={m.picture ? undefined : m.bg}
                  color="white"
                />
              </Tooltip>
            ))}
            {extra > 0 && (
              <Box
                as="span"
                bg="gray.600"
                color="gray.100"
                rounded="full"
                px="2"
                h="24px"
                lineHeight="24px"
                fontSize="xs"
                fontWeight="semibold"
              >
                +{extra}
              </Box>
            )}
          </HStack>
        )}
      </VStack>
    </Box>
  );
}
