// ChatWindows.tsx
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Flex, HStack, Box, Divider, VStack, Tooltip, IconButton, Text,
  useColorModeValue, useToast, Spinner,
  Textarea, Avatar, Icon, useDisclosure,
} from "@chakra-ui/react";
import { PhoneIcon } from "@chakra-ui/icons";
import { RiParentFill } from "react-icons/ri";
import { FiSend } from "react-icons/fi";
import { MdAccessTime, MdOutlinePostAdd, MdKeyboardArrowDown } from "react-icons/md";
import { TiTick } from "react-icons/ti";

import ShowTemplateButton from "./CustomMessages/ShowTemplateButton";
import CreateMessageModal from "./CustomMessages/CreateCustomMessageModal";
import { FileUploadButton } from "./FileUploadButton";
import PreviewBar from "./PreviewBar";
import { ImageFromDrive } from "./ImageFromDrive";
import EmojiPickerButton from "./CustomMessages/EmojiPickerButton";

import { useQueryClient } from "@tanstack/react-query";
import { useSendChatMessage } from "@/Hooks/Query/useSendChatMessage";
import { useOptimisticMessages } from "@/Hooks/Query/useOptimisticMessages";
import { formatToE164 } from "@/Functions/formatToE164";
import { formatAusPhoneNumber } from "@/Functions/formatAusPhoneNumber";
import { ConversationChat, Message } from "@/types";
import { useInfiniteMessages } from "@/Hooks/Query/UseInfiniteQuery";
const AppointmentModalLazy = React.lazy(() => import("@/Components/Modal/AppointmentModal"));

/* ---------- Helpers for day separators ---------- */
const isSameLocalDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

function formatDayLabel(d: Date, now = new Date(), locale = navigator?.language || "en-US") {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((todayStart.getTime() - dateStart.getTime()) / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7) {
    return new Intl.DateTimeFormat(locale, { weekday: "long" }).format(d);
  }
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" }).format(d);
}

/** A centered day chip with horizontal lines (WhatsApp-like) */
const DayDivider = memo(function DayDivider({ date }: { date: Date }) {
  const label = formatDayLabel(date);
  const line = useColorModeValue("blackAlpha.300", "whiteAlpha.300");
  const pillBg = useColorModeValue("white", "gray.700");
  const pillBorder = useColorModeValue("blackAlpha.200", "whiteAlpha.200");
  const pillText = useColorModeValue("gray.700", "gray.100");

  return (
    <HStack w="100%" my={2} spacing={3} align="center">
      <Box flex="1" h="1px" bg={line} />
      <Box
        px={3}
        py={1}
        borderRadius="full"
        bg={pillBg}
        borderWidth="1px"
        borderColor={pillBorder}
        color={pillText}
        fontSize="xs"
        fontWeight="medium"
        shadow="sm"
      >
        {label}
      </Box>
      <Box flex="1" h="1px" bg={line} />
    </HStack>
  );
});

type Props = {
  chat: ConversationChat | undefined;
  isOpen: boolean;
  onConversationRepaired?: (newSid: string, prevSid: string) => void;
};

export default function ChatWindows({ chat, onConversationRepaired }: Props) {
  if (!chat) return null;
  return <ChatWindowsInner chat={chat} onConversationRepaired={onConversationRepaired} />;
}

