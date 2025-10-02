// Components/Chat/CustomChat.tsx
import {
  Box,
  Flex,
  Text,
  useColorModeValue,
  HStack,
  Avatar,
  ButtonGroup,
  Button,
  Spinner,
} from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";

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
import { useAssignCategoryToConversation } from "@/Hooks/Query/useChatCategorization";
import { useMarkConversationRead } from "@/Hooks/Query/useMarkConversationRead";
import { useConversationsInfinite, type ConversationsPage } from "@/Hooks/Query/useConversationsInfinite";
import type { ConversationChat } from "@/types";
import { FaUserAlt } from "react-icons/fa";
import ChatCategorizationPanel from "@/Components/Chat/CustomMessages/ChatCategorizationPanel";
import AddPatientButton from "@/Components/DraggableCards/AddPatientButton";

/* -------- helpers -------- */
type Mode = "active" | "only" | "all";
type ConvInfinite = InfiniteData<ConversationsPage>;

function optimisticClearUnreadPages(
  qc: QueryClient,
  mode: Mode,
  pageSize: number,
  conversationId: string
) {
  qc.setQueryData<ConvInfinite>(
    ["conversations-infinite", mode, pageSize],
    (prev: ConvInfinite | undefined) => {
      if (!prev) return prev;
      return {
        pageParams: prev.pageParams,
        pages: prev.pages.map((p) => ({
          ...p,
          items: p.items.map((c) =>
            c.conversationId === conversationId ? { ...c, unreadCount: 0 } : c
          ),
        })),
      };
    }
  );
}

