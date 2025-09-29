// Components/Chat/CustomChat.tsx
import { Box, Flex, Text, useColorModeValue, HStack, Avatar } from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useQueryClient } from "@tanstack/react-query";

import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensors,
  useSensor,
  DragStartEvent,
  DragEndEvent,
  DragOverlay,
  closestCenter,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

import MessageList from "@/Components/Chat/MessageList";
import ChatWindows from "@/Components/Chat/ChatWindows";
import NewChatButton from "@/Components/Chat/NewChatButton";
import { useChatSocket } from "@/Hooks/Query/useChatSocket";
import { useConversations } from "@/Hooks/Query/useConversations";
import { useAssignCategoryToConversation } from "@/Hooks/Query/useChatCategorization";
import type { ConversationChat } from "@/types";
import { FaUserAlt } from "react-icons/fa";
import ChatCategorizationPanel from "@/Components/Chat/CustomMessages/ChatCategorizationPanel";
import AddPatientButton from "@/Components/DraggableCards/AddPatientButton";

export default function CustomChat() {
  const [chat, setChat] = useState<ConversationChat | undefined>(undefined);
  console.log("Chat",chat)
  const { user } = useAuth0();
  const org_id = (user as any)?.org_id?.toLowerCase?.() ?? "";
  const queryClient = useQueryClient();

  const { data: dataConversation = [], isLoading: isLoadingConversation } = useConversations();

  // keep selected chat fresh if list updates
  useEffect(() => {
    if (!chat?.conversationId || !dataConversation) return;
    const fresh = dataConversation.find((c) => c.conversationId === chat.conversationId);
    if (fresh && fresh !== chat) setChat(fresh);
  }, [dataConversation, chat?.conversationId]);

  // live updates
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

  /* ---------- DND ---------- */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const ids = useMemo(() => dataConversation.map((c) => c.conversationId), [dataConversation]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const byId = useMemo(() => {
    const m = new Map<string, ConversationChat>();
    dataConversation.forEach((c) => m.set(c.conversationId, c));
    return m;
  }, [dataConversation]);
  const activeConv = activeId ? byId.get(activeId) ?? null : null;

  const assign = useAssignCategoryToConversation();

  const handleDragStart = useCallback((e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  }, []);

  const handleDragEnd = useCallback(
    async (e: DragEndEvent) => {
      const { active, over } = e;
      setActiveId(null);
      if (!over) return;

      const overId = String(over.id);
      if (overId.startsWith("cat-")) {
        const chatCategoryId = overId.replace("cat-", "");
        const conversationSid = String(active.id);
        try {
          await assign.mutateAsync({ conversationSid, chatCategoryId });
          queryClient.invalidateQueries({
            queryKey: ["conversation-categories", conversationSid],
          });
        } catch (err) {
          // swallow — upstream handles errors/UI
        }
      }
    },
    [assign, queryClient]
  );

  /* ---------- Styling tokens ---------- */
  const pageBg = useColorModeValue(
    "linear-gradient(180deg, rgba(246,248,255,0.85) 0%, rgba(241,243,255,0.75) 100%)",
    "linear-gradient(180deg, rgba(23,25,35,0.85) 0%, rgba(18,20,28,0.85) 100%)"
  );
  const panelBg = useColorModeValue("rgba(255,255,255,0.85)", "rgba(26,32,44,0.65)");
  const panelBorder = useColorModeValue("blackAlpha.200", "whiteAlpha.200");
  const sidebarHeaderBg = useColorModeValue("rgba(255,255,255,0.76)", "rgba(26,32,44,0.6)");
  const sidebarHeaderBorder = useColorModeValue("blackAlpha.200", "whiteAlpha.200");
  const scrollbarThumb = useColorModeValue("#CBD5E0", "#4A5568");
  const scrollbarTrack = useColorModeValue("#EDF2F7", "#2D3748");

  const handleOpenChat = useCallback((c: ConversationChat) => setChat(c), []);

  return (
    // Full-viewport height on all devices, safe-area aware
    <Box h="90dvh" minH="90dvh" w="100%" position="relative" overflow="hidden">
      {/* Backdrop */}
      <Box position="absolute" inset={0} bgGradient={pageBg} zIndex={0} />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <Flex
          position="relative"
          zIndex={1}
          h="100%"
          // Column on phones (all three sections stacked), row on wide screens
          direction={{ base: "column", xl: "row" }}
          gap={{ base: 3, md: 4 }}
          px={{ base: 2, md: 4 }}
          py={{ base: 2, md: 4 }}
          mx="auto"
        >
          {/* Categories panel */}
          <Box
            // Equal-height sections on phones; fixed column on desktop
            flex={{ base: "1 1 0", xl: "0 0 18%" }}
            w={{ base: "100%", xl: "18%" }}
            maxW={{ xl: "520px" }}
            minH={0}
            maxH={{ base: "100%", xl: "calc(100dvh - 2rem - env(safe-area-inset-bottom))" }}
            p={{ base: 3, md: 5 }}
            bg={panelBg}
            borderWidth="1px"
            borderColor={panelBorder}
            borderRadius="2xl"
            boxShadow="0 10px 30px rgba(0,0,0,0.10)"
            backdropFilter="saturate(140%) blur(6px)"
            overflow="hidden"
          >
            <Box h="100%" overflowY="auto" pr={1}
              sx={{
                "::-webkit-scrollbar": { width: "10px" },
                "::-webkit-scrollbar-thumb": { background: scrollbarThumb, borderRadius: "10px" },
                "::-webkit-scrollbar-track": { background: scrollbarTrack },
              }}
            >
              <ChatCategorizationPanel
                conversationSid={chat?.conversationId ?? ""}
                conversations={dataConversation}
                onOpenChat={handleOpenChat}
                density="compact"
              />
            </Box>
          </Box>

          {/* Sidebar: conversations list */}
          <Box
            flex={{ base: "1 1 0", xl: "0 0 20%" }}
            w={{ base: "100%", xl: "20%" }}
            minH={0}
            maxH={{ base: "100%", xl: "calc(100dvh - 2rem - env(safe-area-inset-bottom))" }}
            bg={panelBg}
            borderWidth="1px"
            borderColor={panelBorder}
            borderRadius="2xl"
            boxShadow="0 10px 30px rgba(0,0,0,0.10)"
            backdropFilter="saturate(140%) blur(6px)"
            overflow="hidden"
          >
            {/* Sticky header */}
            <Box
              position="sticky"
              top={0}
              zIndex={2}
              px={{ base: 3, md: 5 }}
              py={{ base: 3, md: 4 }}
              bg={sidebarHeaderBg}
              borderBottomWidth="1px"
              borderColor={sidebarHeaderBorder}
              backdropFilter="saturate(140%) blur(6px)"
            >
              <Text fontSize={{ base: "xl", md: "2xl" }} fontWeight="bold">
                Messages
              </Text>
              <HStack spacing={3} mt={3} wrap="wrap">
                <NewChatButton setChat={setChat} dataConversation={dataConversation} />
                <AddPatientButton
                  onlyPatient={true}
                  text="New Contact"
                  label="Add Contact"
                  tooltip={false}
                  formProps={{ typeButonVisible: false, phoneFieldReadOnly: false, mode: "CREATION" }}
                />
              </HStack>
            </Box>

            {/* Scrollable list area */}
            <Box
              h="calc(100% - 76px)" // leave room for sticky header; responsive header height handled by overflow
              px={{ base: 3, md: 5 }}
              py={{ base: 3, md: 4 }}
              overflowY="auto"
              sx={{
                "::-webkit-scrollbar": { width: "10px" },
                "::-webkit-scrollbar-thumb": { background: scrollbarThumb, borderRadius: "10px" },
                "::-webkit-scrollbar-track": { background: scrollbarTrack },
              }}
            >
              <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                <MessageList
                  setChat={setChat}
                  dataConversation={dataConversation}
                  isLoadingConversation={isLoadingConversation}
                />
              </SortableContext>
            </Box>
          </Box>

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
            maxH={{ base: "100%", xl: "calc(100dvh - 2rem - env(safe-area-inset-bottom))" }}
          >
            <ChatWindows chat={chat} isOpen={!!chat} />
          </Box>
        </Flex>

        {/* Drag preview */}
        <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }}>
          {activeConv ? <DragPreviewChatRow conv={activeConv} /> : null}
        </DragOverlay>
      </DndContext>
    </Box>
  );
}

