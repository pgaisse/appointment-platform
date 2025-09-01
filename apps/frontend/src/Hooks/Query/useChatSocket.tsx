import { useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth0 } from "@auth0/auth0-react";
import { Message } from "@/types";

let socket: Socket | null = null;

export const useChatSocket = (
  orgId: string,
  onNewMessage: (msg: Message) => void,
  onMessageUpdated: (msg: Message) => void
) => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  useEffect(() => {
    if (!isAuthenticated || !orgId) return;

    let isMounted = true;

    const connectSocket = async () => {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });

      if (!socket) {
        socket = io(import.meta.env.VITE_APP_SERVER_SOCKET, {
          transports: ["websocket"],
          path: "/socket.io/",
          auth: { token: `Bearer ${token}` },
        });

        socket.on("connect", () =>
          console.log("[Socket] ✅ Connected:", socket?.id)
        );
        socket.on("disconnect", (reason) =>
          console.log("[Socket] ❌ Disconnected:", reason)
        );
      }

      if (isMounted) {
        // registrar handlers
        const handleNew = (msg: Message) => {
          console.log("[Socket] 🔔 newMessage:", msg);
          onNewMessage(msg);
        };
        const handleUpdated = (msg: Message) => {
          console.log("[Socket] 🔄 messageUpdated:", msg);
          onMessageUpdated(msg);
        };

        socket.on("newMessage", handleNew);
        socket.on("messageUpdated", handleUpdated);

        // cleanup
        return () => {
          socket?.off("newMessage", handleNew);
          socket?.off("messageUpdated", handleUpdated);
        };
      }
    };

    const promise = connectSocket();

    return () => {
      isMounted = false;
      promise.then((cleanup) => cleanup && cleanup());
    };
  }, [isAuthenticated, getAccessTokenSilently, orgId, onNewMessage, onMessageUpdated]);
};
