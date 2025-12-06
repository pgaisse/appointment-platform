import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth0 } from '@auth0/auth0-react';

// Singleton socket instance - only connect once globally
let socketInstance: Socket | null = null;
let connectionPromise: Promise<Socket> | null = null;

export const useSocket = () => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const initSocket = async () => {
      if (!isAuthenticated) return;

      // If socket already exists, reuse it
      if (socketInstance) {
        if (mountedRef.current) {
          setSocket(socketInstance);
          setConnected(socketInstance.connected);
        }
        return;
      }

      // If connection is in progress, wait for it
      if (connectionPromise) {
        try {
          const sock = await connectionPromise;
          if (mountedRef.current) {
            setSocket(sock);
            setConnected(sock.connected);
          }
        } catch (err) {
          console.warn('Socket connection failed:', err);
        }
        return;
      }

      // Delay socket connection by 2s to prioritize initial UI render
      connectionPromise = new Promise((resolve, reject) => {
        setTimeout(async () => {
          try {
            const token = await getAccessTokenSilently({
              authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
            });

            const newSocket = io(import.meta.env.VITE_APP_SERVER_SOCKET, {
              transports: ['websocket'], // Skip polling, use websocket directly
              auth: { token: `Bearer ${token}` },
              reconnection: true,
              reconnectionAttempts: 5,
              reconnectionDelay: 2000,
              reconnectionDelayMax: 10000,
              timeout: 10000,
            });

            newSocket.on('connect', () => {
              console.log('✅ Socket connected');
              if (mountedRef.current) setConnected(true);
            });

            newSocket.on('disconnect', () => {
              console.log('❌ Socket disconnected');
              if (mountedRef.current) setConnected(false);
            });

            newSocket.on('connect_error', (err) => {
              console.warn('Socket connect_error:', err?.message || err);
              if (mountedRef.current) setConnected(false);
            });

            newSocket.on('error', (err) => {
              console.warn('Socket error:', err);
            });

            socketInstance = newSocket;
            if (mountedRef.current) setSocket(newSocket);
            resolve(newSocket);
          } catch (error) {
            console.error('Error al conectar socket:', error);
            reject(error);
          }
        }, 2000); // 2s delay - let critical UI load first
      });

      try {
        await connectionPromise;
      } catch (err) {
        connectionPromise = null;
      }
    };

    initSocket();

    return () => {
      mountedRef.current = false;
      // Don't disconnect on unmount - keep singleton alive
    };
  }, [getAccessTokenSilently, isAuthenticated]);

  return {
    socket,
    connected,
  };
};
