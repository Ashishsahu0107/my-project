import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_URL } from '../api/client';
import { useAuth } from './AuthContext';

const SocketContext = createContext<{ socket: Socket | null; isConnected: boolean; onlineIds: Set<string> }>({ socket: null, isConnected: false, onlineIds: new Set() });

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { accessToken, user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!accessToken || !user) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
      return;
    }

    const next = io(API_URL, { auth: { token: accessToken }, transports: ['websocket', 'polling'] });
    socketRef.current = next;
    setSocket(next);

    next.on('connect', () => setIsConnected(true));
    next.on('disconnect', () => setIsConnected(false));
    next.on('users:online_list', (ids: string[]) => setOnlineIds(new Set(ids)));
    next.on('user:status', ({ userId, status }: { userId: string; status: string }) => {
      setOnlineIds((current) => {
        const copy = new Set(current);
        status === 'online' ? copy.add(userId) : copy.delete(userId);
        return copy;
      });
    });

    return () => { next.disconnect(); socketRef.current = null; };
  }, [accessToken, user]);

  return <SocketContext.Provider value={{ socket, isConnected, onlineIds }}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}
