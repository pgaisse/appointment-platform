import { Flex } from "@chakra-ui/react";
import { useState } from "react";
import { ConversationChat, Message } from "@/types";
import { useAuth0 } from "@auth0/auth0-react";
import MessageList from "@/Components/Chat/MessageList";
import ChatWindows from "@/Components/Chat/ChatWindows";
import { useChatSocket } from "@/Hooks/Query/useChatSocket";
import { useQueryClient } from "@tanstack/react-query";

export default function CustomChat() {
  const [chat, setChat] = useState<ConversationChat>();
  const { user } = useAuth0();
  const org_id = user?.org_id?.toLowerCase();
  const queryClient = useQueryClient();

  // 📌 Socket para tiempo real
useChatSocket(
  org_id || "",
  (msg: Message) => {
    console.log("📩 newMessage recibido:", msg);

    queryClient.invalidateQueries({ queryKey: ["conversations"] });
    queryClient.invalidateQueries({ queryKey: ["messages", msg.conversationId] });
  },
  (msg: Message) => {
    console.log("📩 messageUpdated recibido:", msg);

    queryClient.invalidateQueries({ queryKey: ["conversations"] });
    queryClient.invalidateQueries({ queryKey: ["messages", msg.conversationId] });
  }
);



  return (
    <Flex
      h="80%"
      w="90%"
      mt={5}
      mx="auto"
      borderRadius="2xl"
      overflow="hidden"
      shadow="2xl"
    >
      {/* Sidebar */}
      <MessageList setChat={setChat} />

      {/* Chat Window */}
      <ChatWindows chat={chat} isOpen={true} />
    </Flex>
  );
}
