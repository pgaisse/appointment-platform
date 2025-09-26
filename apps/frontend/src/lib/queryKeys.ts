// apps/frontend/src/Hooks/queryKeys.ts
export type PageParams = {
  page: number;
  limit: number;
  sort?: Record<string, unknown>;
  filter?: Record<string, unknown>;
};

export type SearchParams = {
  q: string;
  limit?: number;
};

// limpia undefined para no “mover” la key accidentalmente
const clean = <T extends object>(o: T): T =>
  JSON.parse(JSON.stringify(o));

export const appointmentsKey = {
  base: ['appointments'] as const,                             // ← base
  paginated: (p: PageParams) => ['appointments', clean(p)] as const,
};

export const appointmentsSearchKey = {
  base: ['appointments-search'] as const,                     // ← base
  query: (p: SearchParams) => ['appointments-search', clean(p)] as const,
};
