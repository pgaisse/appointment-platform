import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth0 } from '@auth0/auth0-react';

export const useSocket = () => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let disposed = false;
    const connectSocket = async () => {
      if (!isAuthenticated) return;
      try {
        const token = await getAccessTokenSilently({
          authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
        });
        const newSocket = io(import.meta.env.VITE_APP_SERVER_SOCKET, {
          transports: ['websocket'],
          auth: { token: `Bearer ${token}` },
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 2000,
          reconnectionDelayMax: 10000,
        });

        newSocket.on('connect', () => !disposed && setConnected(true));
        newSocket.on('disconnect', () => !disposed && setConnected(false));
        newSocket.on('connect_error', (err) => {
          // Avoid console spam, log concise message
          console.warn('Socket connect_error:', err?.message || err);
        });
        newSocket.on('error', (err) => {
          console.warn('Socket error:', err);
        });

        if (!disposed) setSocket(newSocket);
      } catch (error) {
        console.error('Error al conectar socket:', error);
      }
    };

    connectSocket();
    return () => {
      disposed = true;
      if (socket) socket.disconnect();
    };
  }, [getAccessTokenSilently, isAuthenticated]);

  return {
    socket,
    connected,
  };
};
