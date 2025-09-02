// Components/Chat/CustomChat.tsx
import { Box, Flex, Text, useColorModeValue } from "@chakra-ui/react";
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
import type { ConversationChat, Message } from "@/types";
import { FaUserAlt } from "react-icons/fa";
import { Avatar, HStack } from "@chakra-ui/react";
import ChatCategorizationPanel from "@/Components/Chat/CustomMessages/ChatCategorizationPanel";

export default function CustomChat() {
  const [chat, setChat] = useState<ConversationChat | undefined>(undefined);
  const { user } = useAuth0();
  const org_id = (user as any)?.org_id?.toLowerCase?.() ?? "";
  const queryClient = useQueryClient();

  const { data: dataConversation = [], isLoading: isLoadingConversation } = useConversations();
  useEffect(() => {
    if (!chat?.conversationId || !dataConversation) return;
    const fresh = dataConversation.find(c => c.conversationId === chat.conversationId);
    if (fresh && fresh !== chat) setChat(fresh); // nueva referencia -> re-render
  }, [dataConversation, chat?.conversationId]);
  console.log(dataConversation)
  // live updates
  console.log(org_id)
  useChatSocket(
    org_id,
    // onNewMessage
    (msg) => {
      // notifica al ChatWindows
      window.dispatchEvent(new CustomEvent("chat:message", { detail: msg }));

      // y de paso sincronizas caches si quieres
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["messages", msg.conversationId] });
    },
    // onMessageUpdated (delivered/read/etc.)
    (msg) => {
      window.dispatchEvent(new CustomEvent("chat:message-delivery", { detail: msg }));
      console.log("Se disparó el evento!!!!","ID",JSON.stringify(msg.conversationId,null,2))
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["messages", msg.conversationId] });
    }
  );

  /* ---------- DND ---------- */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const ids = useMemo(
    () => dataConversation.map((c) => c.conversationId),
    [dataConversation]
  );

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

      // Dropped over a category panel area (CategoryDrop uses id="cat-<categoryId>")
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
          console.error("Failed to assign category:", err);
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
    <Box h="100%" w="100%" position="relative" overflow="hidden">
      {/* page backdrop */}
      <Box
        position="absolute"
        inset={0}
        bgGradient={pageBg}
        filter="blur(0px)"
        zIndex={0}
      />

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
          h="full"
          mt={5}
          mx="auto"
          borderRadius="2xl"
          overflow="hidden"
          gap={0}
          // outer card container
          px={{ base: 2, md: 4 }}
        >
          {/* Categories panel */}
          <Box
            p={{ base: 3, md: 6 }}
            w={{ base: "100%", xl: "20%" }}
            maxW={{ xl: "520px" }}
            bg={panelBg}
            borderWidth="1px"
            borderColor={panelBorder}
            borderRadius="2xl"
            boxShadow="0 10px 30px rgba(0,0,0,0.10)"
            backdropFilter="saturate(140%) blur(6px)"
            transition="box-shadow 200ms ease, transform 120ms ease"
            _hover={{ boxShadow: "0 16px 40px rgba(0,0,0,0.14)" }}
            mr={{ base: 0, xl: 4 }}
            // scroll if content overflows
            maxH="calc(100vh - 120px)"
            overflowY="auto"
            sx={{
              "::-webkit-scrollbar": { width: "10px" },
              "::-webkit-scrollbar-thumb": {
                background: scrollbarThumb,
                borderRadius: "10px",
              },
              "::-webkit-scrollbar-track": {
                background: scrollbarTrack,
              },
            }}
          >
            <ChatCategorizationPanel
              conversationSid={chat?.conversationId ?? ""}
              conversations={dataConversation}
              onOpenChat={handleOpenChat}
              density="compact"
            />
          </Box>

          {/* Sidebar: conversations list */}
          <Box
            w={{ base: "100%", xl: "20%" }}
            p={0}
            borderRadius="2xl"
            borderWidth="1px"
            borderColor={panelBorder}
            bg={panelBg}
            boxShadow="0 10px 30px rgba(0,0,0,0.10)"
            backdropFilter="saturate(140%) blur(6px)"
            transition="box-shadow 200ms ease, transform 120ms ease"
            _hover={{ boxShadow: "0 16px 40px rgba(0,0,0,0.14)" }}
            mr={{ base: 0, xl: 4 }}
            display="flex"
            flexDirection="column"
            maxH="calc(100vh - 120px)"
            overflow="hidden"
          >
            {/* Sticky header */}
            <Box
              position="sticky"
              top={0}
              zIndex={2}
              px={{ base: 3, md: 6 }}
              py={4}
              bg={sidebarHeaderBg}
              borderBottomWidth="1px"
              borderColor={sidebarHeaderBorder}
              backdropFilter="saturate(140%) blur(6px)"
            >
              <Text fontSize="2xl" fontWeight="bold">
                Messages
              </Text>
              <Box mt={3}>
                <NewChatButton setChat={setChat} dataConversation={dataConversation} />
              </Box>
            </Box>

            {/* Scrollable list area */}
            <Box
              flex="1"
              px={{ base: 3, md: 6 }}
              py={4}
              overflowY="auto"
              sx={{
                "::-webkit-scrollbar": { width: "10px" },
                "::-webkit-scrollbar-thumb": {
                  background: scrollbarThumb,
                  borderRadius: "10px",
                },
                "::-webkit-scrollbar-track": {
                  background: scrollbarTrack,
                },
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
            flex="1"
            minW={0}
            bg={panelBg}
            borderWidth="1px"
            borderColor={panelBorder}
            borderRadius="2xl"
            boxShadow="0 10px 30px rgba(0,0,0,0.10)"
            backdropFilter="saturate(140%) blur(6px)"
            transition="box-shadow 200ms ease, transform 120ms ease"
            _hover={{ boxShadow: "0 16px 40px rgba(0,0,0,0.14)" }}
            maxH="calc(100vh - 120px)"
            overflow="hidden"
          >
            <ChatWindows chat={chat} isOpen={!!chat} />
          </Box>
        </Flex>

        {/* Drag preview */}
        <DragOverlay
          dropAnimation={{
            duration: 180,
            easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
          }}
        >
          {activeConv ? <DragPreviewChatRow conv={activeConv} /> : null}
        </DragOverlay>
      </DndContext>
    </Box>
  );
}

/* ---------- Visual clone shown in the DragOverlay ---------- */
function DragPreviewChatRow({ conv }: { conv: ConversationChat }) {
  const name =
    conv.owner?.unknown ? undefined : conv.owner?.name || conv.lastMessage?.author || "No name";
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
