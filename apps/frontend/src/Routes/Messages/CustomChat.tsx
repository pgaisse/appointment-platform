// Components/Chat/CustomChat.tsx
import { Box, Flex, Text, useColorModeValue } from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import { ConversationChat, Message } from "@/types";
import { useAuth0 } from "@auth0/auth0-react";
import MessageList from "@/Components/Chat/MessageList";
import ChatWindows from "@/Components/Chat/ChatWindows";
import NewChatButton from "@/Components/Chat/NewChatButton";
import { useChatSocket } from "@/Hooks/Query/useChatSocket";
import { useQueryClient } from "@tanstack/react-query";
import { useConversations } from "@/Hooks/Query/useConversations";

type ConversationListItem = {
  conversationId: string;
  phone: string;
  name: string;
  avatar?: string;
  lastMessage?: Message;
  chatmessage?: Message;
};

export default function CustomChat() {
  const [chat, setChat] = useState<ConversationChat | undefined>(undefined);
  const { user } = useAuth0();
  const org_id = (user as any)?.org_id?.toLowerCase?.() ?? "";
  const queryClient = useQueryClient();
 const { data: dataConversation, isLoading: isLoadingConversation } = useConversations();
 console.log("data",dataConversation)
  // Actualiza en cache la conversacion local->real
  const promoteLocalConversationId = useCallback(
    (phone: string, realConversationId: string) => {
      // 1) lista de conversaciones
      queryClient.setQueryData<ConversationListItem[]>(
        ["conversations"],
        (prev) => {
          if (!Array.isArray(prev)) return prev;
          const localId = `local-${phone}`;
          return prev.map((c) =>
            c.phone === phone || c.conversationId === localId
              ? { ...c, conversationId: realConversationId }
              : c
          );
        }
      );

      // 2) chat seleccionado
      setChat((prev) => {
        if (!prev) return prev;
        const phoneSel = (prev as any).owner?.phone || (prev as any).phone;
        const isLocal = String((prev as any).conversationId || "").startsWith("local-");
        if (phoneSel === phone && isLocal) {
          return { ...prev, conversationId: realConversationId } as any;
        }
        return prev;
      });
    },
    [queryClient]
  );

  // Si tu backend emite un evento específico
  useEffect(() => {
    const sock = (window as any)?.__chatSocket; // si tu useChatSocket no expone socket, ignora este bloque
    if (!sock) return;

    const onReady = (p: { phone: string; conversationId: string }) => {
      promoteLocalConversationId(p.phone, p.conversationId);
    };
    sock.on?.("conversationReady", onReady);
    return () => sock.off?.("conversationReady", onReady);
  }, [promoteLocalConversationId]);

  // Callbacks de tiempo real ya existentes
  useChatSocket(
    org_id,
    (msg: Message) => {
      // newMessage
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["messages", msg.conversationId] });

      // fallback: si es inbound y trae el teléfono en author, actualiza local->real
      if (msg.direction === "inbound" && msg.author) {
        const phone = msg.author; // asumes E164
        if (phone?.startsWith("+") && msg.conversationId.startsWith("CH")) {
          promoteLocalConversationId(phone, msg.conversationId);
        }
      }
    },
    (msg: Message) => {
      // messageUpdated
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["messages", msg.conversationId] });
    }
  );
  const sidebarBg = useColorModeValue('white', 'gray.800');
  console.log(setChat)
  return (
    <Box h="90%" w="100%">
      <Flex
        h="full"
        mt={5}
        mx="auto"
        borderRadius="2xl"
        overflow="hidden"
        shadow="sm"
      >
        {/* Sidebar */}
        <Box w="30%" bg={sidebarBg} p={6} borderRightWidth="1px">
          <Text fontSize="2xl" fontWeight="bold" mb={6}>Messages</Text>
          <NewChatButton setChat={setChat} dataConversation={dataConversation}  />

          <MessageList setChat={setChat} dataConversation={dataConversation} isLoadingConversation={isLoadingConversation}/>
        </Box>

        {/* Chat Window */}
        <ChatWindows chat={chat} isOpen={!!chat} />
      </Flex>
    </Box>
  );
}
