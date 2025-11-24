import React, { useMemo, useState, useEffect } from "react";
import {
  Button,
  IconButton,
  Tooltip,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Input,
  VStack,
  HStack,
  Text,
  Box,
  Spinner,
  useDisclosure,
  Icon,
  useColorModeValue,
} from "@chakra-ui/react";
import { FiMessageCircle } from "react-icons/fi";
import { FaUser } from "react-icons/fa";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useGetCollection } from "@/Hooks/Query/useGetCollection";
import { useCustomChat } from "@/Hooks/Query/useCustomChat";
import { formatToE164 } from "@/Functions/formatToE164";
import type { Message, ConversationChat } from "@/types";
import { formatAustralianMobile } from "@/Functions/formatAustralianMobile";
import type { ConversationsPage } from "@/Hooks/Query/useConversationsInfinite";
import { capitalize } from "@/utils/textFormat";

 type ContactDoc = {
  _id: string;
  nameInput: string;
  lastNameInput: string;
  phoneInput: string;
  sid: string;
  color?: string;
};
 type Props = {
  setChat?: React.Dispatch<React.SetStateAction<ConversationChat | undefined>>;
  dataConversation: ConversationChat[] | undefined;
  iconOnly?: boolean;
  tooltipLabel?: string;
  size?: "xs" | "sm" | "md" | "lg";
  variant?: string;
  onCreate?: (conv: ConversationChat) => void;
};

const MIN_CHARS = 2;

function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

 const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

 const buildLocalMessage = (conversationId: string, author: string): Message => {
  const now = new Date().toISOString();
  return {
    clientTempId: `tmp-${Date.now()}`,
    sid: `local-${Date.now()}`,
    conversationId,
    author,
    body: "",
    index: undefined,
    media: [],
    direction: "outbound",
    createdAt: now,
    updatedAt: now,
    tempOrder: Date.now(),
    status: "pending",
  };
};

