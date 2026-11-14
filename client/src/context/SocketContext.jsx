import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { playNotificationSound } from '../utils/sound';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { accessToken, user, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());
  const [notification, setNotification] = useState(null);
  const [unreadMap, setUnreadMap] = useState({}); // roomId -> count

  const socketRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;

    const newSocket = io(socketUrl, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('Socket.IO connected [id:', newSocket.id, ']');
    });

    newSocket.on('disconnect', (reason) => {
      setIsConnected(false);
      console.log('Socket.IO disconnected:', reason);
    });

    newSocket.on('connect_error', (err) => {
      setIsConnected(false);
      console.warn('Socket connection error:', err.message);
    });

    // Initial online users list
    newSocket.on('users:online_list', (ids) => {
      setOnlineUserIds(new Set(ids));
    });

    // Real-time user presence updates
    newSocket.on('user:status', ({ userId, status }) => {
      setOnlineUserIds((prev) => {
        const updated = new Set(prev);
        if (status === 'online') {
          updated.add(userId);
        } else {
          updated.delete(userId);
        }
        return updated;
      });
    });

    // Global notifications for messages when not looking at that room
    newSocket.on('notification:new_message', ({ roomId, roomName, roomType, message }) => {
      playNotificationSound();

      // Increment unread count for that room
      setUnreadMap((prev) => ({
        ...prev,
        [roomId]: (prev[roomId] || 0) + 1
      }));

      // Show in-app banner toast
      setNotification({
        id: Date.now(),
        roomId,
        roomName: roomName || (roomType === 'direct' ? `@${message.sender?.username}` : 'Chat'),
        sender: message.sender?.username || 'Someone',
        avatar: message.sender?.avatar,
        content: message.content,
        timestamp: new Date()
      });
    });

    return () => {
      newSocket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, accessToken]);

  const clearUnread = (roomId) => {
    setUnreadMap((prev) => {
      const copy = { ...prev };
      delete copy[roomId];
      return copy;
    });
  };

  const clearNotification = () => setNotification(null);

  const value = {
    socket,
    isConnected,
    onlineUserIds,
    notification,
    clearNotification,
    unreadMap,
    clearUnread
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
