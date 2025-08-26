import { ConversationChat } from '@/types';
import { Box, VStack, HStack, Avatar, Stack, Skeleton, Text, useColorModeValue} from '@chakra-ui/react';
import React, {  } from 'react'
import NewChatButton from './NewChatButton';
import { useConversations } from '@/Hooks/Query/useConversations';

type Props = {
    setChat: React.Dispatch<React.SetStateAction<ConversationChat | undefined>>
}

function MessageList({ setChat}: Props) {
    const sidebarBg = useColorModeValue('white', 'gray.800');
    const { data: dataConversation, isLoading: isLoadingConversation } = useConversations();
    
    return (
        <Box w="30%" bg={sidebarBg} p={6} borderRightWidth="1px">
            <Text fontSize="2xl" fontWeight="bold" mb={6}>Messages</Text>
            <NewChatButton/>
            <VStack align="stretch" spacing={4}>
                {!isLoadingConversation && dataConversation ? dataConversation.map((contact: ConversationChat, index) => {

                    return (
                        <HStack
                            key={`${contact.conversationId}-${index}`}
                            p={3}
                            borderRadius="xl"
                            transition="all 0.2s ease"
                            _hover={{ bg: 'blue.100' }}
                            cursor="pointer"
                            onClick={() => setChat(contact)}
                        >
                            <Avatar size="md" name={contact.owner.name} src={contact.owner.avatar} />
                            <Box>
                                <Text fontWeight="semibold">{contact.owner.name}</Text>
                                <Text fontSize="sm" color="gray.500" noOfLines={1}>
                                    {(() => {

                                        if (contact.lastMessage?.body) return contact.lastMessage.body;
                                        if (contact.lastMessage.media && contact.lastMessage?.media?.length > 0) return "📷 Photo";
                                        return contact.lastMessage.body;
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
    )
}

export default MessageList