export default function NewChatButton({ setChat, dataConversation, iconOnly = false, tooltipLabel = "Nuevo chat", size = "sm", variant = "ghost", onCreate }: Props) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 300);
  const { socket } = useCustomChat();
  const queryClient = useQueryClient();

  const mongoQuery = useMemo(() => {
    const s = (debounced || "").trim();
    if (!isOpen || s.length < MIN_CHARS) return { _id: { $exists: false } };
    const rx = "^" + escapeRegExp(s);
    const digits = s.replace(/\D/g, "");
    const or: any[] = [
      { nameInput: { $regex: rx, $options: "i" } },
      { lastNameInput: { $regex: rx, $options: "i" } },
    ];
    if (digits.length >= 3) {
      or.push({ phoneInput: { $regex: "^" + digits } });
    }
    // Exclude patients without phone number
    return { $and: [ { $or: or }, { phoneInput: { $exists: true, $ne: "" } } ] } as any;
  }, [debounced, isOpen]);

  const { data = [], isLoading } = useGetCollection<ContactDoc>("Appointment", {
    mongoQuery,
    projection: { nameInput: 1, lastNameInput: 1, phoneInput: 1, sid: 1, color: 1 },
    limit: 20,
  });
  // Legacy flat list cache (kept for backward compatibility if someone still reads it)
  const upsertConversationInCache = (conv: ConversationChat) => {
    queryClient.setQueryData<ConversationChat[]>(["conversations"], (prev) => {
      const list = Array.isArray(prev) ? prev : [];
      const exists = list.some(
        (c) => c.owner.phone === conv.owner.phone || c.conversationId === conv.conversationId
      );
      if (exists) return list;
      return [conv, ...list];
    });
  };

  // Helpers to read/update the infinite conversations cache so MessageList sees updates immediately
  type ConvInfinite = InfiniteData<ConversationsPage>;

  const conversationExistsInInfinite = (conv: ConversationChat) => {
    const caches = queryClient.getQueriesData<ConvInfinite>({ queryKey: ["conversations-infinite"] });
    const norm = (v?: string) => (v ? v.replace(/\D+/g, "") : "");
    const phone = norm(conv.owner?.phone);
    for (const [, data] of caches) {
      if (!data) continue;
      for (const page of data.pages) {
        for (const c of page.items) {
          if (c.conversationId && conv.conversationId && c.conversationId === conv.conversationId) return true;
          if (norm(c.owner?.phone) && phone && norm(c.owner?.phone) === phone) return true;
        }
      }
    }
    return false;
  };

  const insertAtTopActiveInfinite = (conv: ConversationChat) => {
    // Insert into any active view caches, placing the new conversation at the top of the first page
    const caches = queryClient.getQueriesData<ConvInfinite>({ queryKey: ["conversations-infinite"] });
    for (const [key] of caches) {
      // key is the query key tuple; expect ["conversations-infinite", mode, pageSize]
      const keyArr = Array.isArray(key) ? key : [];
      const mode = keyArr[1];
      if (mode !== "active") continue; // only show in active view
      queryClient.setQueryData<ConvInfinite>(key as any, (prev) => {
        if (!prev) return prev;
        // Remove any existing with same id to avoid duplicates
        const cleanedPages = prev.pages.map((p) => ({
          ...p,
          items: p.items.filter((c) => c.conversationId !== conv.conversationId),
        }));
        const first = cleanedPages[0];
        const newFirst = { ...first, items: [conv, ...first.items] };
        return {
          pageParams: prev.pageParams,
          pages: [newFirst, ...cleanedPages.slice(1)],
        };
      });
    }
  };
  const handleSelectContact = (c: ContactDoc) => {
    const phone = formatToE164(c.phoneInput || "");
    const name = `${c.nameInput} ${c.lastNameInput}`.trim();
    const _id = c._id;
    const sid = c.sid;
    const color = c.color;
    const localConversationId = `local-${phone}`;
    // Prefer server SID when present; otherwise use a temporary local id
    const conversationId = sid && sid.trim().length > 0 ? sid : localConversationId;
    const lm = buildLocalMessage(conversationId, "clinic");

    const newConv: ConversationChat = {
      conversationId,
      owner: {
        phone,
        name,
        _id,
        color,
      },
      lastMessage: lm,
      chatmessage: lm,
      archived: false,
      unreadCount: 0,
    };

    const exists = (dataConversation?.some((u) => u.conversationId === conversationId)) || conversationExistsInInfinite(newConv);
    if (exists) {
      onClose();
      setSearch("");
      return;
    }

    // Optimistically insert into the infinite conversations cache (active view) so MessageList updates immediately
    insertAtTopActiveInfinite(newConv);

  // Keep legacy flat cache in sync (harmless if unused)
  upsertConversationInCache(newConv);
  // Notify parent to persist temp in-session
  onCreate?.(newConv);
    setChat?.(newConv);

    socket?.emit("smsSend", { appId: c._id, phone, name });

    onClose();
    setSearch("");
  };

  return (
    <>
      {iconOnly ? (
        <Tooltip label={tooltipLabel} placement="top" hasArrow openDelay={150}>
          <IconButton
            aria-label={tooltipLabel}
            icon={<FiMessageCircle />}
            size={size}
            variant={variant as any}
            colorScheme="gray"
            onClick={onOpen}
          />
        </Tooltip>
      ) : (
        <Button
          leftIcon={<FiMessageCircle />}
          colorScheme="gray"
          variant="ghost"
          size="md"
          justifyContent="start"
          px={4}
          py={2}
          mb={3}
          borderRadius="lg"
          fontWeight="medium"
          fontSize="md"
          _hover={{ bg: "gray.100" }}
          onClick={onOpen}
        >
          New Chat
        </Button>
      )}

      <Modal isOpen={isOpen} onClose={() => { onClose(); setSearch(""); }} size="lg" isCentered>
        <ModalOverlay />
        <ModalContent borderRadius="2xl">
          <ModalHeader>Start New Chat</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Input
              placeholder="Search by name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              mb={2}
              borderRadius="xl"
              autoFocus
            />

            {search.trim().length < MIN_CHARS && (
              <Text color="gray.500" textAlign="center" my={6}>
                Type at least {MIN_CHARS} characters to search.
              </Text>
            )}

            {isLoading ? (
              <Spinner mx="auto" my={10} />
            ) : (
              <VStack spacing={3} align="stretch" maxH="300px" overflowY="auto">
                {data
                  .filter((c) => (c.phoneInput ?? "").trim().length > 0)
                  .map((contact) => (
                  <HStack
                    key={contact._id}
                    p={3}
                    borderRadius="lg"
                    _hover={{ bg: "gray.100" }}
                    cursor="pointer"
                    onClick={() => handleSelectContact(contact)}
                  >
                    <Box 
                      w="32px"
                      h="32px"
                      bg={useColorModeValue("gray.200", "gray.600")}
                      borderRadius="md"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      flexShrink={0}
                    >
                      <Icon 
                        as={FaUser} 
                        boxSize="16px" 
                        color={contact.color ? `${contact.color}.500` : useColorModeValue("gray.400", "gray.500")}
                      />
                    </Box>
                    <Box>
                      <Text fontWeight="medium" textTransform="capitalize">
                        {capitalize(contact.nameInput)} {capitalize(contact.lastNameInput)}
                      </Text>
                      <Text fontSize="sm" color="gray.500">
                        {formatAustralianMobile(contact.phoneInput || "")}
                      </Text>
                    </Box>
                  </HStack>
                ))}
                {data.length === 0 && search.trim().length >= MIN_CHARS && (
                  <Text textAlign="center" color="gray.400">
                    No contacts found.
                  </Text>
                )}
              </VStack>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