/* ---------- Visual clone shown in the DragOverlay ---------- */
function DragPreviewChatRow({ conv }: { conv: ConversationChat }) {
  const name = conv.owner?.unknown ? undefined : conv.owner?.name || conv.lastMessage?.author || "No name";
  const lastPreview = conv.lastMessage?.body
    ? conv.lastMessage.body
    : conv.lastMessage?.media?.length
    ? "📷 Photo"
    : "";

  return (
    <HStack
      p={3}
      borderRadius="xl"
      bg="chakra-body-bg"
      boxShadow="0 18px 48px rgba(0,0,0,0.30)"
      transition="all 0.2s ease"
      w="360px"
      maxW="80vw"
      cursor="grabbing"
      userSelect="none"
      borderWidth="1px"
      borderColor="blackAlpha.300"
    >
      <Avatar
        size="md"
        name={name}
        src={conv.owner?.avatar}
        icon={conv.owner?.unknown ? <FaUserAlt fontSize="1.5rem" /> : undefined}
        pointerEvents="none"
      />
      <Box flex="1" minW={0}>
        <Text fontWeight="semibold" noOfLines={1}>
          {conv.owner?.name || conv.lastMessage?.author || "No name"}
        </Text>
        <Text fontSize="sm" color="gray.500" noOfLines={1}>
          {lastPreview}
        </Text>
      </Box>
    </HStack>
  );
}
