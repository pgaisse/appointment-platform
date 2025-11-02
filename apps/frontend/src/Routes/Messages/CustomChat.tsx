// Components/Chat/CustomChat.tsx
import {
  Box,
  Flex,
  Text,
  useColorModeValue,
  HStack,
  Avatar,
  Spinner,
  IconButton,
  Tooltip,
  Icon,
  InputGroup,
  InputLeftElement,
  Input,
  CloseButton,
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
import { useGetCollection } from "@/Hooks/Query/useGetCollection";
import { useCustomChat } from "@/Hooks/Query/useCustomChat";
import { formatToE164 } from "@/Functions/formatToE164";
import { useMarkConversationRead } from "@/Hooks/Query/useMarkConversationRead";
import { useConversationsInfinite, type ConversationsPage } from "@/Hooks/Query/useConversationsInfinite";
import type { ConversationChat } from "@/types";
import { FaUserAlt } from "react-icons/fa";
import { FiChevronLeft, FiChevronRight, FiInbox, FiArchive, FiSearch } from "react-icons/fi";
import ChatCategorizationPanel from "@/Components/Chat/CustomMessages/ChatCategorizationPanel";
import AddPatientButton from "@/Components/DraggableCards/AddPatientButton";
import ContactDetailsPanel from "@/Components/Chat/ContactDetailsPanel";
import { MESSAGES_OPEN_EVENT, type OpenMessagesPayload } from "@/Lib/messagesBus";

/* --------------------------------- helpers --------------------------------- */
type Mode = "active" | "only" | "all";
type ConvInfinite = InfiniteData<ConversationsPage>;

type ContactDoc = {
  _id: string;
  nameInput: string;
  lastNameInput: string;
  phoneInput: string;
  sid: string;
  color?: string;
};

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

function removeFromCache(
  data: ConvInfinite | undefined,
  conversationId: string
): ConvInfinite | undefined {
  if (!data) return data;
  return {
    pageParams: data.pageParams,
    pages: data.pages.map((p) => ({
      ...p,
      items: p.items.filter((c) => c.conversationId !== conversationId),
    })),
  };
}

function insertAtTopWithLastMessage(
  data: ConvInfinite | undefined,
  updated: ConversationChat
): ConvInfinite | undefined {
  if (!data) return data;
  // Evitar duplicados si ya estuviera en alguna página
  const cleaned = removeFromCache(data, updated.conversationId)!;
  const first = cleaned.pages[0];
  const newFirst = { ...first, items: [updated, ...first.items] };
  return {
    pageParams: cleaned.pageParams,
    pages: [newFirst, ...cleaned.pages.slice(1)],
  };
}

// removed unused flipArchivedInCache helper

function findConversationInAnyCache(
  caches: Array<[unknown, ConvInfinite | undefined]>,
  conversationId: string
): ConversationChat | undefined {
  for (const [, data] of caches) {
    if (!data) continue;
    for (const page of data.pages) {
      const hit = page.items.find((c) => c.conversationId === conversationId);
      if (hit) return hit;
    }
  }
  return undefined;
}

/**
 * ✅ Arreglo clave:
 * Cuando entra un inbound en una conversación archivada, la movemos de "only" a "active"
 * y actualizamos su lastMessage para que el preview y el orden sean correctos inmediatamente.
 */
function optimisticUpsertInboundAndMoveActive(opts: {
  qc: QueryClient;
  pageSize: number;
  socketMsg: {
    conversationId: string;
    body?: string | null;
    media?: Array<{ url: string; type: string; size?: number }>;
    direction: "inbound" | "outbound";
    author: string;
    createdAt: string | Date;
    sid?: string;
    proxyAddress?: string;
    status?: string;
  };
}) {
  const { qc, pageSize, socketMsg } = opts;
  const id = socketMsg.conversationId;

  // Snapshot de todos los caches de conversations-infinite (cualquier modo/pageSize)
  const snapshot = qc.getQueriesData<ConvInfinite>({
    queryKey: ["conversations-infinite"],
  });

  // Localiza un objeto base para conservar owner, etc.
  const base = findConversationInAnyCache(snapshot, id);

  // Construye un lastMessage consistente con tu esquema
  const lastMessage: ConversationChat["lastMessage"] = {
    sid: socketMsg.sid ?? "SOCKET-SYNTH-" + Date.now(),
    conversationId: id,
    body: socketMsg.body ?? "",
    media: socketMsg.media ?? [],
    status: socketMsg.status ?? "delivered",
    direction: socketMsg.direction,
    author: socketMsg.author,
    proxyAddress: socketMsg.proxyAddress ?? "",
    createdAt: new Date(socketMsg.createdAt as any).toISOString(),
    updatedAt: new Date(socketMsg.createdAt as any).toISOString(),
  };

  // Objeto de conversación actualizado
  const updated: ConversationChat = {
    conversationId: id,
    lastMessage,
    owner: base?.owner ?? {
      _id: undefined as any,
      name: base?.lastMessage?.author ?? "No name",
      lastName: "",
      phone: "",
      email: "",
      org_id: "",
      unknown: true,
    },
    unreadCount: (base?.unreadCount ?? 0), // el contador real lo ajustas fuera si hace falta
    archived: false,
  } as ConversationChat;

  // 1) Quitar de "only" (archived)
  qc.setQueryData<ConvInfinite>(
    ["conversations-infinite", "only", pageSize],
    (prev) => removeFromCache(prev, id)
  );

  // 2) Insertar arriba en "active" con lastMessage actualizado
  qc.setQueryData<ConvInfinite>(
    ["conversations-infinite", "active", pageSize],
    (prev) => insertAtTopWithLastMessage(prev, updated)
  );

  // 3) En "all", solo voltear archived y refrescar último mensaje
  qc.setQueryData<ConvInfinite>(
    ["conversations-infinite", "all", pageSize],
    (prev) => {
      if (!prev) return prev;
      return {
        pageParams: prev.pageParams,
        pages: prev.pages.map((p) => ({
          ...p,
          items: p.items.map((c) =>
            c.conversationId === id
              ? { ...c, archived: false, lastMessage }
              : c
          ),
        })),
      };
    }
  );
}

export default function CustomChat() {
  const [chat, setChat] = useState<ConversationChat | undefined>(undefined);
  const [view, setView] = useState<"active" | "only">("active");
  const [catsOpen, setCatsOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [noMatchPhone, setNoMatchPhone] = useState<string | null>(null);
  const PAGE_SIZE = 50; // fetch larger pages to avoid long-running incremental loads

  const chatIdRef = useRef<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const autoSelectedRef = useRef<boolean>(false);
  const [eventOpen, setEventOpen] = useState<OpenMessagesPayload | null>(null);
  const creatingChatRef = useRef<boolean>(false);

  const { user } = useAuth0();
  const org_id = (user as any)?.org_id?.toLowerCase?.() ?? "";
  const queryClient = useQueryClient();
  const { socket } = useCustomChat();

  // Get conversationId and phone from URL query params OR event bus
  const urlParams = new URLSearchParams(window.location.search);
  const conversationIdFromUrl = urlParams.get("conversationId");
  const phoneFromUrl = urlParams.get("phone");

  // Listen for programmatic open events
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<OpenMessagesPayload>;
      setEventOpen(ce.detail ?? null);
    };
    window.addEventListener(MESSAGES_OPEN_EVENT, handler as EventListener);
    return () => window.removeEventListener(MESSAGES_OPEN_EVENT, handler as EventListener);
  }, []);

  // While mark-read is in flight, force unread=0 locally
  const [readOverrides, setReadOverrides] = useState<Set<string>>(new Set());

  // Search for contact by phone when no conversation exists
  const phoneDigits = noMatchPhone ? noMatchPhone.replace(/\D/g, "") : "";
  const contactQuery = useMemo(() => {
    if (!noMatchPhone || phoneDigits.length < 3) return { _id: { $exists: false } };
    return { phoneInput: { $regex: "^" + phoneDigits } };
  }, [noMatchPhone, phoneDigits]);

  const { data: contactResults = [] } = useGetCollection<ContactDoc>("Appointment", {
    mongoQuery: contactQuery,
    projection: { nameInput: 1, lastNameInput: 1, phoneInput: 1, sid: 1, color: 1 },
    limit: 1,
  });

  // Auto-create chat when contact is found
  useEffect(() => {
    if (!noMatchPhone || creatingChatRef.current) return;
    if (contactResults.length === 0) return;

    const contact = contactResults[0];
    creatingChatRef.current = true;

    const phone = formatToE164(contact.phoneInput || "");
    const name = `${contact.nameInput} ${contact.lastNameInput}`.trim();
    const localConversationId = `local-${phone}`;

    const now = new Date().toISOString();
    const lm = {
      clientTempId: `tmp-${Date.now()}`,
      sid: `local-${Date.now()}`,
      conversationId: localConversationId,
      author: "clinic",
      body: "",
      index: undefined,
      media: [],
      direction: "outbound" as const,
      createdAt: now,
      updatedAt: now,
      tempOrder: Date.now(),
      status: "pending" as const,
    };

    const newConv: ConversationChat = {
      conversationId: contact.sid,
      owner: {
        phone,
        name,
        _id: contact._id,
        color: contact.color,
      },
      lastMessage: lm,
      chatmessage: lm,
      archived: false, // New chats are always active, not archived
      unreadCount: 0,
    };

    console.log("[CustomChat] Auto-creating chat for:", name, phone);
    
    // Add to cache
    queryClient.setQueryData<ConversationChat[]>(["conversations"], (prev) => {
      const list = Array.isArray(prev) ? prev : [];
      const exists = list.some(
        (c) => c.owner.phone === newConv.owner.phone || c.conversationId === newConv.conversationId
      );
      if (exists) return list;
      return [newConv, ...list];
    });

    // Switch to active view for new chats
    if (view !== "active") {
      setView("active");
    }

    // Set as active chat
    setChat(newConv);
    setNoMatchPhone(null);

    // Notify server to initialize conversation
    socket?.emit("smsSend", { appId: contact._id, phone, name });

    // Reset flag after a delay
    setTimeout(() => {
      creatingChatRef.current = false;
    }, 1000);
  }, [noMatchPhone, contactResults, queryClient, socket]);

  // Infinite conversations
  const {
    data,
    isPending,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useConversationsInfinite(view, PAGE_SIZE);
  const dataConversation: ConversationChat[] = useMemo(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data]
  );

  // Subscribe lightweight meta queries (limit=1) to get accurate totals for badges
  const activeMeta = useConversationsInfinite("active", 1);
  const archivedMeta = useConversationsInfinite("only", 1);
  const activeCount = activeMeta.data?.pages?.[0]?.pagination?.total;
  const archivedCount = archivedMeta.data?.pages?.[0]?.pagination?.total;

  // Auto-select conversation from URL parameters (conversationId or phone) or event
  // Search across ALL cached views (active, only, all) to find the conversation
  useEffect(() => {
    const convId = conversationIdFromUrl || eventOpen?.conversationId || undefined;
    const phone = phoneFromUrl || eventOpen?.phone || undefined;

    // If we have a specific chat to find, mark that we're handling it
    // to prevent default selection from taking over
    if ((convId || phone) && !autoSelectedRef.current) {
      autoSelectedRef.current = true; // Mark immediately to block default selection
    }

    if (autoSelectedRef.current && !eventOpen && !convId && !phone) return;

    if (!convId && !phone) return;

    // Helper: normalize phone (digits only)
    const norm = (v?: string | null) => (v ? v.replace(/\D+/g, "") : "");

    // Search in ALL query caches (active, only, all) to find the conversation
    const allCaches = queryClient.getQueriesData<ConvInfinite>({
      queryKey: ["conversations-infinite"],
    });

    let found: ConversationChat | undefined;

    // Try to find by conversationId first
    if (convId) {
      for (const [, data] of allCaches) {
        if (!data?.pages) continue;
        for (const page of data.pages) {
          found = page.items.find((c) => c.conversationId === convId);
          if (found) break;
        }
        if (found) break;
      }
    }

    // If not found by ID, try by phone
    if (!found && phone) {
      const p = norm(phone);
      for (const [, data] of allCaches) {
        if (!data?.pages) continue;
        for (const page of data.pages) {
          found = page.items.find((c) => {
            const ownerPhone = norm(c.owner?.phone ?? "");
            const author = norm(c.lastMessage?.author ?? "");
            return ownerPhone === p || author === p || ownerPhone.endsWith(p) || author.endsWith(p);
          });
          if (found) break;
        }
        if (found) break;
      }
    }

    if (found) {
      // Found in cache - select it and switch to correct view
      console.log("[CustomChat] Found conversation:", found.conversationId, "archived:", found.archived);
      
      // Switch to the correct view based on archived status BEFORE setting chat
      // Default to "active" if archived status is undefined
      const isArchived = found.archived === true;
      const targetView = isArchived ? "only" : "active";
      
      if (view !== targetView) {
        console.log("[CustomChat] Switching view from", view, "to", targetView);
        setView(targetView);
      }
      
      setChat(found);

      if (conversationIdFromUrl || phoneFromUrl) {
        window.history.replaceState({}, '', '/messages');
      }
      setEventOpen(null);
      setNoMatchPhone(null);
      return;
    }

    // Not found in any cache - try to load the missing view
    if (convId && view === "active") {
      // Maybe it's in archived, switch view to try loading it
      setView("only");
      return;
    }

    if (phone && view === "active") {
      // Maybe it's in archived, switch view to try loading it
      setView("only");
      return;
    }

    // Still not found after checking all views - show "no chat" state
    if (phone) {
      console.log("[CustomChat] No conversation found for phone:", phone);
      console.log("[CustomChat] Will open New Chat modal with this phone");
      setNoMatchPhone(phone);
      setChat(undefined); // Clear any previous chat selection
    } else if (convId) {
      console.log("[CustomChat] No conversation found for ID:", convId);
    }
    
    if (conversationIdFromUrl || phoneFromUrl) {
      window.history.replaceState({}, '', '/messages');
    }
    setEventOpen(null);
  }, [conversationIdFromUrl, phoneFromUrl, eventOpen, queryClient, view]);

  // Default selection: pick the most recent conversation shown in MessageList
  // If there's no chat selected and no URL param handled, select the first item
  useEffect(() => {
    if (autoSelectedRef.current) return; // URL-based selection already applied or in progress
    if (noMatchPhone) return; // Don't auto-select if we're showing "no chat" state
    if (!chat && dataConversation.length > 0) {
      setChat(dataConversation[0]);
      // Mark so we don't re-select on further list changes
      autoSelectedRef.current = true;
    }
  }, [chat, dataConversation, noMatchPhone]);

  // keep selected chat fresh
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

  // IntersectionObserver for infinite
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

  // SOCKET: keep conversations + thread updated
  useChatSocket(
    org_id,
    // onNewMessage
    async (msg) => {
      window.dispatchEvent(new CustomEvent("chat:message", { detail: msg }));

      const openId = chatIdRef.current;
      const isVisible = document.visibilityState === "visible";
      const isOpenAndInbound = openId === msg.conversationId && msg.direction === "inbound";

      // ✅ Failsafe + optimista: si llega inbound en archivado, muévelo a "active" y
      // actualiza el preview (lastMessage) al instante.
      if (msg.direction === "inbound") {
        optimisticUpsertInboundAndMoveActive({
          qc: queryClient,
          pageSize: PAGE_SIZE,
          socketMsg: msg,
        });
      }

      // ✅ SIEMPRE: refrescar el thread del chat correspondiente (arregla tu “dev no actualiza ChatWindows”)
      queryClient.invalidateQueries({ queryKey: ["messages", msg.conversationId] });

      if (isOpenAndInbound && isVisible) {
        // Evitar que el refetch reintroduzca contador mientras marcamos leído
        await queryClient.cancelQueries({ queryKey: ["conversations-infinite", view, PAGE_SIZE] });

        // Forzar UI sin badge (override + optimista)
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
          // Conversaciones (todas las vistas)
          queryClient.invalidateQueries({ queryKey: ["conversations-infinite"] });
          // Thread otra vez por si el mark-read aplica transformaciones de server
          queryClient.invalidateQueries({ queryKey: ["messages", msg.conversationId] });
        }
      } else {
        // No está abierto: refrescar listas (y el thread si hay UI en background)
        queryClient.invalidateQueries({ queryKey: ["conversations-infinite"] });
        // (opcional) si tienes contadores/badges en la cabecera del thread, puedes invalidar aquí también
      }
    },
    // onMessageUpdated (statuses, edits, etc.)
    (msg) => {
      // Asegura que el preview y el hilo se mantengan frescos
      queryClient.invalidateQueries({ queryKey: ["conversations-infinite"] });
      queryClient.invalidateQueries({ queryKey: ["messages", msg.conversationId] });
    }
  );

  /* ------------------------------- DND + styling ------------------------------ */
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
          // swallow
        }
      }
    },
    [assign, queryClient]
  );

  /* ------------------------------ style tokens ------------------------------ */
  const pageBg = useColorModeValue(
    "linear-gradient(180deg, rgba(246,248,255,0.85) 0%, rgba(241,243,255,0.75) 100%)",
    "linear-gradient(180deg, rgba(23,25,35,0.85) 0%, rgba(18,20,28,0.85) 100%)"
  );
  const panelBg = useColorModeValue("rgba(255,255,255,0.85)", "rgba(26,32,44,0.65)");
  const panelBorder = useColorModeValue("blackAlpha.200", "whiteAlpha.200");
  // removed unused sidebar header tokens (inlined where used)
  const scrollbarThumb = useColorModeValue("#CBD5E0", "#4A5568");
  const scrollbarTrack = useColorModeValue("#EDF2F7", "#2D3748");
  const badgeBorder = useColorModeValue("white", "gray.800");

  // Overlay bubble position: sits over categories+conversations boundary
  const bubbleLeft = useMemo(() => {
    return {
      base: "8px",
      xl: catsOpen ? "calc(15% + 8px)" : "8px",
    } as const;
  }, [catsOpen]);

  // Right-side bubble position: sits over chat+details boundary
  const bubbleRight = useMemo(() => {
    return {
      base: "8px",
      xl: detailsOpen ? "calc(22% + 8px)" : "8px",
    } as const;
  }, [detailsOpen]);

  // Abrir chat y marcar leído con override local + cancelQueries
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
        queryClient.invalidateQueries({ queryKey: ["messages", c.conversationId] });
      }
    },
    [markRead, queryClient, view]
  );

  // Reinforce read when tab becomes visible
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
        queryClient.invalidateQueries({ queryKey: ["messages", openId] });
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
          {/* Categories panel (collapsible, default collapsed) */}
          {catsOpen && (
            <Box
              flex={{ base: "1 1 0", xl: "0 0 15%" }}
              w={{ base: "100%", xl: "15%" }}
              maxW={{ xl: "420px" }}
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
              transition="all 0.25s ease"
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
          )}

          {/* Floating bubble toggle overlay (above categories and conversations) */}
          <Box
            position="absolute"
            top="50%"
            left={bubbleLeft}
            transform="translateY(-50%)"
            zIndex={500}
          >
            <Tooltip
              label={catsOpen ? "Hide categories" : "Show categories"}
              placement="right"
              openDelay={150}
              hasArrow
            >
              <IconButton
                aria-label={catsOpen ? "Hide categories" : "Show categories"}
                onClick={() => setCatsOpen((v) => !v)}
                rounded="full"
                h={{ base: "40px", md: "44px" }}
                w={{ base: "40px", md: "44px" }}
                p={0}
                variant="solid"
                bg={useColorModeValue("rgba(255,255,255,0.9)", "rgba(26,32,44,0.75)" )}
                borderWidth="1px"
                borderColor={panelBorder}
                boxShadow="0 10px 30px rgba(0,0,0,0.18)"
                backdropFilter="saturate(150%) blur(8px)"
                sx={{ WebkitBackdropFilter: "saturate(150%) blur(8px)" }}
                _hover={{
                  transform: "translateY(-1px)",
                  boxShadow: "0 14px 36px rgba(0,0,0,0.22)",
                  bg: useColorModeValue("rgba(255,255,255,0.98)", "rgba(26,32,44,0.85)"),
                }}
                _active={{ transform: "translateY(0) scale(0.98)" }}
                icon={
                  catsOpen ? (
                    <Icon as={FiChevronLeft} boxSize={5} color={useColorModeValue("gray.700", "gray.200")} />
                  ) : (
                    <Icon as={FiChevronRight} boxSize={5} color={useColorModeValue("gray.700", "gray.200")} />
                  )
                }
              />
            </Tooltip>
          </Box>

          {/* Floating bubble toggle overlay (right side for details panel) */}
          <Box
            position="absolute"
            top="50%"
            right={bubbleRight}
            transform="translateY(-50%)"
            zIndex={500}
          >
            <Tooltip
              label={detailsOpen ? "Hide details" : "Show details"}
              placement="left"
              openDelay={150}
              hasArrow
            >
              <IconButton
                aria-label={detailsOpen ? "Hide details" : "Show details"}
                onClick={() => setDetailsOpen((v) => !v)}
                rounded="full"
                h={{ base: "40px", md: "44px" }}
                w={{ base: "40px", md: "44px" }}
                p={0}
                variant="solid"
                bg={useColorModeValue("rgba(255,255,255,0.9)", "rgba(26,32,44,0.75)" )}
                borderWidth="1px"
                borderColor={panelBorder}
                boxShadow="0 10px 30px rgba(0,0,0,0.18)"
                backdropFilter="saturate(150%) blur(8px)"
                sx={{ WebkitBackdropFilter: "saturate(150%) blur(8px)" }}
                _hover={{
                  transform: "translateY(-1px)",
                  boxShadow: "0 14px 36px rgba(0,0,0,0.22)",
                  bg: useColorModeValue("rgba(255,255,255,0.98)", "rgba(26,32,44,0.85)"),
                }}
                _active={{ transform: "translateY(0) scale(0.98)" }}
                icon={
                  detailsOpen ? (
                    <Icon as={FiChevronRight} boxSize={5} color={useColorModeValue("gray.700", "gray.200")} />
                  ) : (
                    <Icon as={FiChevronLeft} boxSize={5} color={useColorModeValue("gray.700", "gray.200")} />
                  )
                }
              />
            </Tooltip>
          </Box>

          

          {/* Sidebar: conversations list */}
          <Box
            flex={{ base: "1 1 0", xl: "0 0 20%" }}
            w={{ base: "100%", xl: "20%" }}
            minH={0}
            maxH={{ base: "100%", xl: "calc(100dvh - 2rem - env(safe-area-inset-bottom))" }}
            position="relative"
            bg={panelBg}
            borderWidth="1px"
            borderColor={panelBorder}
            borderRadius="2xl"
            boxShadow="0 10px 30px rgba(0,0,0,0.10)"
            backdropFilter="saturate(140%) blur(6px)"
            overflow="hidden"
            display="flex"
            flexDirection="column"
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
                <HStack spacing={2}>
                  <Tooltip label="Main" placement="bottom" openDelay={150} hasArrow>
                    <Box position="relative">
                      <IconButton
                        aria-label="Main"
                        icon={<FiInbox />}
                        size={{ base: "sm", md: "sm" }}
                        variant={view === "active" ? "solid" : "ghost"}
                        colorScheme={view === "active" ? "blue" : "gray"}
                        onClick={() => setView("active")}
                      />
                      {typeof activeCount === "number" && activeCount > 0 && (
                        <Box
                          position="absolute"
                          top="-6px"
                          right="-6px"
                          minW="18px"
                          h="18px"
                          px="1.5px"
                          bg="blue.500"
                          color="white"
                          borderRadius="full"
                          fontSize="xs"
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                          borderWidth="2px"
                          borderColor={badgeBorder}
                        >
                          {activeCount > 99 ? "99+" : activeCount}
                        </Box>
                      )}
                    </Box>
                  </Tooltip>
                  <Tooltip label="Archived" placement="bottom" openDelay={150} hasArrow>
                    <Box position="relative">
                      <IconButton
                        aria-label="Archived"
                        icon={<FiArchive />}
                        size={{ base: "sm", md: "sm" }}
                        variant={view === "only" ? "solid" : "ghost"}
                        colorScheme={view === "only" ? "blue" : "gray"}
                        onClick={() => setView("only")}
                      />
                      {typeof archivedCount === "number" && archivedCount > 0 && (
                        <Box
                          position="absolute"
                          top="-6px"
                          right="-6px"
                          minW="18px"
                          h="18px"
                          px="1.5px"
                          bg="gray.600"
                          color="white"
                          borderRadius="full"
                          fontSize="xs"
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                          borderWidth="2px"
                          borderColor={badgeBorder}
                        >
                          {archivedCount > 99 ? "99+" : archivedCount}
                        </Box>
                      )}
                    </Box>
                  </Tooltip>
                </HStack>
              </HStack>

              <HStack spacing={2} mt={3} wrap="wrap">
                <NewChatButton
                  setChat={setChat}
                  dataConversation={dataConversation}
                  iconOnly
                  tooltipLabel="New chat"
                  size="sm"
                  variant="ghost"
                />
                <AddPatientButton
                  onlyPatient
                  iconOnly
                  label="New contact"
                  tooltip
                  iconSize="sm"
                  formProps={{ typeButonVisible: false, phoneFieldReadOnly: false, mode: "CREATION" }}
                />
              </HStack>

              {/* Header search (always visible) */}
              <Box mt={3}>
                <InputGroup size="sm">
                  <InputLeftElement pointerEvents="none">
                    <FiSearch />
                  </InputLeftElement>
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search chats (name, phone, email, message, ID)…"
                    variant="filled"
                    borderRadius="xl"
                  />
                  {searchTerm && (
                    <CloseButton
                      aria-label="Clear"
                      onClick={() => setSearchTerm("")}
                      position="absolute"
                      right="8px"
                      top="50%"
                      transform="translateY(-50%)"
                    />
                  )}
                </InputGroup>
              </Box>
            </Box>

            {/* Scrollable list */}
            <Box
              flex="1"
              minH={0}
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
                  searchTerm={searchTerm}
                  showSearch={false}
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
            w={{ base: "100%", xl: "auto" }}
            minW={{ base: 0, xl: "520px" }}
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

          {/* Contact details panel (collapsible, default open) */}
          {detailsOpen && (
            <Box
              flex={{ base: "1 1 0", xl: "0 0 22%" }}
              w={{ base: "100%", xl: "22%" }}
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
              <ContactDetailsPanel conversation={chat ?? null} />
            </Box>
          )}
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
        name={name?.[0] || name}
        src={conv.owner?.avatar}
        icon={conv.owner?.unknown ? <FaUserAlt fontSize="1.5rem" /> : undefined}
        pointerEvents="none"
        {...(() => {
          const color = conv.owner?.color;
          if (!color) return { bg: "gray.500", color: "white" };
          if (!color.startsWith('#') && !color.includes('.')) {
            return { bg: `${color}.500`, color: "white" };
          }
          if (color.includes(".")) {
            const [base] = color.split(".");
            return { bg: `${base}.500`, color: "white" };
          }
          const hex = color.replace("#", "");
          const int = parseInt(hex.length === 3 ? hex.split("").map((c: string) => c+c).join("") : hex, 16);
          const r = (int >> 16) & 255, g = (int >> 8) & 255, b = int & 255;
          const yiq = (r * 299 + g * 587 + b * 114) / 1000;
          const text = yiq >= 128 ? "black" : "white";
          return { bg: color, color: text };
        })()}
        boxShadow="0 1px 4px rgba(0,0,0,0.1)"
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
