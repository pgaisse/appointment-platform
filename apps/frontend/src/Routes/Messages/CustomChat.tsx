import {
    Flex,
} from '@chakra-ui/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ConversationChat, LocalMessage } from '@/types';
import { useAuth0 } from '@auth0/auth0-react';
import MessageList from '@/Components/Chat/MessageList';
import ChatWindows from '@/Components/Chat/ChatWindows';


export default function CustomChat() {

    const [chat, setChat] = useState<ConversationChat>()




    const [selectedContact] = useState<string>("");
    const [conversations] = useState<Record<string, LocalMessage[]>>({});
    const [, setCurrentAuthor] = useState<string>('');
    const scrollRef = useRef<HTMLDivElement | null>(null);


    const { user } = useAuth0();

    const org_id = user?.org_id.toLowerCase();


    console.log("chat Seleccionado: ", chat)
    useEffect(() => {
        if (org_id) {
            setCurrentAuthor(org_id);
        }
    }, [org_id]);



    useLayoutEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'auto' }); // o "smooth" si lo prefieres
    }, [conversations, selectedContact]);




    return (
        <Flex h="80%" w="90%" mt={5} mx="auto" borderRadius="2xl" overflow="hidden" shadow="2xl">
            {/* Sidebar */}
            <MessageList setChat={setChat} />

            {/* Chat Window */}
            <ChatWindows chat={chat} />

        </Flex>
    );
}
