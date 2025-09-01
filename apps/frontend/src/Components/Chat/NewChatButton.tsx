import React, { useState, useMemo } from 'react';
import {
    Button,
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalCloseButton,
    Input,
    VStack,
    HStack,
    Avatar,
    Text,
    useDisclosure,
    Box,
    Spinner,
} from '@chakra-ui/react';
import { FiMessageCircle } from 'react-icons/fi';
import { Appointment, ChatMessage, LocalMessage, ManualContact } from '@/types';
import { useGetCollection } from '@/Hooks/Query/useGetCollection';
import { useCustomChat } from '@/Hooks/Query/useCustomChat';
import { AddContactButton } from './AddContactButton';
import { ManualContactFormModal } from './ManualContactFormModal';

type Props = {
    setContacts: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
    setConversations: React.Dispatch<React.SetStateAction<Record<string, LocalMessage[]>>>;
    setSelectedContact: React.Dispatch<React.SetStateAction<ChatMessage | null>>;
    currentAuthor: string;
};

const NewChatButton = ({ setContacts, setConversations, setSelectedContact, currentAuthor }: Props) => {
    const { isOpen, onOpen, onClose } = useDisclosure();
    const [search, setSearch] = useState('');
    const { socket, lastMessage } = useCustomChat();

    const query = {};
    const projection = { nameInput: 1, lastNameInput: 1, phoneInput: 1, sid: 1 };
    const limit = 50;

    const { data = [], isLoading } = useGetCollection<Appointment>('Appointment', {
        query,
        limit,
        projection,
    });


    const filteredContacts = useMemo(() => {
        return data.filter((contact) => {
            const fullName = `${contact.nameInput} ${contact.lastNameInput}`.toLowerCase();
            return (
                fullName.includes(search.toLowerCase()) ||
                contact.phoneInput.toLowerCase().includes(search.toLowerCase())
            );
        });
    }, [search, data]);

    const handleSelectContact = (contact: ManualContact) => {
        const chat: ChatMessage = {
            appId: contact._id,
            sid: contact.sid,
            phone: contact.phoneInput,
            name: `${contact.nameInput} ${contact.lastNameInput}`,
            body: '',
            avatar: '',
            author: currentAuthor,
            dateCreated: new Date().toISOString(),
            nextToken: '',
            media:[],
            lastMessage:new Date(contact.createdAt || ""),
        };

        setContacts((prev) => {
            if (!prev.find((p) => p.phone === chat.phone)) return [...prev, chat];
            return prev;
        });

        setConversations((prev) => ({
            ...prev,
            [chat.phone]: prev[chat.phone] || [],
        }));

        setSelectedContact(chat);
        socket?.emit('smsSend', {
            appId: contact._id,
            phone: contact.phoneInput,
            name: `${contact.nameInput} ${contact.lastNameInput}`,
        });

        onClose();
    };

    return (
        <>
            <Button
                leftIcon={<FiMessageCircle />}
                colorScheme="gray"
                variant="ghost"
                size="md"
                justifyContent="start"
                px={4}
                py={2}
                mb={3}
                borderRadius="lg"
                fontWeight="medium"
                fontSize="md"
                _hover={{ bg: 'gray.100' }}
                onClick={onOpen}
            >
                New Chat
            </Button>

            <Modal isOpen={isOpen} onClose={onClose} size="lg" isCentered>
                <ModalOverlay />
                <ModalContent borderRadius="2xl">
                    <ModalHeader>Start New Chat</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        <Input
                            placeholder="Search by name or phone..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            mb={2}
                            borderRadius="xl"
                        />
                        
                      
  
                        {isLoading ? (
                            <Spinner mx="auto" my={10} />
                        ) : (
                            <VStack spacing={3} align="stretch" maxH="300px" overflowY="auto">
                                {filteredContacts.map((contact) => (
                                    <HStack
                                        key={contact._id}
                                        p={3}
                                        borderRadius="lg"
                                        _hover={{ bg: 'gray.100' }}
                                        cursor="pointer"
                                        onClick={() => handleSelectContact(contact)}
                                    >
                                        <Avatar size="sm" name={`${contact.nameInput} ${contact.lastNameInput}`} />
                                        <Box>
                                            <Text fontWeight="medium">{`${contact.nameInput} ${contact.lastNameInput}`}</Text>
                                            <Text fontSize="sm" color="gray.500">
                                                {contact.phoneInput}
                                            </Text>
                                        </Box>
                                    </HStack>
                                ))}

                                {filteredContacts.length === 0 && (
                                    <Text textAlign="center" color="gray.400">
                                        No contacts found.
                                    </Text>
                                )}
                            </VStack>
                        )}
                    </ModalBody>
                </ModalContent>
            </Modal>
        </>
    );
};

export default NewChatButton;
