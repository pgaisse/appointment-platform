import React, { useState } from 'react';
import {
  SimpleGrid, VStack, Box, Spinner, Text, HStack, Button,
} from '@chakra-ui/react';
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor,
  useSensor, useSensors, KeyboardSensor, closestCenter, Over, DragOverEvent,
  useDroppable
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, sortableKeyboardCoordinates,
  rectSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import type { KanbanBoardProps, Column, Card } from '@/types/kanban';
import { between } from '@/Helpers/between';

type CardId = string;
const colDroppableId = (colId: string) => `col-${colId}`;
const isColDroppable = (id: string | number | undefined) =>
  typeof id === 'string' && id.startsWith('col-');
const parseColId = (droppableId: string) => String(droppableId).replace(/^col-/, '');

function SortableCard({
  card,
  columnId,
  renderCard,
}: {
  card: Card;
  columnId: string;
  renderCard?: (c: Card) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card', cardId: card.id, columnId },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <Box ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {renderCard ? (
        renderCard(card)
      ) : (
        <Box p={3} bg="gray.700" rounded="md" borderWidth="1px">
          {card.title}
        </Box>
      )}
    </Box>
  );
}

/** Crea una zona droppable para la columna (necesaria para poder soltar en columnas vacías). */
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
      maxH="70vh"
      overflowY="auto"
      // un mínimo de alto para poder soltar en vacío
      minH="80px"
      // feedback visual opcional cuando el puntero está encima
      bg={isOver ? 'gray.750' : undefined}
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
  columns,
  cardsByColumn,
  renderColumnHeader,
  renderCard,
  renderEmptyColumn,
  isLoading,
  onMoveCard,
}) => {
  const [activeCard, setActiveCard] = useState<Card | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const findCard = (id: CardId) => {
    for (const col of columns) {
      const list = cardsByColumn[col.id] || [];
      const idx = list.findIndex(c => c.id === id);
      if (idx > -1) return { card: list[idx], columnId: col.id, index: idx };
    }
    return null;
  };

  const getToColumnAndIndex = (over: Over | null, activeId: CardId) => {
    if (!over) return null;
    const overId = over.id;

    // Si estamos sobre la zona droppable de la columna (vacía o no), vamos al final.
    if (isColDroppable(overId)) {
      const toColumnId = parseColId(String(overId));
      const toIndex = (cardsByColumn[toColumnId] || []).length;
      return { toColumnId, toIndex };
    }

    // Si estamos sobre otra tarjeta, insertamos en su índice.
    const overInfo = findCard(String(overId));
    if (!overInfo) return null;
    const toColumnId = overInfo.columnId;
    const toIndex = overInfo.index;
    return { toColumnId, toIndex };
  };

  const computeNeighbors = (
    fromColumnId: string,
    toColumnId: string,
    activeId: string,
    toIndex: number
  ) => {
    // Clon superficial seguro
    const clone: typeof cardsByColumn = Object.fromEntries(
      Object.entries(cardsByColumn).map(([k, v]) => [k, [...(v || [])]])
    );

    // Remover del origen
    const fromArr = clone[fromColumnId] || [];
    const activeIdx = fromArr.findIndex(c => c.id === activeId);
    const [moving] = fromArr.splice(activeIdx, 1);
    clone[fromColumnId] = fromArr;

    // Insertar en destino
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

  const handleDragOver = (_e: DragOverEvent) => {
    // opcional: vista previa optimista
  };

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

    const pos = getToColumnAndIndex(over, String(active.id));
    if (!pos) {
      setActiveCard(null);
      return;
    }
    const { toColumnId, toIndex } = pos;

    // Si no cambió posición real, no llamar backend
    const fromArr = cardsByColumn[from.columnId] || [];
    const currentIdx = fromArr.findIndex(c => c.id === from.card.id);
    if (from.columnId === toColumnId && currentIdx === toIndex) {
      setActiveCard(null);
      return;
    }

    const { beforeSortKey, afterSortKey } = computeNeighbors(from.columnId, toColumnId, from.card.id, toIndex);
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

  if (isLoading) {
    return (
      <VStack py={16}>
        <Spinner />
      </VStack>
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
      <SimpleGrid columns={[1, 2, 3, 4]} spacing={4}>
        {columns.map((col: Column) => {
          const cards = cardsByColumn[col.id] ?? [];
          const items: string[] = cards.map((c) => c.id);

          return (
            <VStack
              key={col.id}
              align="stretch"
              spacing={2}
              bg="gray.800"
              p={3}
              rounded="lg"
            >
              <Box>
                {renderColumnHeader ? (
                  renderColumnHeader(col)
                ) : (
                  <HStack justify="space-between">
                    <Text fontWeight="bold">{col.title}</Text>
                    <Button size="xs">+ Tarjeta</Button>
                  </HStack>
                )}
              </Box>

              {/* Zona droppable de columna (permite soltar en columnas vacías) */}
              <ColumnDroppable columnId={col.id}>
                <SortableContext id={colDroppableId(col.id)} items={items} strategy={rectSortingStrategy}>
                  {items.length === 0
                    ? (renderEmptyColumn ? renderEmptyColumn(col) : <Box color="gray.400">Sin tarjetas</Box>)
                    : items.map((cardId) => {
                        const card = cards.find((c) => c.id === cardId)!;
                        return (
                          <SortableCard
                            key={card.id}
                            card={card}
                            columnId={col.id}
                            renderCard={renderCard}
                          />
                        );
                      })}
                </SortableContext>
              </ColumnDroppable>
            </VStack>
          );
        })}
      </SimpleGrid>

      <DragOverlay>
        {activeCard ? (
          <Box p={3} rounded="lg" borderWidth="1px" bg="gray.700" boxShadow="lg">
            {renderCard ? renderCard(activeCard) : activeCard.title}
          </Box>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default KanbanBoard;
