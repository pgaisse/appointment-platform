import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Heading, HStack, VStack, Button, Select, useToast, useDisclosure, Modal, ModalOverlay,
  ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton, Input, Textarea,
  FormControl, FormLabel, Text, Wrap, WrapItem, Tag, TagLabel, Divider, SimpleGrid, Spinner
} from '@chakra-ui/react';
import { AddIcon } from '@chakra-ui/icons';
import { useTopics } from '@/Hooks/useTopics';
import { useTopicBoard } from '@/Hooks/useTopicBoard';
import type { BoardData, Column } from '@/types/kanban';
import KanbanBoard from '@/Components/Kanban/KanbanBoard';

function uid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export default function App() {
  const toast = useToast();

  const { topics, createTopic } = useTopics();
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedTopic && topics.data && topics.data.length > 0) {
      setSelectedTopic(topics.data[0].id);
    }
  }, [topics.data, selectedTopic]);

  const { board, createColumn, createCard, onMoveCard } = useTopicBoard(selectedTopic ?? '');

  const data: BoardData = board.data ?? { columns: [], cardsByColumn: {} };
  const hasColumns = data.columns.length > 0;

  // Nuevo tópico
  const newTopic = useDisclosure();
  const [topicTitle, setTopicTitle] = useState('');
  const [topicKey, setTopicKey] = useState('');
  const handleCreateTopic = async () => {
    const title = topicTitle.trim();
    if (!title) { toast({ status: 'warning', title: 'Ponle un nombre al tópico' }); return; }
    try {
      const t = await createTopic.mutateAsync({ title, key: topicKey.trim() || undefined });
      setTopicTitle(''); setTopicKey(''); newTopic.onClose();
      toast({ status: 'success', title: 'Tópico creado' });
      setSelectedTopic(t.id);
    } catch (e: any) {
      toast({ status: 'error', title: 'No se pudo crear el tópico', description: e?.message || 'Error desconocido' });
    }
  };

  // Nueva columna
  const newCol = useDisclosure();
  const [colTitle, setColTitle] = useState('');
  const handleCreateColumn = async () => {
    const title = colTitle.trim();
    if (!title) { toast({ status: 'warning', title: 'Ponle un nombre a la columna' }); return; }
    try {
      await createColumn.mutateAsync(title);
      setColTitle(''); newCol.onClose();
      toast({ status: 'success', title: 'Columna creada' });
    } catch (e: any) {
      toast({ status: 'error', title: 'No se pudo crear la columna', description: e?.message || 'Error desconocido' });
    }
  };

  // Nueva tarjeta
  const newCard = useDisclosure();
  const [cardColumnId, setCardColumnId] = useState<string>('');
  const [cardTitle, setCardTitle] = useState('');
  const [cardDesc, setCardDesc] = useState('');
  const [labelsInput, setLabelsInput] = useState('');
  const [membersInput, setMembersInput] = useState('');
  const [dueDate, setDueDate] = useState<string>('');
  const [coverUrl, setCoverUrl] = useState<string>('');
  const [checkText, setCheckText] = useState('');
  const [checklist, setChecklist] = useState<Array<{ id: string; text: string; done: boolean }>>([]);

  useEffect(() => {
    if (newCard.isOpen && !cardColumnId && data.columns.length > 0) {
      setCardColumnId(data.columns[0].id);
    }
  }, [newCard.isOpen, cardColumnId, data.columns]);

  const labels = useMemo(() => labelsInput.split(',').map(s => s.trim()).filter(Boolean), [labelsInput]);
  const members = useMemo(() => membersInput.split(',').map(s => s.trim()).filter(Boolean), [membersInput]);

  const handleAddChecklistItem = () => {
    const t = checkText.trim();
    if (!t) return;
    setChecklist(prev => [...prev, { id: uid(), text: t, done: false }]);
    setCheckText('');
  };

  const handleCreateCard = async () => {
    if (!cardColumnId) { toast({ status: 'warning', title: 'Selecciona una columna' }); return; }
    if (!cardTitle.trim()) { toast({ status: 'warning', title: 'Ponle un título a la tarjeta' }); return; }
    try {
      await createCard.mutateAsync({
        columnId: cardColumnId,
        title: cardTitle.trim(),
        description: cardDesc.trim(),
        labels,
        members,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        coverUrl: coverUrl.trim() || null,
        checklist,
        attachments: [],
        comments: [],
      });
      setCardTitle(''); setCardDesc(''); setLabelsInput(''); setMembersInput(''); setDueDate(''); setCoverUrl(''); setChecklist([]);
      newCard.onClose();
      toast({ status: 'success', title: 'Tarjeta creada' });
    } catch (e: any) {
      toast({ status: 'error', title: 'No se pudo crear la tarjeta', description: e?.message || 'Error desconocido' });
    }
  };

  return (
    <Box p={6}>
      <HStack justify="space-between" mb={4}>
        <Heading size="lg">Kanban — Tópicos</Heading>

        <HStack>
          <Button leftIcon={<AddIcon />} onClick={newTopic.onOpen} isLoading={createTopic.isPending}>
            Nuevo tópico
          </Button>

          <Select
            width="260px"
            placeholder={topics.isLoading ? 'Cargando tópicos…' : 'Selecciona un tópico'}
            value={selectedTopic ?? ''}
            onChange={(e) => setSelectedTopic(e.target.value)}
            isDisabled={topics.isLoading}
          >
            {(topics.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </Select>

          <Button leftIcon={<AddIcon />} onClick={newCol.onOpen} isDisabled={!selectedTopic} isLoading={createColumn.isPending}>
            Nueva columna
          </Button>
        </HStack>
      </HStack>

      {!selectedTopic ? (
        <VStack py={16} spacing={4}>
          <Text color="gray.400">Selecciona un tópico o crea uno nuevo.</Text>
        </VStack>
      ) : board.isFetching && !board.dataUpdatedAt ? (
        <VStack py={16} spacing={4}>
          <Spinner />
          <Text color="gray.400">Cargando tablero…</Text>
        </VStack>
      ) : (
        <KanbanBoard
          columns={data.columns}
          cardsByColumn={data.cardsByColumn}
          onMoveCard={onMoveCard}
          renderColumnHeader={(col) => (
            <HStack justify="space-between" align="center" w="100%" px={1}>
              <Text fontWeight="bold">{col.title}</Text>
              <Button size="xs" onClick={() => { setCardColumnId(col.id); newCard.onOpen(); }} isLoading={createCard.isPending}>
                + Tarjeta
              </Button>
            </HStack>
          )}
          renderEmptyColumn={(col) => (
            <VStack py={4}>
              <Text color="gray.400" fontSize="sm">Sin tarjetas</Text>
              <Button size="sm" variant="ghost" onClick={() => { setCardColumnId(col.id); newCard.onOpen(); }} isLoading={createCard.isPending}>
                + Agregar tarjeta
              </Button>
            </VStack>
          )}
          renderCard={(card) => (
            <Box p={3} rounded="lg" borderWidth="1px" bg="gray.700">
              <VStack align="flex-start" spacing={2}>
                <Text fontWeight="semibold">{card.title}</Text>
                {card.labels && card.labels.length > 0 && (
                  <Wrap>
                    {card.labels.map((l) => (
                      <WrapItem key={l}>
                        <Tag variant="subtle"><TagLabel>{l}</TagLabel></Tag>
                      </WrapItem>
                    ))}
                  </Wrap>
                )}
                {card.description && (
                  <Text fontSize="sm" color="gray.300" noOfLines={3}>{card.description}</Text>
                )}
                {card.dueDate && (
                  <Text fontSize="xs" color="gray.400">Vence: {new Date(card.dueDate).toLocaleString()}</Text>
                )}
              </VStack>
            </Box>
          )}
          isLoading={board.isFetching && !board.dataUpdatedAt}
        />
      )}

      {/* Nuevo tópico */}
      <Modal isOpen={newTopic.isOpen} onClose={() => !createTopic.isPending && newTopic.onClose()}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Nuevo tópico</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <FormControl>
                <FormLabel>Título</FormLabel>
                <Input placeholder="Ej: Marketing Q4" value={topicTitle} onChange={(e) => setTopicTitle(e.target.value)} autoFocus />
              </FormControl>
              <FormControl>
                <FormLabel>Clave (opcional)</FormLabel>
                <Input placeholder="Ej: MKT" value={topicKey} onChange={(e) => setTopicKey(e.target.value)} />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={newTopic.onClose} isDisabled={createTopic.isPending}>Cancelar</Button>
            <Button onClick={handleCreateTopic} isLoading={createTopic.isPending}>Crear</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Nueva columna */}
      <Modal isOpen={newCol.isOpen} onClose={() => !createColumn.isPending && newCol.onClose()}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Nueva columna</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl>
              <FormLabel>Nombre de la columna</FormLabel>
              <Input placeholder="Ej: To Do" value={colTitle} onChange={(e) => setColTitle(e.target.value)} autoFocus />
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={newCol.onClose} isDisabled={createColumn.isPending}>Cancelar</Button>
            <Button onClick={handleCreateColumn} isLoading={createColumn.isPending}>Crear</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Nueva tarjeta */}
      <Modal isOpen={newCard.isOpen} onClose={() => !createCard.isPending && newCard.onClose()}>
        <ModalOverlay />
        <ModalContent maxW="720px">
          <ModalHeader>Nueva tarjeta</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={5} align="stretch">
              <SimpleGrid columns={[1, 2]} gap={4}>
                <FormControl>
                  <FormLabel>Columna</FormLabel>
                  <Select
                    value={cardColumnId}
                    onChange={(e) => setCardColumnId(e.target.value)}
                    placeholder={hasColumns ? 'Selecciona' : 'No hay columnas'}
                    isDisabled={!hasColumns}
                  >
                    {data.columns.map((c: Column) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </Select>
                </FormControl>

                <FormControl>
                  <FormLabel>Título</FormLabel>
                  <Input placeholder="Ej: Diseñar landing" value={cardTitle} onChange={(e) => setCardTitle(e.target.value)} />
                </FormControl>
              </SimpleGrid>

              <FormControl>
                <FormLabel>Descripción</FormLabel>
                <Textarea placeholder="Detalles de la tarea…" value={cardDesc} onChange={(e) => setCardDesc(e.target.value)} rows={4} />
              </FormControl>

              <SimpleGrid columns={[1, 2]} gap={4}>
                <FormControl>
                  <FormLabel>Labels (separados por coma)</FormLabel>
                  <Input placeholder="bug, urgente, backend" value={labelsInput} onChange={(e) => setLabelsInput(e.target.value)} />
                </FormControl>
                <FormControl>
                  <FormLabel>Miembros (ids/correos, coma)</FormLabel>
                  <Input placeholder="ana@example.com, juan@example.com" value={membersInput} onChange={(e) => setMembersInput(e.target.value)} />
                </FormControl>
              </SimpleGrid>

              <SimpleGrid columns={[1, 2]} gap={4}>
                <FormControl>
                  <FormLabel>Fecha límite</FormLabel>
                  <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </FormControl>
                <FormControl>
                  <FormLabel>Cover URL (opcional)</FormLabel>
                  <Input placeholder="https://..." value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} />
                </FormControl>
              </SimpleGrid>

              <Divider />

              <FormControl>
                <FormLabel>Checklist</FormLabel>
                <HStack>
                  <Input
                    placeholder="Agregar ítem…"
                    value={checkText}
                    onChange={(e) => setCheckText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddChecklistItem();
                      }
                    }}
                  />
                  <Button onClick={handleAddChecklistItem}>Agregar</Button>
                </HStack>
                {checklist.length > 0 && (
                  <VStack align="stretch" mt={3} spacing={2}>
                    {checklist.map((it) => (
                      <HStack key={it.id} justify="space-between">
                        <Text>{it.text}</Text>
                        <Button size="xs" variant="ghost" onClick={() => setChecklist(prev => prev.filter(x => x.id != it.id))}>
                          Quitar
                        </Button>
                      </HStack>
                    ))}
                  </VStack>
                )}
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={newCard.onClose} isDisabled={createCard.isPending}>Cancelar</Button>
            <Button onClick={handleCreateCard} isLoading={createCard.isPending} isDisabled={!cardColumnId}>Crear tarjeta</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
