import { useSocket } from '@/Hooks/Query/useSocket';
import { useEffect, useState } from 'react';

type MSG = {
  from: string;
  body: string;
  receivedAt: Date;
};

export const SmsListener = () => {
  const { socket, connected } = useSocket();
  const [messages, setMessages] = useState<MSG[]>([]);

  useEffect(() => {
    if (!socket || !connected) return;

    const handleSMS = (data: MSG) => {
      console.log('📬 SMS recibido desde backend:', data);
      setMessages((prev) => [...prev, data]);
    };

    socket.on('smsReceived', handleSMS);

    return () => {
      socket.off('smsReceived', handleSMS);
    };
  }, [socket, connected]);

  return (
    <div>
      <p>{connected ? '✅ Socket conectado' : '🔄 Conectando socket...'}</p>

      {messages.length === 0 && <p>📭 No hay mensajes aún</p>}

      {messages.length > 0 && (
        <ul style={{ marginTop: '1rem' }}>
          {messages.map((msg, i) => (
            <li key={i}>
              <strong>📨 De:</strong> {msg.from} <br />
              <strong>Mensaje:</strong> {msg.body}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
