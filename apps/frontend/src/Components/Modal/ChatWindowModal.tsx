import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Flex,
  HStack,
  Text,
  IconButton,
  Tooltip,
  Avatar,
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
import { keyframes as emoKeyframes, keyframes } from "@emotion/react";

import { FaMessage } from "react-icons/fa6";
import { FaUserAlt } from "react-icons/fa";
import { useAuth0 } from "@auth0/auth0-react";
import { useQueryClient } from "@tanstack/react-query";

import ChatWindows from "@/Components/Chat/ChatWindows";
import { useChatSocket } from "@/Hooks/Query/useChatSocket";
import { useConversations } from "@/Hooks/Query/useConversations";
import { useAssignCategoryToConversation } from "@/Hooks/Query/useChatCategorization";

import type { ConversationChat } from "@/types";

/* =============================================================
   Public API — programmatic open via event bus
   ============================================================= */
export type ChatOpenPayload = {
  conversationId?: string;
  /** Raw phone; we'll normalize by stripping non-digits for matching */
  phone?: string;
  /** Internal patient/app id if you want to match by owner._id */
  appId?: string;
};

const CHAT_MODAL_OPEN = "chat:open-modal" as const;

export function openChatModal(payload?: ChatOpenPayload) {
  window.dispatchEvent(new CustomEvent(CHAT_MODAL_OPEN, { detail: payload }));
}

/* =============================================================
   ChatWindowModal
   - Full chat (categories + list + window) inside a responsive Modal
   - Works with the SAME hooks/components as CustomChat
   - Can be opened by: 1) clicking the provided trigger icon 2) programmatically via openChatModal()
   - Accepts optional initial payload for the trigger
   ============================================================= */

type ChatWindowModalProps = {
  /** Optional trigger; defaults to an IconButton with a message icon */
  trigger?: React.ReactElement<any, any>;
  /** When clicking the trigger, preselect this conversation/contact. */
  initial?: ChatOpenPayload;
  /** Called when modal fully closes */
  onCloseModal?: () => void;
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
  /** Title in the modal header; defaults to "Chat" */
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

  // Listen to global open events so any icon can open this modal identically
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<ChatOpenPayload>;
      setPendingOpenPayload(ce.detail);
      onOpen();
    };
    window.addEventListener(CHAT_MODAL_OPEN, handler as EventListener);
    return () => window.removeEventListener(CHAT_MODAL_OPEN, handler as EventListener);
  }, [onOpen]);

  // If the consumer didn't pass a trigger, render a default one (message bubble icon)
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

/* =============================================================
   Inner content: SAME flow/state as CustomChat but confined to the modal
   ============================================================= */

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

  useEffect(() => {
    setChat(contact);
    if (contact) console.log("Contact From draggable", contact);
  }, [contact]);

  const { data: dataConversation = [], isLoading: isLoadingConversation } = useConversations();

  // Keep selected chat fresh if list updates
  useEffect(() => {
    if (!chat?.conversationId || !dataConversation) return;
    const fresh = dataConversation.find((c) => c.conversationId === chat.conversationId);
    if (fresh && fresh !== chat) setChat(fresh);
  }, [dataConversation, chat?.conversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live updates (identical behavior)
  useChatSocket(
    org_id,
    // onNewMessage
    (msg) => {
      window.dispatchEvent(new CustomEvent("chat:message", { detail: msg }));
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["messages", msg.conversationId] });
    },
    // onMessageUpdated
    (msg) => {
      window.dispatchEvent(new CustomEvent("chat:message-delivery", { detail: msg }));
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["messages", msg.conversationId] });
    }
  );

  const assign = useAssignCategoryToConversation();

  /* ---------- Styling tokens (match CustomChat) ---------- */
  const pageBg = useColorModeValue(
    "linear-gradient(180deg, rgba(246,248,255,0.85) 0%, rgba(241,243,255,0.75) 100%)",
    "linear-gradient(180deg, rgba(23,25,35,0.85) 0%, rgba(18,20,28,0.85) 100%)"
  );
  const panelBg = useColorModeValue("rgba(255,255,255,0.85)", "rgba(26,32,44,0.65)");
  const panelBorder = useColorModeValue("blackAlpha.200", "whiteAlpha.200");

  // --- Initial selection logic: on mount or when conversations arrive, honor initial payload
  const initialAppliedRef = useRef(false);
  useEffect(() => {
    if (initialAppliedRef.current) return;
    if (!dataConversation?.length) return;

    if (!initial) {
      initialAppliedRef.current = true;
      return; // user will pick from the list
    }

    const normDigits = (s?: string) => (s ? s.replace(/\D+/g, "") : "");

    let found: ConversationChat | undefined = undefined;

    if (initial.conversationId) {
      found = dataConversation.find((c) => c.conversationId === initial.conversationId);
    }
    if (!found && initial.appId) {
      found = dataConversation.find((c) => c.owner?._id === initial.appId);
    }
    if (!found && initial.phone) {
      const want = normDigits(initial.phone);
      found = dataConversation.find((c) => normDigits(c.owner?.phone || c.lastMessage?.author) === want);
    }

    if (found) setChat(found);
    initialAppliedRef.current = true;
  }, [dataConversation, initial]);

  // Estado de arranque/carga para el overlay premium
  const isBooting = isLoadingConversation || (!chat && dataConversation.length === 0);

  return (
    <Box h="75dvh" minH="480px" w="100%" position="relative" overflow="hidden" borderRadius="xl">
      {/* Backdrop */}
      <Box position="absolute" inset={0} bgGradient={pageBg} zIndex={0} />

      <Flex position="relative" zIndex={1} h="100%" direction={{ base: "column", xl: "row" }} gap={{ base: 3, md: 4 }}>
        {/* Chat window */}
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

      {/* Overlay de espera premium */}
      <WaitModal
        isOpen={isBooting}
        title="Preparando tu chat"
        subtitle="Sincronizando conversaciones y cargando mensajes…"
      />
    </Box>
  );
}

/* ---------- Modal de espera premium y ultra sofisticado ---------- */
function WaitModal({
  isOpen,
  title = "Cargando…",
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}}
      isCentered
      closeOnOverlayClick={false}
      closeOnEsc={false}
      size="md"
      motionPreset="scale"
    >
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
              {/* Anillo cónico animado + spinner */}
              <Box position="relative" w="132px" h="132px" aria-busy="true">
                {/* Glow concéntrico */}
                <Box
                  position="absolute"
                  inset="-12px"
                  borderRadius="full"
                  filter="blur(18px)"
                  opacity={0.55}
                  bgGradient="radial(closest-side, rgba(99,102,241,0.35), transparent)"
                />
                {/* Anillo cónico animado */}
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
                {/* Disco interior “glass” */}
                <Center
                  position="absolute"
                  inset="12px"
                  borderRadius="full"
                  bg={glassBg}
                  borderWidth="1px"
                  borderColor={borderCol}
                  boxShadow="inset 0 1px 0 rgba(255,255,255,0.12)"
                >
                  <Spinner size="lg" thickness="4px" speed="0.7s" />
                </Center>
              </Box>

              {/* Título con shimmer sutil */}
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

              {/* Subtítulo */}
              {subtitle && (
                <Text fontSize="sm" color={textMuted} textAlign="center" maxW="sm">
                  {subtitle}
                </Text>
              )}

              {/* Barras fantasma (hint de contenido futuro) */}
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

/* ---------- Visual clone shown in the DragOverlay (opcional) ---------- */