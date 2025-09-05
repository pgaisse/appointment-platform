import { Checkbox, HStack, Input, Popover, PopoverArrow, PopoverBody, PopoverContent, PopoverHeader, PopoverTrigger, Stack, Button } from '@chakra-ui/react';
import { useMemo, useState } from 'react';
import type { LabelDef } from '@/types/kanban';
import LabelChip from './LabelChip';

type Props = {
  topicLabels: LabelDef[];
  value: LabelDef[];                     // asignados a la tarjeta (objetos)
  onChange: (next: LabelDef[]) => void;  // devuelve la lista actualizada
};

export default function LabelAssigner({ topicLabels, value, onChange }: Props) {
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
        <Button size="sm" variant="outline">Asignar labels</Button>
      </PopoverTrigger>
      <PopoverContent w="320px">
        <PopoverArrow />
        <PopoverHeader>Labels del tópico</PopoverHeader>
        <PopoverBody>
          <Stack spacing={3}>
            <Input size="sm" placeholder="Buscar..." value={q} onChange={e => setQ(e.target.value)} />
            <Stack spacing={2} maxH="240px" overflowY="auto">
              {filtered.map(l => (
                <HStack key={l.id} spacing={3}>
                  <Checkbox isChecked={selectedIds.has(l.id)} onChange={() => toggle(l)} />
                  <LabelChip label={l} withText />
                </HStack>
              ))}
              {filtered.length === 0 && <Button size="sm" variant="ghost" isDisabled>No hay labels</Button>}
            </Stack>
          </Stack>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
}
