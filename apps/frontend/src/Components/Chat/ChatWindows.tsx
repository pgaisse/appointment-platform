import {
  Flex,
  HStack,
  Avatar,
  Box,
  Divider,
  VStack,
  Tooltip,
  IconButton,
  Input,
  Text,
  useColorModeValue,
  useToast,
} from "@chakra-ui/react";
import { useRef, useState } from "react";
import { FiSend } from "react-icons/fi";
import { MdAccessTime, MdOutlinePostAdd } from "react-icons/md";
import CreateMessageModal from "./CustomMessages/CreateCustomMessageModal";
import EmojiPickerButton from "./CustomMessages/EmojiPickerButton";
import ShowTemplateButton from "./CustomMessages/ShowTemplateButton";
import { FileUploadButton } from "./FileUploadButton";
import { ImageFromDrive } from "./ImageFromDrive";
import PreviewBar from "./PreviewBar";
import { ConversationChat, Message } from "@/types";
import { useSendChatMessage } from "@/Hooks/Query/useSendChatMessage";
import { formatToE164 } from "@/Functions/formatToE164";
import { useAuth0 } from "@auth0/auth0-react";
import { useMessages } from "@/Hooks/Query/useMessages";
import { useQueryClient } from "@tanstack/react-query";
import { TiTick } from "react-icons/ti";
import { useOptimisticMessages } from "@/Hooks/Query/useOptimisticMessages";

type PreviewItem = { id: string; url: string; name: string; size: number };

type Props = {
  chat: ConversationChat | undefined;
  isOpen: boolean;
};

function ChatWindows({ chat }: Props) {
  const [input, setInput] = useState("");
  const [, setUploadPercent] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<PreviewItem[]>([]);

  const { user } = useAuth0();
  const sendChat = useSendChatMessage();
  const hasText = input.trim().length > 0;
  const toast = useToast();
  const queryClient = useQueryClient();

  const bubbleClient = useColorModeValue("gray.100", "gray.700");
  const bubbleUser = useColorModeValue("blue.100", "blue.600");
  const textUser = useColorModeValue("gray.900", "white");
  const textClient = useColorModeValue("gray.900", "white");

  // 📥 Trae siempre mensajes completos
  const { data: messagesData } = useMessages(chat?.conversationId || "", 1, 50);

  // 📌 Hook de optimistas
  const {
    messages,
    addOptimistic,
    removeOptimistic,
    clearOptimistic,
  } = useOptimisticMessages(messagesData?.messages || []);

  // 📌 Enviar mensaje (optimista)
  const handleSend = () => {
    if (!chat) return;

    const appId = chat.owner._id;
    if (!appId) {
      toast({
        title: "Cannot send",
        description: "Missing patient appId.",
        status: "error",
        position: "bottom-right",
      });
      return;
    }

    const hasText = !!input.trim();
    const hasFiles = selectedFiles.length > 0;
    if (!hasText && !hasFiles) return;

    const messageText = input.trim();

    // Crear optimista
    const optimisticMessage: Message = {
      sid: `temp-${Date.now()}`,
      conversationId: chat.conversationId,
      author: appId,
      body: messageText,
      media: hasFiles
        ? selectedFiles.map((f) => ({
            url: URL.createObjectURL(f),
            type: f.type,
            size: f.size,
          }))
        : [],
      direction: "outbound",
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      index: `${Date.now()}`, // index temporal
    };

    addOptimistic(optimisticMessage);

    sendChat.mutate(
      {
        to: formatToE164(chat.owner.phone),
        appId,
        body: messageText || "",
        files: hasFiles ? selectedFiles : [],
        onProgress: (p: number) => setUploadPercent(p),
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: ["messages", chat.conversationId],
          });
          clearOptimistic();
          setUploadPercent(0);
          setInput("");
          setPreviews([]);
          setSelectedFiles([]);
        },
        onError: (error: any) => {
          removeOptimistic(optimisticMessage.sid);
          setUploadPercent(0);
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
  };

  return (
    <Flex direction="column" w="70%" p={6} position="relative">
      {chat && (
        <>
          <HStack spacing={4} mb={4} align="center">
            <Avatar size="lg" name={chat.owner.name} src={chat.owner.avatar} />
            <Box>
              <Text fontWeight="bold" fontSize="2xl">
                {chat.owner.name}
              </Text>
            </Box>
          </HStack>
          <Divider mb={4} />

          {/* Mensajes */}
          <VStack
            spacing={3}
            flex={1}
            overflowY="auto"
            align="stretch"
            pr={2}
            position="relative"
          >
            {messages.map((msg) => {
              const isClinic = msg.direction === "outbound";
              return (
                <Flex
                  key={msg.sid}
                  justify={isClinic ? "flex-end" : "flex-start"}
                  w="100%"
                  mb={2}
                >
                  <Box
                    bg={isClinic ? bubbleUser : bubbleClient}
                    color={isClinic ? textUser : textClient}
                    pl={4}
                    pr={2}
                    py={1}
                    borderRadius="lg"
                    maxW="75%"
                    boxShadow="sm"
                  >
                    {msg.body && (
                      <Text mb={msg.media?.length ? 2 : 0}>{msg.body}</Text>
                    )}
                    {Array.isArray(msg.media) &&
                      msg.media.map((mediaItem, i) => (
                        <ImageFromDrive key={i} fileId={mediaItem.url} />
                      ))}
                    <HStack justify="flex-end">
                      {isClinic &&
                        (msg.status === "delivered" ? (
                          <TiTick />
                        ) : (
                          <MdAccessTime size={"12px"} />
                        ))}
                      <Text fontSize="10px" textAlign="right" mt={1}>
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </HStack>
                  </Box>
                </Flex>
              );
            })}
          </VStack>

          {/* Input */}
          <Box p={4} borderTop="1px solid #E2E8F0">
            <PreviewBar
              previews={previews}
              onRemove={(id) =>
                setPreviews((prev) => prev.filter((p) => p.id !== id))
              }
              onClear={() => setPreviews([])}
            />
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
                  <ShowTemplateButton
                    selectedPatient={chat?.owner._id}
                    onSelectTemplate={(text: string) => setInput(text)}
                  />
                </Tooltip>
                <Tooltip label="Create Templates">
                  <CreateMessageModal
                    triggerButton={
                      <IconButton
                        aria-label="Create template"
                        icon={<MdOutlinePostAdd size={20} />}
                        variant="ghost"
                        size="sm"
                      />
                    }
                  />
                </Tooltip>
                <Tooltip label="Upload">
                  <FileUploadButton
                    onFilesReady={(files) => {
                      setSelectedFiles(files);
                      setPreviews(
                        files.map((f) => ({
                          id: `${f.name}-${f.size}-${f.lastModified}`,
                          url: URL.createObjectURL(f),
                          name: f.name,
                          size: f.size,
                        }))
                      );
                    }}
                    isSending={sendChat.isPending}
                    hasText={hasText}
                  />
                </Tooltip>
                <Tooltip label="Emoji">
                  <EmojiPickerButton
                    inputRef={inputRef}
                    value={input}
                    setValue={setInput}
                  />
                </Tooltip>
              </HStack>

              <Input
                ref={inputRef}
                placeholder="Say something..."
                variant="unstyled"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                px={2}
              />

              <IconButton
                icon={<FiSend size={20} />}
                colorScheme="blue"
                onClick={handleSend}
                aria-label="Send message"
                size="lg"
                borderRadius="xl"
              />
            </Flex>
          </Box>
        </>
      )}
    </Flex>
  );
}

export default ChatWindows;
