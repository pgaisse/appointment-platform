import {
  Box, Button, HStack, IconButton, Input, Popover, PopoverTrigger, PopoverContent,
  PopoverArrow, PopoverCloseButton, PopoverHeader, PopoverBody, Stack, Checkbox,
  Wrap, WrapItem, useDisclosure, useToast,
} from '@chakra-ui/react';
import { SmallCloseIcon } from '@chakra-ui/icons';
import { useMemo, useState } from 'react';
import type { LabelDef, LabelColor } from '@/types/kanban';
import LabelChip from './LabelChip';

const PALETTE: LabelColor[] = ['green','yellow','orange','red','purple','blue','lime','sky','pink','gray','black'];

const uid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto
  ? crypto.randomUUID()
  : `${Date.now().toString(36)}${Math.random().toString(36).slice(2,8)}`);

type Props = {
  topicLabels: LabelDef[];                    // lista de labels disponibles del tópico
  value: LabelDef[];                          // labels asignados a la tarjeta
  onChange: (next: LabelDef[]) => void;       // toggle/crear/editar → devuelve lista asignada
  onCreateLabel?: (l: Omit<LabelDef,'id'>) => Promise<LabelDef> | LabelDef; // opcional: persistir en backend
};

export default function LabelPicker({ topicLabels, value, onChange, onCreateLabel }: Props) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<LabelColor>('green');

  const selectedIds = useMemo(() => new Set(value.map(l => l.id)), [value]);
  const filtered = useMemo(
    () => topicLabels.filter(l => l.name.toLowerCase().includes(query.toLowerCase())),
    [topicLabels, query]
  );

  const toggle = (l: LabelDef) => {
    if (selectedIds.has(l.id)) {
      onChange(value.filter(v => v.id !== l.id));
    } else {
      onChange([...value, l]);
    }
  };

  const create = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const payload = { name, color: newColor } as Omit<LabelDef,'id'>;
      const created = onCreateLabel ? await onCreateLabel(payload) : { id: uid(), ...payload };
      onChange([...value, created]);
      setNewName('');
      toast({ status: 'success', title: 'Label creado' });
    } catch (e) {
      toast({ status: 'error', title: 'No se pudo crear el label' });
    }
  };

  return (
    <Popover isOpen={isOpen} onOpen={onOpen} onClose={onClose} placement="bottom-start">
      <PopoverTrigger>
        <Button size="sm" variant="outline">Labels</Button>
      </PopoverTrigger>
      <PopoverContent w="320px">
        <PopoverArrow />
        <PopoverCloseButton />
        <PopoverHeader>Labels</PopoverHeader>
        <PopoverBody>
          <Stack spacing={3}>
            <Input
              size="sm"
              placeholder="Search labels..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />

            {/* Lista */}
            <Stack spacing={2} maxH="220px" overflowY="auto">
              {filtered.map(l => (
                <HStack key={l.id} spacing={3}>
                  <Checkbox isChecked={selectedIds.has(l.id)} onChange={() => toggle(l)} />
                  <LabelChip label={l} withText />
                </HStack>
              ))}
              {filtered.length === 0 ? (
                <Box fontSize="sm" color="gray.500">No labels</Box>
              ) : null}
            </Stack>

            {/* Crear nuevo */}
            <Box borderTopWidth="1px" pt={3}>
              <HStack mb={2}>
                <Input
                  size="sm"
                  placeholder="Create a new label"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') create(); }}
                />
                <IconButton
                  aria-label="clear"
                  size="sm"
                  icon={<SmallCloseIcon />}
                  variant="ghost"
                  onClick={() => setNewName('')}
                />
              </HStack>
              <Wrap mb={2}>
                {PALETTE.map(c => (
                  <WrapItem key={c}>
                    <Box
                      w="20px"
                      h="20px"
                      rounded="sm"
                      borderWidth={newColor === c ? '2px' : '1px'}
                      borderColor={newColor === c ? 'blue.400' : 'gray.600'}
                      cursor="pointer"
                      onClick={() => setNewColor(c)}
                      bg={`${c === 'black' ? 'black' : `${c}.500`}`}
                    />
                  </WrapItem>
                ))}
              </Wrap>
              <Button size="sm" w="100%" onClick={create} isDisabled={!newName.trim()}>
                Create label
              </Button>
            </Box>
          </Stack>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
}