function ChatWindowsInner({ chat, onConversationRepaired }: { chat: ConversationChat; onConversationRepaired?: (newSid: string, prevSid: string) => void; }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const sendChat = useSendChatMessage();
  // Tutor modal controls
  const { isOpen: isTutorOpen, onOpen: onTutorOpen, onClose: onTutorClose } = useDisclosure();
  const [tutorId, setTutorId] = useState<string | null>(null);

  // === INFINITE ===
  const {
    data,
    fetchNextPage,          // usaremos "next" para cargar páginas más antiguas al llegar arriba
    hasNextPage,
    isFetchingNextPage,
    isRefetching,
  } = useInfiniteMessages(chat.conversationId, 10);

  // Unimos todas las páginas en orden cronológico ASCENDENTE global
  const baseMessages = useMemo<Message[]>(() => {
    if (!data?.pages?.length) return [];
    // page 1 trae más recientes; invertimos páginas para que primero queden las más antiguas
    const pagesOldToNew = [...data.pages].reverse();
    const merged = pagesOldToNew.flatMap(p => p.messages);
    return merged;
  }, [data]);

  // Optimistas encima de baseMessages
  const { messages, addOptimistic, removeOptimistic, updateOptimistic, clearOptimistic } =
    useOptimisticMessages(baseMessages);

  const onSend = useCallback(
    ({ text, files }: { text: string; files: File[] }) => {
      const appId = chat.owner._id;
      const hasText = !!text.trim();
      const hasFiles = files.length > 0;
      if (!appId || (!hasText && !hasFiles)) {
        if (!appId) {
          toast({
            title: "Cannot send",
            description: "Missing patient appId.",
            status: "error",
            position: "bottom-right",
          });
        }
        return;
      }

      const tempSid = `temp-${Date.now()}`;
      const optimistic: Message = {
        sid: tempSid,
        conversationId: chat.conversationId,
        author: appId,
        body: text.trim(),
        media: hasFiles
          ? files.map((f) => ({ url: URL.createObjectURL(f), type: f.type, size: f.size }))
          : [],
        direction: "outbound",
        status: "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        index: `${Date.now()}`,
      };
      addOptimistic(optimistic);
      console.log("LOG:", {
        to: formatToE164(chat.owner.phone || ""),
        appId,
        body: text.trim(),
        files,
      });
      (async () => {
        try {
          const res: any = await sendChat.mutateAsync({
            to: formatToE164(chat.owner.phone || ""),
            appId,
            body: text.trim(),
            files,
            onProgress: () => { },
          });

          const repairedSid = res?.repairedSid as string | undefined;
          const previousSid = (res?.previousSid as string | undefined) || chat.conversationId;
          const finalSid = repairedSid && repairedSid !== previousSid ? repairedSid : previousSid;

          // Reconcile optimistic entry with first real message if available
          const firstDoc = Array.isArray(res?.docs) ? res.docs[0] : null;
          const realSid = firstDoc?.sid || res?.messageSid;
          if (realSid) {
            updateOptimistic(tempSid, {
              sid: realSid,
              status: "sent",
              index: String(firstDoc?.index ?? optimistic.index),
              conversationId: firstDoc?.conversationId || finalSid,
              body: firstDoc?.body ?? optimistic.body,
              media: (firstDoc?.media as any) || optimistic.media,
              updatedAt: new Date().toISOString(),
            });
          }

          if (repairedSid && repairedSid !== previousSid) {
            // Invalidate and refetch both threads to avoid visual gaps
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ["messages", previousSid] }) as any,
              queryClient.invalidateQueries({ queryKey: ["messages", repairedSid] }) as any,
            ]);
            await Promise.all([
              queryClient.refetchQueries({ queryKey: ["messages", previousSid] }),
              queryClient.refetchQueries({ queryKey: ["messages", repairedSid] }),
            ]);
            onConversationRepaired?.(repairedSid, previousSid);
            toast({
              title: "Conversation repaired",
              description: `Updated conversation SID to ${repairedSid}`,
              status: "success",
              position: "bottom-right",
            });
          } else {
            await queryClient.invalidateQueries({ queryKey: ["messages", finalSid] }) as any;
            await queryClient.refetchQueries({ queryKey: ["messages", finalSid] });
          }

          // Remove optimistics only after real data is in cache (prevents flicker)
          clearOptimistic();
        } catch (error: any) {
          removeOptimistic(optimistic.sid);
          console.error("Error sending message:", error);
          toast({
            title: "Failed to send",
            description: error?.message || "Unexpected error",
            status: "error",
            position: "bottom-right",
          });
        }
      })();
    },
    [chat.conversationId, chat.owner._id, chat.owner.phone, addOptimistic, removeOptimistic, clearOptimistic, queryClient, sendChat, toast, onConversationRepaired]
  );

  const borderCol = useColorModeValue("blackAlpha.200", "whiteAlpha.200");

  return (
    <Flex direction="column" w="100%" h="full" p={{ base: 3, md: 4 }} position="relative">
      <Header
        name={chat.owner?.unknown ? undefined : (chat.owner?.name || chat.lastMessage?.author)}
        name_={chat.owner?.name ? chat.owner?.name : undefined}
        color={chat.owner?.color}
        avatar={chat.owner?.avatar}
        phone={chat.owner?.phone}
        represented={chat.owner?.represented}
        onTutorClick={() => {
          if (chat.owner?.represented && chat.owner?._id) {
            setTutorId(chat.owner._id);
            onTutorOpen();
          }
        }}
      />
      <Divider mb={4} borderColor={borderCol} />

      <MessageList
        messages={messages}
        conversationId={chat.conversationId}
        loadOlder={async () => { if (hasNextPage && !isFetchingNextPage) await fetchNextPage(); }}
        hasOlder={!!hasNextPage}
        isLoadingOlder={isFetchingNextPage || isRefetching}
        patientColor={chat.owner?.color}
        patientName={`${chat.owner?.name || ''} ${chat.owner?.lastName || ''}`.trim()}
      />

      <Composer
        key={chat.conversationId}
        conversationId={chat.conversationId}
        disabled={sendChat.isPending}
        patientId={chat.owner._id || ""}
        unknown={chat.owner.unknown || false}
        onSend={onSend}
      />

      {/* Nested tutor modal */}
      {tutorId && (
        <React.Suspense fallback={null}>
          <AppointmentModalLazy id={tutorId} isOpen={isTutorOpen} onClose={onTutorClose} />
        </React.Suspense>
      )}
    </Flex>
  );
}

