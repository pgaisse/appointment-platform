import { ConversationChat } from '@/types';
import { Box, VStack, HStack, Avatar, Stack, Skeleton, Text } from '@chakra-ui/react';
import React, { } from 'react'
import { useConversations } from '@/Hooks/Query/useConversations';
import { FaUserAlt } from 'react-icons/fa';

type Props = {
    setChat: React.Dispatch<React.SetStateAction<ConversationChat | undefined>>
    dataConversation: ConversationChat[] | undefined
    isLoadingConversation: boolean
}

function MessageList({ setChat, dataConversation, isLoadingConversation }: Props) {
   

    return (


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
                        <Avatar size="md" name={contact.owner.unknown?undefined:contact.owner?.name || contact.lastMessage?.author} src={contact.owner?.avatar} icon={contact.owner?.unknown ? <FaUserAlt fontSize="1.5rem" /> : undefined} />
                        <Box>
                            <Text fontWeight="semibold">{contact.owner.name}</Text>
                            <Text fontSize="sm" color="gray.500" noOfLines={1}>
                                {(() => {
                                    if (contact.lastMessage?.body) return contact.lastMessage.body;
                                    if (contact.lastMessage?.media?.length) return "📷 Photo";
                                    return "";
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

    )
}

export default MessageList
