// apps/frontend/src/Components/Kanban/CardDetailsModal.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter,
  ModalCloseButton, Box, HStack, VStack, Text, Input, Textarea, Button,
  IconButton, Checkbox, Avatar, Divider,
  useToast, useDisclosure, Tooltip, Center, Spinner,
  Popover, PopoverTrigger, PopoverContent, PopoverArrow, PopoverCloseButton, PopoverBody,
  InputGroup, InputLeftElement, useOutsideClick,
} from '@chakra-ui/react';
import { SmallCloseIcon, AddIcon, SearchIcon } from '@chakra-ui/icons';
import type { Card, LabelDef } from '@/types/kanban';
import { useCardComments } from '@/Hooks/useCardComments';
import LabelAssigner from './LabelAssigner';
import { useTopicLabels } from '@/Hooks/useTopicLabels';
import { useSystemUsers, type SystemUser } from '@/Hooks/useSystemUsers';

type Props = {
  isOpen: boolean;
  card: Card | null;
  onClose: () => void;
  onUpdate: (cardId: string, patch: Partial<Card>) => Promise<void> | void;
  topicId: string; // compat
};

const uid = () =>
  crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

// -------- utils (diff + shallow equality) --------
const shallowEq = (a: any, b: any) => {
  if (a === b) return true;
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
};

function diffAgainst<T extends object>(base: Partial<T>, next: Partial<T>) {
  const out: Partial<T> = {};
  (Object.keys(next) as (keyof T)[]).forEach((k) => {
    if (!shallowEq(next[k], base[k])) out[k] = next[k];
  });
  return out;
}

const labelsToIds = (arr?: (LabelDef | string)[] | null): string[] =>
  Array.isArray(arr) ? arr.map((l) => (typeof l === 'string' ? l : l.id)).filter(Boolean) : [];

// Keep only fields que persistimos (labels → ids)
function pickPersistable(card: Card | null): Partial<Card> {
  if (!card) return {};
  const { title, description, members, checklist, attachments } = card;
  const labels = labelsToIds((card as any).labels);
  return { title, description, members, checklist, attachments, labels: labels as any };
}

// ===== avatar visuals =====
const AVATAR_COLORS = ['orange.400','cyan.500','pink.400','purple.500','green.500','blue.500','red.400','yellow.500','teal.500','linkedin.500'];
const pickColor = (seed?: string | null) => { if (!seed) return 'gray.500'; let h = 0; for (let i = 0; i < seed.length; i++) h = (h << 5) - h + seed.charCodeAt(i); return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]; };

// ===== tipo seguro para refs de input (evita error TS) =====
type InputRefLike =
  | React.RefObject<HTMLInputElement>
  | React.MutableRefObject<HTMLInputElement | null>;

