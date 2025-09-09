import React from 'react';
import { Wrap, WrapItem, IconButton } from '@chakra-ui/react';
import type { LabelColor } from '@/types/kanban';

const PALETTE: LabelColor[] = [
  'green','yellow','orange','red','purple','blue','lime','sky','pink','gray','black'
];

const HEX: Record<LabelColor, string> = {
  green:'#22c55e', yellow:'#eab308', orange:'#f97316', red:'#ef4444',
  purple:'#a855f7', blue:'#3b82f6', lime:'#84cc16', sky:'#0ea5e9',
  pink:'#ec4899', gray:'#64748b', black:'#111827'
};

export default function ColorSwatchPicker({
  value,
  onChange,
  size = 'md',
}: {
  value?: LabelColor;
  onChange: (c: LabelColor) => void;
  size?: 'sm' | 'md';
}) {
  const dim = size === 'sm' ? '22px' : '28px';

  return (
    <Wrap spacing={2}>
      {PALETTE.map((c) => (
        <WrapItem key={c}>
          <IconButton
            aria-label="Pick color"
            onClick={() => onChange(c)}
            minW={dim}
            h={dim}
            borderRadius="full"
            bg={HEX[c]}
            _hover={{ transform: 'scale(1.06)' }}
            borderWidth={value === c ? '2px' : '1px'}
            borderColor={value === c ? 'whiteAlpha.900' : 'blackAlpha.500'}
            boxShadow={value === c ? '0 0 0 2px rgba(255,255,255,0.25)' : 'none'}
          />
        </WrapItem>
      ))}
    </Wrap>
  );
}