/* ---------- Subcomponents ---------- */

const Header = memo(function Header({
  name,
  name_,
  color,
  avatar,
  phone,
  represented,
  onTutorClick,
}: {
  name: string | undefined;
  avatar?: string;
  name_: string | undefined;
  color?: string;
  phone?: string;
  represented?: boolean;
  onTutorClick?: () => void;
}) {
  const titleColor = useColorModeValue("gray.800", "gray.100");
  const subColor = useColorModeValue("gray.500", "gray.400");

  // Capitalizar primera letra de cada palabra
  const capitalizeWords = (str: string | undefined) => {
    if (!str) return str;
    return str
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const displayName = capitalizeWords(name_ || name || "No name");
  const displaySubName = name && name_ && name_ !== name ? capitalizeWords(name) : undefined;

  return (
    <HStack spacing={4} mb={2} align="center">
      <Avatar 
        size="md"
        name={displayName}
        src={avatar}
        bg={color ? `${color}.400` : "gray.400"}
        color="white"
      />
      <Box minW={0}>
        <HStack spacing={3} align="center">
          <Text fontWeight="semibold" fontSize={{ base: "lg", md: "xl" }} color={titleColor} noOfLines={1}>
            {displayName}
          </Text>
          {/* Phone pill next to the name */}
          <Box
            bg={useColorModeValue("blackAlpha.50", "whiteAlpha.100")}
            px={2}
            py={1}
            rounded="full"
            borderWidth="1px"
            borderColor={useColorModeValue("blackAlpha.200", "whiteAlpha.300")}
          >
            <HStack spacing={2} align="center">
              <PhoneIcon boxSize={3.5} color={useColorModeValue("green.600", "green.300")} />
              {represented ? (
                <HStack spacing={1} align="center">
                    <Box 
                    as="button" 
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => { 
                      e.stopPropagation(); 
                      onTutorClick?.(); 
                    }} 
                    aria-label="Open representative"
                    >
                    <Box as={RiParentFill} color={useColorModeValue("purple.600", "purple.300")} />
                    </Box>
                  <Text fontSize="sm" fontWeight="semibold">{phone ? formatAusPhoneNumber(phone) : "—"}</Text>
                </HStack>
              ) : (
                <Text fontSize="sm" fontWeight="semibold">{phone ? formatAusPhoneNumber(phone) : "—"}</Text>
              )}
            </HStack>
          </Box>
        </HStack>
        {displaySubName && (
          <Text fontSize="sm" color={subColor} noOfLines={1}>
            {displaySubName}
          </Text>
        )}
      </Box>
    </HStack>
  );
});

