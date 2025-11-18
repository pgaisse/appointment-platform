import { Box, Button, HStack, Input, Tag, Tooltip, VStack, Text, Wrap, WrapItem, Divider } from '@chakra-ui/react';
import { useMemo, useState } from 'react';

export type LiquidSnippet = {
  label: string;
  code: string;
  category: 'Patient' | 'Appointment' | 'Organization' | 'Filters';
};

interface LiquidTokenPaletteProps {
  onInsert: (code: string) => void;
  size?: 'xs' | 'sm' | 'md';
  compact?: boolean;
}

const DEFAULT_SNIPPETS: LiquidSnippet[] = [
  // Patient
  { label: 'Patient name', code: "{{ patient.nameInput | default: 'Patient' }}", category: 'Patient' },
  { label: 'Patient last name', code: "{{ patient.lastNameInput }}", category: 'Patient' },
  { label: 'Phone', code: "{{ patient.phoneInput }}", category: 'Patient' },
  // Appointment (computed latest)
  { label: 'Latest start (dd/MM/yyyy HH:mm)', code: "{{ patient.latestSlot.startDate | date: 'dd/LL/yyyy HH:mm' }}", category: 'Appointment' },
  { label: 'Latest end (dd/MM/yyyy HH:mm)', code: "{{ patient.latestSlot.endDate | date: 'dd/LL/yyyy HH:mm' }}", category: 'Appointment' },
  // Org
  { label: 'Org id', code: "{{ org.id }}", category: 'Organization' },
  // Filters examples
  { label: 'Uppercase', code: "{{ patient.nameInput | upcase }}", category: 'Filters' },
  { label: 'Lowercase', code: "{{ patient.nameInput | downcase }}", category: 'Filters' },
  { label: 'Default value', code: "{{ patient.nameInput | default: 'Patient' }}", category: 'Filters' },
  { label: 'Truncate (20)', code: "{{ patient.nameInput | truncate: 20 }}", category: 'Filters' },
];

export default function LiquidTokenPalette({ onInsert, size = 'xs', compact = false }: LiquidTokenPaletteProps) {
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return DEFAULT_SNIPPETS;
    return DEFAULT_SNIPPETS.filter(s => s.label.toLowerCase().includes(term) || s.code.toLowerCase().includes(term));
  }, [q]);

  const byCategory = useMemo(() => {
    const map: Record<string, LiquidSnippet[]> = {};
    for (const s of filtered) {
      map[s.category] = map[s.category] || [];
      map[s.category].push(s);
    }
    return map;
  }, [filtered]);

  return (
    <Box>
      <HStack mb={2}>
        <Input size={size} placeholder="Search tokens…" value={q} onChange={(e) => setQ(e.target.value)} />
        {!compact && (
          <Tag size={size} colorScheme="purple" variant="subtle">Liquid</Tag>
        )}
      </HStack>
      <VStack align="stretch" spacing={3}>
        {Object.entries(byCategory).map(([cat, items]) => (
          <Box key={cat}>
            <HStack justify="space-between" mb={2}>
              <Text fontSize="sm" fontWeight="semibold" color="gray.700">{cat}</Text>
              <Tag size="xs">{items.length}</Tag>
            </HStack>
            <Wrap spacing={2}>
              {items.map(s => (
                <WrapItem key={s.label}>
                  <Tooltip label={s.code} hasArrow>
                    <Button size={size} variant="outline" onClick={() => onInsert(s.code)}>
                      {s.label}
                    </Button>
                  </Tooltip>
                </WrapItem>
              ))}
            </Wrap>
            <Divider my={3} />
          </Box>
        ))}
      </VStack>
    </Box>
  );
}
