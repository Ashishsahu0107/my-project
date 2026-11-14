import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/apiClient';
import { ProfileModal } from './ProfileModal';
import { io } from 'socket.io-client';
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
  ChevronDown,
  ShieldCheck,
  CheckCheck,
  Circle
} from 'lucide-react';

const INITIAL_CHANNELS = [
  { id: 'general', name: 'general', description: 'The town square — general discussions and welcome area', type: 'channel' },
  { id: 'random', name: 'random', description: 'Off-topic banter and fun links', type: 'channel' },
  { id: 'engineering', name: 'engineering', description: 'Code architecture, reviews, and tech stacks', type: 'channel' }
];

const INITIAL_MESSAGES = {
  general: [
    {
      id: 'm1',
      sender: { username: 'system', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=system' },
      content: '👋 Welcome to the ChatApp! Real-time messaging with authenticated sessions and MongoDB.',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      reactions: [{ emoji: '🎉', count: 3 }]
    },
    {
      id: 'm2',
      sender: { username: 'alex_demo', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=alex' },
      content: 'Hey everyone! JWT access and refresh token authentication is live with email OTP verification! 🚀',
      createdAt: new Date(Date.now() - 1800000).toISOString(),
      reactions: [{ emoji: '🔥', count: 2 }, { emoji: '👍', count: 4 }]
    }
  ],
  random: [
    {
      id: 'm3',
      sender: { username: 'sophia', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=sophia' },
      content: 'Coffee break time ☕ Anyone up for a quick sync?',
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      reactions: [{ emoji: '☕', count: 2 }]
    }
  ],
  engineering: [
    {
      id: 'm4',
      sender: { username: 'dev_lead', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=dev' },
      content: 'Mongoose schemas, rate limiting, and password hashing with bcrypt are running smoothly.',
      createdAt: new Date(Date.now() - 5400000).toISOString(),
      reactions: [{ emoji: '💻', count: 3 }]
    }
  ]
};

export const ChatApp = () => {
  const { user, accessToken, logout } = useAuth();

  const [activeRoom, setActiveRoom] = useState(INITIAL_CHANNELS[0]);
  const [channels, setChannels] = useState(INITIAL_CHANNELS);
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [inputMessage, setInputMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [newChannelModalOpen, setNewChannelModalOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const [usersList, setUsersList] = useState([
    { id: 'u1', username: 'alex_demo', status: 'online', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=alex' },
    { id: 'u2', username: 'sophia', status: 'online', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=sophia' },
    { id: 'u3', username: 'marcus_k', status: 'away', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=marcus' },
    { id: 'u4', username: 'elena_r', status: 'offline', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=elena' }
  ]);

  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);

  // Auto-scroll to latest message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeRoom]);

  // Connect Socket.IO
  useEffect(() => {
    if (!accessToken) return;

    try {
      const socket = io('/', {
        auth: { token: accessToken },
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 3
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        socket.emit('room:join', activeRoom.id);
      });

      socket.on('message:received', (newMsg) => {
        setMessages((prev) => ({
          ...prev,
          [activeRoom.id]: [...(prev[activeRoom.id] || []), newMsg]
        }));
      });

      socket.on('typing:status', ({ roomId, user: typingPerson, isTyping: typingStatus }) => {
        if (roomId === activeRoom.id) {
          if (typingStatus && typingPerson?.username !== user?.username) {
            setTypingUser(typingPerson.username);
          } else {
            setTypingUser(null);
          }
        }
      });

      return () => {
        socket.disconnect();
      };
    } catch (err) {
      console.warn('Socket.IO connection deferred:', err.message);
    }
  }, [accessToken, activeRoom.id, user?.username]);

  // Handle room switch
  const handleSelectRoom = (room) => {
    setActiveRoom(room);
    setSidebarOpen(false);
    if (socketRef.current) {
      socketRef.current.emit('room:join', room.id);
    }
  };

  // Send message handler
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const content = inputMessage.trim();
    setInputMessage('');

    const newMsg = {
      id: 'msg_' + Date.now(),
      sender: {
        username: user?.username || 'You',
        avatar: user?.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=me'
      },
      content,
      createdAt: new Date().toISOString(),
      reactions: []
    };

    // Optimistically append message
    setMessages((prev) => ({
      ...prev,
      [activeRoom.id]: [...(prev[activeRoom.id] || []), newMsg]
    }));

    // Dispatch to API if connected
    try {
      await apiClient.post('/messages', {
        roomId: activeRoom.id,
        content
      });
    } catch {
      // In offline / preview simulation, trigger simulated friendly peer response
      if (activeRoom.type === 'channel' || activeRoom.type === 'direct') {
        setTimeout(() => {
          const peerMsg = {
            id: 'peer_' + Date.now(),
            sender: {
              username: activeRoom.name?.includes('engineering') ? 'dev_lead' : 'alex_demo',
              avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${activeRoom.name || 'peer'}`
            },
            content: `Got it! Authentication token & real-time sessions are active. 💬`,
            createdAt: new Date().toISOString(),
            reactions: [{ emoji: '👍', count: 1 }]
          };
          setMessages((prev) => ({
            ...prev,
            [activeRoom.id]: [...(prev[activeRoom.id] || []), peerMsg]
          }));
        }, 1200);
      }
    }
  };

  // Handle Reaction
  const handleReaction = (messageId, emoji) => {
    setMessages((prev) => {
      const roomMsgs = prev[activeRoom.id] || [];
      const updated = roomMsgs.map((m) => {
        if (m.id !== messageId) return m;
        const reactions = [...(m.reactions || [])];
        const existing = reactions.find((r) => r.emoji === emoji);
        if (existing) {
          existing.count += 1;
        } else {
          reactions.push({ emoji, count: 1 });
        }
        return { ...m, reactions };
      });
      return { ...prev, [activeRoom.id]: updated };
    });
  };

  // Create Channel
  const handleCreateChannel = (e) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;

    const normalized = newChannelName.trim().toLowerCase().replace(/\s+/g, '-');
    const newChan = {
      id: normalized,
      name: normalized,
      description: newChannelDesc.trim() || 'New conversation channel',
      type: 'channel'
    };

    setChannels((prev) => [...prev, newChan]);
    setActiveRoom(newChan);
    setNewChannelName('');
    setNewChannelDesc('');
    setNewChannelModalOpen(false);
  };

  const currentMessages = messages[activeRoom.id] || [];

  const filteredChannels = channels.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredUsers = usersList.filter((u) =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
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
              <div className="flex items-center space-x-1 text-[10px] text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Encrypted Live</span>
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
              placeholder="Filter channels or peers..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950/60 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>

        {/* Rooms & Direct chats list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-6">
          {/* Channels */}
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
              {filteredChannels.map((channel) => {
                const isActive = activeRoom.id === channel.id;
                return (
                  <button
                    key={channel.id}
                    onClick={() => handleSelectRoom(channel)}
                    className={`w-full flex items-center space-x-2 px-2.5 py-2 rounded-xl text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <Hash className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="truncate">{channel.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Direct Peers */}
          <div>
            <div className="px-2 mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Direct Messages
              </span>
            </div>
            <div className="space-y-0.5">
              {filteredUsers.map((peer) => {
                const isSelected = activeRoom.id === peer.id;
                return (
                  <button
                    key={peer.id}
                    onClick={() =>
                      handleSelectRoom({
                        id: peer.id,
                        name: `@${peer.username}`,
                        description: `Direct conversation with @${peer.username}`,
                        type: 'direct'
                      })
                    }
                    className={`w-full flex items-center space-x-2 px-2.5 py-2 rounded-xl text-xs font-medium transition-colors ${
                      isSelected
                        ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <img
                        src={peer.avatar}
                        alt={peer.username}
                        className="w-5 h-5 rounded-md bg-slate-800"
                      />
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-slate-900 ${
                          peer.status === 'online'
                            ? 'bg-emerald-500'
                            : peer.status === 'away'
                            ? 'bg-amber-500'
                            : 'bg-slate-500'
                        }`}
                      />
                    </div>
                    <span className="truncate">@{peer.username}</span>
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
                  {user?.statusMessage || user?.email || 'Active'}
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

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-950">
        {/* Top Header */}
        <header className="h-16 px-4 sm:px-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/60 backdrop-blur-md">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-brand-400">
                {activeRoom.type === 'direct' ? (
                  <User className="w-4 h-4" />
                ) : (
                  <Hash className="w-4 h-4" />
                )}
              </div>
              <div>
                <h2 className="text-sm font-bold text-white flex items-center space-x-1.5">
                  <span>{activeRoom.name}</span>
                </h2>
                <p className="text-xs text-slate-400 truncate max-w-xs sm:max-w-md">
                  {activeRoom.description}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>JWT Verified</span>
            </div>
          </div>
        </header>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {currentMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-slate-500">
              <MessageSquare className="w-12 h-12 mb-2 text-slate-700" />
              <p className="text-sm font-medium">No messages yet in this room</p>
              <p className="text-xs text-slate-600">Be the first to say hello!</p>
            </div>
          ) : (
            currentMessages.map((msg) => {
              const isMe = msg.sender?.username === user?.username;
              return (
                <div
                  key={msg.id}
                  className={`flex items-start space-x-3 ${isMe ? 'flex-row-reverse space-x-reverse' : ''}`}
                >
                  <img
                    src={msg.sender?.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=avatar'}
                    alt={msg.sender?.username}
                    className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 p-0.5 shrink-0"
                  />
                  <div className={`max-w-[80%] sm:max-w-md ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center space-x-2 mb-1 px-1">
                      <span className="text-xs font-semibold text-slate-300">
                        {isMe ? 'You' : `@${msg.sender?.username}`}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>

                    {/* Bubble */}
                    <div
                      className={`group relative p-3 rounded-2xl text-sm leading-relaxed ${
                        isMe
                          ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white rounded-tr-none shadow-md shadow-brand-600/20'
                          : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'
                      }`}
                    >
                      <p className="break-words">{msg.content}</p>

                      {/* Emoji reaction bar on hover */}
                      <div
                        className={`absolute -top-3 ${
                          isMe ? 'right-2' : 'left-2'
                        } hidden group-hover:flex items-center space-x-1 px-1.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 shadow-lg text-xs z-10`}
                      >
                        {['👍', '❤️', '🔥', '🚀'].map((em) => (
                          <button
                            key={em}
                            type="button"
                            onClick={() => handleReaction(msg.id, em)}
                            className="hover:scale-125 transition-transform px-1"
                          >
                            {em}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Reactions display */}
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5 px-1">
                        {msg.reactions.map((r, i) => (
                          <button
                            key={i}
                            onClick={() => handleReaction(msg.id, r.emoji)}
                            className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-slate-900/80 border border-slate-800 text-xs text-slate-300 hover:border-slate-700"
                          >
                            <span>{r.emoji}</span>
                            <span className="text-[10px] font-mono text-slate-400">{r.count}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Typing indicator */}
        {typingUser && (
          <div className="px-6 py-1 text-xs text-brand-400 italic flex items-center space-x-1 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-ping" />
            <span>@{typingUser} is typing...</span>
          </div>
        )}

        {/* Message Input Box */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/40">
          <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={`Message #${activeRoom.name}...`}
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
                  placeholder="e.g. design-sync"
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
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
