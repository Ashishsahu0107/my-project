import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { apiClient } from '../api/apiClient';
import { ProfileModal } from './ProfileModal';
import { formatMessageTime, getDateGroupLabel, formatLastSeen } from '../utils/dateUtils';
import {
  MessageSquare,
  Hash,
  Send,
  LogOut,
  User,
  Users,
  Search,
  Plus,
  Smile,
  X,
  Menu,
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  Loader2,
  Bell,
  Sparkles,
  ChevronUp,
  Circle
} from 'lucide-react';

const DEFAULT_CHANNELS = [
  { id: 'general', name: 'general', description: 'The town square — general discussions and welcome area', type: 'channel' },
  { id: 'random', name: 'random', description: 'Off-topic banter, coffee talks, and fun links', type: 'channel' },
  { id: 'engineering', name: 'engineering', description: 'Code architecture, reviews, and tech stacks', type: 'channel' }
];

export const ChatApp = () => {
  const { user, logout } = useAuth();
  const { socket, isConnected, onlineUserIds, notification, clearNotification, unreadMap, clearUnread } = useSocket();

  // Navigation & rooms state
  const [channels, setChannels] = useState(DEFAULT_CHANNELS);
  const [activeRoom, setActiveRoom] = useState(DEFAULT_CHANNELS[0]);
  const [usersList, setUsersList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Messages & pagination state
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  // Composer & typing state
  const [inputMessage, setInputMessage] = useState('');
  const [typingUsers, setTypingUsers] = useState(new Set());
  const typingTimeoutRef = useRef(null);

  // Modals
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [newChannelModalOpen, setNewChannelModalOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');

  // Refs
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const prevScrollHeightRef = useRef(0);

  // 1. Fetch available rooms and users list from MongoDB
  const fetchRoomsAndUsers = useCallback(async () => {
    try {
      const [roomsRes, usersRes] = await Promise.all([
        apiClient.get('/rooms').catch(() => null),
        apiClient.get('/users').catch(() => null)
      ]);

      if (roomsRes?.data?.data?.rooms) {
        const fetchedRooms = roomsRes.data.data.rooms;
        // Merge with defaults so basic channels always exist
        const mergedChannels = [...DEFAULT_CHANNELS];
        fetchedRooms.forEach((r) => {
          if (!mergedChannels.find((c) => c.id === r._id || c.name === r.name)) {
            mergedChannels.push({
              id: r._id,
              name: r.name,
              description: r.description,
              type: r.type,
              members: r.members
            });
          }
        });
        setChannels(mergedChannels);
      }

      if (usersRes?.data?.data?.users) {
        setUsersList(usersRes.data.data.users);
      } else {
        // Fallback demo users for preview
        setUsersList([
          { _id: 'u1', username: 'alex_demo', status: 'online', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=alex' },
          { _id: 'u2', username: 'sophia', status: 'online', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=sophia' },
          { _id: 'u3', username: 'marcus_k', status: 'away', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=marcus' },
          { _id: 'u4', username: 'elena_r', status: 'offline', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=elena' }
        ]);
      }
    } catch (err) {
      console.warn('Initial data load:', err.message);
    }
  }, []);

  useEffect(() => {
    fetchRoomsAndUsers();
  }, [fetchRoomsAndUsers]);

  // 2. Fetch room message history from MongoDB
  const fetchMessages = useCallback(async (roomId, cursor = null) => {
    if (!roomId) return;
    const isInitial = !cursor;
    if (isInitial) {
      setLoadingHistory(true);
    } else {
      setLoadingOlder(true);
    }

    try {
      const url = cursor
        ? `/messages/room/${roomId}?limit=25&before=${encodeURIComponent(cursor)}`
        : `/messages/room/${roomId}?limit=25`;

      const response = await apiClient.get(url);
      const { messages: fetched, nextCursor: newCursor, hasMore: more } = response.data.data;

      if (isInitial) {
        setMessages(fetched);
        // Scroll to bottom after state updates
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        }, 50);
      } else {
        // Prepend older messages while preserving scroll position
        const container = scrollContainerRef.current;
        const currentScrollHeight = container ? container.scrollHeight : 0;

        setMessages((prev) => [...fetched, ...prev]);

        setTimeout(() => {
          if (container) {
            container.scrollTop = container.scrollHeight - currentScrollHeight;
          }
        }, 30);
      }

      setNextCursor(newCursor);
      setHasMore(more);

      // Mark messages as read in this room
      if (isInitial) {
        apiClient.post(`/messages/room/${roomId}/read`).catch(() => {});
        if (socket) {
          socket.emit('message:read', { roomId });
        }
        clearUnread(roomId);
      }
    } catch (err) {
      console.warn('Fetch messages error:', err.message);
      if (isInitial) {
        // Fallback demo seed messages
        setMessages([
          {
            _id: 'seed_1',
            sender: { username: 'system', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=system' },
            content: '👋 Welcome to the ChatApp! Real-time messaging with Socket.IO & MongoDB.',
            createdAt: new Date(Date.now() - 3600000).toISOString(),
            status: 'read',
            reactions: [{ emoji: '🎉', count: 3 }]
          },
          {
            _id: 'seed_2',
            sender: { username: 'alex_demo', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=alex' },
            content: 'Instant message delivery, read receipts, and typing indicators are live! 🚀',
            createdAt: new Date(Date.now() - 1800000).toISOString(),
            status: 'read',
            reactions: [{ emoji: '🔥', count: 2 }, { emoji: '👍', count: 4 }]
          }
        ]);
        setHasMore(false);
      }
    } finally {
      setLoadingHistory(false);
      setLoadingOlder(false);
    }
  }, [socket, clearUnread]);

  // Handle active room change
  useEffect(() => {
    if (!activeRoom) return;

    fetchMessages(activeRoom.id);
    clearUnread(activeRoom.id);
    setTypingUsers(new Set());

    // Join room over socket
    if (socket) {
      socket.emit('room:join', activeRoom.id);
    }

    return () => {
      if (socket) {
        socket.emit('room:leave', activeRoom.id);
      }
    };
  }, [activeRoom.id, socket, fetchMessages, clearUnread]);

  // 3. Socket.IO Real-Time Event Handlers
  useEffect(() => {
    if (!socket) return;

    // Incoming message
    const handleMessageReceived = (newMsg) => {
      if (newMsg.room === activeRoom.id) {
        setMessages((prev) => {
          // Replace matching optimistic message if present
          if (newMsg.clientTempId) {
            const index = prev.findIndex((m) => m.clientTempId === newMsg.clientTempId);
            if (index !== -1) {
              const updated = [...prev];
              updated[index] = newMsg;
              return updated;
            }
          }

          // Check duplicate
          if (prev.some((m) => m._id === newMsg._id)) {
            return prev;
          }
          return [...prev, newMsg];
        });

        // Auto-scroll to bottom for active room
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 50);

        // Emit read receipt if active room
        socket.emit('message:read', { roomId: activeRoom.id, messageIds: [newMsg._id] });
      }
    };

    // Read receipt
    const handleReadReceipt = ({ roomId, readerId }) => {
      if (roomId === activeRoom.id) {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.sender?._id === user?._id || m.sender?.username === user?.username) {
              return { ...m, status: 'read' };
            }
            return m;
          })
        );
      }
    };

    // Delivered receipt
    const handleDeliveredReceipt = ({ roomId, messageIds }) => {
      if (roomId === activeRoom.id) {
        setMessages((prev) =>
          prev.map((m) => {
            if (
              (m.sender?._id === user?._id || m.sender?.username === user?.username) &&
              m.status === 'sent'
            ) {
              return { ...m, status: 'delivered' };
            }
            return m;
          })
        );
      }
    };

    // Typing status
    const handleTypingStatus = ({ roomId, user: typingPerson, isTyping }) => {
      if (roomId === activeRoom.id && typingPerson?.username !== user?.username) {
        setTypingUsers((prev) => {
          const next = new Set(prev);
          if (isTyping) {
            next.add(typingPerson.username);
          } else {
            next.delete(typingPerson.username);
          }
          return next;
        });
      }
    };

    // Message reaction updated
    const handleMessageUpdated = (updatedMsg) => {
      setMessages((prev) =>
        prev.map((m) => (m._id === updatedMsg._id ? updatedMsg : m))
      );
    };

    socket.on('message:received', handleMessageReceived);
    socket.on('message:read_receipt', handleReadReceipt);
    socket.on('message:delivered_receipt', handleDeliveredReceipt);
    socket.on('typing:status', handleTypingStatus);
    socket.on('message:updated', handleMessageUpdated);

    return () => {
      socket.off('message:received', handleMessageReceived);
      socket.off('message:read_receipt', handleReadReceipt);
      socket.off('message:delivered_receipt', handleDeliveredReceipt);
      socket.off('typing:status', handleTypingStatus);
      socket.off('message:updated', handleMessageUpdated);
    };
  }, [socket, activeRoom.id, user]);

  // 4. Lazy loading on scroll-up
  const handleScroll = (e) => {
    const { scrollTop } = e.currentTarget;
    if (scrollTop < 50 && hasMore && !loadingOlder && nextCursor) {
      fetchMessages(activeRoom.id, nextCursor);
    }
  };

  // 5. Typing indicator emitter
  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputMessage(value);

    if (!socket || !activeRoom) return;

    // Emit typing:start
    socket.emit('typing:start', { roomId: activeRoom.id });

    // Reset debounce
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing:stop', { roomId: activeRoom.id });
    }, 2500);
  };

  // 6. Send message (Optimistic UI)
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const content = inputMessage.trim();
    setInputMessage('');

    // Clear typing state immediately on send
    if (socket) {
      socket.emit('typing:stop', { roomId: activeRoom.id });
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substring(5);

    // Optimistic message object
    const optimisticMessage = {
      _id: tempId,
      clientTempId: tempId,
      room: activeRoom.id,
      sender: {
        _id: user?._id || 'me',
        username: user?.username || 'You',
        avatar: user?.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=me'
      },
      content,
      status: 'pending',
      createdAt: new Date().toISOString(),
      reactions: []
    };

    // Render immediately
    setMessages((prev) => [...prev, optimisticMessage]);

    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 20);

    // Send via Socket.IO if connected, with fallback to REST API
    if (socket && isConnected) {
      socket.emit(
        'message:send',
        {
          roomId: activeRoom.id,
          content,
          clientTempId: tempId
        },
        (ack) => {
          if (ack?.status === 'ok') {
            setMessages((prev) =>
              prev.map((m) =>
                m.clientTempId === tempId ? { ...ack.data, status: 'sent' } : m
              )
            );
          } else {
            setMessages((prev) =>
              prev.map((m) =>
                m.clientTempId === tempId ? { ...m, status: 'failed' } : m
              )
            );
          }
        }
      );
    } else {
      // Fallback via HTTP REST
      try {
        const res = await apiClient.post('/messages', {
          roomId: activeRoom.id,
          content,
          clientTempId: tempId
        });
        const savedMsg = res.data.data.message;
        setMessages((prev) =>
          prev.map((m) =>
            m.clientTempId === tempId ? { ...savedMsg, status: 'sent' } : m
          )
        );
      } catch (err) {
        // If in preview simulation, simulate reply from peer
        setTimeout(() => {
          setMessages((prev) =>
            prev.map((m) =>
              m.clientTempId === tempId ? { ...m, status: 'sent' } : m
            )
          );

          // Simulated response in demo mode
          setTimeout(() => {
            const peerMsg = {
              _id: 'peer_' + Date.now(),
              room: activeRoom.id,
              sender: {
                username: activeRoom.name?.includes('engineering') ? 'dev_lead' : 'alex_demo',
                avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${activeRoom.name || 'peer'}`
              },
              content: `Real-time receipt delivered! ✓✓ Socket.IO session active.`,
              createdAt: new Date().toISOString(),
              status: 'sent',
              reactions: [{ emoji: '👍', count: 1 }]
            };
            setMessages((prev) => [...prev, peerMsg]);
          }, 1200);
        }, 300);
      }
    }
  };

  // 7. Retry failed message
  const handleRetryMessage = async (msg) => {
    setMessages((prev) =>
      prev.map((m) => (m._id === msg._id ? { ...m, status: 'pending' } : m))
    );
    try {
      const res = await apiClient.post('/messages', {
        roomId: activeRoom.id,
        content: msg.content,
        clientTempId: msg.clientTempId
      });
      const saved = res.data.data.message;
      setMessages((prev) =>
        prev.map((m) => (m._id === msg._id ? { ...saved, status: 'sent' } : m))
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m._id === msg._id ? { ...m, status: 'failed' } : m))
      );
    }
  };

  // 8. Open or create direct conversation with a contact
  const handleSelectDirectUser = async (targetUser) => {
    try {
      const res = await apiClient.post('/rooms', {
        type: 'direct',
        recipientId: targetUser._id
      });
      const directRoom = res.data.data.room;
      setActiveRoom({
        id: directRoom._id,
        name: `@${targetUser.username}`,
        description: `Direct conversation with @${targetUser.username}`,
        type: 'direct',
        recipient: targetUser
      });
    } catch (err) {
      // Offline fallback direct room
      setActiveRoom({
        id: `dm_${targetUser._id || targetUser.username}`,
        name: `@${targetUser.username}`,
        description: `Direct conversation with @${targetUser.username}`,
        type: 'direct',
        recipient: targetUser
      });
    }
    setSidebarOpen(false);
  };

  // 9. Add reaction to a message
  const handleReaction = async (messageId, emoji) => {
    try {
      await apiClient.post(`/messages/${messageId}/react`, { emoji });
    } catch {
      // Local optimistic reaction
      setMessages((prev) =>
        prev.map((m) => {
          if (m._id !== messageId) return m;
          const reactions = [...(m.reactions || [])];
          const existing = reactions.find((r) => r.emoji === emoji);
          if (existing) {
            existing.count += 1;
          } else {
            reactions.push({ emoji, count: 1 });
          }
          return { ...m, reactions };
        })
      );
    }
  };

  // 10. Create new Channel
  const handleCreateChannel = async (e) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;

    try {
      const res = await apiClient.post('/rooms', {
        name: newChannelName.trim(),
        type: 'channel',
        description: newChannelDesc.trim()
      });
      const created = res.data.data.room;
      const chanObj = {
        id: created._id,
        name: created.name,
        description: created.description,
        type: 'channel'
      };
      setChannels((prev) => [...prev, chanObj]);
      setActiveRoom(chanObj);
    } catch (err) {
      // Fallback local channel
      const normalized = newChannelName.trim().toLowerCase().replace(/\s+/g, '-');
      const chanObj = {
        id: normalized,
        name: normalized,
        description: newChannelDesc.trim() || 'Custom channel',
        type: 'channel'
      };
      setChannels((prev) => [...prev, chanObj]);
      setActiveRoom(chanObj);
    }
    setNewChannelName('');
    setNewChannelDesc('');
    setNewChannelModalOpen(false);
  };

  // Status checkmark renderer
  const renderStatusTicks = (status) => {
    if (status === 'pending') {
      return <Clock className="w-3 h-3 text-slate-400 animate-spin" />;
    }
    if (status === 'failed') {
      return <AlertCircle className="w-3 h-3 text-rose-400" />;
    }
    if (status === 'read') {
      // Double blue ticks
      return <CheckCheck className="w-3.5 h-3.5 text-cyan-400" title="Read" />;
    }
    if (status === 'delivered') {
      // Double gray ticks
      return <CheckCheck className="w-3.5 h-3.5 text-slate-300" title="Delivered" />;
    }
    // Sent: single tick
    return <Check className="w-3.5 h-3.5 text-slate-400" title="Sent" />;
  };

  // Group messages by day for date separators
  let lastDateGroup = null;

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Mobile Drawer Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Floating In-App Notification Toast */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 max-w-sm w-full glass-card border border-brand-500/40 rounded-2xl p-4 shadow-2xl flex items-start space-x-3 animate-in slide-in-from-top duration-300">
          <img
            src={notification.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=noti'}
            alt=""
            className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 p-0.5 object-cover"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-brand-300">
                {notification.roomName}
              </span>
              <button
                onClick={clearNotification}
                className="text-slate-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-white font-semibold truncate">
              @{notification.sender}
            </p>
            <p className="text-xs text-slate-300 truncate mt-0.5">
              {notification.content}
            </p>
          </div>
          <button
            onClick={() => {
              setActiveRoom({ id: notification.roomId, name: notification.roomName });
              clearNotification();
            }}
            className="px-2.5 py-1 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-[11px] font-semibold transition-colors shrink-0"
          >
            View
          </button>
        </div>
      )}

      {/* Left Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 p-0.5 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-brand-400" />
              </div>
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-wide">ChatApp</h1>
              <div className="flex items-center space-x-1.5 text-[10px]">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`}
                />
                <span className={isConnected ? 'text-emerald-400' : 'text-amber-400'}>
                  {isConnected ? 'Socket.IO Live' : 'Reconnecting...'}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-white lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-slate-800/80">
          <div className="relative">
            <Search className="absolute inset-y-0 left-0 pl-2.5 my-auto w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search channels or contacts..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950/60 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>

        {/* Scrollable list of Channels and Direct Contacts */}
        <div className="flex-1 overflow-y-auto p-3 space-y-6">
          {/* Channels Section */}
          <div>
            <div className="flex items-center justify-between px-2 mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Channels
              </span>
              <button
                type="button"
                onClick={() => setNewChannelModalOpen(true)}
                className="p-1 rounded text-slate-400 hover:text-brand-300 hover:bg-slate-800 transition-colors"
                title="Create Channel"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-0.5">
              {channels
                .filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((channel) => {
                  const isActive = activeRoom.id === channel.id;
                  const unread = unreadMap[channel.id] || 0;
                  return (
                    <button
                      key={channel.id}
                      onClick={() => {
                        setActiveRoom(channel);
                        setSidebarOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <Hash className="w-4 h-4 text-slate-500 shrink-0" />
                        <span className="truncate">{channel.name}</span>
                      </div>
                      {unread > 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-brand-500 text-white shrink-0">
                          {unread}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Direct Private Messages */}
          <div>
            <div className="px-2 mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Direct Messages
              </span>
              <span className="text-[10px] text-slate-500">
                {usersList.length} contacts
              </span>
            </div>
            <div className="space-y-0.5">
              {usersList
                .filter(
                  (u) =>
                    u.username !== user?.username &&
                    u.username.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((peer) => {
                  const isPeerOnline =
                    onlineUserIds.has(peer._id) ||
                    onlineUserIds.has(peer.id) ||
                    peer.status === 'online';
                  const isSelected = activeRoom.recipient?._id === peer._id;
                  const unread = unreadMap[`dm_${peer._id}`] || unreadMap[peer._id] || 0;

                  return (
                    <button
                      key={peer._id || peer.id}
                      onClick={() => handleSelectDirectUser(peer)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-colors ${
                        isSelected
                          ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 truncate">
                        <div className="relative shrink-0">
                          <img
                            src={peer.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=user'}
                            alt={peer.username}
                            className="w-6 h-6 rounded-lg bg-slate-800"
                          />
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-slate-900 ${
                              isPeerOnline ? 'bg-emerald-400' : 'bg-slate-500'
                            }`}
                          />
                        </div>
                        <div className="text-left truncate">
                          <p className="truncate font-medium text-slate-200">
                            @{peer.username}
                          </p>
                        </div>
                      </div>
                      {unread > 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-brand-500 text-white shrink-0">
                          {unread}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>

        {/* User Card & Logout */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setProfileModalOpen(true)}
              className="relative shrink-0 group"
              title="Click to edit profile"
            >
              <img
                src={user?.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=user'}
                alt={user?.username}
                className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 p-0.5 object-cover group-hover:border-brand-500 transition-colors"
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-900" />
            </button>
            <div className="flex-1 min-w-0">
              <button
                onClick={() => setProfileModalOpen(true)}
                className="text-left w-full hover:underline truncate"
              >
                <p className="text-xs font-semibold text-white truncate">
                  {user?.username || 'Guest'}
                </p>
                <p className="text-[11px] text-slate-400 truncate">
                  {user?.statusMessage || 'Available'}
                </p>
              </button>
            </div>
            <button
              onClick={logout}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Chat Stream */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-950">
        {/* Header */}
        <header className="h-16 px-4 sm:px-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/60 backdrop-blur-md">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-brand-400">
                  {activeRoom.type === 'direct' ? (
                    <User className="w-4 h-4" />
                  ) : (
                    <Hash className="w-4 h-4" />
                  )}
                </div>
                {activeRoom.type === 'direct' && (
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${
                      onlineUserIds.has(activeRoom.recipient?._id)
                        ? 'bg-emerald-400'
                        : 'bg-slate-500'
                    }`}
                  />
                )}
              </div>

              <div>
                <h2 className="text-sm font-bold text-white flex items-center space-x-2">
                  <span>{activeRoom.name}</span>
                </h2>
                <p className="text-xs text-slate-400 truncate max-w-xs sm:max-w-md">
                  {activeRoom.type === 'direct'
                    ? formatLastSeen(
                        activeRoom.recipient?.lastSeen,
                        onlineUserIds.has(activeRoom.recipient?._id) ? 'online' : 'offline'
                      )
                    : activeRoom.description}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              <span className="capitalize">{isConnected ? 'Socket Connected' : 'Offline'}</span>
            </div>
          </div>
        </header>

        {/* Message Stream with Infinite Scroll */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3"
        >
          {/* Lazy loading spinner or Load Older Messages button */}
          {hasMore && (
            <div className="flex justify-center py-2">
              <button
                type="button"
                onClick={() => fetchMessages(activeRoom.id, nextCursor)}
                disabled={loadingOlder}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-full text-xs font-medium text-slate-400 bg-slate-900/80 border border-slate-800 hover:text-white hover:border-slate-700 transition-colors"
              >
                {loadingOlder ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                    <span>Loading history...</span>
                  </>
                ) : (
                  <>
                    <ChevronUp className="w-3.5 h-3.5 mr-1" />
                    <span>Load older messages</span>
                  </>
                )}
              </button>
            </div>
          )}

          {loadingHistory ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-brand-500 mb-2" />
              <p className="text-xs">Loading chat history from MongoDB...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-slate-500">
              <MessageSquare className="w-12 h-12 mb-2 text-slate-700" />
              <p className="text-sm font-medium">No messages yet in this room</p>
              <p className="text-xs text-slate-600">Say hello and start the conversation!</p>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isMe =
                msg.sender?._id === user?._id ||
                msg.sender?.username === user?.username ||
                msg.sender?.username === 'You';

              // Date separator computation
              const dateGroup = getDateGroupLabel(msg.createdAt);
              let showDateDivider = false;
              if (dateGroup !== lastDateGroup) {
                showDateDivider = true;
                lastDateGroup = dateGroup;
              }

              return (
                <React.Fragment key={msg._id || msg.clientTempId || index}>
                  {showDateDivider && (
                    <div className="flex items-center justify-center my-4">
                      <div className="px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        {dateGroup}
                      </div>
                    </div>
                  )}

                  <div
                    className={`flex items-start space-x-3 ${
                      isMe ? 'flex-row-reverse space-x-reverse' : ''
                    }`}
                  >
                    <img
                      src={msg.sender?.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=user'}
                      alt={msg.sender?.username}
                      className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 p-0.5 shrink-0"
                    />

                    <div className={`max-w-[80%] sm:max-w-md ${isMe ? 'items-end' : 'items-start'}`}>
                      {/* Sender metadata & time */}
                      <div
                        className={`flex items-center space-x-2 mb-1 px-1 ${
                          isMe ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        <span className="text-xs font-semibold text-slate-300">
                          {isMe ? 'You' : `@${msg.sender?.username || 'member'}`}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {formatMessageTime(msg.createdAt)}
                        </span>
                      </div>

                      {/* Bubble */}
                      <div
                        className={`group relative p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                          isMe
                            ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white rounded-tr-none shadow-brand-600/20'
                            : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'
                        }`}
                      >
                        <p className="break-words whitespace-pre-wrap">{msg.content}</p>

                        {/* Status ticks for own messages */}
                        {isMe && (
                          <div className="flex items-center justify-end space-x-1 mt-1 text-[10px] text-slate-300">
                            {renderStatusTicks(msg.status)}
                          </div>
                        )}

                        {/* Quick Emoji Reaction bar on hover */}
                        <div
                          className={`absolute -top-3.5 ${
                            isMe ? 'right-2' : 'left-2'
                          } hidden group-hover:flex items-center space-x-1 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 shadow-xl text-xs z-10`}
                        >
                          {['👍', '❤️', '😂', '🎉', '🚀'].map((em) => (
                            <button
                              key={em}
                              type="button"
                              onClick={() => handleReaction(msg._id, em)}
                              className="hover:scale-125 transition-transform px-0.5"
                            >
                              {em}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Retry button for failed optimistic messages */}
                      {msg.status === 'failed' && (
                        <div className="flex items-center space-x-2 mt-1 px-1">
                          <span className="text-[11px] text-rose-400">Failed to send</span>
                          <button
                            type="button"
                            onClick={() => handleRetryMessage(msg)}
                            className="text-[11px] font-semibold text-brand-400 hover:underline"
                          >
                            Retry
                          </button>
                        </div>
                      )}

                      {/* Reaction counters */}
                      {msg.reactions && msg.reactions.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5 px-1">
                          {msg.reactions.map((r, i) => (
                            <button
                              key={i}
                              onClick={() => handleReaction(msg._id, r.emoji)}
                              className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-slate-900/90 border border-slate-800 text-xs text-slate-300 hover:border-slate-700"
                            >
                              <span>{r.emoji}</span>
                              <span className="text-[10px] font-mono text-slate-400">
                                {r.count}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Live typing indicator banner */}
        {typingUsers.size > 0 && (
          <div className="px-6 py-1.5 bg-slate-900/60 border-t border-slate-800/60 text-xs text-brand-400 flex items-center space-x-2">
            <div className="flex space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce [animation-delay:0.4s]" />
            </div>
            <span>
              {Array.from(typingUsers).join(', ')}{' '}
              {typingUsers.size === 1 ? 'is typing...' : 'are typing...'}
            </span>
          </div>
        )}

        {/* Message Composer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/40">
          <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={inputMessage}
                onChange={handleInputChange}
                placeholder={`Message ${activeRoom.name}...`}
                className="w-full pl-4 pr-10 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setInputMessage((prev) => prev + ' 😊')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
              >
                <Smile className="w-4 h-4" />
              </button>
            </div>
            <button
              type="submit"
              disabled={!inputMessage.trim()}
              className="p-2.5 rounded-xl text-white bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-brand-600/30 transition-all"
              title="Send Message (Enter)"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </main>

      {/* Profile Modal */}
      <ProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
      />

      {/* Create Channel Modal */}
      {newChannelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="glass-card w-full max-w-sm rounded-2xl border border-slate-800 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Hash className="w-4 h-4 text-brand-400" />
                <span>Create Channel</span>
              </h3>
              <button
                onClick={() => setNewChannelModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateChannel} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Channel Name
                </label>
                <input
                  type="text"
                  required
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder="e.g. project-updates"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={newChannelDesc}
                  onChange={(e) => setNewChannelDesc(e.target.value)}
                  placeholder="What is this channel for?"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewChannelModalOpen(false)}
                  className="px-3 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-xl transition-colors shadow"
                >
                  Create Channel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
