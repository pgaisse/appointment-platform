import React, { useState } from 'react';
import {
  VStack,
  Box,
  Spinner,
  Text,
  HStack,
  Button,
  Textarea,
  IconButton,
  Center,
  Alert,
  AlertIcon,
} from '@chakra-ui/react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  KeyboardSensor,
  closestCenter,
  Over,
  DragOverEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SmallCloseIcon } from '@chakra-ui/icons';

import type { KanbanBoardProps, Column, Card } from '@/types/kanban';
import { between } from '@/Helpers/between';
import LabelChip from './LabelChip';

type CardId = string;
const colDroppableId = (colId: string) => `col-${colId}`;
const isColDroppable = (id: string | number | undefined) =>
  typeof id === 'string' && id.startsWith('col-');
const parseColId = (droppableId: string) => String(droppableId).replace(/^col-/, '');

const DefaultCard: React.FC<{ card: Card }> = ({ card }) => (
  <Box p={3} bg="gray.600" rounded="md">
    {/* Chips arriba */}
    {card.labels?.length ? (
      <HStack spacing={1} mb={2} flexWrap="wrap">
        {card.labels.map((l) => (
          <LabelChip key={(l as any).id ?? String(l)} label={l as any} />
        ))}
      </HStack>
    ) : null}

    <Text fontWeight="semibold">{card.title}</Text>
    {card.description && (
      <Text fontSize="sm" color="gray.300" noOfLines={3}>
        {card.description}
      </Text>
    )}
  </Box>
);

/** Tarjeta sortable */
function SortableCard({
  card,
  columnId,
  renderCard,
  onOpenCard,
}: {
  card: Card;
  columnId: string;
  renderCard?: (c: Card) => React.ReactNode;
  onOpenCard?: (c: Card) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card', cardId: card.id, columnId },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    cursor: 'pointer',
  };

  return (
    <Box
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => !isDragging && onOpenCard?.(card)}
    >
      {renderCard ? renderCard(card) : <DefaultCard card={card} />}
    </Box>
  );
}