/** Contenido del selector de usuarios (dentro del Popover). Controla “click afuera” con useOutsideClick. */
function UserPickerContent({
  alreadySelected,
  onSelect,
  searchRef,
  orgId,
  onRequestClose,
}: {
  alreadySelected: string[];
  onSelect: (u: SystemUser) => void;
  searchRef: InputRefLike;
  orgId?: string;
  onRequestClose?: () => void;
}) {
  const [q, setQ] = useState('');
  const { users } = useSystemUsers(q, true, orgId);

  const contentRef = useRef<HTMLDivElement>(null);
  useOutsideClick({
    ref: contentRef,
    handler: () => onRequestClose?.(),
  });

  const visible = useMemo(() => {
    const selected = new Set(alreadySelected);
    return (users.data || [])
      .filter((u) => (u.status ?? 'active') !== 'blocked')
      .filter((u) => !selected.has(u.id));
  }, [users.data, alreadySelected]);

  return (
    <PopoverContent
      ref={contentRef}
      w="360px"
      bg="white"
      borderColor="gray.100"
      pt={3}
      pr={4}
      boxShadow="lg"
    >
      <PopoverArrow />
      <PopoverCloseButton />
      <PopoverBody>
        <VStack align="stretch" spacing={3}>
          <InputGroup size="sm">
            <InputLeftElement pointerEvents="none">
              <SearchIcon color="gray.400" />
            </InputLeftElement>
            <Input
              ref={searchRef as unknown as React.Ref<HTMLInputElement>}
              placeholder="Search users by name or email"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </InputGroup>

          {users.isLoading && (users.data ?? []).length === 0 ? (
            <Center py={4}><Spinner size="sm" /></Center>
          ) : visible.length === 0 ? (
            <Text fontSize="sm" color="gray.500">No users found.</Text>
          ) : (
            <VStack align="stretch" spacing={1} maxH="260px" overflowY="auto">
              {visible.map((u) => {
                const nm = u.name || u.email || 'User';
                return (
                  <HStack
                    key={u.id}
                    p={2}
                    rounded="md"
                    _hover={{ bg: 'blackAlpha.50' }}
                    justify="space-between"
                  >
                    <HStack>
                      <Avatar
                        size="sm"
                        name={nm}
                        src={u.picture || undefined}
                        bg={pickColor(u.name ?? u.email ?? u.id)}
                        color="white"
                      />
                      <VStack spacing={0} align="start">
                        <Text fontSize="sm" fontWeight="semibold" noOfLines={1}>{nm}</Text>
                        {u.email ? <Text fontSize="xs" color="gray.500" noOfLines={1}>{u.email}</Text> : null}
                      </VStack>
                    </HStack>
                    <Button size="xs" colorScheme="blue" onClick={() => onSelect(u)}>Add</Button>
                  </HStack>
                );
              })}
            </VStack>
          )}
        </VStack>
      </PopoverBody>
    </PopoverContent>
  );
}

