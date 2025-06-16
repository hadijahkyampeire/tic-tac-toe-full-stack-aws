import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  connectSocket,
  sendMessage as wsSendMessage,
  reconnectSocket,
} from '../lib/websocket';

type WebSocketContextType = {
  sendMessage: (msg: object) => void;
  connected: boolean;
  status: string;
  reconnect: () => void;
};

const WebSocketContext = createContext<WebSocketContextType | undefined>(
  undefined
);

type Props = {
  children: React.ReactNode;
};

export const WebSocketProvider: React.FC<Props> = ({ children }) => {
  const [status, setStatus] = useState<
    'connected' | 'disconnected' | 'connecting...'
  >('disconnected');

  useEffect(() => {
    const tryConnect = () => {
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('WebSocketProvider: No token yet, retrying...');
        setTimeout(tryConnect, 500);
        return;
      }
      connectSocket(() => {}, setStatus);
    };

    tryConnect();
  }, []);

  const reconnect = () => {
    reconnectSocket(() => {}, setStatus);
  };

  const sendMessage = (msg: object) => wsSendMessage(msg);

  return (
    <WebSocketContext.Provider
      value={{ sendMessage, connected: status === 'connected', status, reconnect }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const ctx = useContext(WebSocketContext);
  if (!ctx)
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  return ctx;
};