/** Zona droppable de la columna (permite soltar en columnas vacías). */
function ColumnDroppable({
  columnId,
  children,
}: {
  columnId: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: colDroppableId(columnId),
    data: { type: 'column', columnId },
  });

  return (
    <VStack
      ref={setNodeRef}
      align="stretch"
      spacing={2}
      minH="80px"                 // área mínima para soltar
      bg={isOver ? 'gray.700' : 'transparent'}
      borderColor={isOver ? 'blue.400' : 'transparent'}
      borderWidth={isOver ? '1px' : '0'}
      rounded="md"
      p={1}
    >
      {children}
    </VStack>
  );
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({
  columns = [],                           // defaults seguros
  cardsByColumn = {},
  renderColumnHeader,
  renderCard,
  renderEmptyColumn,
  isLoading,
  onMoveCard,
  onCreateCard,
  onOpenCard,
}) => {
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [draftByCol, setDraftByCol] = useState<Record<string, string>>({});
  const [isAddingByCol, setIsAddingByCol] = useState<Record<string, boolean>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const findCard = (id: CardId) => {
    for (const col of columns) {
      const list = cardsByColumn[col.id] || [];
      const idx = list.findIndex((c) => c.id === id);
      if (idx > -1) return { card: list[idx], columnId: col.id, index: idx };
    }
    return null;
  };

  const getToColumnAndIndex = (over: Over | null) => {
    if (!over) return null;
    const overId = over.id;
    if (isColDroppable(overId)) {
      const toColumnId = parseColId(String(overId));
      const toIndex = (cardsByColumn[toColumnId] || []).length;
      return { toColumnId, toIndex };
    }
    const overInfo = findCard(String(overId));
    if (!overInfo) return null;
    return { toColumnId: overInfo.columnId, toIndex: overInfo.index };
  };

  const computeNeighbors = (
    fromColumnId: string,
    toColumnId: string,
    activeId: string,
    toIndex: number
  ) => {
    const clone: typeof cardsByColumn = Object.fromEntries(
      Object.entries(cardsByColumn).map(([k, v]) => [k, [...(v || [])]])
    );
    const fromArr = clone[fromColumnId] || [];
    const activeIdx = fromArr.findIndex((c) => c.id === activeId);
    const [moving] = fromArr.splice(activeIdx, 1);
    clone[fromColumnId] = fromArr;

    const destArr = clone[toColumnId] || [];
    destArr.splice(toIndex, 0, moving);
    clone[toColumnId] = destArr;

    const before = destArr[toIndex - 1] ?? null;
    const after = destArr[toIndex + 1] ?? null;

    return {
      beforeSortKey: before?.sortKey ?? null,
      afterSortKey: after?.sortKey ?? null,
    };
  };

  const handleDragStart = (e: DragStartEvent) => {
    if (e.active?.id) {
      const info = findCard(String(e.active.id));
      setActiveCard(info?.card ?? null);
    }
  };

  const handleDragOver = (_e: DragOverEvent) => { };

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!active?.id || !over) {
      setActiveCard(null);
      return;
    }
    const from = findCard(String(active.id));
    if (!from) {
      setActiveCard(null);
      return;
    }
    const pos = getToColumnAndIndex(over);
    if (!pos) {
      setActiveCard(null);
      return;
    }
    const { toColumnId, toIndex } = pos;

    const fromArr = cardsByColumn[from.columnId] || [];
    const currentIdx = fromArr.findIndex((c) => c.id === from.card.id);
    if (from.columnId === toColumnId && currentIdx === toIndex) {
      setActiveCard(null);
      return;
    }

    const { beforeSortKey, afterSortKey } = computeNeighbors(
      from.columnId,
      toColumnId,
      from.card.id,
      toIndex
    );
    const provisionalSortKey = between(beforeSortKey, afterSortKey);

    await onMoveCard?.({
      cardId: from.card.id,
      fromColumnId: from.columnId,
      toColumnId,
      toIndex,
      before: beforeSortKey ?? undefined,
      after: afterSortKey ?? undefined,
      provisionalSortKey,
    });

    setActiveCard(null);
  };

  // Footer estilo Trello
  const startAdd = (colId: string) => setDraftByCol((p) => ({ ...p, [colId]: '' }));
  const cancelAdd = (colId: string) =>
    setDraftByCol((p) => {
      const next = { ...p };
      delete next[colId];
      return next;
    });
  const confirmAdd = async (colId: string) => {
    const title = (draftByCol[colId] ?? '').trim();
    if (!title || !onCreateCard) return;
    setIsAddingByCol((p) => ({ ...p, [colId]: true }));
    try {
      await onCreateCard(colId, title);
      setDraftByCol((p) => {
        const n = { ...p };
        delete n[colId];
        return n;
      });
    } finally {
      setIsAddingByCol((p) => ({ ...p, [colId]: false }));
    }
  };

  // --- Render ---
  if (isLoading) {
    return (
      <Center py={16}>
        <Spinner />
      </Center>
    );
  }

  if (!columns || columns.length === 0) {
    return (
      <Center py={10}>
        <Alert status="warning" variant="subtle" rounded="md">
          <AlertIcon />
          No columns. Create one from the topic menu or use the API.
        </Alert>
      </Center>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {/* ===== CONTENEDOR HORIZONTAL SIN WRAP ===== */}
      <Box
        w="full"        // <-- ocupa 100%
        minW={0}        // <-- permite que el contenido se contraiga sin overflow
        display="flex"
        flexDir="row"
        alignItems="flex-start"
        gap={4}
        flexWrap="nowrap"
        overflowX="auto"
        overflowY="hidden"
        py={2}
        px={1}
      >
        {columns.map((col: Column) => {
          const cards = cardsByColumn[col.id] ?? [];
          const items: string[] = cards.map((c) => c.id);
          const isEditing = Object.prototype.hasOwnProperty.call(draftByCol, col.id);
          const isLoadingAdd = !!isAddingByCol[col.id];

          return (
            <VStack
              key={col.id}
              align="stretch"
              spacing={2}
              bg="gray.800"
              p={3}
              rounded="lg"
              borderWidth="1px"
              // columna de ancho fijo: no se encoge
              flex="0 0 320px"
              minW="320px"
              maxW="320px"
            >
              {/* Header */}
              <Box>
                {renderColumnHeader ? (
                  renderColumnHeader(col)
                ) : (
                  <HStack justify="space-between">
                    <Text fontWeight="bold" color="white">
                      {col.title}
                    </Text>
                  </HStack>
                )}
              </Box>

              {/* Lista / zona droppable */}
              <ColumnDroppable columnId={col.id}>
                <SortableContext
                  id={colDroppableId(col.id)}
                  items={items}
                  strategy={rectSortingStrategy} // vertical dentro de la columna
                >
                  {items.length === 0
                    ? renderEmptyColumn
                      ? renderEmptyColumn(col)
                      : <Box color="gray.400">No cards</Box>
                    : items.map((cardId) => {
                      const card = cards.find((c) => c.id === cardId)!;
                      return (
                        <SortableCard
                          key={card.id}
                          card={card}
                          columnId={col.id}
                          renderCard={renderCard}
                          onOpenCard={onOpenCard}
                        />
                      );
                    })}
                </SortableContext>
              </ColumnDroppable>

              {/* Footer Trello-like */}
              {!isEditing ? (
                <Button
                  size="sm"
                  variant="ghost"
                  colorScheme="whiteAlpha"
                  onClick={() => startAdd(col.id)}
                  justifyContent="flex-start"
                >
                  + Add card
                </Button>
              ) : (
                <VStack align="stretch" spacing={2}>
                  <Textarea
                    value={draftByCol[col.id]}
                    onChange={(e) =>
                      setDraftByCol((p) => ({ ...p, [col.id]: e.target.value }))
                    }
                    placeholder="Enter a title or paste a link"
                    rows={2}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        confirmAdd(col.id);
                      } else if (e.key === 'Escape') {
                        cancelAdd(col.id);
                      }
                    }}
                  />
                  <HStack>
                    <Button
                      size="sm"
                      colorScheme="blue"
                      onClick={() => confirmAdd(col.id)}
                      isLoading={isLoadingAdd}
                      isDisabled={!draftByCol[col.id]?.trim()}
                    >
                      Add card
                    </Button>
                    <IconButton
                      aria-label="Cancel"
                      size="sm"
                      variant="ghost"
                      icon={<SmallCloseIcon />}
                      onClick={() => cancelAdd(col.id)}
                      isDisabled={isLoadingAdd}
                    />
                  </HStack>
                </VStack>
              )}
            </VStack>
          );
        })}
      </Box>

      {/* Overlay sin borde extra */}
      <DragOverlay>
        {activeCard ? (
          <Box pointerEvents="none">
            {renderCard ? renderCard(activeCard) : <DefaultCard card={activeCard} />}
          </Box>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default KanbanBoard;
