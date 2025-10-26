import React, { useMemo, useState, useEffect } from "react";
import {
  Button, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody,
  ModalCloseButton, Input, VStack, HStack, Avatar, Text, Box, Spinner,
  useDisclosure,
} from "@chakra-ui/react";
import { FiMessageCircle } from "react-icons/fi";
import { useQueryClient } from "@tanstack/react-query";
import { useGetCollection } from "@/Hooks/Query/useGetCollection";
import { useCustomChat } from "@/Hooks/Query/useCustomChat";
import { formatToE164 } from "@/Functions/formatToE164";
import type { Message, ConversationChat } from "@/types";
import { formatAustralianMobile } from "@/Functions/formatAustralianMobile";

type ContactDoc = {
  _id: string;
  nameInput: string;
  lastNameInput: string;
  phoneInput: string;
  sid: string;
};

type Props = {
  setChat?: React.Dispatch<React.SetStateAction<ConversationChat | undefined>>;
  dataConversation: ConversationChat[] | undefined
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

export default function NewChatButton({ setChat, dataConversation }: Props) {
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
    return { $or: or };
  }, [debounced, isOpen]);

  const { data = [], isLoading } = useGetCollection<ContactDoc>("Appointment", {
    mongoQuery,
    projection: { nameInput: 1, lastNameInput: 1, phoneInput: 1, sid: 1 },
    limit: 20,
  });

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

  const handleSelectContact = (c: ContactDoc) => {
    const phone = formatToE164(c.phoneInput || "");
    const name = `${c.nameInput} ${c.lastNameInput}`.trim();
    const _id = c._id
    const sid = c.sid
    const localConversationId = `local-${phone}`;

    const lm = buildLocalMessage(localConversationId, "clinic");

    const newConv: ConversationChat = {
      conversationId: sid,
      owner: {
        phone,
        name,
        _id,
      },

      lastMessage: lm,
      chatmessage: lm,
    };
    const exists = dataConversation?.some(u => u.conversationId === sid);
    if (exists) {
      onClose();
      setSearch(""); 
      return
    }



    upsertConversationInCache(newConv);
    setChat?.(newConv);

    socket?.emit("smsSend", { appId: c._id, phone, name });

    onClose();
    setSearch("");
  };

  return (
    <>
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
                {data.map((contact) => (
                  <HStack
                    key={contact._id}
                    p={3}
                    borderRadius="lg"
                    _hover={{ bg: "gray.100" }}
                    cursor="pointer"
                    onClick={() => handleSelectContact(contact)}
                  >
                    <Avatar size="sm" name={`${contact.nameInput} ${contact.lastNameInput}`} />
                    <Box>
                      <Text fontWeight="medium" textTransform="capitalize">
                        {contact.nameInput} {contact.lastNameInput}
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
