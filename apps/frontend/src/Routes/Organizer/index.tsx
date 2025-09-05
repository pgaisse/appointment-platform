// frontend/src/Routes/App.tsx
import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Container,
  Heading,
  HStack,
  Select,
  Spacer,
  Input,
  useToast,
  VStack,
  Text,
  Skeleton,
} from '@chakra-ui/react';
import KanbanBoard from '@/Components/Kanban/KanbanBoard';
import { useTopics } from '@/Hooks/useTopics';
import { useTopicBoard } from '@/Hooks/useTopicBoard';
import type { Card } from '@/types/kanban';
import CardDetailsModal from '@/Components/Kanban/CardDetailModal';

export default function App() {
  const toast = useToast();

  /** ===== 1) Tópicos (lista + crear) ===== */
  const { topics, createTopic } = useTopics();
  const topicsList = topics.data ?? [];

  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [newTopicTitle, setNewTopicTitle] = useState('');

  // seleccionar automáticamente el primer tópico disponible
  useEffect(() => {
    if (!selectedTopic && topicsList.length > 0) {
      setSelectedTopic(topicsList[0].id as string);
    }
  }, [topicsList, selectedTopic]);

  const handleCreateTopic = async () => {
    const title = newTopicTitle.trim();
    if (!title) return;
    try {
      const created = await createTopic.mutateAsync({ title });
      setNewTopicTitle('');
      // seleccionar el recién creado
      setSelectedTopic((created as any)?._id ?? null);
      toast({ status: 'success', title: 'Tópico creado' });
    } catch (e) {
      toast({ status: 'error', title: 'No se pudo crear el tópico' });
    }
  };

  /** ===== 2) Tablero por tópico ===== */
  const {
    board,
    createColumn,
    createCard,
    onMoveCard,
    updateCard,
  } = useTopicBoard(selectedTopic ?? '');

  const data = board.data ?? { columns: [], cardsByColumn: {} };

  /** ===== 3) Modal de tarjeta ===== */
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const flatCards: Card[] = useMemo(
    () => Object.values(data.cardsByColumn ?? {}).flat(),
    [data.cardsByColumn]
  );
  const selectedCard: Card | null =
    openCardId ? flatCards.find((c) => c.id === openCardId) ?? null : null;

  /** ===== 4) UI ===== */
  const creatingTopic = createTopic.isPending;
  const creatingColumn = createColumn.isPending;

  return (
    <Container maxW="7xl" py={6}>
      {/* Header */}
      <VStack align="stretch" spacing={4} mb={4}>
        <HStack>
          <Heading size="md">Kanban</Heading>
          <Spacer />

          {/* Selector de tópico */}
          {topics.isLoading ? (
            <Skeleton height="32px" width="260px" rounded="md" />
          ) : topicsList.length > 0 ? (
            <HStack spacing={2}>
              <Select
                size="sm"
                width="260px"
                value={selectedTopic ?? ''}
                onChange={(e) => setSelectedTopic(e.target.value || null)}
              >
                {topicsList.map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.title ?? t.key ?? t.id}
                  </option>
                ))}
              </Select>
              <Button
                size="sm"
                onClick={async () => {
                  const title = prompt('Nombre de la nueva columna')?.trim();
                  if (!title) return;
                  try {
                    await createColumn.mutateAsync(title);
                    toast({ status: 'success', title: 'Columna creada' });
                  } catch {
                    toast({ status: 'error', title: 'No se pudo crear la columna' });
                  }
                }}
                isLoading={creatingColumn}
              >
                + Columna
              </Button>
            </HStack>
          ) : null}
        </HStack>

        {/* Crear tópico cuando no hay */}
        {topicsList.length === 0 && !topics.isLoading && (
          <HStack>
            <Input
              placeholder="Nombre del tópico"
              size="sm"
              value={newTopicTitle}
              onChange={(e) => setNewTopicTitle(e.target.value)}
            />
            <Button size="sm" onClick={handleCreateTopic} isLoading={creatingTopic}>
              Crear tópico
            </Button>
          </HStack>
        )}
      </VStack>

      {/* Contenido */}
      {selectedTopic ? (
        <KanbanBoard
          columns={data.columns}
          cardsByColumn={data.cardsByColumn}
          isLoading={board.isLoading}
          onMoveCard={onMoveCard}
          onCreateCard={(colId, title) =>
            createCard.mutateAsync({ columnId: colId, title })
          }
          onOpenCard={(c) => setOpenCardId(c.id)}
          // puedes personalizar cómo se ve cada card:
          // renderCard={(card) => (
          //   <Box p={3} rounded="md" borderWidth="1px" bg="gray.700">
          //     <Text fontWeight="semibold">{card.title}</Text>
          //     {card.description && (
          //       <Text fontSize="sm" color="gray.300" noOfLines={3}>
          //         {card.description}
          //       </Text>
          //     )}
          //   </Box>
          // )}
        />
      ) : (
        <Box p={6} rounded="md" borderWidth="1px">
          {topics.isLoading ? (
            <Text>Cargando tópicos…</Text>
          ) : (
            <Text>Primero crea un tópico para comenzar.</Text>
          )}
        </Box>
      )}

      {/* Modal de detalles de tarjeta */}
      <CardDetailsModal
        isOpen={!!openCardId}
        card={selectedCard}
        onClose={() => setOpenCardId(null)}
        onUpdate={async (cardId, patch) => {
          await updateCard.mutateAsync({ cardId, patch });
        }}
      />
    </Container>
  );
}