const MessageBubble = memo(function MessageBubble({ msg, patientColor, patientName }: { msg: Message; patientColor?: string; patientName?: string }) {
  const isClinic = msg.direction === "outbound";

  const bubbleInbound = useColorModeValue("gray.100", "gray.700");
  const bubbleOutbound = useColorModeValue("blue.500", "blue.400");
  const textInbound = useColorModeValue("gray.900", "gray.100");
  const textOutbound = "white";
  const tickColor = useColorModeValue("green.500", "green.300");
  const timeColor = useColorModeValue("gray.600", "gray.300");

  const showDrive = (u?: string) => !!u && !u.startsWith("blob:");

  // Obtener iniciales del nombre
  const getInitials = (name: string | undefined) => {
    if (!name) return "?";
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  };

  // Para mensajes outbound, obtener info del usuario que envió
  const senderName = isClinic && msg.user?.name ? msg.user.name : "User";
  const senderPicture = isClinic && msg.user?.picture ? msg.user.picture : undefined;

  return (
    <Flex 
      justify={isClinic ? "flex-end" : "flex-start"} 
      w="100%" 
      align="flex-end"
      gap={2}
    >
      {/* Avatar para mensajes entrantes (paciente) */}
      {!isClinic && (
        <Tooltip label={patientName || "Patient"} placement="left" hasArrow>
          <Avatar 
            size="sm" 
            name={patientName || "Patient"}
            bg={patientColor ? `${patientColor}.400` : "gray.400"}
            color="white"
            getInitials={getInitials}
            flexShrink={0}
          />
        </Tooltip>
      )}

      {/* Burbuja del mensaje */}
      <Flex direction="column" maxW="75%" align={isClinic ? "flex-end" : "flex-start"}>
        <Box
          bg={isClinic ? bubbleOutbound : bubbleInbound}
          color={isClinic ? textOutbound : textInbound}
          px={4}
          py={2.5}
          borderRadius="2xl"
          boxShadow="md"
          position="relative"
        >
          {!!msg.body && (
            <Text 
              fontSize="sm" 
              mb={Array.isArray(msg.media) && msg.media.length ? 2 : 0} 
              whiteSpace="pre-wrap"
              lineHeight="1.4"
            >
              {msg.body}
            </Text>
          )}

          {Array.isArray(msg.media) &&
            msg.media.map((m, i) =>
              showDrive(m.url) ? (
                <ImageFromDrive key={i} fileId={m.url} />
              ) : (
                <Box key={i} mt={2}>
                  <img
                    src={m.url}
                    alt={m.type || "preview"}
                    style={{ maxWidth: "100%", borderRadius: 12, display: "block" }}
                  />
                </Box>
              )
            )}
        </Box>

        {/* Timestamp y status fuera de la burbuja */}
        <HStack spacing={1} mt={1} px={1}>
          <Text fontSize="xs" color={timeColor} fontWeight="medium">
            {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
          {isClinic && (
            msg.status === "delivered" ? (
              <Icon as={TiTick} boxSize={3} color={tickColor} />
            ) : (
              <Icon as={MdAccessTime} boxSize={3} color={timeColor} />
            )
          )}
        </HStack>
      </Flex>

      {/* Avatar para mensajes salientes (usuario de la clínica) */}
      {isClinic && (
        <Tooltip label={senderName} placement="right" hasArrow>
          <Avatar 
            size="sm" 
            name={senderName}
            src={senderPicture}
            bg="blue.500"
            color="white"
            getInitials={getInitials}
            flexShrink={0}
          />
        </Tooltip>
      )}
    </Flex>
  );
}, areMsgEqual);

function areMsgEqual(prev: { msg: Message }, next: { msg: Message }) {
  return (
    prev.msg.sid === next.msg.sid &&
    prev.msg.status === next.msg.status &&
    prev.msg.updatedAt === next.msg.updatedAt &&
    prev.msg.body === next.msg.body &&
    (prev.msg.media?.length || 0) === (next.msg.media?.length || 0)
  );
}

/** MessageList con day separators + infinito arriba */
const MessageList = memo(function MessageList({
  messages,
  conversationId,
  loadOlder,
  hasOlder,
  isLoadingOlder,
  patientColor,
  patientName,
}: {
  messages: Message[];
  conversationId: string;
  loadOlder: () => Promise<void> | void;
  hasOlder: boolean;
  isLoadingOlder: boolean;
  patientColor?: string;
  patientName?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);

  const [isAtBottom, setIsAtBottom] = useState(true);
  const didInitialScrollRef = useRef(false);

  // Para preservar posición al cargar más arriba
  const pendingAnchorRef = useRef<{
    prevScrollHeight: number;
    prevScrollTop: number;
  } | null>(null);

  const ensureBottom = useCallback(async (behavior: ScrollBehavior = "auto") => {
    const scroller = scrollerRef.current;
    const sentinel = bottomSentinelRef.current;
    if (!scroller || !sentinel) return;

    sentinel.scrollIntoView({ block: "end", behavior });
    await new Promise<void>((r) => requestAnimationFrame(() => r()));

    const imgs = Array.from(scroller.querySelectorAll("img")) as HTMLImageElement[];
    if (imgs.length) {
      const decoders = imgs.map((img) => {
        if (typeof img.decode === "function") return img.decode().catch(() => { });
        if (img.complete) return Promise.resolve();
        return new Promise<void>((res) => img.addEventListener("load", () => res(), { once: true, capture: true }));
      });
      await Promise.allSettled(decoders);
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      sentinel.scrollIntoView({ block: "end" });
    }
  }, []);

  // Al cambiar de conversación: baja al final
  useEffect(() => {
    didInitialScrollRef.current = false;
    requestAnimationFrame(() => {
      ensureBottom("auto");
      didInitialScrollRef.current = true;
      setIsAtBottom(true);
    });
  }, [conversationId, ensureBottom]);

  // Observa "estar al fondo"
  useEffect(() => {
    const scroller = scrollerRef.current;
    const bottom = bottomSentinelRef.current;
    if (!scroller || !bottom) return;

    const io = new IntersectionObserver(
      (entries) => setIsAtBottom(entries[0]?.isIntersecting ?? false),
      { root: scroller, threshold: 0, rootMargin: "0px 0px 24px 0px" }
    );
    io.observe(bottom);
    return () => io.disconnect();
  }, []);

  // Autoscroll sólo si estás al fondo
  useEffect(() => {
    if (!didInitialScrollRef.current) return;
    if (isAtBottom) ensureBottom("smooth");
  }, [messages, isAtBottom, ensureBottom]);

  // Resize/Mutations: mantiene bottom si corresponde
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const ro = new ResizeObserver(() => {
      if (isAtBottom) ensureBottom("auto");
    });
    ro.observe(scroller);

    const mo = new MutationObserver(() => {
      if (isAtBottom) ensureBottom("auto");
    });
    mo.observe(scroller, { childList: true, subtree: true });

    const onLoad = () => { if (isAtBottom) ensureBottom("auto"); };
    scroller.addEventListener("load", onLoad, true);

    return () => {
      ro.disconnect();
      mo.disconnect();
      scroller.removeEventListener("load", onLoad, true);
    };
  }, [isAtBottom, ensureBottom]);

  // === INFINITE TOP: observar el tope y pedir página anterior preservando scroll ===
  useEffect(() => {
    const scroller = scrollerRef.current;
    const top = topSentinelRef.current;
    if (!scroller || !top) return;

    const onTopIntersect = async (entries: IntersectionObserverEntry[]) => {
      const entry = entries[0];
      if (!entry?.isIntersecting) return;
      if (!hasOlder || isLoadingOlder) return;

      // Anclamos posición actual antes de cargar
      pendingAnchorRef.current = {
        prevScrollHeight: scroller.scrollHeight,
        prevScrollTop: scroller.scrollTop,
      };

      await loadOlder(); // fetchNextPage()
    };

    const ioTop = new IntersectionObserver(onTopIntersect, {
      root: scroller,
      threshold: 0,
      rootMargin: "150px 0px 0px 0px", // dispara un poco antes de tocar el borde
    });

    ioTop.observe(top);
    return () => ioTop.disconnect();
  }, [hasOlder, isLoadingOlder, loadOlder]);

  // Cuando terminan de llegar mensajes nuevos por "load older", reponemos el scroll
  useEffect(() => {
    if (!pendingAnchorRef.current) return;
    const scroller = scrollerRef.current;
    if (!scroller) {
      pendingAnchorRef.current = null;
      return;
    }

    // Esperamos a que el DOM pinte
    requestAnimationFrame(() => {
      const { prevScrollHeight, prevScrollTop } = pendingAnchorRef.current!;
      const newScrollHeight = scroller.scrollHeight;
      const delta = newScrollHeight - prevScrollHeight;
      scroller.scrollTop = prevScrollTop + delta;
      pendingAnchorRef.current = null;
    });
  }, [messages]);

  const scrollThumb = useColorModeValue("blackAlpha.300", "whiteAlpha.300");

  // Interleave con day dividers
  const interleaved = useMemo(() => {
    const out: React.ReactNode[] = [];
    let prevDate: Date | null = null;
    for (const m of messages) {
      const d = new Date(m.createdAt);
      if (!prevDate || !isSameLocalDay(prevDate, d)) {
        out.push(<DayDivider key={`day-${d.toDateString()}`} date={d} />);
        prevDate = d;
      }
      out.push(<MessageBubble key={m.sid} msg={m} patientColor={patientColor} patientName={patientName} />);
    }
    return out;
  }, [messages, patientColor, patientName]);

  return (
    <Box position="relative" flex="1" minH={0}>
      <VStack
        ref={scrollerRef as any}
        spacing={3}
        flex="1"
        overflowY="auto"
        align="stretch"
        pr={2}
        position="absolute"
        top={0}
        bottom={0}
        left={0}
        right={0}
        sx={{
          "&::-webkit-scrollbar": { width: "6px" },
          "&::-webkit-scrollbar-thumb": { background: scrollThumb, borderRadius: "8px" },
          scrollbarWidth: "thin",
        }}
      >
        <div ref={topSentinelRef} style={{ height: 1 }} />

        {isLoadingOlder && (
          <HStack justify="center" py={2}>
            <Spinner size="sm" />
            <Text fontSize="xs" opacity={0.7}>Loading earlier messages…</Text>
          </HStack>
        )}

        {interleaved}

        <div ref={bottomSentinelRef} style={{ height: 1 }} />
      </VStack>

      {!isAtBottom && (
        <IconButton
          aria-label="Go to latest"
          icon={<MdKeyboardArrowDown size={22} />}
          onClick={() => {
            const scroller = scrollerRef.current;
            if (!scroller) return;
            ensureBottom("smooth");
          }}
          position="absolute"
          bottom="88px"
          left="50%"
          transform="translateX(-50%)"
          colorScheme="blue"
          borderRadius="full"
          boxShadow="md"
          zIndex={1}
          size="sm"
        />
      )}
    </Box>
  );
});

