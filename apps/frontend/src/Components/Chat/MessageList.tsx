// Components/Chat/MessageList.tsx
import { ConversationChat } from "@/types";
import {
  Box,
  VStack,
  HStack,
  Stack,
  Skeleton,
  Text,
  Badge,
  Spacer,
  IconButton,
  Tooltip,
  Input,
  InputGroup,
  InputLeftElement,
  CloseButton,
  Icon,
  useColorModeValue,
} from "@chakra-ui/react";
import React, { useEffect, useMemo, useState } from "react";
import { FaUser } from "react-icons/fa";
import { FiArchive, FiInbox, FiSearch } from "react-icons/fi";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import AddPatientButton from "../DraggableCards/AddPatientButton";
import { formatFromE164 } from "@/Functions/formatFromE164";
import { useArchiveConversation } from "@/Hooks/Query/useArchiveConversation";
import { useConversationSearch } from "@/Hooks/Query/useConversationsSearch";

type Props = {
  setChat: (c: ConversationChat) => void | Promise<void>;
  dataConversation: ConversationChat[] | undefined;
  isLoadingConversation: boolean;
  readOverrides?: ReadonlySet<string>;
  archivedMode?: "active" | "only" | "all";
  onReorder?: (ordered: ConversationChat[]) => void;
  searchTerm?: string; // external search term to control from parent
  showSearch?: boolean; // whether to render the search box inside this component
};

export default function MessageList({
  setChat,
  dataConversation,
  isLoadingConversation,
  readOverrides,
  archivedMode = "active",
  searchTerm,
  showSearch = true,
}: Props) {
  // Debounced search
  const [localTerm, setLocalTerm] = useState("");
  const effectiveTerm = searchTerm ?? localTerm;
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setDebounced(effectiveTerm.trim()), 300);
    return () => clearTimeout(id);
  }, [effectiveTerm]);

  const searchEnabled = debounced.length >= 2;
  const effectiveSearchScope: "active" | "only" | "all" = searchEnabled ? "all" : archivedMode;
  const { data: searchData, isLoading: isSearching } = useConversationSearch(
    debounced,
    effectiveSearchScope,
    1,
    50 // request larger pages to match conversations list and reduce extra fetches
  );

  // Compute lists before any early return to keep hook order stable
  const listRaw = searchEnabled ? (searchData?.items ?? []) : (dataConversation ?? []);
  // Exclude conversations tied to represented appointments in both normal list and search results
  const list = listRaw.filter((c) => !(c.owner as any)?.represented);
  const uniqueList = useMemo(() => {
    const seen = new Set<string>();
    const out: ConversationChat[] = [];
    for (const c of list) {
      const id = String(c.conversationId);
      if (!seen.has(id)) {
        seen.add(id);
        out.push(c);
      }
    }
    return out;
  }, [list]);

  if (!searchEnabled && isLoadingConversation) {
    return (
      <Stack>
        {showSearch ? (
          <SearchBox term={localTerm} setTerm={setLocalTerm} isSearching={false} />
        ) : null}
        <Skeleton borderRadius="xl" height="60px" m={2} />
        <Skeleton borderRadius="xl" height="60px" m={2} />
        <Skeleton borderRadius="xl" height="60px" m={2} />
      </Stack>
    );
  }

  return (
    <VStack align="stretch" spacing={4}>
      {showSearch ? (
        <SearchBox term={localTerm} setTerm={setLocalTerm} isSearching={isSearching} />
      ) : null}

      {!searchEnabled && !list.length ? (
        <Text color="gray.500">No conversations</Text>
      ) : null}

      {searchEnabled ? (
        <>
          {isSearching && <Text color="gray.500">Searching…</Text>}
          {!isSearching && uniqueList.length === 0 && (
            <Text color="gray.500">No matches</Text>
          )}
          {!isSearching &&
            uniqueList.map((contact) => (
              <PlainChatRow
                key={`s-${contact.conversationId}`}
                contact={contact}
                onOpen={() => setChat(contact)}
                readOverrides={readOverrides}
                archivedMode={contact.archived ? "only" : "active"}
              />
            ))}
        </>
      ) : (
        uniqueList.map((contact) => (
          <SortableChatRow
            key={contact.conversationId}
            contact={contact}
            onOpen={() => setChat(contact)}
            readOverrides={readOverrides}
            archivedMode={archivedMode}
          />
        ))
      )}
    </VStack>
  );
}

/* ------------------------------- Search box ------------------------------- */
function SearchBox({
  term,
  setTerm,
  isSearching,
}: {
  term: string;
  setTerm: (v: string) => void;
  isSearching: boolean;
}) {
  return (
    <InputGroup size="sm">
      <InputLeftElement pointerEvents="none">
        <FiSearch />
      </InputLeftElement>
      <Input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Search chats (name, phone, email, message, ID)…"
        variant="filled"
        borderRadius="xl"
      />
      {term && (
        <CloseButton
          aria-label="Clear"
          onClick={() => setTerm("")}
          position="absolute"
          right="8px"
          top="50%"
          transform="translateY(-50%)"
          isDisabled={isSearching}
        />
      )}
    </InputGroup>
  );
}

