// frontend/src/Components/Kanban/CardDetailsModal.tsx
import React, { useEffect, useState } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter,
  ModalCloseButton, Box, HStack, VStack, Text, Input, Textarea, Button,
  Tag, TagLabel, Wrap, WrapItem, IconButton, Checkbox, useToast,
} from '@chakra-ui/react';
import { SmallCloseIcon } from '@chakra-ui/icons';
import type { Card } from '@/types/kanban';

type ChecklistItem = { id: string; text: string; done: boolean };
type Attachment = { id: string; url: string; name?: string };
type CommentItem = { id: string; text: string; createdAt?: string };

type Props = {
  isOpen: boolean;
  card: Card | null;
  onClose: () => void;
  onUpdate: (cardId: string, patch: Partial<Card>) => Promise<void> | void;
};

const uid = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);

// comparación simple (suficiente para nuestro caso)
const isEqual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const CardDetailsModal: React.FC<Props> = ({ isOpen, card, onClose, onUpdate }) => {
  const toast = useToast();
  const [local, setLocal] = useState<Card | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [memberText, setMemberText] = useState('');
  const [checkText, setCheckText] = useState('');
  const [attachUrl, setAttachUrl] = useState('');
  const [attachName, setAttachName] = useState('');

  useEffect(() => {
    setLocal(card ? (JSON.parse(JSON.stringify(card)) as Card) : null);
    setNewLabel('');
    setMemberText('');
    setCheckText('');
    setAttachUrl('');
    setAttachName('');
  }, [card, isOpen]);

  if (!card || !local) return null;

  /** Guarda solo los campos que realmente cambiaron (evita toast “Guardado” sin cambios) */
  const savePatch = async (patch: Partial<Card>) => {
    // filtra claves que no cambiaron respecto al `card` original
    const filteredEntries = Object.entries(patch).filter(([key, val]) => {
      const original = (card as any)[key];
      return !isEqual(original, val);
    });
    if (filteredEntries.length === 0) return; // no hay cambios → no llamamos backend ni mostramos toast

    const filteredPatch = Object.fromEntries(filteredEntries) as Partial<Card>;
    try {
      await onUpdate(card.id, filteredPatch);
      toast({ status: 'success', title: 'Guardado' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error';
      toast({ status: 'error', title: 'No se pudo guardar', description: msg });
    }
  };

  // Labels
  const addLabel = () => {
    const l = newLabel.trim();
    if (!l) return;
    const labels = Array.from(new Set([...(local.labels ?? []), l]));
    setLocal({ ...local, labels });
    setNewLabel('');
  };
  const removeLabel = (l: string) => {
    setLocal({ ...local, labels: (local.labels ?? []).filter((x: string) => x !== l) });
  };

  // Members
  const addMember = () => {
    const m = memberText.trim();
    if (!m) return;
    const members = Array.from(new Set([...(local.members ?? []), m]));
    setLocal({ ...local, members });
    setMemberText('');
  };
  const removeMember = (m: string) => {
    setLocal({ ...local, members: (local.members ?? []).filter((x: string) => x !== m) });
  };

  // Checklist
  const addChecklistItem = () => {
    const t = checkText.trim();
    if (!t) return;
    const checklist: ChecklistItem[] = [
      ...((local.checklist as ChecklistItem[] | undefined) ?? []),
      { id: uid(), text: t, done: false },
    ];
    setLocal({ ...local, checklist: checklist as unknown as Card['checklist'] });
  };
  const toggleChecklist = (id: string) => {
    const checklist: ChecklistItem[] = ((local.checklist as ChecklistItem[] | undefined) ?? [])
      .map((it: ChecklistItem) => (it.id === id ? { ...it, done: !it.done } : it));
    setLocal({ ...local, checklist: checklist as unknown as Card['checklist'] });
  };
  const removeChecklist = (id: string) => {
    const checklist: ChecklistItem[] = ((local.checklist as ChecklistItem[] | undefined) ?? [])
      .filter((it: ChecklistItem) => it.id !== id);
    setLocal({ ...local, checklist: checklist as unknown as Card['checklist'] });
  };

  // Attachments
  const addAttachment = () => {
    const url = attachUrl.trim();
    if (!url) return;
    const attachments: Attachment[] = [
      ...((local.attachments as Attachment[] | undefined) ?? []),
      { id: uid(), url, name: attachName.trim() || undefined },
    ];
    setLocal({ ...local, attachments: attachments as unknown as Card['attachments'] });
    setAttachUrl('');
    setAttachName('');
  };
  const removeAttachment = (id: string) => {
    const attachments: Attachment[] = ((local.attachments as Attachment[] | undefined) ?? [])
      .filter((a: Attachment) => a.id !== id);
    setLocal({ ...local, attachments: attachments as unknown as Card['attachments'] });
  };

  // Comments
  const addComment = (txt: string) => {
    const text = txt.trim();
    if (!text) return;
    const comments: CommentItem[] = [
      ...((local.comments as CommentItem[] | undefined) ?? []),
      { id: uid(), text, createdAt: new Date().toISOString() },
    ];
    setLocal({ ...local, comments: comments as unknown as Card['comments'] });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="6xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <Input
            variant="unstyled"
            fontSize="2xl"
            fontWeight="bold"
            value={local.title}
            onChange={(e) => setLocal({ ...local, title: e.target.value })}
            onBlur={() => {
              const newTitle = local.title.trim();
              // solo guarda si cambió respecto al original
              if (!isEqual(card.title, newTitle)) {
                void savePatch({ title: newTitle });
              }
            }}
          />
        </ModalHeader>
        <ModalCloseButton />

        <ModalBody>
          <HStack align="start" spacing={6}>
            {/* IZQUIERDA */}
            <VStack align="stretch" flex={2} spacing={6}>
              <HStack spacing={3} flexWrap="wrap">
                <Button size="sm" onClick={addLabel}>+ Add</Button>
                <Button size="sm" onClick={() => savePatch({ labels: local.labels ?? [] })}>Labels</Button>
                <Button size="sm" onClick={() => savePatch({ dueDate: local.dueDate ?? null })}>Dates</Button>
                <Button size="sm" onClick={() => savePatch({ checklist: (local.checklist ?? []) as Card['checklist'] })}>Checklist</Button>
                <Button size="sm" onClick={() => savePatch({ attachments: (local.attachments ?? []) as Card['attachments'] })}>Attachment</Button>
              </HStack>

              {/* Members */}
              <Box>
                <Text fontWeight="semibold" mb={2}>Members</Text>
                <HStack mb={2}>
                  <Input
                    placeholder="add member (email/id)"
                    value={memberText}
                    onChange={(e) => setMemberText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') addMember(); }}
                  />
                  <Button onClick={addMember}>Add</Button>
                </HStack>
                <Wrap>
                  {(local.members ?? []).map((m: string) => (
                    <WrapItem key={m}>
                      <Tag>
                        <TagLabel>{m}</TagLabel>
                        <IconButton
                          aria-label="remove"
                          size="xs"
                          variant="ghost"
                          icon={<SmallCloseIcon />}
                          onClick={() => removeMember(m)}
                        />
                      </Tag>
                    </WrapItem>
                  ))}
                </Wrap>
                <Button mt={2} size="sm" onClick={() => savePatch({ members: local.members ?? [] })}>
                  Save members
                </Button>
              </Box>

              {/* Description */}
              <Box>
                <Text fontWeight="semibold" mb={2}>Description</Text>
                <Textarea
                  placeholder="Add a more detailed description..."
                  rows={4}
                  value={local.description ?? ''}
                  onChange={(e) => setLocal({ ...local, description: e.target.value })}
                  onBlur={() => {
                    const newDesc = local.description ?? '';
                    if (!isEqual(card.description ?? '', newDesc)) {
                      void savePatch({ description: newDesc });
                    }
                  }}
                />
              </Box>

              {/* Checklist */}
              <Box>
                <Text fontWeight="semibold" mb={2}>Checklist</Text>
                <HStack mb={2}>
                  <Input
                    placeholder="Add checklist item"
                    value={checkText}
                    onChange={(e) => setCheckText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') addChecklistItem(); }}
                  />
                  <Button onClick={addChecklistItem}>Add</Button>
                </HStack>
                <VStack align="stretch">
                  {((local.checklist as ChecklistItem[] | undefined) ?? []).map((it: ChecklistItem) => (
                    <HStack key={it.id} justify="space-between">
                      <Checkbox isChecked={it.done} onChange={() => toggleChecklist(it.id)}>
                        {it.text}
                      </Checkbox>
                      <IconButton
                        aria-label="remove"
                        size="sm"
                        variant="ghost"
                        icon={<SmallCloseIcon />}
                        onClick={() => removeChecklist(it.id)}
                      />
                    </HStack>
                  ))}
                </VStack>
                <Button mt={2} size="sm" onClick={() => savePatch({ checklist: (local.checklist ?? []) as Card['checklist'] })}>
                  Save checklist
                </Button>
              </Box>

              {/* Attachments */}
              <Box>
                <Text fontWeight="semibold" mb={2}>Attachments</Text>
                <HStack mb={2}>
                  <Input placeholder="https://..." value={attachUrl} onChange={(e) => setAttachUrl(e.target.value)} />
                  <Input placeholder="name (optional)" value={attachName} onChange={(e) => setAttachName(e.target.value)} />
                  <Button onClick={addAttachment}>Add</Button>
                </HStack>
                <VStack align="stretch">
                  {((local.attachments as Attachment[] | undefined) ?? []).map((att: Attachment) => (
                    <HStack key={att.id} justify="space-between">
                      <a href={att.url} target="_blank" rel="noreferrer">{att.name || att.url}</a>
                      <IconButton
                        aria-label="remove"
                        size="sm"
                        variant="ghost"
                        icon={<SmallCloseIcon />}
                        onClick={() => removeAttachment(att.id)}
                      />
                    </HStack>
                  ))}
                </VStack>
                <Button mt={2} size="sm" onClick={() => savePatch({ attachments: (local.attachments ?? []) as Card['attachments'] })}>
                  Save attachments
                </Button>
              </Box>
            </VStack>

            {/* DERECHA */}
            <VStack align="stretch" flex={1} spacing={4}>
              <Text fontWeight="semibold">Comments and activity</Text>
              <Textarea
                placeholder="Write a comment..."
                rows={3}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const val = (e.target as HTMLTextAreaElement).value;
                    addComment(val);
                    (e.target as HTMLTextAreaElement).value = '';
                  }
                }}
              />
              <VStack align="stretch" spacing={3}>
                {((local.comments as CommentItem[] | undefined) ?? [])
                  .slice()
                  .reverse()
                  .map((cm: CommentItem) => (
                    <Box key={cm.id} p={2} borderWidth="1px" rounded="md" bg="gray.700">
                      <Text fontSize="sm">{cm.text}</Text>
                      <Text fontSize="xs" color="gray.400">
                        {cm.createdAt ? new Date(cm.createdAt).toLocaleString() : ''}
                      </Text>
                    </Box>
                  ))}
              </VStack>
              <Button size="sm" onClick={() => savePatch({ comments: (local.comments ?? []) as Card['comments'] })}>
                Save comments
              </Button>
            </VStack>
          </HStack>
        </ModalBody>

        <ModalFooter>
          {/* Labels quick add */}
          <HStack w="100%" justify="space-between">
            <HStack>
              <Input
                size="sm"
                placeholder="add label"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addLabel(); }}
              />
              <Button size="sm" onClick={addLabel}>Add</Button>
              {(local.labels ?? []).length > 0 && (
                <Wrap>
                  {(local.labels ?? []).map((l: string) => (
                    <WrapItem key={l}>
                      <Tag>
                        <TagLabel>{l}</TagLabel>
                        <IconButton
                          aria-label="remove"
                          size="xs"
                          variant="ghost"
                          icon={<SmallCloseIcon />}
                          onClick={() => removeLabel(l)}
                        />
                      </Tag>
                    </WrapItem>
                  ))}
                </Wrap>
              )}
            </HStack>
            <HStack>
              <Button variant="ghost" onClick={onClose}>Close</Button>
              <Button
                colorScheme="blue"
                onClick={() => savePatch({
                  title: local.title,
                  description: local.description,
                  labels: local.labels,
                  members: local.members,
                  dueDate: local.dueDate,
                  checklist: local.checklist,
                  attachments: local.attachments,
                  comments: local.comments,
                })}
              >
                Save all
              </Button>
            </HStack>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default CardDetailsModal;
