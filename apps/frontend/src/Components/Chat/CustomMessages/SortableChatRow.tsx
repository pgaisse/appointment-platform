// Components/Chat/SortableChatRow.tsx (o donde lo tengas)
import { Box } from "@chakra-ui/react";
import { useSortable } from "@dnd-kit/sortable";
// ...

export default function SortableChatRow({ contact }: { contact: any; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: contact.conversationId,
    // 📌 IMPORTANTE: data que leeremos en onDragEnd
    data: {
      type: "conversation",
      conversationSid: contact.conversationId,
      phone: contact.phone,
      name: contact.name,
    },
  });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <Box ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {/* ...tu contenido de fila... */}
    </Box>
  );
}
