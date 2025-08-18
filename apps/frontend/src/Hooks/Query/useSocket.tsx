import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth0 } from '@auth0/auth0-react';
import { env } from '@/types';

export const useSocket = () => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const connectSocket = async () => {
      if (isAuthenticated) {
        try {
          const token = await getAccessTokenSilently({
            authorizationParams: {
              audience: env.AUTH0_AUDIENCE,
            },
          });

          const newSocket = io(env.VITE_APP_SERVER, {
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

          setSocket(newSocket);

          return () => {
            newSocket.disconnect();
          };
        } catch (error) {
          console.error('Error al conectar socket:', error);
        }
      }
    };

    connectSocket();
  }, [getAccessTokenSilently, isAuthenticated]);

  return {
    socket,
    connected,
  };
};
