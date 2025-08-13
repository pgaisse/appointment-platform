import {
    Box,
    Flex,
    Avatar,
    Text,
    Input,
    IconButton,
    VStack,
    HStack,
    Divider,
    useColorModeValue,
    Tooltip,
    Stack,
    Skeleton,
    useToast,
} from '@chakra-ui/react';
import { FiSend } from 'react-icons/fi';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useCustomChat } from '@/Hooks/Query/useCustomChat';
import { useWebhookData } from '@/Hooks/Query/useWebhookData';
import { ChatMessage, Conversation, LocalMessage } from '@/types';
import NewChatButton from '@/Components/Chat/NewChatButton';
import { useAuth0 } from '@auth0/auth0-react';
import { formatToE164 } from '@/Functions/formatToE164';
import EmojiPickerButton from '@/Components/Chat/CustomMessages/EmojiPickerButton';
import ShowTemplateButton from '@/Components/Chat/CustomMessages/ShowTemplateButton';
import CreateMessageModal from '@/Components/Chat/CustomMessages/CreateCustomMessageModal';
import { MdOutlinePostAdd } from 'react-icons/md';
import { ImageFromDrive } from '@/Components/Chat/ImageFromDrive';
import { FileUploadButton } from '@/Components/Chat/FileUploadButton';
import { useSendChatMessage } from '@/Hooks/Query/useSendChatMessage';
import PreviewBar from '@/Components/Chat/PreviewBar';


type PreviewItem = { id: string; url: string; name: string; size: number };