const Composer = memo(function Composer({
  disabled,
  patientId,
  conversationId,
  unknown,
  onSend,
}: {
  disabled?: boolean;
  patientId: string;
  conversationId: string;
  unknown: boolean;
  onSend: (p: { text: string; files: File[] }) => void;
}) {
  type PreviewItem = { id: string; url: string; name: string; size: number };

  const storageKey = useMemo(() => `draft:${conversationId}`, [conversationId]);

  const [text, setText] = useState<string>(() => {
    try { return localStorage.getItem(storageKey) ?? ""; } catch { return ""; }
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<PreviewItem[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      const t = text.trim();
      if (t.length > 0) localStorage.setItem(storageKey, t);
      else localStorage.removeItem(storageKey);
    } catch { }
  }, [storageKey, text]);

  const hasText = text.trim().length > 0;

  const handleFilesReady = useCallback((files: File[]) => {
    setSelectedFiles(files);
    setPreviews(
      files.map((f) => ({
        id: `${f.name}-${f.size}-${f.lastModified}`,
        url: URL.createObjectURL(f),
        name: f.name,
        size: f.size,
      }))
    );
  }, []);

  const handleRemovePreview = useCallback((id: string) => {
    setPreviews((prev) => prev.filter((p) => p.id !== id));
    setSelectedFiles((prev) =>
      prev.filter((f) => `${f.name}-${f.size}-${f.lastModified}` !== id)
    );
  }, []);

  const handleClearPreviews = useCallback(() => {
    setPreviews((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.url));
      return [];
    });
    setSelectedFiles([]);
  }, []);

  const send = useCallback(() => {
    onSend({ text, files: selectedFiles });
    setText("");
    handleClearPreviews();
    try { localStorage.removeItem(storageKey); } catch { }
    inputRef.current?.focus();
  }, [onSend, text, selectedFiles, handleClearPreviews, storageKey]);

  useEffect(() => () => {
    previews.forEach((p) => URL.revokeObjectURL(p.url));
  }, [previews]);

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;
    const maxHeight = window.innerHeight * 0.35; // 35vh
    textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
  }, [text]);

  const composerBg = useColorModeValue("white", "gray.800");
  const composerBorder = useColorModeValue("blackAlpha.200", "whiteAlpha.200");
  const fieldBorder = useColorModeValue("blackAlpha.300", "whiteAlpha.300");

  return (
    <Box pt={3} borderTopWidth="1px" borderColor={composerBorder}>
      <PreviewBar
        previews={previews}
        onRemove={handleRemovePreview}
        onClear={handleClearPreviews}
      />

      <Flex
        borderRadius="lg"
        borderWidth="1px"
        borderColor={fieldBorder}
        px={2}
        py={2}
        align="flex-end"
        gap={2}
        bg={composerBg}
      >
        <HStack spacing={1} alignSelf="flex-end">
          {!unknown && <Tooltip label="Saved messages">
            <ShowTemplateButton selectedPatient={patientId} onSelectTemplate={setText} category="message" />
          </Tooltip>}

          {!unknown && <Tooltip label="Create template">
            <CreateMessageModal
              patientId={patientId}
              triggerButton={
                <IconButton
                  aria-label="Create template"
                  icon={<MdOutlinePostAdd size={18} />}
                  variant="ghost"
                  size="sm"
                />
              }
            />
          </Tooltip>}

          <Tooltip label="Attach file">
            <FileUploadButton onFilesReady={handleFilesReady} isSending={!!disabled} hasText={hasText} />
          </Tooltip>

          <Tooltip label="Emoji">
            <EmojiPickerButton inputRef={inputRef} value={text} setValue={setText} />
          </Tooltip>
        </HStack>

        <Textarea
          ref={inputRef}
          placeholder="Type a message…"
          variant="unstyled"
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          onWheel={(e) => e.stopPropagation()}
          resize="none"
          minH="40px"
          maxH="35vh"
          overflowY="auto"
          px={2}
          isDisabled={disabled}
          sx={{
            scrollbarWidth: "thin",
            msOverflowStyle: "auto",
            "&::-webkit-scrollbar": { width: "6px" },
            "&::-webkit-scrollbar-thumb": { borderRadius: "8px", background: "var(--chakra-colors-gray-400)" },
            "&::-webkit-scrollbar-track": { background: "transparent" },
          }}
        />


        <IconButton
          icon={<FiSend size={18} />}
          colorScheme="blue"
          onClick={send}
          aria-label="Send message"
          size="md"
          borderRadius="xl"
          isDisabled={disabled || (!hasText && selectedFiles.length === 0)}
        />
      </Flex>
    </Box>
  );
});
