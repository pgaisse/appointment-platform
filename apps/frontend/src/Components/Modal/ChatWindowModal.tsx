import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Flex,
  HStack,
  Text,
  IconButton,
  Tooltip,
  useColorModeValue,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  Spinner,
  Center,
  VStack,
} from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { FaMessage } from "react-icons/fa6";
import { useAuth0 } from "@auth0/auth0-react";
import { useQueryClient } from "@tanstack/react-query";

import ChatWindows from "@/Components/Chat/ChatWindows";
import { useChatSocket } from "@/Hooks/Query/useChatSocket";
import { useMarkConversationRead } from "@/Hooks/Query/useMarkConversationRead";
import { useUnarchiveOnInbound } from "@/Hooks/Query/useUnarchiveOnInbound";
import type { ConversationChat } from "@/types";

/* ========= Public API — programmatic open via event bus ========= */
export type ChatOpenPayload = {
  conversationId?: string;
  phone?: string; // raw; digits will be normalized
  appId?: string; // owner._id
};

const CHAT_MODAL_OPEN = "chat:open-modal" as const;

export function openChatModal(payload?: ChatOpenPayload) {
  window.dispatchEvent(new CustomEvent(CHAT_MODAL_OPEN, { detail: payload }));
}

/* ========================= Component API ========================= */
type ChatWindowModalProps = {
  trigger?: React.ReactElement<any, any>;
  initial?: ChatOpenPayload;
  onCloseModal?: () => void;
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
  title?: string;
  contact: ConversationChat | undefined;
};

export default function ChatWindowModal({
  trigger,
  initial,
  onClose,
  title = "Chat",
  onCloseModal,
  onOpen,
  isOpen,
  contact,
}: ChatWindowModalProps) {
  const [pendingOpenPayload, setPendingOpenPayload] = useState<ChatOpenPayload | undefined>(initial);

  // allow programmatic open
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<ChatOpenPayload>;
      setPendingOpenPayload(ce.detail);
      onOpen();
    };
    window.addEventListener(CHAT_MODAL_OPEN, handler as EventListener);
    return () => window.removeEventListener(CHAT_MODAL_OPEN, handler as EventListener);
  }, [onOpen]);

  const DefaultTrigger = (
    <Tooltip label="Open chat" hasArrow>
      <IconButton aria-label="Open chat" icon={<FaMessage />} variant="ghost" onClick={() => onOpen()} />
    </Tooltip>
  );

  const modalBg = useColorModeValue("rgba(250, 252, 255, 0.9)", "rgba(18, 20, 28, 0.9)");

  return (
    <>
      {trigger
        ? React.cloneElement(trigger, {
            onClick: (e: any) => {
              trigger.props?.onClick?.(e);
              setPendingOpenPayload((prev) => prev ?? initial);
              onOpen();
            },
          })
        : DefaultTrigger}

      <Modal
        isOpen={isOpen}
        onClose={() => {
          onCloseModal ? onCloseModal() : undefined;
          onClose?.();
        }}
        size="6xl"
        scrollBehavior="inside"
      >
        <ModalOverlay />
        <ModalContent
          bg={modalBg}
          backdropFilter="saturate(140%) blur(6px)"
          borderRadius="2xl"
          overflow="hidden"
          boxShadow="2xl"
        >
          <ModalHeader>{title}</ModalHeader>
          <ModalCloseButton />
          <ModalBody p={{ base: 2, md: 4 }}>
            <ChatModalInner initial={pendingOpenPayload} contact={contact} />
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}

