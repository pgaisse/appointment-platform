export type Id = string;

export interface Topic {
  id: Id;
  title: string;
  key?: string;
  meta?: Record<string, unknown>;
}

export type LabelColor =
  | 'green' | 'yellow' | 'orange' | 'red' | 'purple' | 'blue'
  | 'lime' | 'sky' | 'pink' | 'gray' | 'black';

export interface LabelDef {
  id: string;
  name: string;
  color: LabelColor;
}

export interface ChecklistItem { id: string; text: string; done: boolean }
export interface Attachment { id: string; url: string; name?: string; mime?: string; size?: number }
export interface Comment { id: string; authorId?: string; authorName?: string; text: string; createdAt?: string }

export interface CardParam { key: string; value: unknown }

export interface Card {
  id: Id;
  topicId?: Id;
  columnId: Id;
  title: string;
  description?: string;
  members?: string[];
  dueDate?: string | null;
  coverUrl?: string | null;
  checklist?: ChecklistItem[];
  attachments?: Attachment[];
  comments?: Comment[];
  params?: CardParam[];
  labels?: LabelDef[]; 
  sortKey: string;
  createdAt?: string; updatedAt?: string;
}

export interface Column {
  id: Id;
  topicId?: Id;
  title: string;
  sortKey: string;
  meta?: Record<string, unknown>;
}

export interface BoardData {
  columns: Column[];
  cardsByColumn: Record<Id, Card[]>;
}

export interface MoveCardArgs {
  cardId: Id;
  fromColumnId: Id;
  toColumnId: Id;
  toIndex: number;
  before?: string;
  after?: string;
  provisionalSortKey: string;
}

// src/types/kanban.ts
// ... resto de imports y tipos

export interface KanbanBoardProps extends BoardData {
  onMoveCard?: (args: MoveCardArgs) => Promise<void> | void;
  onReorderColumns?: (orderedColumnIds: Id[]) => Promise<void> | void;
  renderColumnHeader?: (c: Column) => React.ReactNode;
  renderCard?: (card: Card) => React.ReactNode;
  renderEmptyColumn?: (c: Column) => React.ReactNode;
  isLoading?: boolean;
  disabled?: boolean;
  virtualization?: boolean;
  maxColumnHeight?: string | number;
  keyboardDnd?: boolean;
  onCreateCard?: (columnId: Id, title: string) => Promise<void> | void;

  /** Nuevo: abrir detalle de tarjeta */
  onOpenCard?: (card: Card) => void;
}

