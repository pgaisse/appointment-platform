// frontend/src/Routes/App.tsx
import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Container,
  Heading,
  HStack,
  Spacer,
  useToast,
  VStack,
  Text,
  Skeleton,
} from '@chakra-ui/react';

import KanbanBoard from '@/Components/Kanban/KanbanBoard';
import CardDetailsModal from '@/Components/Kanban/CardDetailsModal';

import { useTopics } from '@/Hooks/useTopics';
import { useTopicBoard } from '@/Hooks/useTopicBoard';
import { useTopicAppearance } from '@/Hooks/useTopicAppearance';
import BoardBackground from '@/Components/Kanban/BoardBackground';

import type { Card } from '@/types/kanban';
import AppearanceControls from '@/Components/Kanban/AppearanceControls';
import NewColumnButton from '@/Components/Kanban/NewColumnButton';
import NewTopicButton from '@/Components/Topics/NewTopicButton';
import CardView from '@/Components/Kanban/CardView';
import BoardAppearanceModal from '@/Components/Appearance/BoardAppearanceModal';
import BackgroundSurface from '@/Components/Appearance/BackgroundSurface';
import TopicPicker from '@/Components/Topics/TopicPicker';
import Gate from '@/auth/Gate';

type Props = {
  topicId?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'solid' | 'outline' | 'ghost';
};

export default function index({ topicId }: Props) {
  const toast = useToast();

  /** ===== 1) Topics (list + create) ===== */
  const { topics } = useTopics();
  const topicsList = topics.data ?? [];

  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [] = useState('');
  const [openAppearance, setOpenAppearance] = useState(false);

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

  /** ===== 3) Appearance (background + overlay) ===== */
  // Use selected topic (or prop as fallback) to load the right appearance
  const topicForAppearance = selectedTopic ?? topicId ?? '';
  const { appearance, saveAppearance } = useTopicAppearance(topicForAppearance, {
    enabled: !!topicForAppearance,
  });

  /** ===== 4) Card details modal ===== */
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const flatCards: Card[] = useMemo(
    () => Object.values(data.cardsByColumn ?? {}).flat(),
    [data.cardsByColumn]
  );
  const selectedCard: Card | null =
    openCardId ? flatCards.find((c) => c.id === openCardId) ?? null : null;

  return (
    <>
      {/* Fullscreen background (color/image + blur/brightness + overlay)
          Asegúrate de tener zIndex={-1} dentro de BoardBackground */}
      <BoardBackground appearance={appearance.data} />

      {/* Contenedor raíz: ocupa TODO el alto disponible del parent (Layout main) */}
      <Container
        maxW="full"
        h="full"                 // 100% del alto del contenedor padre
        py={6}
        position="relative"
        zIndex={1}
        display="flex"           // Para poder fijar header arriba y área scroll abajo
        flexDir="column"
        overflow="hidden"        // Evita crecer; el scroll será del área de contenido
      >
        {/* Header área (altura natural, no hace scroll) */}
        <VStack align="stretch" spacing={4} mb={4} flexShrink={0}>
          <HStack>
            <Heading size="md"></Heading>
            <Spacer />

            {/* Topic selector + New topic + Appearance + New column (labeled "New Card") */}
            {topics.isLoading ? (
              <Skeleton height="32px" width="260px" rounded="md" />
            ) : topicsList.length > 0 ? (
              <BackgroundSurface
                overlayOpacity={0.45}     // más alto → más atenuado
                overlayColor="whiteAlpha.700" // 'blackAlpha.700' si prefieres
                blurPx={2}                 // suaviza detalles del fondo
                brightness={0.85}          // 0.7–0.9 suele ser óptimo
                containerProps={{
                  minH: "50px",
                  p: 8,
                  rounded: "2xl"
                }}
              >
                <HStack spacing={2}>
                  <TopicPicker
                    value={selectedTopic}
                    options={topicsList as any}  // [{ id, title?, key? }]
                    onChange={(id) => setSelectedTopic(id)}
                    isLoading={topics.isLoading}
                  />

                  <NewTopicButton
                    buttonText="New topic"
                    onCreated={(t) => setSelectedTopic(t.id)}
                  />

                  {/* Appearance button (modal/controls) */}
                  <Gate requireAnyPerms={["organizer_appearance:edit"]} source="all">
                    <AppearanceControls topicId={selectedTopic ?? ''} />
                  </Gate>

                  <NewColumnButton
                    buttonText="New List"
                    onCreate={async (title) => {
                      await createColumn.mutateAsync(title);
                      toast({ status: 'success', title: 'Card created' });
                    }}
                  />
                </HStack>
              </BackgroundSurface>
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

        {/* Área de contenido: FLEX + minH=0 + overflowY=auto para scroll interno */}
        <Box flex="1" minH={0} overflow="hidden">
          {selectedTopic ? (
            <Box rounded="md" p={2} h="100%" overflowY="auto">
              <KanbanBoard
                columns={data.columns}
                cardsByColumn={data.cardsByColumn}
                isLoading={board.isLoading}
                onMoveCard={onMoveCard}
                onCreateCard={(colId, title) =>
                  createCard.mutateAsync({ columnId: colId, title })
                }
                onOpenCard={(c) => setOpenCardId(c.id)}
                // custom card view with hover completion radio
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
            </Box>
          ) : (
            <Box p={6} rounded="md" borderWidth="1px" h="100%" overflowY="auto">
              {topics.isLoading ? (
                <Text>Loading topics…</Text>
              ) : (
                <Text>Create a topic to get started.</Text>
              )}
            </Box>
          )}
        </Box>

        {/* Modales (independientes del scroll) */}
        <CardDetailsModal
          isOpen={!!openCardId}
          card={selectedCard}
          onClose={() => setOpenCardId(null)}
          topicId={selectedTopic ?? ''} // must be a valid id (non-empty)
          onUpdate={async (cardId, patch) => {
            await updateCard.mutateAsync({ cardId, patch });
          }}
        />

        <BoardAppearanceModal
          isOpen={openAppearance}
          onClose={() => setOpenAppearance(false)}
          initial={appearance.data}
          onSave={async (patch) => {
            await saveAppearance.mutateAsync(patch);
          }}
        />
      </Container>
    </>
  );
}