/* ======================= Inner content (modal) ======================= */
function ChatModalInner({
  initial,
  contact,
}: {
  initial: ChatOpenPayload | undefined;
  contact: ConversationChat | undefined;
}) {
  const [chat, setChat] = useState<ConversationChat | undefined>(undefined);
  const { user } = useAuth0();
  const org_id = (user as any)?.org_id?.toLowerCase?.() ?? "";
  const queryClient = useQueryClient();
  const markRead = useMarkConversationRead();
  const unarchiveOnInbound = useUnarchiveOnInbound();

  // Selected chat comes from the launcher
  useEffect(() => {
    setChat(contact);
  }, [contact]);

  // When modal opens with a selected chat: mark as read (server) + keep caches fresh
  useEffect(() => {
    const run = async () => {
      if (!chat?.conversationId) return;
      // Avoid flicker on unread by pausing list queries, then invalidate
      await queryClient.cancelQueries({ queryKey: ["conversations-infinite"] });
      try {
        await markRead.mutateAsync(chat.conversationId);
      } finally {
        // keep both lists and thread fresh
        queryClient.invalidateQueries({ queryKey: ["conversations-infinite"] });
        queryClient.invalidateQueries({ queryKey: ["messages", chat.conversationId] });
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat?.conversationId]);

  // Real-time sync for the open chat
  useChatSocket(
    org_id,
    // onNewMessage
    async (msg) => {
      window.dispatchEvent(new CustomEvent("chat:message", { detail: msg }));

      // Always refresh the thread for the impacted conversation
      queryClient.invalidateQueries({ queryKey: ["messages", msg.conversationId] });

      // If the inbound belongs to the opened chat, mark as read + unarchive failsafe
      const isOpenAndInbound = chat?.conversationId === msg.conversationId && msg.direction === "inbound";
      if (isOpenAndInbound) {
        await queryClient.cancelQueries({ queryKey: ["conversations-infinite"] });
        try {
          // server-side read
          await markRead.mutateAsync(msg.conversationId);
          // ensure server state if it was archived (idempotent)
          unarchiveOnInbound.mutate(msg.conversationId);
        } finally {
          // refresh lists + thread
          queryClient.invalidateQueries({ queryKey: ["conversations-infinite"] });
          queryClient.invalidateQueries({ queryKey: ["messages", msg.conversationId] });
        }
      } else {
        // Not the open chat: just refresh lists so badges/ordering stay right
        queryClient.invalidateQueries({ queryKey: ["conversations-infinite"] });
      }
    },
    // onMessageUpdated
    (msg) => {
      queryClient.invalidateQueries({ queryKey: ["conversations-infinite"] });
      queryClient.invalidateQueries({ queryKey: ["messages", msg.conversationId] });
    }
  );

  /* ---------- styling ---------- */
  const pageBg = useColorModeValue(
    "linear-gradient(180deg, rgba(246,248,255,0.85) 0%, rgba(241,243,255,0.75) 100%)",
    "linear-gradient(180deg, rgba(23,25,35,0.85) 0%, rgba(18,20,28,0.85) 100%)"
  );
  const panelBg = useColorModeValue("rgba(255,255,255,0.85)", "rgba(26,32,44,0.65)");
  const panelBorder = useColorModeValue("blackAlpha.200", "whiteAlpha.200");

  // Fancy wait overlay while initial data settles
  const isBooting = !chat; // we already lazy-load modal, so just wait for contact

  return (
    <Box h="75dvh" minH="480px" w="100%" position="relative" overflow="hidden" borderRadius="xl">
      <Box position="absolute" inset={0} bgGradient={pageBg} zIndex={0} />

      <Flex position="relative" zIndex={1} h="100%" direction={{ base: "column", xl: "row" }} gap={{ base: 3, md: 4 }}>
        {/* Chat window only (lists live outside the modal) */}
        <Box
          flex={{ base: "1 1 0", xl: "1 1 auto" }}
          minW={0}
          minH={0}
          bg={panelBg}
          borderWidth="1px"
          borderColor={panelBorder}
          borderRadius="2xl"
          boxShadow="0 10px 30px rgba(0,0,0,0.10)"
          backdropFilter="saturate(140%) blur(6px)"
          overflow="hidden"
          maxH={{ base: "100%", xl: "calc(75dvh - 1rem)" }}
        >
          <ChatWindows chat={chat} isOpen={!!chat} />
        </Box>
      </Flex>

      <WaitModal isOpen={isBooting} title="Preparing your chat…" subtitle="Syncing conversations and loading messages…" />
    </Box>
  );
}

/* ---------- Lightweight wait overlay ---------- */
function WaitModal({
  isOpen,
  title = "Loading…",
  subtitle,
}: {
  isOpen: boolean;
  title?: string;
  subtitle?: string;
}) {
  const glassBg = useColorModeValue("rgba(250, 252, 255, 0.75)", "rgba(18, 20, 28, 0.75)");
  const borderCol = useColorModeValue("blackAlpha.200", "whiteAlpha.200");
  const textMuted = useColorModeValue("gray.600", "gray.300");

  const spin = keyframes`from { transform: rotate(0deg); } to { transform: rotate(360deg); }`;
  const shimmer = keyframes`
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  `;

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={() => {}} isCentered closeOnOverlayClick={false} closeOnEsc={false} size="md" motionPreset="scale">
      <ModalOverlay zIndex={1800} bg="blackAlpha.600" backdropFilter="blur(10px) saturate(160%)" />
      <ModalContent
        zIndex={1800}
        bg={glassBg}
        borderRadius="3xl"
        overflow="hidden"
        borderWidth="1px"
        borderColor={borderCol}
        boxShadow="0 20px 80px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.15)"
      >
        <ModalBody p={8}>
          <Center>
            <VStack spacing={6}>
              <Box position="relative" w="132px" h="132px" aria-busy="true">
                <Box position="absolute" inset="-12px" borderRadius="full" filter="blur(18px)" opacity={0.55} bgGradient="radial(closest-side, rgba(99,102,241,0.35), transparent)" />
                <Box
                  position="absolute"
                  inset={0}
                  borderRadius="full"
                  bg="conic-gradient(from 0deg, #7dd3fc, #a78bfa, #f472b6, #fbbf24, #7dd3fc)"
                  animation={`${spin} 2.8s linear infinite`}
                  sx={{
                    WebkitMask: "radial-gradient(farthest-side, transparent 66%, black 67%)",
                    mask: "radial-gradient(farthest-side, transparent 66%, black 67%)",
                  }}
                />
                <Center position="absolute" inset="12px" borderRadius="full" bg={glassBg} borderWidth="1px" borderColor={borderCol} boxShadow="inset 0 1px 0 rgba(255,255,255,0.12)">
                  <Spinner size="lg" thickness="4px" speed="0.7s" />
                </Center>
              </Box>

              <Text
                fontSize="xl"
                fontWeight="semibold"
                bgGradient="linear(to-r, gray.400, gray.100, gray.400)"
                bgClip="text"
                animation={`${shimmer} 2.2s ease-in-out infinite`}
                backgroundSize="200% 100%"
                textAlign="center"
              >
                {title}
              </Text>

              {subtitle && (
                <Text fontSize="sm" color={textMuted} textAlign="center" maxW="sm">
                  {subtitle}
                </Text>
              )}

              <VStack spacing={2} w="full" maxW="sm" opacity={0.9}>
                <Box h="10px" w="100%" borderRadius="full" bg="blackAlpha.200" />
                <Box h="10px" w="90%" borderRadius="full" bg="blackAlpha.200" />
                <Box h="10px" w="80%" borderRadius="full" bg="blackAlpha.200" />
              </VStack>
            </VStack>
          </Center>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