export default function CustomChat() {
    const [contacts, setContacts] = useState<ChatMessage[]>([]);
    const [selectedContact, setSelectedContact] = useState<ChatMessage | null>(null);
    const [conversations, setConversations] = useState<Record<string, LocalMessage[]>>({});
    const [currentAuthor, setCurrentAuthor] = useState<string>('');
    const [input, setInput] = useState('');
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [uploadPercent, setUploadPercent] = useState(0);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [previews, setPreviews] = useState<PreviewItem[]>([]);

    const toast = useToast();
    const hasText = input.trim().length > 0;
    const { socket } = useCustomChat();
    const { data, isLoading } = useWebhookData<Conversation[]>({});
    const sendChat = useSendChatMessage();
    const { user } = useAuth0();

    const org_id = user?.org_id.toLowerCase();

    const bg = useColorModeValue('gray.50', 'gray.900');
    const sidebarBg = useColorModeValue('white', 'gray.800');
    const bubbleClient = useColorModeValue('gray.100', 'gray.700');
    const bubbleUser = useColorModeValue('blue.100', 'blue.600');
    const textUser = useColorModeValue('gray.900', 'white');
    const textClient = useColorModeValue('gray.900', 'white');

    useEffect(() => {
        if (org_id) {
            setCurrentAuthor(org_id);
        }
    }, [org_id]);

    useEffect(() => {
        if (!data || !Array.isArray(data)) return;
        const enrichedContacts: ChatMessage[] = [];
        const initialConversations: Record<string, LocalMessage[]> = {};
        const seenPhones = new Set<string>();
        console.log("FrontEnd Data", data)
        data.forEach((conv: Conversation) => {
            if (!Array.isArray(conv.chatmessage)) return; // ⛑ Previene el error
            const convAppId = (conv as any).appId ?? (conv as any).app_id ?? (conv as any)._id ?? '';

            conv.chatmessage.forEach((msg) => {
                const sid = msg.sid?.trim();
                const phone = msg.phone?.trim();
                const name = msg.name?.trim();
                const body = msg.body?.trim();
                const author = msg.author;
                const avatar = msg.avatar?.trim();
                const nextToken = msg.nextToken?.trim();
                const messageSid = msg.messageSid
                const lastMessage = msg.lastMessage
                const appId =
                    msg.appId ??
                    convAppId ??
                    (msg as any).app_id ??
                    (msg as any)._id ??
                    '';
                const media = Array.isArray(msg.media) ? msg.media : []
                if (!phone || !author) return;

                if (!seenPhones.has(phone)) {
                    seenPhones.add(phone);
                    enrichedContacts.push({
                        sid,
                        phone,
                        name: conv.name || name || phone,
                        avatar,
                        body,
                        author,
                        lastMessage,
                        nextToken,
                        appId,
                        messageSid,
                        dateCreated: msg.dateCreated,
                        media
                    });
                }

                if (!initialConversations[phone]) {
                    initialConversations[phone] = [];
                }

                initialConversations[phone].push({ author, body, sid, media });
            });
        });
        setContacts(enrichedContacts);
        setConversations(initialConversations);
    }, [data]);


    useLayoutEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'auto' }); // o "smooth" si lo prefieres
    }, [conversations, selectedContact]);

    useEffect(() => {
        if (!socket) return; // ← Esto ahora no retorna del useEffect

        const handleSMS = (data: Conversation[]) => {
            const incoming = data[0];
            if (!Array.isArray(incoming?.chatmessage)) return;

            const latestMsg = incoming.chatmessage[0];
            const phone = latestMsg.phone?.trim();
            const messageSid = latestMsg.messageSid;
            const appId = latestMsg.appId ?? (incoming as any).appId ?? (incoming as any).app_id ?? (incoming as any)._id ?? '';

            if (!phone || !messageSid) return;

            setContacts((prevContacts) => {
                const filtered = prevContacts.filter((c) => c.phone !== phone);
                const newContact: ChatMessage = {
                    sid: latestMsg.sid?.trim(),
                    phone,
                    name: incoming.name || latestMsg.name || phone,
                    avatar: latestMsg.avatar?.trim(),
                    body: latestMsg.body || '',
                    author: latestMsg.author,
                    nextToken: latestMsg.nextToken?.trim(),
                    appId, // ✅ intentamos rellenarlo también aquí
                    dateCreated: latestMsg.dateCreated,
                    messageSid: latestMsg.messageSid,
                    lastMessage: latestMsg.lastMessage,
                    media: latestMsg.media ?? [],
                };
                return [newContact, ...filtered];
            });



            setConversations((prev) => {
                const updated = { ...prev };
                const previousMessages = updated[phone] || [];

                const alreadyExists = previousMessages.some(
                    (m) => (m as any).messageSid === messageSid
                );
                if (!alreadyExists) {
                    updated[phone] = [
                        ...previousMessages,
                        {
                            author: latestMsg.author,
                            body: latestMsg.body,
                            sid: messageSid,
                            media: latestMsg.media ?? []
                        },
                    ];
                }

                return updated;
            });
        };

        socket.on("smsReceived", handleSMS);
        return () => {
            socket.off("smsReceived", handleSMS);
        };
    }, [socket]);




    const handleSend = () => {
        if (!selectedContact) return;

        const appId = selectedContact.appId;
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

        // ❌ Regla: no permitir texto + archivos al mismo tiempo
        if (hasText && hasFiles) {
            toast({
                title: "Choose one",
                description: "Send a message OR attach files, not both.",
                status: "warning",
                position: "bottom-right",
            });
            return;
        }

        // ✅ Solo TEXTO
        if (hasText) {

            // Optimistic UI solo para texto
            const optimistic = { author: currentAuthor, body: input.trim() };
            setInput(""); // restaurar input
            setConversations((prev: any) => ({
                ...prev,
                [selectedContact.phone]: [...(prev[selectedContact.phone] || []), optimistic],
            }));

            sendChat.mutate(
                {
                    to: formatToE164(selectedContact.phone),
                    appId,
                    body: input.trim(),
                },
                {
                    onSuccess: () => {
                        setInput("");
                        toast({
                            title: "Message sent",
                            status: "success",
                            duration: 2000,
                            position: "bottom-right",
                        });
                    },
                    onError: (error: any) => {
                        // revertir optimista
                        setConversations((prev: any) => {
                            const list = (prev[selectedContact.phone] || []).slice();
                            list.pop();
                            return { ...prev, [selectedContact.phone]: list };
                        });
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

            return; // terminamos flujo texto
        }

        // ✅ Solo ARCHIVOS
        if (hasFiles) {
            setInput(""); // restaurar input
            setSelectedFiles([]);
            sendChat.mutate(
                {
                    to: formatToE164(selectedContact.phone),
                    appId,
                    files: selectedFiles,
                    // onProgress es opcional; coméntalo si no usas barra de progreso:
                    onProgress: (p) => setUploadPercent?.(p),
                },
                {
                    onSuccess: () => {
                        setSelectedFiles([]);
                        setUploadPercent?.(0);
                        toast({
                            title: "Media sent",
                            status: "success",
                            duration: 2000,
                            position: "bottom-right",
                        });

                    },
                    onError: (error: any) => {
                        setUploadPercent?.(0);
                        console.error("Error sending media:", error);
                        toast({
                            title: "Failed to send media",
                            description: error?.message || "Unexpected error",
                            status: "error",
                            position: "bottom-right",
                        });

                    },
                }
            );
        }
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

    // limpiar todos
    const clearPreviews = () => {
        setPreviews((prev) => {
            prev.forEach(p => URL.revokeObjectURL(p.url));
            return [];
        });
        setSelectedFiles([]);
    };

    return (
        <Flex h="80%" w="90%" mt={5} mx="auto" bg={bg} borderRadius="2xl" overflow="hidden" shadow="2xl">
            {/* Sidebar */}
            <Box w="30%" bg={sidebarBg} p={6} borderRightWidth="1px">
                <Text fontSize="2xl" fontWeight="bold" mb={6}>Messages</Text>
                <NewChatButton
                    currentAuthor={currentAuthor}
                    setContacts={setContacts}
                    setConversations={setConversations}
                    setSelectedContact={setSelectedContact}
                />
                <VStack align="stretch" spacing={4}>
                    {!isLoading && contacts ? contacts.map((contact, index) => {
                        return (
                            <HStack
                                key={`${contact.phone}-${index}`}
                                p={3}
                                borderRadius="xl"
                                transition="all 0.2s ease"
                                bg={selectedContact?.phone === contact.phone ? 'blue.50' : 'transparent'}
                                _hover={{ bg: 'blue.100' }}
                                cursor="pointer"
                                onClick={() => setSelectedContact(contact)}
                            >
                                <Avatar size="md" name={contact.name} src={contact.avatar} />
                                <Box>
                                    <Text fontWeight="semibold">{contact.name}</Text>
                                    <Text fontSize="sm" color="gray.500" noOfLines={1}>
                                        {(() => {
                                            const lastMsg = (conversations[contact.phone] || []).slice(-1)[0];
                                            if (lastMsg?.body) return lastMsg.body;
                                            if (lastMsg.media && lastMsg?.media?.length > 0) return "📷 Photo";
                                            return contact.body;
                                        })()}
                                    </Text>
                                </Box>
                            </HStack>
                        )
                    }) :
                        <Stack>
                            <Skeleton borderRadius="xl" height='60px' m={2} />
                            <Skeleton borderRadius="xl" height='60px' m={2} />
                            <Skeleton borderRadius="xl" height='60px' m={2} />
                        </Stack>
                    }
                </VStack>
            </Box>

            {/* Chat Window */}
            <Flex direction="column" w="70%" p={6} position="relative">
                {selectedContact && (
                    <>
                        <HStack spacing={4} mb={4} align="center">
                            <Avatar size="lg" name={selectedContact.name} src={selectedContact.avatar} />
                            <Box>
                                <Text fontWeight="bold" fontSize="2xl">{selectedContact.name}</Text>
                                {// <Text fontSize="sm" color="gray.500">Online</Text>
                                }
                            </Box>
                        </HStack>
                        <Divider mb={4} />

                        <VStack spacing={3} flex={1} overflowY="auto" align="stretch" pr={2}>
                            {(conversations[selectedContact.phone] || []).map((msg, idx) => {
                                console.log("selectedContact", selectedContact)
                                const isClinic = msg.author === currentAuthor;
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
                                            {msg.body && <Text mb={msg.media?.length ? 3 : 0}>{msg.body}</Text>}

                                            {/* Mostrar imágenes si existen */}
                                            {Array.isArray(msg.media) &&
                                                msg.media.map((mediaItem, i) => (
                                                    <ImageFromDrive key={i} fileId={mediaItem.filename} />
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
                                        <ShowTemplateButton selectedPatient={selectedContact?.appId} onSelectTemplate={(text: string) => setInput(text)} />
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
        </Flex>
    );
}
