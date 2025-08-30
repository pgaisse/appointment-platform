// ChatWindows.tsx
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Flex, HStack, Avatar, Box, Divider, VStack, Tooltip, IconButton, Input, Text,
  useColorModeValue, useToast,
} from "@chakra-ui/react";
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
import { useMessages } from "@/Hooks/Query/useMessages";
import { useOptimisticMessages } from "@/Hooks/Query/useOptimisticMessages";
import { formatToE164 } from "@/Functions/formatToE164";
import { ConversationChat, Message } from "@/types";

type PreviewItem = { id: string; url: string; name: string; size: number };
type Props = { chat: ConversationChat | undefined; isOpen: boolean };

/** Contenedor "seguro": SIN hooks si chat es undefined */
export default function ChatWindows({ chat }: Props) {
  if (!chat) return null;
  return <ChatWindowsInner chat={chat} />;
}

/** Todo lo que usa hooks vive acá (chat garantizado) */
function ChatWindowsInner({ chat }: { chat: ConversationChat }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const sendChat = useSendChatMessage();

  // Mensajes desde servidor + capa optimista (unificada)
  const { data: messagesData } = useMessages(chat.conversationId, 1, 50);
  const { messages, addOptimistic, removeOptimistic, clearOptimistic } =
    useOptimisticMessages(messagesData?.messages || []);

  // onSend memoizado
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

      // Optimista
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

      // Envío real
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
              title: "Failed to send message",
              description: error?.message || "Unexpected error",
              status: "error",
              position: "bottom-right",
            });
          },
        }
      );
    },
    [chat.conversationId, chat.owner._id, chat.owner.phone, addOptimistic, removeOptimistic, clearOptimistic, queryClient, sendChat, toast]
  );

  return (
    <Flex direction="column" w="70%" p={6} position="relative">
      <Header name={chat.owner.name || ""} avatar={chat.owner.avatar} />
      <Divider mb={4} />

      <MessageList messages={messages} conversationId={chat.conversationId} />

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

/* ---------- Subcomponentes ---------- */

const Header = memo(function Header({ name, avatar }: { name: string; avatar?: string }) {
  return (
    <HStack spacing={4} mb={4} align="center">
      <Avatar size="lg" name={name} src={avatar} />
      <Box>
        <Text fontWeight="bold" fontSize="2xl">{name}</Text>
      </Box>
    </HStack>
  );
});

const MessageBubble = memo(function MessageBubble({ msg }: { msg: Message }) {
  const isClinic = msg.direction === "outbound";
  // ✅ Colores por defecto (los originales)
  const bubbleClient = useColorModeValue("gray.100", "gray.700");
  const bubbleUser = useColorModeValue("blue.100", "blue.600");
  const textUser = useColorModeValue("gray.900", "white");
  const textClient = useColorModeValue("gray.900", "white");
  const showDrive = (u?: string) => !!u && !u.startsWith("blob:");

  return (
    <Flex justify={isClinic ? "flex-end" : "flex-start"} w="100%" >
      <Box
        bg={isClinic ? bubbleUser : bubbleClient}
        color={isClinic ? textUser : textClient}
        pl={4} pr={2} py={3}
        borderRadius="lg" maxW="75%" boxShadow="sm"
      >
        {!!msg.body && (
          <Text mb={Array.isArray(msg.media) && msg.media.length ? 2 : 0}  fontWeight="normal">
            {msg.body}
          </Text>
        )}

        {Array.isArray(msg.media) && msg.media.map((m, i) =>
          showDrive(m.url) ? (
            <ImageFromDrive key={i} fileId={m.url} />
          ) : (
            <Box   key={i} mt={2} >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.url} alt={m.type || "preview"} style={{ maxWidth: "100%", borderRadius: 8 }} />
            </Box>
          )
        )}

        <HStack justify="flex-end" mt={1}>
          {isClinic && (msg.status === "delivered" ? <TiTick size={12} color={"green"}/> : <MdAccessTime size={10} />)}
          <Text fontSize="10px" textAlign="right" fontWeight="normal">
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

/** MessageList con sentinel + auto-scroll solo al abrir/cambiar chat o si ya estás abajo */
const MessageList = memo(function MessageList({
  messages, conversationId,
}: { messages: Message[]; conversationId: string }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const didInitialScrollRef = useRef(false);

  const ensureBottom = useCallback(async (behavior: ScrollBehavior = "auto") => {
    const scroller = scrollerRef.current;
    const sentinel = sentinelRef.current;
    if (!scroller || !sentinel) return;

    sentinel.scrollIntoView({ block: "end", behavior });
    await new Promise<void>((r) => requestAnimationFrame(() => r()));

    // Espera decode/carga de imágenes, luego baja otra vez
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

  // Al cambiar de chat → baja al final UNA sola vez
  useEffect(() => {
    didInitialScrollRef.current = false;
    requestAnimationFrame(() => {
      ensureBottom("auto");
      didInitialScrollRef.current = true;
      setIsAtBottom(true);
    });
  }, [conversationId, ensureBottom]);

  // Observa si estás "cerca del fondo" (tolerancia)
  useEffect(() => {
    const scroller = scrollerRef.current;
    const sentinel = sentinelRef.current;
    if (!scroller || !sentinel) return;

    const io = new IntersectionObserver(
      (entries) => setIsAtBottom(entries[0]?.isIntersecting ?? false),
      { root: scroller, threshold: 0, rootMargin: "0px 0px 24px 0px" }
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, []);

  // Si llegan mensajes nuevos y estás abajo → mantente abajo
  useEffect(() => {
    if (!didInitialScrollRef.current) return;
    if (isAtBottom) ensureBottom("smooth");
  }, [messages, isAtBottom, ensureBottom]);

  // Cambios de tamaño / mutaciones (imágenes grandes): si estás abajo, mantente abajo
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const ro = new ResizeObserver(() => { if (isAtBottom) ensureBottom("auto"); });
    ro.observe(scroller);

    const mo = new MutationObserver(() => { if (isAtBottom) ensureBottom("auto"); });
    mo.observe(scroller, { childList: true, subtree: true });

    const onLoad = () => { if (isAtBottom) ensureBottom("auto"); };
    scroller.addEventListener("load", onLoad, true);

    return () => {
      ro.disconnect();
      mo.disconnect();
      scroller.removeEventListener("load", onLoad, true);
    };
  }, [isAtBottom, ensureBottom]);

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
        top={0} bottom={0} left={0} right={0}
        // Ocultar la barra de scroll sin depender del tema
        sx={{
          '&::-webkit-scrollbar': { width: '0px', height: '0px' },
          '&::-webkit-scrollbar-thumb': { background: 'transparent' },
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {messages.map((m) => (<MessageBubble key={m.sid} msg={m} />))}
        <div ref={sentinelRef} style={{ height: 1 }} />
      </VStack>

      {!isAtBottom && (
        <IconButton
          aria-label="Ir al último mensaje"
          icon={<MdKeyboardArrowDown size={22} />}
          onClick={() => ensureBottom("smooth")}
          position="absolute"
          bottom="80px"
          left="50%"
          transform="translateX(-50%)"
          colorScheme="blue"
          borderRadius="full"
          boxShadow="md"
          zIndex={1}
        />
      )}
    </Box>
  );
});

const Composer = memo(function Composer({
  disabled, patientId, conversationId, onSend,
}: {
  disabled?: boolean;
  patientId: string;
  conversationId: string;
  onSend: (p: { text: string; files: File[] }) => void;
}) {
  const storageKey = useMemo(() => `draft:${conversationId}`, [conversationId]);

  // Lazy init: lee localStorage solo una vez
  const [text, setText] = useState<string>(() => {
    try { return localStorage.getItem(storageKey) ?? ""; } catch { return ""; }
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<PreviewItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Persistir borrador
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
    setPreviews(files.map((f) => ({
      id: `${f.name}-${f.size}-${f.lastModified}`,
      url: URL.createObjectURL(f), name: f.name, size: f.size,
    })));
  }, []);

  const handleRemovePreview = useCallback((id: string) => {
    setPreviews((prev) => prev.filter((p) => p.id !== id));
    setSelectedFiles((prev) => prev.filter((f) => `${f.name}-${f.size}-${f.lastModified}` !== id));
  }, []);

  const handleClearPreviews = useCallback(() => {
    setPreviews((prev) => { prev.forEach((p) => URL.revokeObjectURL(p.url)); return []; });
    setSelectedFiles([]);
  }, []);

  const send = useCallback(() => {
    onSend({ text, files: selectedFiles });
    setText("");
    handleClearPreviews();
    try { localStorage.removeItem(storageKey); } catch {}
    inputRef.current?.focus();
  }, [onSend, text, selectedFiles, handleClearPreviews, storageKey]);

  useEffect(() => () => { previews.forEach((p) => URL.revokeObjectURL(p.url)); }, [previews]);

  return (
    <Box p={4} borderTop="1px solid #E2E8F0">
      <PreviewBar previews={previews} onRemove={handleRemovePreview} onClear={handleClearPreviews} />
      <Flex
        borderRadius="lg"
        border="1px solid #CBD5E0"
        px={3}
        py={2}
        align="center"
        gap={2}
        bg="white"
      >
        <HStack spacing={1}>
          <Tooltip label="Custom Messages">
            <ShowTemplateButton selectedPatient={patientId} onSelectTemplate={setText} />
          </Tooltip>
          <Tooltip label="Create Templates">
            <CreateMessageModal
              triggerButton={<IconButton aria-label="Create template" icon={<MdOutlinePostAdd size={20} />} variant="ghost" size="sm" />}
            />
          </Tooltip>
          <Tooltip label="Upload">
            <FileUploadButton onFilesReady={handleFilesReady} isSending={!!disabled} hasText={hasText} />
          </Tooltip>
          <Tooltip label="Emoji">
            <EmojiPickerButton inputRef={inputRef} value={text} setValue={setText} />
          </Tooltip>
        </HStack>

        <Input
          ref={inputRef}
          placeholder="Say something..."
          variant="unstyled"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          px={2}
          isDisabled={disabled}
        />

        <IconButton
          icon={<FiSend size={20} />}
          colorScheme="blue"
          onClick={send}
          aria-label="Send message"
          size="lg"
          borderRadius="xl"
          isDisabled={disabled || (!hasText && selectedFiles.length === 0)}
        />
      </Flex>
    </Box>
  );
});
