import { ChevronLeftIcon, ChevronRightIcon } from "@chakra-ui/icons";
import { Button, HStack, IconButton, Text } from "@chakra-ui/react";

type Props = {
  totalPages: number;
  currentPage: number;
  onPageChange: (n: number) => void;
  isPlaceholderData?: boolean;
  siblingCount?: number;   // nº de páginas a cada lado (default 1)
  boundaryCount?: number;  // nº de páginas al inicio/fin (default 1)
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

function buildRange(start: number, end: number) {
  const arr: number[] = [];
  for (let i = start; i <= end; i++) arr.push(i);
  return arr;
}

/** Devuelve una lista con números de página y elipsis ("…") */
function usePaginationItems(total: number, page: number, siblingCount = 1, boundaryCount = 1) {
  if (total <= 0) return [];
  const startPages = buildRange(1, Math.min(boundaryCount, total));
  const endPages = buildRange(Math.max(total - boundaryCount + 1, boundaryCount + 1), total);

  const leftSibling = Math.max(page - siblingCount, boundaryCount + 2);
  const rightSibling = Math.min(page + siblingCount, total - boundaryCount - 1);

  const items: (number | "ellipsis")[] = [];

  // inicio
  items.push(...startPages);

  // elipsis izquierda
  if (leftSibling > boundaryCount + 2) items.push("ellipsis");
  else if (boundaryCount + 1 < total - boundaryCount) items.push(boundaryCount + 1);

  // ventana central
  for (let p = leftSibling; p <= rightSibling; p++) items.push(p);

  // elipsis derecha
  if (rightSibling < total - boundaryCount - 1) items.push("ellipsis");
  else if (total - boundaryCount > boundaryCount) items.push(total - boundaryCount);

  // fin
  endPages.forEach((p) => {
    if (!items.includes(p)) items.push(p);
  });

  // limpieza por si hay duplicados
  const seen = new Set<string>();
  return items.filter((x) => {
    const k = String(x);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const Pagination = ({
  isPlaceholderData,
  totalPages,
  currentPage,
  onPageChange,
  siblingCount = 1,
  boundaryCount = 1,
}: Props) => {
  const page = clamp(currentPage, 1, Math.max(totalPages, 1));
  const items = usePaginationItems(totalPages, page, siblingCount, boundaryCount);

  const go = (n: number) => onPageChange(clamp(n, 1, totalPages));

  const disabledPrev = page <= 1;
  const disabledNext = page >= totalPages || totalPages === 0;

  return (
    <HStack spacing={1} wrap="wrap" justifyContent={"center"} w="full" >
      {/* First */}
      <IconButton
        aria-label="First page"
        icon={<Text fontWeight="bold">«</Text>}
        size="sm"
        onClick={() => go(1)}
        isDisabled={disabledPrev}
        variant="ghost"
      />
      {/* Prev */}
      <IconButton
        aria-label="Previous page"
        icon={<ChevronLeftIcon />}
        size="sm"
        onClick={() => go(page - 1)}
        isDisabled={disabledPrev}
        variant="ghost"
      />

      {/* Números + elipsis */}
      {items.map((it, idx) =>
        it === "ellipsis" ? (
          <Button key={`e-${idx}`} size="sm" variant="ghost" isDisabled tabIndex={-1}>
            …
          </Button>
        ) : (
          <Button
            key={it}
            size="sm"
            onClick={() => go(it)}
            colorScheme={page === it ? "blue" : "gray"}
            variant={page === it ? "solid" : "ghost"}
          >
            {it}
          </Button>
        )
      )}

      {/* Next */}
      <IconButton
        aria-label="Next page"
        icon={<ChevronRightIcon />}
        size="sm"
        onClick={() => go(page + 1)}
        isDisabled={disabledNext}
        variant="ghost"
      />
      {/* Last */}
      <IconButton
        aria-label="Last page"
        icon={<Text fontWeight="bold">»</Text>}
        size="sm"
        onClick={() => go(totalPages)}
        isDisabled={disabledNext}
        variant="ghost"
      />

      {isPlaceholderData && <Text fontSize="sm">Loading…</Text>}
    </HStack>
  );
};

export default Pagination;
