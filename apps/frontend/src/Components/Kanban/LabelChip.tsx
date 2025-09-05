import { Box, Text } from '@chakra-ui/react';
import type { LabelDef, LabelColor } from '@/types/kanban';

const colorMap: Record<LabelColor, { bg: string; text: string; border: string }> = {
  green:  { bg: 'green.500',  text: 'white', border: 'green.600'  },
  yellow: { bg: 'yellow.400', text: 'black', border: 'yellow.500' },
  orange: { bg: 'orange.400', text: 'black', border: 'orange.500' },
  red:    { bg: 'red.500',    text: 'white', border: 'red.600'    },
  purple: { bg: 'purple.500', text: 'white', border: 'purple.600' },
  blue:   { bg: 'blue.500',   text: 'white', border: 'blue.600'   },
  lime:   { bg: 'lime.400',   text: 'black', border: 'lime.500'   },
  sky:    { bg: 'cyan.400',   text: 'black', border: 'cyan.500'   },
  pink:   { bg: 'pink.400',   text: 'black', border: 'pink.500'   },
  gray:   { bg: 'gray.500',   text: 'white', border: 'gray.600'   },
  black:  { bg: 'black',      text: 'white', border: 'black'      },
};

export default function LabelChip({ label, withText = false }: { label: LabelDef; withText?: boolean }) {
  const c = colorMap[label.color] ?? colorMap.gray;
  return (
    <Box
      as="span"
      display="inline-flex"
      px={withText ? 2 : 0}
      h="8px"
      minW={withText ? 'auto' : '40px'}
      rounded="sm"
      bg={c.bg}
      borderWidth="1px"
      borderColor={c.border}
      alignItems="center"
      justifyContent="center"
      lineHeight="8px"
    >
      {withText ? <Text fontSize="xs" color={c.text}>{label.name}</Text> : null}
    </Box>
  );
}
