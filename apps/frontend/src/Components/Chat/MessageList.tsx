// Components/Chat/MessageList.tsx
import { ConversationChat } from "@/types";
import {
  Box,
  VStack,
  HStack,
  Avatar,
  Stack,
  Skeleton,
  Text,
  Divider,
} from "@chakra-ui/react";
import React from "react";
import { FaUserAlt } from "react-icons/fa";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import AddPatientButton from "../DraggableCards/AddPatientButton";
import { formatFromE164 } from "@/Functions/formatFromE164";

type Props = {
  setChat: React.Dispatch<React.SetStateAction<ConversationChat | undefined>>;
  dataConversation: ConversationChat[] | undefined;
  isLoadingConversation: boolean;
  /** Optional: parent handles reordering and onDragEnd. */
  onReorder?: (ordered: ConversationChat[]) => void;
};

export default function MessageList({
  setChat,
  dataConversation,
  isLoadingConversation,
}: Props) {
  if (isLoadingConversation) {
    return (
      <Stack>
        <Skeleton borderRadius="xl" height="60px" m={2} />
        <Skeleton borderRadius="xl" height="60px" m={2} />
        <Skeleton borderRadius="xl" height="60px" m={2} />
      </Stack>
    );
  }

  if (!dataConversation?.length) {
    return <Text color="gray.500">No conversations</Text>;
  }

  // NOTE: No DndContext/SortableContext here — the parent wraps this list.
  return (
    <VStack align="stretch" spacing={4}>
      {dataConversation.map((contact) => (
        <SortableChatRow
          key={contact.conversationId}
          contact={contact}
          onOpen={() => setChat(contact)}
        />
      ))}
    </VStack>
  );
}

/* ---- Draggable & sortable row (drag from ANYWHERE) ----- */
function SortableChatRow({
  contact,
  onOpen,
}: {
  contact: ConversationChat;
  onOpen: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: contact.conversationId,
    // Parent can read this in onDragEnd to assign to a category, etc.
    data: {
      type: "conversation",
      conversationSid: contact.conversationId,
      phone: contact.owner?.phone ?? contact.lastMessage?.author ?? undefined,
      name: contact.owner?.name ?? undefined,
    },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition:
      transition ||
      "transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 150ms ease, opacity 150ms ease",
    boxShadow: isDragging ? "0 12px 28px rgba(0,0,0,0.18)" : undefined,
    opacity: isDragging ? 0.98 : 1,
    cursor: "grab",
    willChange: "transform",
    // Helps keep it interactive during drag and avoids accidental text selection
    userSelect: "none",
    touchAction: "none",
    zIndex: isDragging ? 10 : "auto",
  };

  const displayName =
    contact.owner?.unknown
      ? undefined
      : contact.owner?.name || contact.lastMessage?.author;
  console.log("contact From messageList",contact)
  const lastPreview = (() => {
    if (contact.lastMessage?.body) return contact.lastMessage.body;
    if (contact.lastMessage?.media?.length) return "📷 Photo";
    return "";
  })();
  const formatedNumber = formatFromE164(contact.owner?.phone ? contact.owner?.phone : "")


  return (
    <HStack
      ref={setNodeRef}
      style={style}
      px={3}
      borderRadius="xl"
      transition="background 0.2s ease, transform 0.2s ease"
      _hover={{ bg: "blackAlpha.50", _dark: { bg: "whiteAlpha.100" } }}
      // Drag from ANYWHERE on the row:
      {...listeners}
      {...attributes}
      // Click still opens the chat if user taps quickly
      onClick={onOpen}
    >
      <Avatar
        size="md"
        name={displayName}
        src={contact.owner?.avatar}
        icon={contact.owner?.unknown ? <FaUserAlt fontSize="1.5rem" /> : undefined}
        pointerEvents="none"
      />


      <Box flex="1" minW={0}>
        <HStack>
          <Text fontWeight="semibold" noOfLines={1}>
            {contact.owner?.name || contact.lastMessage?.author || "No name"}

          </Text>
          {contact.owner?.unknown ? <AddPatientButton color="blue" px={0} py={0} mb={0} onlyPatient={true} label='Add Contact'
            formProps={{
              typeButonVisible: false, phoneVal: formatedNumber, phoneFieldReadOnly: true,
              mode: "EDITION", idVal: contact.owner._id, conversationId: contact.conversationId
            }} /> : undefined}
        </HStack>

        <Text fontSize="sm" color="gray.500" noOfLines={1}>
          {lastPreview}
        </Text>

      </Box>

    </HStack>

  );
}