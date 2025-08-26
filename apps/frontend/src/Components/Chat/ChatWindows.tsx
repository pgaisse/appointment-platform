import { Flex, HStack, Avatar, Box, Divider, VStack, Tooltip, IconButton, Input, Text, useColorModeValue, useToast } from '@chakra-ui/react';
import { useRef, useState } from 'react'
import { FiSend } from 'react-icons/fi';
import { MdOutlinePostAdd } from 'react-icons/md';
import CreateMessageModal from './CustomMessages/CreateCustomMessageModal';
import EmojiPickerButton from './CustomMessages/EmojiPickerButton';
import ShowTemplateButton from './CustomMessages/ShowTemplateButton';
import { FileUploadButton } from './FileUploadButton';
import { ImageFromDrive } from './ImageFromDrive';
import PreviewBar from './PreviewBar';
import { useMessages } from '@/Hooks/Query/useMessages';
import { ConversationChat, LocalMessage } from '@/types';
import { useSendChatMessage } from '@/Hooks/Query/useSendChatMessage';
import { formatToE164 } from '@/Functions/formatToE164';

type PreviewItem = { id: string; url: string; name: string; size: number };
type Props = {
    chat: ConversationChat | undefined
}

function ChatWindows({ chat }: Props) {
    const page = 1;
    const { data: dataMessages } = useMessages(chat?chat.conversationId:"", page, 20);
    const [] = useState<Record<string, LocalMessage[]>>({});
    const [currentAuthor] = useState<string>('');
    const [input, setInput] = useState('');
    const [, setUploadPercent] = useState(0);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [previews, setPreviews] = useState<PreviewItem[]>([]);

    const sendChat = useSendChatMessage();
    const hasText = input.trim().length > 0;
    const toast = useToast();


    const bubbleClient = useColorModeValue('gray.100', 'gray.700');
    const bubbleUser = useColorModeValue('blue.100', 'blue.600');
    const textUser = useColorModeValue('gray.900', 'white');
    const textClient = useColorModeValue('gray.900', 'white');


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
        const hasFiles = Array.isArray(selectedFiles) && selectedFiles.length > 0;

        if (!hasText && !hasFiles) return;

        const messageText = input.trim();

        // reset UI
        //setInput("");
        //setPreviews([]);
        //setSelectedFiles([]);

        sendChat.mutate(
            {
                to: formatToE164(chat.owner.phone),
                appId,
                body: messageText,
                files: hasFiles ? selectedFiles : [],
                onProgress: (p: number) => setUploadPercent(p),
            },
            {
                onSuccess: () => {
                    setUploadPercent(0);
                    toast({
                        title: hasFiles ? "Media sent" : "Message sent",
                        status: "success",
                        duration: 2000,
                        position: "bottom-right",
                    });
                },
                onError: (error: any) => {
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


    const handleFilesReady = (files: File[]) => {
        const items = files.map((f) => ({
            id: `${f.name}-${f.size}-${f.lastModified}-${crypto.randomUUID()}`,
            url: URL.createObjectURL(f),
            name: f.name,
            size: f.size,
        }));
        setSelectedFiles(files);
        setPreviews(items);
    };
    const removePreview = (id: string) => {
        setPreviews((prev) => {
            const tgt = prev.find(p => p.id === id);
            if (tgt) URL.revokeObjectURL(tgt.url);
            const next = prev.filter(p => p.id !== id);
            // refleja en selectedFiles por índice (mismo orden)
            const keptIds = new Set(next.map(n => n.id));
            setSelectedFiles((fs) =>
                fs.filter((_, idx) => keptIds.has(prev[idx].id))
            );
            return next;
        });
    };
    const clearPreviews = () => {
        setPreviews((prev) => {
            prev.forEach(p => URL.revokeObjectURL(p.url));
            return [];
        });
        setSelectedFiles([]);
    };

    return (
        <>
            <Flex direction="column" w="70%" p={6} position="relative">
                {chat && (
                    <>
                        <HStack spacing={4} mb={4} align="center">
                            <Avatar size="lg" name={chat.owner.name} src={chat.owner.avatar} />
                            <Box>
                                <Text fontWeight="bold" fontSize="2xl">{chat.owner.name}</Text>
                                {// <Text fontSize="sm" color="gray.500">Online</Text>
                                }
                            </Box>
                        </HStack>
                        <Divider mb={4} />

                        <VStack spacing={3} flex={1} overflowY="auto" align="stretch" pr={2}>
                            {dataMessages?.messages.map((msg, idx) => {
                                const isClinic = msg.direction === "outbound";
                                return (
                                    <Flex key={idx} justify={isClinic ? 'flex-end' : 'flex-start'} w="100%">
                                        <Box
                                            bg={isClinic ? bubbleUser : bubbleClient}
                                            color={isClinic ? textUser : textClient}
                                            px={5}
                                            py={3}
                                            borderRadius="lg"
                                            borderBottomRightRadius={isClinic ? '0' : 'lg'}
                                            borderBottomLeftRadius={isClinic ? 'lg' : '0'}
                                            maxW="70%"
                                            boxShadow="md"
                                            fontSize="md"
                                            fontWeight={"normal"}
                                        >
                                            {/* Mostrar el body si existe */}
                                            {msg.body && <Text mb={msg.media?.length ? 3 : 0}>{`${msg.body} (${msg.author})`}</Text>}

                                            {/* Mostrar imágenes si existen */}
                                            {Array.isArray(msg.media) &&
                                                msg.media.map((mediaItem, i) => (
                                                    <ImageFromDrive key={i} fileId={mediaItem.url} />
                                                ))}
                                        </Box>
                                    </Flex>
                                );
                            })}
                            <Box ref={scrollRef} />
                        </VStack>

                        <Box p={4} borderTop="1px solid #E2E8F0">
                            <PreviewBar
                                previews={previews}
                                onRemove={removePreview}
                                onClear={clearPreviews}
                            />
                            <Flex borderRadius="lg" border="1px solid #CBD5E0" px={3} py={2} align="center" gap={2} bg="white">
                                {/* Left Icons */}
                                <HStack spacing={1}>
                                    <Tooltip label="Custom Messages">
                                        <ShowTemplateButton selectedPatient={chat?.owner._id} onSelectTemplate={(text: string) => setInput(text)} />
                                    </Tooltip>
                                    <Tooltip label="Create Templates">
                                        <CreateMessageModal
                                            triggerButton={<IconButton
                                                aria-label="Create template"
                                                icon={<MdOutlinePostAdd size={20} />}
                                                variant="ghost"
                                                size="sm"
                                            />}
                                        />
                                    </Tooltip>

                                    <Tooltip label="Emoji">
                                        <FileUploadButton onFilesReady={handleFilesReady}
                                            isSending={sendChat.isPending}   // si usas React Query
                                            hasText={hasText} /></Tooltip>
                                    <Tooltip label="Emoji">
                                        <EmojiPickerButton inputRef={inputRef} value={input} setValue={setInput} />
                                    </Tooltip>
                                </HStack>

                                {/* Input */}
                                <Input
                                    ref={inputRef}
                                    placeholder="Say something..."
                                    variant="unstyled"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                    px={2}
                                />

                                {/* Send */}
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
        </>
    )
}

export default ChatWindows