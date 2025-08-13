import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth0 } from '@auth0/auth0-react';
import { ChatMessage } from '@/types';


interface SocketData<T = any> {
  event: string;
  payload: T;
}

export const useCustomChat = () => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<SocketData<ChatMessage> | null>(null);

  useEffect(() => {
    let newSocket: Socket;

    const connect = async () => {
      if (!isAuthenticated) return;

      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE as string,
        },
      });

      newSocket = io(import.meta.env.VITE_APP_SERVER as string, {
        transports: ['websocket'],
        auth: {
          token: `Bearer ${token}`,
        },
      });

      newSocket.on('connect', () => {
        setConnected(true);
        console.log('✅ Socket conectado:', newSocket.id);
      });

      newSocket.on('disconnect', () => {
        setConnected(false);
        console.log('❌ Socket desconectado');
      });

      newSocket.onAny((event, payload) => {
        setLastMessage({ event, payload });
      });

      setSocket(newSocket);
    };

    connect();

    return () => {
      if (newSocket) newSocket.disconnect();
    };
  }, [getAccessTokenSilently, isAuthenticated]);

  return { socket, connected, lastMessage };
};