/* ------------------------- Non-sortable (search) row ---------------------- */
function PlainChatRow({
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
  const isArchived = typeof (contact as any).archived === "boolean" ? (contact as any).archived : archivedMode === "only";
  const rowBg = isArchived ? useColorModeValue("purple.50", "whiteAlpha.100") : undefined;
  const rowHoverBg = isArchived
    ? useColorModeValue("purple.100", "whiteAlpha.200")
    : undefined;
  const rowBorder = isArchived ? useColorModeValue("purple.200", "whiteAlpha.300") : undefined;
  return (
    <HStack
      px={3}
      py={2}
      borderRadius="xl"
      transition="background 0.2s ease"
      bg={rowBg}
      borderWidth={isArchived ? "1px" : undefined}
      borderColor={rowBorder}
      _hover={{ bg: rowHoverBg ?? "blackAlpha.50", _dark: { bg: rowHoverBg ? undefined : "whiteAlpha.100" } }}
      onClick={onOpen}
      cursor="pointer"
    >
      <InnerRowContent
        contact={contact}
        readOverrides={readOverrides}
        archivedMode={archivedMode}
      />
    </HStack>
  );
}

/* -------------------------------- Sortable row ---------------------------- */
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: contact.conversationId,
    data: {
      type: "conversation",
      conversationSid: contact.conversationId,
      phone: contact.owner?.phone ?? contact.lastMessage?.author ?? undefined,
      name: contact.owner?.name ?? undefined,
    },
  });

  const isArchived = typeof (contact as any).archived === "boolean" ? (contact as any).archived : archivedMode === "only";
  const rowBg = isArchived ? useColorModeValue("purple.50", "whiteAlpha.100") : undefined;
  const rowHoverBg = isArchived
    ? useColorModeValue("purple.100", "whiteAlpha.200")
    : undefined;
  const rowBorder = isArchived ? useColorModeValue("purple.200", "whiteAlpha.300") : undefined;

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

  return (
    <HStack
      ref={setNodeRef}
      style={style}
      px={3}
      py={2}
      borderRadius="xl"
      transition="background 0.2s ease, transform 0.2s ease"
      bg={rowBg}
      borderWidth={isArchived ? "1px" : undefined}
      borderColor={rowBorder}
      _hover={{ bg: rowHoverBg ?? "blackAlpha.50", _dark: { bg: rowHoverBg ? undefined : "whiteAlpha.100" } }}
      {...listeners}
      {...attributes}
      onClick={onOpen}
    >
      <InnerRowContent
        contact={contact}
        readOverrides={readOverrides}
        archivedMode={archivedMode}
      />
    </HStack>
  );
}

/* ---------------------------- Shared row content -------------------------- */
function InnerRowContent({
  contact,
  readOverrides,
  archivedMode = "active",
}: {
  contact: ConversationChat;
  readOverrides?: ReadonlySet<string>;
  archivedMode?: "active" | "only" | "all";
}) {
  const formatFirstName = (value: string) => {
    const first = (value || "").trim().split(/\s+/)[0] || "";
    if (!first) return "No name";
    return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  };

  const lastPreview = (() => {
    if (contact.lastMessage?.body) return contact.lastMessage.body;
    if (contact.lastMessage?.media?.length) return "📷 Photo";
    return "";
  })();

  const formattedNumber = formatFromE164(contact.owner?.phone ? contact.owner?.phone : "");

  // unread overrides
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
    <>
      <Box 
        w={{ base: "40px", md: "48px" }}
        h={{ base: "40px", md: "48px" }}
        bg={useColorModeValue("gray.200", "gray.600")}
        borderRadius="lg"
        display="flex"
        alignItems="center"
        justifyContent="center"
        flexShrink={0}
      >
        {(() => {
          const defaultIconColor = useColorModeValue("gray.400", "gray.500");
          const c = contact.owner?.color;
          let colorValue: string = defaultIconColor;
          if (c && typeof c === "string") {
            if (c.startsWith("#")) {
              colorValue = c; // hex color provided by appointment
            } else if (c.includes(".")) {
              colorValue = c; // chakra token like "teal.500"
            } else {
              colorValue = `${c}.500`; // base token name, add weight
            }
          }
          return (
            <Icon as={FaUser} boxSize={{ base: "20px", md: "24px" }} color={colorValue} />
          );
        })()}
      </Box>

      <Box flex="1" minW={0}>
        <HStack align="center" spacing={2}>
          <Tooltip hasArrow label={contact.owner?.name || contact.lastMessage?.author || "No name"} openDelay={300}>
            <Text fontWeight={isUnread ? "bold" : "semibold"} noOfLines={1} fontSize={{ base: "sm", md: "md" }}>
              {formatFirstName(contact.owner?.name || contact.lastMessage?.author || "No name")}
            </Text>
          </Tooltip>

          {/* Archived badge: hide in archived-only list to keep max space for name */}
          {(() => {
            const isArchived = typeof (contact as any).archived === "boolean" ? (contact as any).archived : archivedMode === "only";
            const showBadge = isArchived && archivedMode !== "only";
            return showBadge ? (
              <Badge colorScheme="purple" variant="subtle" borderRadius="full" px="2" fontSize="0.65rem">
                Archived
              </Badge>
            ) : null;
          })()}

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

          {displayUnread > 0 && (
            <Badge borderRadius="full" px="2" fontSize="0.75rem" colorScheme="blue">
              {displayUnread > 99 ? "99+" : displayUnread}
            </Badge>
          )}
        </HStack>

        <Text
          fontSize={{ base: "xs", md: "sm" }}
          color={isUnread ? "inherit" : "gray.500"}
          fontWeight={isUnread ? "semibold" : "normal"}
          noOfLines={1}
        >
          {lastPreview}
        </Text>
      </Box>

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
    </>
  );
}
