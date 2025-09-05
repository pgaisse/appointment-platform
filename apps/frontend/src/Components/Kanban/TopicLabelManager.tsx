import { useState } from 'react';
import {
  Drawer, DrawerOverlay, DrawerContent, DrawerHeader, DrawerBody,
  Box, Stack, HStack, Input, Button, IconButton, useToast, Divider, Text, Card, CardBody
} from '@chakra-ui/react';
import { SmallCloseIcon } from '@chakra-ui/icons';
import type { LabelDef, LabelColor } from '@/types/kanban';
import { useTopicLabels } from '@/Hooks/useTopicLabels';
import LabelChip from './LabelChip';
import ColorSwatchPicker from './ColorSwatchPicker';

export default function TopicLabelManager({
  isOpen, onClose, topicId
}: { isOpen: boolean; onClose: () => void; topicId: string; }) {
  const toast = useToast();
  const { labels, createLabel, updateLabel, deleteLabel } = useTopicLabels(topicId);

  const [name, setName] = useState('');
  const [color, setColor] = useState<LabelColor>('green');

  const save = async () => {
    const n = name.trim(); if (!n) return;
    try {
      await createLabel.mutateAsync({ name: n, color });
      setName(''); setColor('green');
      toast({ status: 'success', title: 'Label created' });
    } catch (e: any) {
      toast({ status: 'error', title: 'Could not create label', description: e?.message || 'Error' });
    }
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} size="md">
      <DrawerOverlay />
      <DrawerContent>
        <DrawerHeader borderBottomWidth="1px">Label catalog</DrawerHeader>
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
                    />
                    <Text mt={2} fontSize="sm" color="gray.400">
                      Preview
                    </Text>
                    <Box mt={1}>
                      <LabelChip label={{ id: 'preview', name: name || 'Label', color }} withText />
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
                  <Button colorScheme="teal" onClick={save} isLoading={createLabel.isPending}>
                    Create
                  </Button>
                  <Button variant="ghost" onClick={() => { setName(''); setColor('green'); }}>
                    Clear
                  </Button>
                </HStack>
              </Stack>
            </CardBody>
          </Card>

          <Divider my={4} />

          {/* Existing */}
          <Stack spacing={3}>
            <Text fontWeight="semibold">Existing labels</Text>
            <Stack spacing={2}>
              {(labels.data ?? []).map((l) => (
                <HStack key={l.id} align="center" justify="space-between" p={2} borderWidth="1px" rounded="md">
                  <HStack spacing={3}>
                    <LabelChip label={l} withText />
                    <Input
                      size="sm"
                      defaultValue={l.name}
                      onBlur={(e) => {
                        const nv = e.target.value.trim();
                        if (nv && nv !== l.name) updateLabel.mutate({ labelId: l.id, patch: { name: nv } });
                      }}
                    />
                  </HStack>
                  <HStack>
                    <ColorSwatchPicker
                      value={l.color}
                      onChange={(c) => updateLabel.mutate({ labelId: l.id, patch: { color: c } })}
                      size="sm"
                    />
                    <IconButton
                      aria-label="Delete label"
                      icon={<SmallCloseIcon />}
                      onClick={() => deleteLabel.mutate(l.id)}
                      variant="ghost"
                    />
                  </HStack>
                </HStack>
              ))}
              {(labels.data ?? []).length === 0 && (
                <Box p={4} borderWidth="1px" rounded="md" textAlign="center" color="gray.400">
                  No labels yet.
                </Box>
              )}
            </Stack>
          </Stack>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
