import React from "react";
import { Box, VStack, Text, Avatar, Flex } from "@chakra-ui/react";
import {
  DndContext,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";

interface Conversation {
  id: string;
  name: string;
  lastMessage: string;
  avatar?: string;
  color?: string;
}

const conversations: Conversation[] = [
  { id: "1", name: "Paciente 1", lastMessage: "Necesito cita" },
  { id: "2", name: "Paciente 2", lastMessage: "Consulta presupuesto" },
  { id: "3", name: "Paciente 3", lastMessage: "Dolor muela" },
];

const categories = ["New", "Qualifying", "Follow-up"];

function DraggableConversation({ conv }: { conv: Conversation }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: conv.id,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <Flex
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      p={3}
      mb={2}
      borderWidth="1px"
      borderRadius="lg"
      bg="white"
      boxShadow="sm"
      align="center"
      _hover={{ boxShadow: "md", cursor: "grab" }}
    >
      <Avatar 
        size="sm" 
        name={conv.name?.[0] || conv.name} 
        src={conv.avatar} 
        mr={3}
        {...(() => {
          const color = conv.color;
          if (!color) return { bg: "gray.500", color: "white" };
          if (!color.startsWith('#') && !color.includes('.')) {
            return { bg: `${color}.500`, color: "white" };
          }
          if (color.includes(".")) {
            const [base] = color.split(".");
            return { bg: `${base}.500`, color: "white" };
          }
          const hex = color.replace("#", "");
          const int = parseInt(hex.length === 3 ? hex.split("").map((c: string) => c+c).join("") : hex, 16);
          const r = (int >> 16) & 255, g = (int >> 8) & 255, b = int & 255;
          const yiq = (r * 299 + g * 587 + b * 114) / 1000;
          const text = yiq >= 128 ? "black" : "white";
          return { bg: color, color: text };
        })()}
        boxShadow="0 1px 4px rgba(0,0,0,0.1)"
      />
      <Box>
        <Text fontWeight="bold">{conv.name}</Text>
        <Text fontSize="sm" color="gray.500" noOfLines={1}>
          {conv.lastMessage}
        </Text>
      </Box>
    </Flex>
  );
}

function DroppableColumn({ id, title }: { id: string; title: string }) {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <Box
      ref={setNodeRef}
      w="250px"
      minH="400px"
      p={3}
      borderWidth="2px"
      borderColor={isOver ? "blue.400" : "gray.200"}
      borderRadius="lg"
      bg="gray.50"
    >
      <Text fontWeight="bold" mb={3}>
        {title}
      </Text>
    </Box>
  );
}

export default function ConversationBoard() {
  const handleDragEnd = (event: any) => {
    const { over, active } = event;
    if (over) {
      console.log(`Conversación ${active.id} movida a ${over.id}`);
    }
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <Flex h="100vh" bg="gray.100">
        {/* Sidebar conversations */}
        <Box w="300px" p={4} borderRight="1px solid #ddd" bg="white">
          <Text fontWeight="bold" mb={4}>
            Conversations
          </Text>
          <VStack align="stretch">
            {conversations.map((c) => (
              <DraggableConversation key={c.id} conv={c} />
            ))}
          </VStack>
        </Box>

        {/* Categories board */}
        <Flex flex={1} p={6} gap={6}>
          {categories.map((cat) => (
            <DroppableColumn key={cat} id={cat} title={cat} />
          ))}
        </Flex>
      </Flex>
    </DndContext>
  );
}
