import { useState } from 'react';
import {
    Box, Button, Drawer, DrawerBody, DrawerContent, DrawerHeader, DrawerOverlay,
    HStack, Input, Select, Stack, IconButton, useToast
} from '@chakra-ui/react';
import { SmallCloseIcon } from '@chakra-ui/icons';
import type { LabelDef, LabelColor } from '@/types/kanban';
import { useTopicLabels } from '@/Hooks/useTopicLabels';
import LabelChip from './LabelChip';

const PALETTE: LabelColor[] = ['green', 'yellow', 'orange', 'red', 'purple', 'blue', 'lime', 'sky', 'pink', 'gray', 'black'];

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
            toast({ status: 'success', title: 'Label creado' });
        } catch (e: any) {
            toast({ status: 'error', title: 'No se pudo crear', description: e?.message || 'Error' });
        }
    };

    return (
        <Drawer isOpen={isOpen} onClose={onClose} size="sm">
            <DrawerOverlay />
            <DrawerContent>
                <DrawerHeader>Catálogo de labels</DrawerHeader>
                <DrawerBody>
                    <Stack spacing={4}>
                        <HStack>
                            <Input placeholder="Nombre del label" value={name} onChange={e => setName(e.target.value)} />
                            <Select value={color} onChange={e => setColor(e.target.value as LabelColor)}>
                                {PALETTE.map(c => <option key={c} value={c}>{c}</option>)}
                            </Select>
                            <Button onClick={save} isLoading={createLabel.isPending}>Crear</Button>
                        </HStack>

                        <Box borderTopWidth="1px" pt={3}>
                            <Stack spacing={2}>
                                {(labels.data ?? []).map(l => (
                                    <HStack key={l.id} justify="space-between">
                                        <HStack>
                                            <LabelChip label={l} withText />
                                            <Input
                                                size="sm"
                                                defaultValue={l.name}
                                                onBlur={e => {
                                                    const nv = e.target.value.trim();
                                                    if (nv && nv !== l.name) updateLabel.mutate({ labelId: l.id, patch: { name: nv } });
                                                }}
                                            />
                                            <Select
                                                value={color}
                                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                                                    setColor(e.target.value as LabelColor)
                                                }
                                            >
                                                {PALETTE.map(c => <option key={c} value={c}>{c}</option>)}
                                            </Select>
                                        </HStack>
                                        <IconButton
                                            aria-label="delete"
                                            icon={<SmallCloseIcon />}
                                            onClick={() => deleteLabel.mutate(l.id)}
                                            variant="ghost"
                                        />
                                    </HStack>
                                ))}
                            </Stack>
                        </Box>
                    </Stack>
                </DrawerBody>
            </DrawerContent>
        </Drawer>
    );
}
