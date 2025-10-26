import { Checkbox, HStack, Input, Popover, PopoverArrow, PopoverBody, PopoverContent, PopoverHeader, PopoverTrigger, Stack, Button, Flex } from '@chakra-ui/react';
import { AddIcon } from '@chakra-ui/icons';
import { useMemo, useState } from 'react';
import type { LabelDef } from '@/types/kanban';
import LabelChip from './LabelChip';

type Props = {
  topicLabels: LabelDef[];
  value: LabelDef[];                     // assigned (hydrated objects)
  onChange: (next: LabelDef[]) => void;
  onCreateRequested?: () => void;        // opens the manager
};

export default function LabelAssigner({ topicLabels, value, onChange, onCreateRequested }: Props) {
  const [q, setQ] = useState('');
  const selectedIds = useMemo(() => new Set(value.map(l => l.id)), [value]);
  const filtered = useMemo(
    () => topicLabels.filter(l => l.name.toLowerCase().includes(q.toLowerCase())),
    [topicLabels, q]
  );
  const toggle = (l: LabelDef) => {
    if (selectedIds.has(l.id)) onChange(value.filter(v => v.id !== l.id));
    else onChange([...value, l]);
  };

  return (
    <Popover placement="bottom-start">
      <PopoverTrigger>
        <Button size="sm" variant="outline" minW="120px" whiteSpace="nowrap">Assign labels</Button>
      </PopoverTrigger>
      <PopoverContent w="420px">
        <PopoverArrow />
        <PopoverHeader>
          <Flex align="center" justify="space-between" gap={2}>
            <Input size="sm" placeholder="Search labels..." value={q} onChange={e => setQ(e.target.value)} />
            <Button
              size="sm"
              leftIcon={<AddIcon />}
              onClick={onCreateRequested}
              whiteSpace="nowrap"
              px={3}
              minW="110px"
              flexShrink={0}
            >
              New label
            </Button>
          </Flex>
        </PopoverHeader>
        <PopoverBody>
          <Stack spacing={2} maxH="260px" overflowY="auto">
            {filtered.map(l => (
              <HStack key={l.id} spacing={3}>
                <Checkbox isChecked={selectedIds.has(l.id)} onChange={() => toggle(l)} />
                <LabelChip label={l} withText />
              </HStack>
            ))}
            {filtered.length === 0 && <Button size="sm" variant="ghost" isDisabled>No labels found</Button>}
          </Stack>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
}