const CardDetailsModal: React.FC<Props> = ({ isOpen, card, onClose, onUpdate, topicId }) => {
  const toast = useToast();
  const { onOpen: openMgr } = useDisclosure();
  const { labels: topicLabelsQ } = useTopicLabels(topicId);
  const topicLabels: LabelDef[] = topicLabelsQ.data ?? [];

  // ---------- HOOKS ARRIBA ----------
  const [local, setLocal] = useState<Card | null>(null);

  // UI states
  const [attachUrl, setAttachUrl] = useState('');
  const [attachName, setAttachName] = useState('');
  const [commentDraft, setCommentDraft] = useState('');
  const [isPickerOpen, setPickerOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Comments (protegido por cardId)
  const cardId = card?.id ?? null;
  const { list: comments, add: addComment, remove: removeComment } = useCardComments(cardId);

  // Prefetch usuarios para mostrar avatares de miembros existentes
  const orgId: string | undefined = undefined;
  const { byId: usersById } = useSystemUsers('', true, orgId);

  // Snapshot del servidor (solo campos persistibles)
  const serverSnapshotRef = useRef<Partial<Card>>({});
  useEffect(() => {
    serverSnapshotRef.current = pickPersistable(card);
  }, [
    card?.id, card?.title, card?.description, card?.members, card?.checklist, card?.attachments, (card as any)?.labels,
  ]);

  // Copia local del card
  useEffect(() => {
    if (!isOpen) return;
    try {
      const clone =
        (globalThis as any).structuredClone
          ? (structuredClone as any)(card)
          : card
          ? JSON.parse(JSON.stringify(card))
          : null;
      setLocal(clone);
    } catch {
      setLocal(card ? JSON.parse(JSON.stringify(card)) : null);
    }
  }, [card, isOpen]);
  console.log("card",card)

  // ---- Cola de guardado (debounced + coalesced) ----
  const saveQueueRef = useRef<Partial<Card>>({});
  const isSavingRef = useRef(false);
  const debounceRef = useRef<number | null>(null);
  const lastOkMsgRef = useRef('Saved');

  const flushQueue = async () => {
    if (isSavingRef.current) return;
    const patch = saveQueueRef.current;
    saveQueueRef.current = {};
    if (!patch || !Object.keys(patch).length || !card) return;

    isSavingRef.current = true;
    try {
      await onUpdate(card.id, patch);
      serverSnapshotRef.current = { ...serverSnapshotRef.current, ...patch };
      toast({ status: 'success', title: lastOkMsgRef.current });
    } catch (e: any) {
      toast({ status: 'error', title: 'Could not save', description: e?.message || 'Error' });
    } finally {
      isSavingRef.current = false;
      if (Object.keys(saveQueueRef.current).length) flushQueue();
    }
  };

  const queuePatch = (patch: Partial<Card>, okMsg = 'Saved') => {
    saveQueueRef.current = { ...saveQueueRef.current, ...patch };
    lastOkMsgRef.current = okMsg;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(flushQueue, 250) as unknown as number;
  };

  const queueChanged = (next: Partial<Card>, okMsg?: string) => {
    // normaliza labels → ids antes del diff
    const prepared: Partial<Card> = { ...next } as any;
    if ((next as any).labels) (prepared as any).labels = labelsToIds((next as any).labels);
    const base = serverSnapshotRef.current || {};
    const changes = diffAgainst<Card>(base, prepared);
    if (Object.keys(changes).length) queuePatch(changes, okMsg ?? 'Saved');
  };

  // limpiar cola al cerrar
  useEffect(() => {
    if (!isOpen) {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      saveQueueRef.current = {};
    }
  }, [isOpen]);

  // ---------- early states ----------
  if (!isOpen) return null;

  if (!card || !local) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} size="6xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader />
          <ModalCloseButton />
          <ModalBody>
            <Text color="gray.400">Loading…</Text>
          </ModalBody>
        </ModalContent>
      </Modal>
    );
  }

  // ---------- handlers miembros ----------
  const selectedUsers: SystemUser[] = (local.members || []).map((id) => {
    const u = usersById.get(id);
    return u ?? ({ id, name: null, email: null } as SystemUser);
  });

  const addMember = (u: SystemUser) => {
    const next = Array.from(new Set([...(local.members || []), u.id]));
    setLocal({ ...local, members: next });
    setPickerOpen(false);
    queueChanged({ members: next }, 'Members updated');
  };

  const removeMember = (id: string) => {
    const next = (local.members || []).filter((x) => x !== id);
    setLocal({ ...local, members: next });
    queueChanged({ members: next }, 'Members updated');
  };

  // ---------- render ----------
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
              const t = (local.title || '').trim();
              if (t) queueChanged({ title: t }, 'Title saved');
            }}
          />
        </ModalHeader>
        <ModalCloseButton />

        <ModalBody>
          <HStack align="start" spacing={6}>
            {/* LEFT */}
            <VStack align="stretch" flex={2} spacing={6}>
              {/* Labels */}
              <Box>
                <Text fontWeight="semibold" mb={2}>Labels</Text>
                <HStack spacing={3} flexWrap="wrap">
                  <LabelAssigner
                    topicLabels={topicLabels}
                    value={(local.labels ?? []) as LabelDef[]}
                    onChange={(next) => setLocal({ ...local, labels: next as any })}
                    onCreateRequested={openMgr}
                  />
                  <Button
                    size="sm"
                    onClick={() => queueChanged({ labels: (local.labels ?? []) as any }, 'Labels saved')}
                  >
                    Save labels
                  </Button>
                  <Button size="sm" variant="outline" onClick={openMgr}>
                    Manage labels
                  </Button>
                </HStack>
              </Box>

              {/* Members (usuarios del sistema) */}
              <Box>
                <Text fontWeight="semibold" mb={2}>Members</Text>
                <HStack spacing={3} align="center">
                  {/* Avatares actuales */}
                  <HStack spacing={3}>
                    {selectedUsers.map((u) => {
                      console.log("u",u)
                      const nm = u.name || u.email || 'User';
                      return (
                        <Tooltip key={u.id} label={nm}>
                          <Box position="relative" role="group">
                            <Avatar
                              size="sm"
                              name={nm}
                              src={u.picture || undefined}
                              bg={pickColor(u.name ?? u.email ?? u.id)}
                              color="white"
                            />
                            <IconButton
                              aria-label="remove member"
                              icon={<SmallCloseIcon />}
                              size="2xs"
                              variant="solid"
                              colorScheme="blackAlpha"
                              position="absolute"
                              top="-6px"
                              right="-6px"
                              rounded="full"
                              opacity={0}
                              _groupHover={{ opacity: 1 }}
                              onClick={() => removeMember(u.id)}
                              data-card-action="remove-member"
                            />
                          </Box>
                        </Tooltip>
                      );
                    })}
                  </HStack>

                  {/* Popover controlado (click fuera cierra via useOutsideClick en el content) */}
                  <Popover
                    isOpen={isPickerOpen}
                    onClose={() => setPickerOpen(false)}
                    placement="bottom-start"
                    closeOnBlur={false}
                    initialFocusRef={searchRef}
                  >
                    <PopoverTrigger>
                      <IconButton
                        aria-label="add member"
                        icon={<AddIcon boxSize="3" />}
                        size="sm"
                        rounded="full"
                        variant="ghost"
                        bg="gray.100"
                        _hover={{ bg: 'gray.200' }}
                        onClick={() => setPickerOpen(true)}
                      />
                    </PopoverTrigger>

                    <UserPickerContent
                      alreadySelected={(local.members || []) as string[]}
                      onSelect={addMember}
                      searchRef={searchRef}
                      orgId={orgId}
                      onRequestClose={() => setPickerOpen(false)}
                    />
                  </Popover>
                </HStack>
              </Box>

              {/* Description */}
              <Box>
                <Text fontWeight="semibold" mb={2}>Description</Text>
                <Textarea
                  placeholder="Add a more detailed description..."
                  rows={4}
                  value={local.description || ''}
                  onChange={(e) => setLocal({ ...local, description: e.target.value })}
                  onBlur={() => queueChanged({ description: (local.description || '').trim() }, 'Description saved')}
                />
              </Box>

              {/* Checklist */}
              <Box>
                <Text fontWeight="semibold" mb={2}>Checklist</Text>
                <HStack mb={2}>
                  <Input
                    placeholder="Add checklist item"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const t = (e.currentTarget.value || '').trim();
                        if (!t) return;
                        const checklist = [...(local.checklist || []), { id: uid(), text: t, done: false }];
                        setLocal({ ...local, checklist });
                        queueChanged({ checklist }, 'Checklist saved');
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                  <Button onClick={() => {
                    const t = prompt('Checklist item')?.trim();
                    if (!t) return;
                    const checklist = [...(local.checklist || []), { id: uid(), text: t, done: false }];
                    setLocal({ ...local, checklist });
                    queueChanged({ checklist }, 'Checklist saved');
                  }}>
                    + Add
                  </Button>
                </HStack>
                <VStack align="stretch">
                  {(local.checklist || []).map((it) => (
                    <HStack key={it.id} justify="space-between">
                      <Checkbox
                        isChecked={it.done}
                        onChange={() => {
                          const checklist = (local.checklist || []).map((x) => x.id === it.id ? { ...x, done: !x.done } : x);
                          setLocal({ ...local, checklist });
                          queueChanged({ checklist });
                        }}
                      >
                        {it.text}
                      </Checkbox>
                      <IconButton
                        aria-label="remove"
                        size="sm"
                        variant="ghost"
                        icon={<SmallCloseIcon />}
                        onClick={() => {
                          const checklist = (local.checklist || []).filter((x) => x.id !== it.id);
                          setLocal({ ...local, checklist });
                          queueChanged({ checklist }, 'Checklist saved');
                        }}
                      />
                    </HStack>
                  ))}
                </VStack>
              </Box>

              {/* Attachments */}
              <Box>
                <Text fontWeight="semibold" mb={2}>Attachments</Text>
                <HStack mb={2}>
                  <Input placeholder="https://..." value={attachUrl} onChange={(e) => setAttachUrl(e.target.value)} />
                  <Input placeholder="name (optional)" value={attachName} onChange={(e) => setAttachName(e.target.value)} />
                  <Button onClick={() => {
                    const url = attachUrl.trim();
                    if (!url) return;
                    const attachments = [...(local.attachments || []), { id: uid(), url, name: attachName.trim() || undefined }];
                    setLocal({ ...local, attachments });
                    setAttachUrl(''); setAttachName('');
                    queueChanged({ attachments }, 'Attachments saved');
                  }}>
                    Add
                  </Button>
                </HStack>
                <VStack align="stretch">
                  {(local.attachments || []).map((att) => (
                    <HStack key={att.id} justify="space-between">
                      <a style={{color:"blue" }} href={att.url} target="_blank" rel="noreferrer">{att.name || att.url}</a>
                      <IconButton
                        aria-label="remove"
                        size="sm"
                        variant="ghost"
                        icon={<SmallCloseIcon />}
                        onClick={() => {
                          const attachments = (local.attachments || []).filter((a) => a.id !== att.id);
                          setLocal({ ...local, attachments });
                          queueChanged({ attachments }, 'Attachments saved');
                        }}
                      />
                    </HStack>
                  ))}
                </VStack>
              </Box>
            </VStack>

            {/* RIGHT: Comments */}
            <VStack align="stretch" flex={1} spacing={4}>
              <Text fontWeight="semibold">Comments</Text>

              <HStack>
                <Textarea
                  placeholder="Write a comment…"
                  rows={3}
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      const txt = commentDraft.trim();
                      if (!txt || addComment.isPending) return;
                      try { await addComment.mutateAsync(txt); setCommentDraft(''); } catch {}
                    }
                  }}
                />
                <Button
                  onClick={async () => {
                    const txt = commentDraft.trim();
                    if (!txt || addComment.isPending) return;
                    try { await addComment.mutateAsync(txt); setCommentDraft(''); } catch {}
                  }}
                  isLoading={addComment.isPending}
                >
                  Send
                </Button>
              </HStack>

              <Divider />

              <VStack align="stretch" spacing={3} maxH="380px" overflowY="auto">
                {comments.isLoading ? (
                  <Text color="gray.400">Loading comments…</Text>
                ) : (comments.data || []).length === 0 ? (
                  <Text color="gray.400">No comments yet.</Text>
                ) : (
                  (comments.data || []).slice().reverse().map((cm) => (
                    <HStack key={cm.id} align="start" spacing={3}>
                      <Avatar size="sm" src={cm.author?.picture || undefined} name={cm.author?.name || undefined} />
                      <VStack align="stretch" spacing={1} flex={1}>
                        <HStack justify="space-between">
                          <Text fontSize="sm" fontWeight="semibold">
                            {cm.author?.name || cm.author?.email || 'User'}
                          </Text>
                          <HStack spacing={2}>
                            <Text fontSize="xs" color="gray.400">
                              {cm.createdAt ? new Date(cm.createdAt).toLocaleString() : ''}
                            </Text>
                            <IconButton
                              aria-label="delete comment"
                              size="xs"
                              variant="ghost"
                              icon={<SmallCloseIcon />}
                              onClick={() => removeComment.mutate(cm.id)}
                            />
                          </HStack>
                        </HStack>
                        <Text fontSize="sm">{cm.text}</Text>
                      </VStack>
                    </HStack>
                  ))
                )}
              </VStack>
            </VStack>
          </HStack>
        </ModalBody>

        <ModalFooter>
          <HStack w="100%" justify="flex-end">
            <Button
              variant="ghost"
              onClick={() => {
                if (debounceRef.current) { window.clearTimeout(debounceRef.current); debounceRef.current = null; }
                saveQueueRef.current = {};
                onClose();
              }}
            >
              Close
            </Button>
            <Button
              colorScheme="blue"
              onClick={() => {
                // Encola solo lo que realmente cambió (labels normalizadas a ids)
                queueChanged({
                  title: (local.title || '').trim(),
                  description: (local.description || '').trim(),
                  members: local.members,
                  checklist: local.checklist,
                  attachments: local.attachments,
                  labels: labelsToIds((local as any).labels) as any,
                }, 'Saved');
              }}
            >
              Save all
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default CardDetailsModal;
