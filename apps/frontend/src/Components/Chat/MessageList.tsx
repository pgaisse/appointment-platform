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
  Badge,
  Spacer,
  IconButton,
  Tooltip,
} from "@chakra-ui/react";
import React from "react";
import { FaUserAlt } from "react-icons/fa";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import AddPatientButton from "../DraggableCards/AddPatientButton";
import { formatFromE164 } from "@/Functions/formatFromE164";
import { FiArchive, FiInbox } from "react-icons/fi";
import { useArchiveConversation } from "@/Hooks/Query/useArchiveConversation";

type Props = {
  setChat: (c: ConversationChat) => void | Promise<void>;
  dataConversation: ConversationChat[] | undefined;
  isLoadingConversation: boolean;
  readOverrides?: ReadonlySet<string>;
  archivedMode?: "active" | "only" | "all";
  onReorder?: (ordered: ConversationChat[]) => void;
};

export default function MessageList({
  setChat,
  dataConversation,
  isLoadingConversation,
  readOverrides,
  archivedMode = "active",
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

  return (
    <VStack align="stretch" spacing={4}>
      {dataConversation.map((contact) => (
        <SortableChatRow
          key={contact.conversationId}
          contact={contact}
          onOpen={() => setChat(contact)}
          readOverrides={readOverrides}
          archivedMode={archivedMode}
        />
      ))}
    </VStack>
  );
}

function SortableChatRow({
  contact,
  onOpen,
  readOverrides,
  archivedMode = "active",
}: {
  contact: ConversationChat;
  onOpen: () => void | Promise<void>;
  readOverrides?: ReadonlySet<string>;
  archivedMode?: "active" | "only" | "all";
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
    userSelect: "none",
    touchAction: "none",
    zIndex: isDragging ? 10 : "auto",
  };

  const displayName =
    contact.owner?.unknown
      ? undefined
      : contact.owner?.name || contact.lastMessage?.author;

  const lastPreview = (() => {
    if (contact.lastMessage?.body) return contact.lastMessage.body;
    if (contact.lastMessage?.media?.length) return "📷 Photo";
    return "";
  })();

  const formattedNumber = formatFromE164(contact.owner?.phone ? contact.owner?.phone : "");

  // Apply local override: if present, display 0
  const rawUnread = contact.unreadCount ?? 0;
  const overridden = readOverrides?.has(contact.conversationId) ?? false;
  const displayUnread = overridden ? 0 : rawUnread;
  const isUnread = displayUnread > 0;

  const { mutate: archiveMutate, isPending: isArchiving } = useArchiveConversation();

  const handleArchiveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    archiveMutate({ id: contact.conversationId, archived: true });
  };
  const handleUnarchiveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    archiveMutate({ id: contact.conversationId, archived: false });
  };

  return (
    <HStack
      ref={setNodeRef}
      style={style}
      px={3}
      py={2}
      borderRadius="xl"
      transition="background 0.2s ease, transform 0.2s ease"
      _hover={{ bg: "blackAlpha.50", _dark: { bg: "whiteAlpha.100" } }}
      {...listeners}
      {...attributes}
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
        <HStack align="center" spacing={2}>
          <Text fontWeight={isUnread ? "bold" : "semibold"} noOfLines={1}>
            {contact.owner?.name || contact.lastMessage?.author || "No name"}
          </Text>

          {/* Quick “Add Contact” if owner is unknown */}
          {contact.owner?.unknown ? (
            <AddPatientButton
              color="blue"
              px={0}
              py={0}
              mb={0}
              onlyPatient
              label="Add Contact"
              formProps={{
                typeButonVisible: false,
                phoneVal: formattedNumber,
                phoneFieldReadOnly: true,
                mode: "EDITION",
                idVal: contact.owner._id,
                conversationId: contact.conversationId,
              }}
            />
          ) : null}

          <Spacer />

          {/* Unread badge */}
          {displayUnread > 0 && (
            <Badge borderRadius="full" px="2" fontSize="0.75rem" colorScheme="blue">
              {displayUnread > 99 ? "99+" : displayUnread}
            </Badge>
          )}
        </HStack>

        <Text
          fontSize="sm"
          color={isUnread ? "inherit" : "gray.500"}
          fontWeight={isUnread ? "semibold" : "normal"}
          noOfLines={1}
        >
          {lastPreview}
        </Text>
      </Box>

      {/* Archive / Unarchive button */}
      {archivedMode === "only" ? (
        <Tooltip label="Unarchive">
          <IconButton
            aria-label="Unarchive"
            size="sm"
            variant="ghost"
            icon={<FiInbox />}
            onClick={handleUnarchiveClick}
            isLoading={isArchiving}
          />
        </Tooltip>
      ) : (
        <Tooltip label="Archive">
          <IconButton
            aria-label="Archive"
            size="sm"
            variant="ghost"
            icon={<FiArchive />}
            onClick={handleArchiveClick}
            isLoading={isArchiving}
          />
        </Tooltip>
      )}
    </HStack>
  );
}
