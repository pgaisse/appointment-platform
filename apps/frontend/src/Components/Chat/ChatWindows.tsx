// ChatWindows.tsx
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  forwardRef,
} from "react";
import {
  Flex, HStack, Avatar, Box, Divider, VStack, Tooltip, IconButton, Input, Text,
  useColorModeValue, useToast, Spinner,
} from "@chakra-ui/react";
import { FiSend } from "react-icons/fi";
import { MdAccessTime, MdOutlinePostAdd, MdKeyboardArrowDown } from "react-icons/md";
import { TiTick } from "react-icons/ti";
import { FaUserAlt } from "react-icons/fa";

import ShowTemplateButton from "./CustomMessages/ShowTemplateButton";
import CreateMessageModal from "./CustomMessages/CreateCustomMessageModal";
import { FileUploadButton } from "./FileUploadButton";
import PreviewBar from "./PreviewBar";
import { ImageFromDrive } from "./ImageFromDrive";
import EmojiPickerButton from "./CustomMessages/EmojiPickerButton";

import { useQueryClient } from "@tanstack/react-query";
import { useSendChatMessage } from "@/Hooks/Query/useSendChatMessage";
import { useMessages } from "@/Hooks/Query/useMessages";
import { useOptimisticMessages } from "@/Hooks/Query/useOptimisticMessages";
import { formatToE164 } from "@/Functions/formatToE164";
import { ConversationChat, Message } from "@/types";

/* ---------- Helpers for day separators ---------- */
const isSameLocalDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

function formatDayLabel(d: Date, now = new Date(), locale = navigator?.language || "en-US") {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateStart  = new Date(d.getFullYear(), d.getMonth(), d.getDate());
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

type Props = { chat: ConversationChat | undefined; isOpen: boolean };

export default function ChatWindows({ chat }: Props) {
  if (!chat) return null;
  return <ChatWindowsInner chat={chat} />;
}

function ChatWindowsInner({ chat }: { chat: ConversationChat }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const sendChat = useSendChatMessage();

  /** ---------- PAGINACIÓN (tipo WhatsApp) ---------- */
  const limit = 3;
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [all, setAll] = useState<Message[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);

  // Scroller DOM desde MessageList (para preservar scroll al cargar más)
  const scrollerDomRef = useRef<HTMLDivElement | null>(null);
  const pendingPrependRef = useRef<{ prevHeight: number; prevTop: number } | null>(null);

  // Carga de la página actual
  const { data: pageData, isFetching } = useMessages(chat.conversationId, page, limit);

  // Reset al cambiar de conversación
  useEffect(() => {
    setPage(1);
    setAll([]);
    setHasMore(false);
    setLoadingMore(false);
    pendingPrependRef.current = null;
  }, [chat.conversationId]);

  // Merge de páginas en "all" manteniendo orden ascendente y sin duplicados
  useEffect(() => {
    if (!pageData) return;
    setHasMore(!!pageData.pagination?.hasMore);

    setAll((prev) => {
      const incoming = pageData.messages || [];
      // Si page === 1, empezamos; si >1, prepend de mensajes antiguos
      const base = page === 1 ? incoming : [...incoming, ...prev];
      const map = new Map<string, Message>();
      for (const m of base) map.set(m.sid, m);
      return Array.from(map.values()).sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    });
  }, [pageData, page]);

  // Al completar un "prepend", preservamos la posición de scroll
  useEffect(() => {
    if (!loadingMore) return;
    if (isFetching) return;
    const scroller = scrollerDomRef.current;
    const pending = pendingPrependRef.current;
    if (scroller && pending) {
      // Esperar al siguiente frame para asegurar DOM aplicado
      requestAnimationFrame(() => {
        const newHeight = scroller.scrollHeight;
        const delta = newHeight - pending.prevHeight;
        scroller.scrollTop = pending.prevTop + delta;
        pendingPrependRef.current = null;
        setLoadingMore(false);
      });
    } else {
      setLoadingMore(false);
    }
  }, [all.length, isFetching, loadingMore]);

  const requestOlder = useCallback(() => {
    if (loadingMore || isFetching || !hasMore) return;
    const scroller = scrollerDomRef.current;
    if (!scroller) return;
    pendingPrependRef.current = {
      prevHeight: scroller.scrollHeight,
      prevTop: scroller.scrollTop,
    };
    setLoadingMore(true);
    setPage((p) => p + 1);
  }, [loadingMore, isFetching, hasMore]);

  /** ---------- Optimistic + envío ---------- */
  const { messages, addOptimistic, removeOptimistic, clearOptimistic } =
    useOptimisticMessages(all);

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

      const optimistic: Message = {
        sid: `temp-${Date.now()}`,
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

      sendChat.mutate(
        {
          to: formatToE164(chat.owner.phone || ""),
          appId,
          body: text.trim(),
          files,
          onProgress: () => {},
        },
        {
          onSuccess: () => {
            clearOptimistic();
            queryClient.invalidateQueries({ queryKey: ["messages", chat.conversationId] });
          },
          onError: (error: any) => {
            removeOptimistic(optimistic.sid);
            console.error("Error sending message:", error);
            toast({
              title: "Failed to send",
              description: error?.message || "Unexpected error",
              status: "error",
              position: "bottom-right",
            });
          },
        }
      );
    },
    [
      chat.conversationId,
      chat.owner._id,
      chat.owner.phone,
      addOptimistic,
      removeOptimistic,
      clearOptimistic,
      queryClient,
      sendChat,
      toast,
    ]
  );

  const borderCol = useColorModeValue("blackAlpha.200", "whiteAlpha.200");

  return (
    <Flex direction="column" w="100%" h="full" p={{ base: 3, md: 4 }} position="relative">
      <Header
        name={chat.owner?.unknown ? undefined : (chat.owner?.name || chat.lastMessage?.author)}
        avatar={chat.owner?.avatar}
        icon={chat.owner?.unknown ? <FaUserAlt fontSize="1.25rem" /> : undefined}
        name_={chat.owner?.name ? chat.owner?.name : undefined}
      />
      <Divider mb={4} borderColor={borderCol} />

      <MessageList
        ref={scrollerDomRef}
        messages={messages}
        conversationId={chat.conversationId}
        onLoadOlder={requestOlder}
        hasMore={hasMore}
        isLoadingMore={loadingMore}
      />

      <Composer
        key={chat.conversationId}
        conversationId={chat.conversationId}
        disabled={sendChat.isPending}
        patientId={chat.owner._id || ""}
        onSend={onSend}
      />
    </Flex>
  );
}

