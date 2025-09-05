// frontend/src/Routes/App.tsx
import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Container,
  Heading,
  HStack,
  Select,
  Spacer,
  Skeleton,
  Text,
  useToast,
  VStack,
} from '@chakra-ui/react';
import KanbanBoard from '@/Components/Kanban/KanbanBoard';
import { useTopics } from '@/Hooks/useTopics';
import { useTopicBoard } from '@/Hooks/useTopicBoard';
import type { Card, Topic } from '@/types/kanban';
import CardDetailsModal from '@/Components/Kanban/CardDetailsModal';
import NewTopicButton from '@/Components/Topics/NewTopicButton';
import NewColumnButton from '@/Components/Kanban/NewColumnButton';
import CardView from '@/Components/Kanban/CardView';

export default function App() {
  const toast = useToast();

  /** ===== 1) Topics (list) ===== */
  const { topics } = useTopics();
  const topicsList: Topic[] = topics.data ?? [];

  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  // Auto-select first topic when available
  useEffect(() => {
    if (!selectedTopic && topicsList.length > 0) {
      setSelectedTopic(topicsList[0].id as string);
    }
  }, [topicsList, selectedTopic]);

  /** ===== 2) Board by topic ===== */
  const {
    board,
    createColumn,
    createCard,
    onMoveCard,
    updateCard,
  } = useTopicBoard(selectedTopic ?? '');

  const data = board.data ?? { columns: [], cardsByColumn: {} };

  /** ===== 3) Card modal ===== */
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const flatCards: Card[] = useMemo(
    () => Object.values(data.cardsByColumn ?? {}).flat(),
    [data.cardsByColumn]
  );
  const selectedCard: Card | null =
    openCardId ? flatCards.find((c) => c.id === openCardId) ?? null : null;

  /** ===== 4) UI ===== */
  const creatingColumn = createColumn.isPending;

  return (
    <Container maxW="full" py={6}>
      {/* Header */}
      <VStack align="stretch" spacing={4} mb={4}>
        <HStack>
          <Heading size="md">Kanban</Heading>
          <Spacer />

          {/* Topic selector + New topic + New column (labeled "New Card" by request) */}
          {topics.isLoading ? (
            <Skeleton height="32px" width="260px" rounded="md" />
          ) : topicsList.length > 0 ? (
            <HStack spacing={2}>
              <Select
                size="sm"
                width="260px"
                value={selectedTopic ?? ''}
                onChange={(e) => setSelectedTopic(e.target.value || null)}
                placeholder="Select a topic"
              >
                {topicsList.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title ?? t.key ?? t.id}
                  </option>
                ))}
              </Select>

              <NewTopicButton
                buttonText="New topic"
                onCreated={(t) => setSelectedTopic(t.id)}
              />

              <NewColumnButton
                buttonText="New Card"
                onCreate={async (title) => {
                  await createColumn.mutateAsync(title);
                  toast({ status: 'success', title: 'Card created' });
                }}
              />
            </HStack>
          ) : (
            <HStack>
              <NewTopicButton
                buttonText="Create your first topic"
                size="sm"
                colorScheme="teal"
                onCreated={(t) => setSelectedTopic(t.id)}
              />
            </HStack>
          )}
        </HStack>
      </VStack>

      {/* Content */}
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
          /** our custom card view with hover completion radio */
          renderCard={(card) => (
            <CardView
              card={card}
              onOpen={(c) => setOpenCardId(c.id)}
              onToggleComplete={(id, next) => {
                // PATCH /cards/:id { completed: boolean }
                return updateCard.mutateAsync({ cardId: id, patch: { completed: next } });
              }}
            />
          )}
        />
      ) : (
        <Box p={6} rounded="md" borderWidth="1px">
          {topics.isLoading ? (
            <Text>Loading topics…</Text>
          ) : (
            <Text>Create a topic to get started.</Text>
          )}
        </Box>
      )}

      {/* Card details modal */}
      <CardDetailsModal
        isOpen={!!openCardId}
        card={selectedCard}
        onClose={() => setOpenCardId(null)}
        topicId={selectedTopic ?? ''} // must be a valid id (non-empty)
        onUpdate={async (cardId, patch) => {
          await updateCard.mutateAsync({ cardId, patch });
        }}
      />
    </Container>
  );
}
