import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_URL } from '../api/client';
import { useAuth } from './AuthContext';
import { useSettings } from './SettingsContext';

const SOCKET_URL =
  process.env.EXPO_PUBLIC_SOCKET_URL?.trim()?.replace(/\/$/, '') || API_URL;

const SocketContext = createContext<{ socket: Socket | null; isConnected: boolean; onlineIds: Set<string> }>({ socket: null, isConnected: false, onlineIds: new Set() });

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { accessToken, user, logout, syncUser } = useAuth();
  const { applySyncedSettings } = useSettings();
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

    const next = io(SOCKET_URL, { auth: { token: accessToken }, transports: ['websocket', 'polling'] });
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
    next.on('auth:force_logout', () => {
      logout().catch(() => {});
    });
    next.on('user:profile_updated', ({ userId, user: updatedUser }: { userId: string; user: any }) => {
      const currentId = String(user?.id || user?._id || '');
      if (currentId && String(userId) === currentId && updatedUser) {
        syncUser(updatedUser).catch(() => {});
      }
    });
    next.on('user:settings_updated', ({ settings }: { settings: any }) => {
      if (settings) {
        applySyncedSettings(settings).catch(() => {});
      }
    });

    return () => { next.disconnect(); socketRef.current = null; };
  }, [accessToken, user]);

  return <SocketContext.Provider value={{ socket, isConnected, onlineIds }}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}