/* ---------- Subcomponents ---------- */

const Header = memo(function Header({
  name,
  avatar,
  icon,
  name_,
}: {
  name: string | undefined;
  avatar?: string;
  icon?: React.ReactElement | undefined;
  name_: string | undefined;
}) {
  const titleColor = useColorModeValue("gray.800", "gray.100");
  const subColor = useColorModeValue("gray.500", "gray.400");

  return (
    <HStack spacing={4} mb={2} align="center">
      <Avatar size="md" name={name} src={avatar} icon={icon} />
      <Box minW={0}>
        <Text fontWeight="semibold" fontSize={{ base: "lg", md: "xl" }} color={titleColor} noOfLines={1}>
          {name_ || name || "No name"}
        </Text>
        {name && name_ && name_ !== name && (
          <Text fontSize="sm" color={subColor} noOfLines={1}>
            {name}
          </Text>
        )}
      </Box>
    </HStack>
  );
});

const MessageBubble = memo(function MessageBubble({ msg }: { msg: Message }) {
  const isClinic = msg.direction === "outbound";

  const bubbleInbound = useColorModeValue("gray.100", "gray.700");
  const bubbleOutbound = useColorModeValue("blue.100", "blue.600");
  const textInbound = useColorModeValue("gray.900", "white");
  const textOutbound = useColorModeValue("gray.900", "white");
  const tickColor = useColorModeValue("green", "green.300");

  const showDrive = (u?: string) => !!u && !u.startsWith("blob:");

  return (
    <Flex justify={isClinic ? "flex-end" : "flex-start"} w="100%">
      <Box
        bg={isClinic ? bubbleOutbound : bubbleInbound}
        color={isClinic ? textOutbound : textInbound}
        px={4}
        py={3}
        borderRadius="lg"
        maxW="75%"
        boxShadow="sm"
      >
        {!!msg.body && (
          <Text fontWeight={"normal"} mb={Array.isArray(msg.media) && msg.media.length ? 2 : 0} whiteSpace="pre-wrap">
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
                  style={{ maxWidth: "100%", borderRadius: 8, display: "block" }}
                />
              </Box>
            )
          )}

        <HStack justify="flex-end" mt={1} spacing={2}>
          {isClinic &&
            (msg.status === "delivered" ? (
              <TiTick size={12} color={tickColor as any} />
            ) : (
              <MdAccessTime size={12} />
            ))}
          <Text fontWeight={"normal"} fontSize="10px" opacity={0.8}>
            {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
        </HStack>
      </Box>
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

/** MessageList con separadores de día y paginación al hacer scroll hacia arriba */
type MessageListProps = {
  messages: Message[];
  conversationId: string;
  onLoadOlder?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
};

const MessageList = memo(
  forwardRef<HTMLDivElement, MessageListProps>(function MessageList(
    { messages, conversationId, onLoadOlder, hasMore, isLoadingMore },
    outerRef
  ) {
    const scrollerRef = useRef<HTMLDivElement | null>(null);
    const assignScrollerRef = useCallback((el: HTMLDivElement | null) => {
      scrollerRef.current = el;
      if (typeof outerRef === "function") outerRef(el);
      else if (outerRef && "current" in (outerRef as any)) (outerRef as any).current = el;
    }, [outerRef]);

    const bottomSentinelRef = useRef<HTMLDivElement>(null);
    const topSentinelRef = useRef<HTMLDivElement>(null);
    const [isAtBottom, setIsAtBottom] = useState(true);
    const didInitialScrollRef = useRef(false);

    const ensureBottom = useCallback(async (behavior: ScrollBehavior = "auto") => {
      const scroller = scrollerRef.current;
      const sentinel = bottomSentinelRef.current;
      if (!scroller || !sentinel) return;

      sentinel.scrollIntoView({ block: "end", behavior });
      await new Promise<void>((r) => requestAnimationFrame(() => r()));

      const imgs = Array.from(scroller.querySelectorAll("img")) as HTMLImageElement[];
      if (imgs.length) {
        const decoders = imgs.map((img) => {
          if (typeof img.decode === "function") return img.decode().catch(() => {});
          if (img.complete) return Promise.resolve();
          return new Promise<void>((res) => img.addEventListener("load", () => res(), { once: true, capture: true }));
        });
        await Promise.allSettled(decoders);
        await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
        sentinel.scrollIntoView({ block: "end" });
      }
    }, []);

    useEffect(() => {
      didInitialScrollRef.current = false;
      requestAnimationFrame(() => {
        ensureBottom("auto");
        didInitialScrollRef.current = true;
        setIsAtBottom(true);
      });
    }, [conversationId, ensureBottom]);

    // Observa el fondo para mostrar el botón "bajar"
    useEffect(() => {
      const scroller = scrollerRef.current;
      const sentinel = bottomSentinelRef.current;
      if (!scroller || !sentinel) return;

      const io = new IntersectionObserver(
        (entries) => setIsAtBottom(entries[0]?.isIntersecting ?? false),
        { root: scroller, threshold: 0, rootMargin: "0px 0px 24px 0px" }
      );
      io.observe(sentinel);
      return () => io.disconnect();
    }, []);

    // Observa el top para cargar más
    useEffect(() => {
      const scroller = scrollerRef.current;
      const top = topSentinelRef.current;
      if (!scroller || !top) return;

      const io = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (entry?.isIntersecting && hasMore && !isLoadingMore) {
            onLoadOlder?.();
          }
        },
        // rootMargin positiva arriba = dispara antes de tocar el borde (pre-fetch)
        { root: scroller, threshold: 0, rootMargin: "200px 0px 0px 0px" }
      );
      io.observe(top);
      return () => io.disconnect();
    }, [hasMore, isLoadingMore, onLoadOlder]);

    // Auto-scroll al fondo solo si el usuario ya estaba abajo
    useEffect(() => {
      if (!didInitialScrollRef.current) return;
      if (isAtBottom) ensureBottom("smooth");
    }, [messages, isAtBottom, ensureBottom]);

    // Ajustes ante cambios de tamaño/carga de medios cuando está al fondo
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

      const onLoad = () => {
        if (isAtBottom) ensureBottom("auto");
      };
      scroller.addEventListener("load", onLoad, true);

      return () => {
        ro.disconnect();
        mo.disconnect();
        scroller.removeEventListener("load", onLoad, true);
      };
    }, [isAtBottom, ensureBottom]);

    const scrollThumb = useColorModeValue("blackAlpha.300", "whiteAlpha.300");

    // Construye lista intercalada con separadores de día
    const interleaved = useMemo(() => {
      const out: React.ReactNode[] = [];
      let prevDate: Date | null = null;

      for (const m of messages) {
        const d = new Date(m.createdAt);
        if (!prevDate || !isSameLocalDay(prevDate, d)) {
          out.push(<DayDivider key={`day-${d.toDateString()}`} date={d} />);
          prevDate = d;
        }
        out.push(<MessageBubble key={m.sid} msg={m} />);
      }
      return out;
    }, [messages]);

    return (
      <Box position="relative" flex="1" minH={0}>
        <VStack
          ref={assignScrollerRef as any}
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
          {/* Sentinel superior para "cargar más" */}
          <div ref={topSentinelRef} style={{ height: 1 }} />

          {/* Loader superior mientras trae páginas antiguas */}
          {isLoadingMore && (
            <HStack justify="center" py={2}>
              <Spinner size="sm" />
              <Text fontSize="xs" color="gray.500">Loading earlier messages…</Text>
            </HStack>
          )}

          {interleaved}

          {/* Sentinel inferior para detectar si estás abajo */}
          <div ref={bottomSentinelRef} style={{ height: 1 }} />
        </VStack>

        {!isAtBottom && (
          <IconButton
            aria-label="Go to latest"
            icon={<MdKeyboardArrowDown size={22} />}
            onClick={() => {
              const sentinel = bottomSentinelRef.current;
              sentinel?.scrollIntoView({ behavior: "smooth", block: "end" });
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
  })
);

const Composer = memo(function Composer({
  disabled,
  patientId,
  conversationId,
  onSend,
}: {
  disabled?: boolean;
  patientId: string;
  conversationId: string;
  onSend: (p: { text: string; files: File[] }) => void;
}) {
  type PreviewItem = { id: string; url: string; name: string; size: number };

  const storageKey = useMemo(() => `draft:${conversationId}`, [conversationId]);

  // lazy-init draft from localStorage
  const [text, setText] = useState<string>(() => {
    try {
      return localStorage.getItem(storageKey) ?? "";
    } catch {
      return "";
    }
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<PreviewItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // persist draft
  useEffect(() => {
    try {
      const t = text.trim();
      if (t.length > 0) localStorage.setItem(storageKey, t);
      else localStorage.removeItem(storageKey);
    } catch {}
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
    try {
      localStorage.removeItem(storageKey);
    } catch {}
    inputRef.current?.focus();
  }, [onSend, text, selectedFiles, handleClearPreviews, storageKey]);

  useEffect(
    () => () => {
      previews.forEach((p) => URL.revokeObjectURL(p.url));
    },
    [previews]
  );

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
        align="center"
        gap={2}
        bg={composerBg}
      >
        <HStack spacing={1}>
          <Tooltip label="Saved messages">
            <ShowTemplateButton
              selectedPatient={patientId}
              onSelectTemplate={setText}
            />
          </Tooltip>

          <Tooltip label="Create template">
            <CreateMessageModal
              triggerButton={
                <IconButton
                  aria-label="Create template"
                  icon={<MdOutlinePostAdd size={18} />}
                  variant="ghost"
                  size="sm"
                />
              }
            />
          </Tooltip>

          <Tooltip label="Attach file">
            <FileUploadButton
              onFilesReady={handleFilesReady}
              isSending={!!disabled}
              hasText={hasText}
            />
          </Tooltip>

          <Tooltip label="Emoji">
            <EmojiPickerButton
              inputRef={inputRef}
              value={text}
              setValue={setText}
            />
          </Tooltip>
        </HStack>

        <Input
          ref={inputRef}
          placeholder="Type a message…"
          variant="unstyled"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          px={2}
          isDisabled={disabled}
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
