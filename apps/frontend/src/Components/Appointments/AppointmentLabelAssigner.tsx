// AppointmentLabelAssigner - Popover for assigning labels to appointment slots
import { 
  Checkbox, HStack, Input, Popover, PopoverArrow, PopoverBody, 
  PopoverContent, PopoverHeader, PopoverTrigger, Stack, Button, Flex 
} from '@chakra-ui/react';
import { AddIcon } from '@chakra-ui/icons';
import { useMemo, useState } from 'react';
import type { LabelDef } from '@/types/kanban';
import LabelChip from '../Kanban/LabelChip';

type Props = {
  orgLabels: LabelDef[];           // all available labels (shared between organizer and appointments)
  value: string[];                             // assigned label IDs
  onChange: (labelIds: string[]) => void;      // update assigned labels
  onCreateRequested?: () => void;              // opens the manager drawer
};

export default function AppointmentLabelAssigner({ 
  orgLabels, 
  value, 
  onChange, 
  onCreateRequested 
}: Props) {
  const [q, setQ] = useState('');
  
  // Convert value (string[]) to set for quick lookup
  const selectedIds = useMemo(() => new Set(value), [value]);
  
  // Filter labels by search query
  const filtered = useMemo(
    () => orgLabels.filter(l => l.name.toLowerCase().includes(q.toLowerCase())),
    [orgLabels, q]
  );

  // Toggle label selection
  const toggle = (labelId: string) => {
    if (selectedIds.has(labelId)) {
      onChange(value.filter(id => id !== labelId));
    } else {
      onChange([...value, labelId]);
    }
  };

  return (
    <Popover placement="bottom-start">
      <PopoverTrigger>
        <Button size="sm" variant="outline" minW="120px" whiteSpace="nowrap">
          Assign labels
        </Button>
      </PopoverTrigger>
      <PopoverContent w="420px">
        <PopoverArrow />
        <PopoverHeader>
          <Flex align="center" justify="space-between" gap={2}>
            <Input 
              size="sm" 
              placeholder="Search labels..." 
              value={q} 
              onChange={e => setQ(e.target.value)} 
            />
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
                <Checkbox 
                  isChecked={selectedIds.has(l.id)} 
                  onChange={() => toggle(l.id)} 
                />
                <LabelChip label={l} withText />
              </HStack>
            ))}
            {filtered.length === 0 && (
              <Button size="sm" variant="ghost" isDisabled>
                No labels found
              </Button>
            )}
          </Stack>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
}
