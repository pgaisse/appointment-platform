// AppointmentLabelManager - Drawer for managing shared labels (Organizer + Appointments)
import { useState } from 'react';
import {
  Drawer, DrawerOverlay, DrawerContent, DrawerHeader, DrawerBody,
  Box, Stack, HStack, Input, Button, IconButton, useToast, Divider, Text, Card, CardBody
} from '@chakra-ui/react';
import { SmallCloseIcon } from '@chakra-ui/icons';
import type { LabelColor } from '@/types/kanban';
import { useAppointmentLabels } from '@/Hooks/useAppointmentLabels';
import LabelChip from '../Kanban/LabelChip';
import ColorSwatchPicker from '../Kanban/ColorSwatchPicker';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export default function AppointmentLabelManager({ isOpen, onClose }: Props) {
  const toast = useToast();
  const { labels, createLabel, updateLabel, deleteLabel } = useAppointmentLabels();

  const [name, setName] = useState('');
  const [color, setColor] = useState<LabelColor>('green');

  const save = async () => {
    const n = name.trim();
    if (!n) return;
    
    try {
      await createLabel.mutateAsync({ name: n, color });
      setName('');
      setColor('green');
      toast({ status: 'success', title: 'Label created' });
    } catch (e: any) {
      toast({ 
        status: 'error', 
        title: 'Could not create label', 
        description: e?.message || 'Error' 
      });
    }
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} size="md">
      <DrawerOverlay />
      <DrawerContent>
        <DrawerHeader borderBottomWidth="1px">Label Catalog (Shared: Organizer + Appointments)</DrawerHeader>
        <DrawerBody>
          {/* Create new */}
          <Card variant="outline" mb={4}>
            <CardBody>
              <Stack spacing={4}>
                <Text fontWeight="semibold">New label</Text>
                <HStack align="start" spacing={4}>
                  <Box flex="1">
                    <Input
                      placeholder="Label name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') save();
                      }}
                    />
                    <Text mt={2} fontSize="sm" color="gray.400">
                      Preview
                    </Text>
                    <Box mt={1}>
                      <LabelChip 
                        label={{ id: 'preview', name: name || 'Label', color }} 
                        withText 
                      />
                    </Box>
                  </Box>
                  <Box>
                    <ColorSwatchPicker
                      value={color}
                      onChange={(c) => setColor(c)}
                      size="md"
                    />
                  </Box>
                </HStack>
                <HStack>
                  <Button 
                    colorScheme="teal" 
                    onClick={save} 
                    isLoading={createLabel.isPending}
                  >
                    Create
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={() => { setName(''); setColor('green'); }}
                  >
                    Clear
                  </Button>
                </HStack>
              </Stack>
            </CardBody>
          </Card>

          <Divider my={4} />

          {/* Existing labels */}
          <Stack spacing={3}>
            <Text fontWeight="semibold">Existing labels</Text>
            <Stack spacing={2}>
              {labels.length === 0 ? (
                <Text fontSize="sm" color="gray.400">No labels yet. Create your first one above.</Text>
              ) : (
                labels.map((l) => (
                  <HStack 
                    key={l.id} 
                    align="center" 
                    justify="space-between" 
                    p={2} 
                    borderWidth="1px" 
                    rounded="md"
                  >
                    <HStack spacing={3} flex="1">
                      <LabelChip label={l} withText />
                      <Input
                        size="sm"
                        defaultValue={l.name}
                        onBlur={(e) => {
                          const nv = e.target.value.trim();
                          if (nv && nv !== l.name) {
                            updateLabel.mutateAsync(l.id, { name: nv });
                          }
                        }}
                      />
                    </HStack>
                    <HStack>
                      <ColorSwatchPicker
                        value={l.color}
                        onChange={(c) => updateLabel.mutateAsync(l.id, { color: c })}
                        size="sm"
                      />
                      <IconButton
                        aria-label="Delete label"
                        icon={<SmallCloseIcon />}
                        onClick={() => {
                          if (confirm(`Delete label "${l.name}"?`)) {
                            deleteLabel.mutateAsync(l.id);
                          }
                        }}
                        variant="ghost"
                        colorScheme="red"
                        size="sm"
                      />
                    </HStack>
                  </HStack>
                ))
              )}
            </Stack>
          </Stack>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