export default function CustomChat() {
  const [chat, setChat] = useState<ConversationChat | undefined>(undefined);
  const [view, setView] = useState<"active" | "only">("active"); // list to display
  const PAGE_SIZE = 10;

  const chatIdRef = useRef<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const { user } = useAuth0();
  const org_id = (user as any)?.org_id?.toLowerCase?.() ?? "";
  const queryClient = useQueryClient();

  // Local override while /read is in-flight (or when inbound arrives and the chat is open)
  const [readOverrides, setReadOverrides] = useState<Set<string>>(new Set());

  // Infinite conversations
  const {
    data,
    isPending,             // TanStack v5
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useConversationsInfinite(view, PAGE_SIZE);

  // Flatten items
  const dataConversation: ConversationChat[] = useMemo(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data]
  );

  // Keep selected chat fresh if the list updates
  useEffect(() => {
    if (!chat?.conversationId || !dataConversation) return;
    const fresh = dataConversation.find((c) => c.conversationId === chat.conversationId);
    if (fresh && fresh !== chat) setChat(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataConversation, chat?.conversationId]);

  useEffect(() => {
    chatIdRef.current = chat?.conversationId ?? null;
  }, [chat?.conversationId]);

  const markRead = useMarkConversationRead();

  // IntersectionObserver sentinel for infinite scroll
  useEffect(() => {
    if (!sentinelRef.current) return;
    const el = sentinelRef.current;
    const obs = new IntersectionObserver(
      (entries: IntersectionObserverEntry[]) => {
        const first = entries[0];
        if (first.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { root: null, rootMargin: "120px", threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Socket live updates (invalidate only current list)
  useChatSocket(
    org_id,
    // onNewMessage
    async (msg) => {
      window.dispatchEvent(new CustomEvent("chat:message", { detail: msg }));

      const openId = chatIdRef.current;
      const isVisible = document.visibilityState === "visible";
      const isOpenAndInbound = openId === msg.conversationId && msg.direction === "inbound";

      if (isOpenAndInbound && isVisible) {
        // Prevent a refetch from reintroducing the old unread value while marking as read
        await queryClient.cancelQueries({ queryKey: ["conversations-infinite", view, PAGE_SIZE] });

        // Force UI without badge (override + optimistic)
        setReadOverrides((prev) => new Set(prev).add(msg.conversationId));
        optimisticClearUnreadPages(queryClient, view, PAGE_SIZE, msg.conversationId);

        try {
          await markRead.mutateAsync(msg.conversationId);
        } finally {
          setReadOverrides((prev) => {
            const next = new Set(prev);
            next.delete(msg.conversationId);
            return next;
          });
          queryClient.invalidateQueries({ queryKey: ["conversations-infinite"] });
        }
      } else {
        queryClient.invalidateQueries({ queryKey: ["conversations-infinite"] });
      }
    },
    // onMessageUpdated
    () => {
      queryClient.invalidateQueries({ queryKey: ["conversations-infinite"] });
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
        } catch {
          // upstream handles errors
        }
      }
    },
    [assign, queryClient]
  );

  /* ---------- styling tokens ---------- */
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

  // Open chat and mark as read with local override + cancelQueries
  const handleOpenChat = useCallback(
    async (c: ConversationChat) => {
      setChat(c);

      await queryClient.cancelQueries({ queryKey: ["conversations-infinite", view, PAGE_SIZE] });

      setReadOverrides((prev) => new Set(prev).add(c.conversationId));
      optimisticClearUnreadPages(queryClient, view, PAGE_SIZE, c.conversationId);

      try {
        await markRead.mutateAsync(c.conversationId);
      } finally {
        setReadOverrides((prev) => {
          const next = new Set(prev);
          next.delete(c.conversationId);
          return next;
        });
        queryClient.invalidateQueries({ queryKey: ["conversations-infinite"] });
      }
    },
    [markRead, queryClient, view]
  );

  // When the tab becomes visible, reinforce read state
  useEffect(() => {
    const onVis = async () => {
      const openId = chatIdRef.current;
      if (!openId) return;
      await queryClient.cancelQueries({ queryKey: ["conversations-infinite", view, PAGE_SIZE] });
      setReadOverrides((prev) => new Set(prev).add(openId));
      optimisticClearUnreadPages(queryClient, view, PAGE_SIZE, openId);
      try {
        await markRead.mutateAsync(openId);
      } finally {
        setReadOverrides((prev) => {
          const next = new Set(prev);
          next.delete(openId);
          return next;
        });
        queryClient.invalidateQueries({ queryKey: ["conversations-infinite"] });
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [markRead, queryClient, view]);

  return (
    <Box h="90dvh" minH="90dvh" w="100%" position="relative" overflow="hidden">
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
          direction={{ base: "column", xl: "row" }}
          gap={{ base: 3, md: 4 }}
          px={{ base: 2, md: 4 }}
          py={{ base: 2, md: 4 }}
          mx="auto"
        >
          {/* Categories panel */}
          <Box
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
            <Box
              h="100%"
              overflowY="auto"
              pr={1}
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
              bg={useColorModeValue("rgba(255,255,255,0.76)", "rgba(26,32,44,0.6)")}
              borderBottomWidth="1px"
              borderColor={useColorModeValue("blackAlpha.200", "whiteAlpha.200")}
              backdropFilter="saturate(140%) blur(6px)"
            >
              <HStack justify="space-between" align="center">
                <Text fontSize={{ base: "xl", md: "2xl" }} fontWeight="bold">
                  Messages
                </Text>
                <ButtonGroup size="sm" isAttached variant="outline">
                  <Button onClick={() => setView("active")} isActive={view === "active"}>
                    Active
                  </Button>
                  <Button onClick={() => setView("only")} isActive={view === "only"}>
                    Archived
                  </Button>
                </ButtonGroup>
              </HStack>

              <HStack spacing={3} mt={3} wrap="wrap">
                <NewChatButton setChat={setChat} dataConversation={dataConversation} />
                <AddPatientButton
                  onlyPatient
                  text="New Contact"
                  label="Add Contact"
                  tooltip={false}
                  formProps={{ typeButonVisible: false, phoneFieldReadOnly: false, mode: "CREATION" }}
                />
              </HStack>
            </Box>

            {/* Scrollable list */}
            <Box
              h="calc(100% - 112px)"
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
                  setChat={handleOpenChat}
                  dataConversation={dataConversation}
                  isLoadingConversation={isPending}
                  readOverrides={readOverrides}
                  archivedMode={view}
                />
              </SortableContext>

              {/* Infinite scroll sentinel */}
              <Box ref={sentinelRef} mt={2} mb={4} textAlign="center">
                {isFetchingNextPage ? (
                  <Spinner size="sm" />
                ) : hasNextPage ? (
                  <Text fontSize="sm" color="gray.500">
                    Load more…
                  </Text>
                ) : (
                  <Text fontSize="sm" color="gray.400">
                    No more chats
                  </Text>
                )}
              </Box>
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

/* ---------- Visual clone used in DragOverlay ---------- */
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
