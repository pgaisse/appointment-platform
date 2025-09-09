import React from 'react';
import { Box, HStack, Text } from '@chakra-ui/react';
import type { LabelDef, LabelColor } from '@/types/kanban';

const COLOR_HEX: Record<LabelColor, string> = {
  green:  '#22c55e',
  yellow: '#eab308',
  orange: '#f97316',
  red:    '#ef4444',
  purple: '#a855f7',
  blue:   '#3b82f6',
  lime:   '#84cc16',
  sky:    '#0ea5e9',
  pink:   '#ec4899',
  gray:   '#64748b',
  black:  '#111827',
};

// Perceptual luminance for readable text color
function textColorFor(bgHex: string) {
  const hex = bgHex.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return L > 0.58 ? 'black' : 'white';
}

export default function LabelChip({
  label,
  withText = false,
  size = 'sm',
}: {
  label: LabelDef;
  withText?: boolean;
  size?: 'sm' | 'md';
}) {
  const bg = COLOR_HEX[label.color] ?? '#64748b';
  const fg = textColorFor(bg);
  const styles =
    size === 'sm'
      ? { h: '20px', fontSize: '11px', px: 2 }
      : { h: '24px', fontSize: '12px', px: 2.5 };

  return (
    <HStack
      as="span"
      spacing={1.5}
      bg={bg}
      color={fg}
      borderRadius="md"
      height={styles.h}
      px={styles.px}
      lineHeight="1"
      fontWeight="semibold"
      whiteSpace="nowrap"
      maxW="100%"
    >
      {/* small leading dot for aesthetics */}
      <Box
        w="6px"
        h="6px"
        borderRadius="full"
        bg="whiteAlpha.900"
        opacity={fg === 'white' ? 0.65 : 0.35}
      />
      {withText ? (
        <Text
          as="span"
          fontSize={styles.fontSize}
          noOfLines={1}
          textOverflow="ellipsis"
          overflow="hidden"
          maxW="220px"
        >
          {label.name}
        </Text>
      ) : null}
    </HStack>
  );
}
