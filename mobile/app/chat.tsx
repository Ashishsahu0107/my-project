import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { useSocket } from '../src/context/SocketContext';
import { useCall } from '../src/context/CallContext';
import { useSettings } from '../src/context/SettingsContext';
import { api, getApiErrorMessage } from '../src/api/client';
import { setActiveChatRoomId } from '../src/services/notifications';
import {
  ChatMessage,
  deleteMessage,
  editMessage,
  forwardMessage,
  reactToMessage,
} from '../src/services/messageService';
import { MessageActionsModal } from '../src/components/MessageActionsModal';
import { ForwardMessageModal } from '../src/components/ForwardMessageModal';
import { SearchModal } from '../src/components/SearchModal';
import { ChatActionsModal } from '../src/components/ChatActionsModal';
import { ChatSkeleton } from '../src/components/ChatSkeleton';
import { MessageBubble } from '../src/components/MessageBubble';
import { MediaAttachment, MediaPreviewModal } from '../src/components/MediaPreviewModal';
import {
  ChatFilter,
  fetchMessagesAround,
  fetchOlderMessages,
  fetchRooms,
  toggleArchiveRoom,
  toggleFavoriteRoom,
  togglePinRoom,
} from '../src/services/searchService';

type Room = {
  _id: string;
  name?: string;
  type: 'channel' | 'direct' | 'group';
  description?: string;
  members?: any[];
  avatar?: string;
  unreadCount?: number;
  isFavorite?: boolean;
  isPinned?: boolean;
  isArchived?: boolean;
  updatedAt?: string;
};

function sortRooms(list: Room[]): Room[] {
  return [...list].sort((a, b) => {
    if (Boolean(a.isPinned) !== Boolean(b.isPinned)) return a.isPinned ? -1 : 1;
    const tA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const tB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return tB - tA;
  });
}

type GroupedReaction = {
  emoji: string;
  count: number;
  reactedByMe: boolean;
};

function groupReactions(
  reactions: ChatMessage['reactions'] = [],
  currentUserId: string
): GroupedReaction[] {
  const map = new Map<string, GroupedReaction>();
  for (const r of reactions) {
    const existing = map.get(r.emoji) || { emoji: r.emoji, count: 0, reactedByMe: false };
    existing.count += 1;
    if (String(r.user) === String(currentUserId)) {
      existing.reactedByMe = true;
    }
    map.set(r.emoji, existing);
  }
  return Array.from(map.values());
}

function ChatScreen() {
  const { user, logout } = useAuth();
  const { socket } = useSocket();
  const { initiateCall } = useCall();
  const { wallpaperColor, messageFontSize, colors, t } = useSettings();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  // Advanced message action states
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null);
  const [actionsVisible, setActionsVisible] = useState(false);
  const [forwardVisible, setForwardVisible] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState<ChatMessage | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);

  // Search, filter & pagination states
  const [chatFilter, setChatFilter] = useState<ChatFilter>('all');
  const [searchVisible, setSearchVisible] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const jumpToMessageIdRef = useRef<string | null>(null);
  const { width } = useWindowDimensions();
  const maxBubbleWidth = Math.min(width * 0.78, 420);

  const [refreshing, setRefreshing] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<MediaAttachment | null>(null);
  const [chatActionsVisible, setChatActionsVisible] = useState(false);
  const [actionRoom, setActionRoom] = useState<Room | null>(null);

  const listRef = useRef<FlatList<ChatMessage>>(null);
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const { roomId: requestedRoomId } = useLocalSearchParams<{ roomId?: string }>();

  const currentUserId = String(user?.id || user?._id || '');

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(''), 2200);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const loadRooms = async (filter: ChatFilter = chatFilter) => {
    try {
      const data: Room[] = await fetchRooms(filter);
      setRooms(data);
      if (!room && data.length) {
        const requested =
          typeof requestedRoomId === 'string'
            ? data.find((item) => item._id === requestedRoomId)
            : null;
        setRoom(requested || data.find((item) => item.name === 'general') || data[0]);
      }
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Could not load conversations'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRooms(chatFilter);
  }, [chatFilter]);

  useEffect(() => {
    if (typeof requestedRoomId === 'string' && requestedRoomId && rooms.length > 0) {
      const target = rooms.find((item) => item._id === requestedRoomId);
      if (target && target._id !== room?._id) {
        setRoom(target);
      }
    }
  }, [requestedRoomId, rooms]);

  useEffect(() => {
    setActiveChatRoomId(room?._id || null);
    return () => {
      setActiveChatRoomId(null);
    };
  }, [room?._id]);

  useEffect(() => {
    if (!room) return;
    setError('');
    setReplyingTo(null);
    setEditingMessage(null);
    (async () => {
      try {
        const jumpId = jumpToMessageIdRef.current;
        if (jumpId) {
          jumpToMessageIdRef.current = null;
          const data = await fetchMessagesAround(room._id, jumpId, 30);
          setMessages(data.messages);
          setNextCursor(data.nextCursor || null);
          setHasMoreMessages(Boolean(data.hasMore));
          setHighlightedMessageId(jumpId);
          setTimeout(() => {
            const idx = data.messages.findIndex((m: ChatMessage) => m._id === jumpId);
            if (idx >= 0) {
              listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
            }
          }, 200);
          setTimeout(() => setHighlightedMessageId(null), 2600);
        } else {
          const response = await api.get(`/messages/room/${room._id}?limit=25`);
          setMessages(response.data.data.messages);
          setNextCursor(response.data.data.nextCursor || null);
          setHasMoreMessages(Boolean(response.data.data.hasMore));
        }
        socket?.emit('room:join', room._id);
      } catch (err: any) {
        setError(getApiErrorMessage(err, 'Could not load conversations'));
      }
    })();
    return () => {
      if (socket) socket.emit('room:leave', room._id);
    };
  }, [room?._id, socket]);

  const handleLoadOlder = async () => {
    if (!room || !nextCursor || loadingOlder || !hasMoreMessages) return;
    setLoadingOlder(true);
    try {
      const data = await fetchOlderMessages(room._id, nextCursor, 25);
      setMessages((current) => {
        const existingIds = new Set(current.map((m) => m._id));
        const olderUnique = (data.messages as ChatMessage[]).filter((m) => !existingIds.has(m._id));
        return [...olderUnique, ...current];
      });
      setNextCursor(data.nextCursor || null);
      setHasMoreMessages(Boolean(data.hasMore));
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Could not load earlier messages'));
    } finally {
      setLoadingOlder(false);
    }
  };

  const handleToggleFavorite = async (targetRoom: Room | null = room) => {
    if (!targetRoom) return;
    try {
      const res = await toggleFavoriteRoom(targetRoom._id);
      if (room?._id === targetRoom._id) {
        setRoom((prev) => (prev ? { ...prev, isFavorite: res.isFavorite } : prev));
      }
      setRooms((prev) => {
        const updated = prev.map((r) =>
          r._id === targetRoom._id ? { ...r, isFavorite: res.isFavorite } : r
        );
        return chatFilter === 'favorites' && !res.isFavorite
          ? updated.filter((r) => r._id !== targetRoom._id)
          : sortRooms(updated);
      });
      showToast(res.isFavorite ? 'Added to favorites' : 'Removed from favorites');
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Could not update favorite'));
    }
  };

  const handleTogglePin = async (targetRoom: Room | null = room) => {
    if (!targetRoom) return;
    try {
      const res = await togglePinRoom(targetRoom._id);
      if (room?._id === targetRoom._id) {
        setRoom((prev) => (prev ? { ...prev, isPinned: res.isPinned } : prev));
      }
      setRooms((prev) =>
        sortRooms(
          prev.map((r) => (r._id === targetRoom._id ? { ...r, isPinned: res.isPinned } : r))
        )
      );
      showToast(res.isPinned ? 'Chat pinned to top' : 'Chat unpinned');
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Could not update pin'));
    }
  };

  const handleToggleArchive = async (targetRoom: Room | null = room) => {
    if (!targetRoom) return;
    try {
      const res = await toggleArchiveRoom(targetRoom._id);
      if (room?._id === targetRoom._id) {
        setRoom((prev) => (prev ? { ...prev, isArchived: res.isArchived } : prev));
      }
      setRooms((prev) => {
        const updated = prev.map((r) =>
          r._id === targetRoom._id ? { ...r, isArchived: res.isArchived } : r
        );
        if (chatFilter === 'archived' && !res.isArchived) {
          return updated.filter((r) => r._id !== targetRoom._id);
        }
        if (chatFilter !== 'archived' && res.isArchived) {
          return updated.filter((r) => r._id !== targetRoom._id);
        }
        return sortRooms(updated);
      });
      showToast(res.isArchived ? 'Chat archived' : 'Chat unarchived');
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Could not update archive'));
    }
  };

  const handleSelectSearchMessage = (targetRoomId: string, messageId: string) => {
    jumpToMessageIdRef.current = messageId;
    const found = rooms.find((r) => r._id === targetRoomId);
    if (found) {
      if (found._id === room?._id) {
        // Already in the same room — jump immediately
        fetchMessagesAround(found._id, messageId, 30)
          .then((data) => {
            jumpToMessageIdRef.current = null;
            setMessages(data.messages);
            setNextCursor(data.nextCursor || null);
            setHasMoreMessages(Boolean(data.hasMore));
            setHighlightedMessageId(messageId);
            setTimeout(() => {
              const idx = data.messages.findIndex((m: ChatMessage) => m._id === messageId);
              if (idx >= 0) {
                listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
              }
            }, 200);
            setTimeout(() => setHighlightedMessageId(null), 2600);
          })
          .catch(() => {});
      } else {
        setRoom(found);
      }
    } else {
      setChatFilter('all');
      fetchRooms('all')
        .then((allRooms: Room[]) => {
          setRooms(allRooms);
          const match = allRooms.find((r) => r._id === targetRoomId);
          if (match) setRoom(match);
        })
        .catch(() => {});
    }
  };

  useEffect(() => {
    if (!socket) return;

    const onReceived = (message: ChatMessage & { clientTempId?: string }) => {
      setMessages((current) => {
        if (message.room && room?._id && String(message.room) !== String(room._id)) {
          return current;
        }
        const duplicate = current.some(
          (item) =>
            item._id === message._id ||
            (!!message.clientTempId && (item as any).clientTempId === message.clientTempId)
        );
        return duplicate ? current : [...current, message];
      });
    };

    const onUpdated = (updated: ChatMessage) => {
      setMessages((current) =>
        current.map((item) => (item._id === updated._id ? { ...item, ...updated } : item))
      );
    };

    const onDeleted = ({ messageId }: { messageId: string; roomId: string }) => {
      setMessages((current) =>
        current.map((item) =>
          item._id === messageId
            ? { ...item, isDeleted: true, content: 'This message was deleted', reactions: [] }
            : item
        )
      );
    };

    const onDeletedForMe = ({ messageId }: { messageId: string; roomId: string }) => {
      setMessages((current) => current.filter((item) => item._id !== messageId));
    };

    const onPreferenceUpdated = ({
      roomId: updatedRoomId,
      isFavorite,
      isPinned,
      isArchived,
    }: {
      roomId: string;
      isFavorite?: boolean;
      isPinned?: boolean;
      isArchived?: boolean;
    }) => {
      setRooms((prev) => {
        let next = prev.map((r) => {
          if (r._id !== updatedRoomId) return r;
          return {
            ...r,
            ...(isFavorite !== undefined ? { isFavorite } : {}),
            ...(isPinned !== undefined ? { isPinned } : {}),
            ...(isArchived !== undefined ? { isArchived } : {}),
          };
        });
        if (isArchived !== undefined) {
          if (chatFilter !== 'archived' && isArchived) {
            next = next.filter((r) => r._id !== updatedRoomId);
          } else if (chatFilter === 'archived' && !isArchived) {
            next = next.filter((r) => r._id !== updatedRoomId);
          }
        }
        return sortRooms(next);
      });
      setRoom((prev) => {
        if (!prev || prev._id !== updatedRoomId) return prev;
        return {
          ...prev,
          ...(isFavorite !== undefined ? { isFavorite } : {}),
          ...(isPinned !== undefined ? { isPinned } : {}),
          ...(isArchived !== undefined ? { isArchived } : {}),
        };
      });
    };

    const onNewRoomNotification = ({ roomId: notifRoomId }: { roomId: string }) => {
      if (room?._id && String(room._id) === String(notifRoomId)) return;
      setRooms((prev) =>
        prev.map((r) =>
          r._id === notifRoomId ? { ...r, unreadCount: (r.unreadCount || 0) + 1 } : r
        )
      );
    };

    socket.on('message:received', onReceived);
    socket.on('message:updated', onUpdated);
    socket.on('message:deleted', onDeleted);
    socket.on('message:deleted_for_me', onDeletedForMe);
    socket.on('room:preference_updated', onPreferenceUpdated);
    socket.on('notification:new_message', onNewRoomNotification);

    return () => {
      socket.off('message:received', onReceived);
      socket.off('message:updated', onUpdated);
      socket.off('message:deleted', onDeleted);
      socket.off('message:deleted_for_me', onDeletedForMe);
      socket.off('room:preference_updated', onPreferenceUpdated);
      socket.off('notification:new_message', onNewRoomNotification);
    };
  }, [socket, room?._id, chatFilter]);

  const sendOrSave = async () => {
    const content = text.trim();
    if (!content || !room) return;

    if (editingMessage) {
      const targetId = editingMessage._id;
      setText('');
      setEditingMessage(null);
      try {
        const updated = await editMessage(targetId, content);
        setMessages((current) =>
          current.map((item) => (item._id === updated._id ? { ...item, ...updated } : item))
        );
      } catch (err: any) {
        setError(getApiErrorMessage(err, 'Could not edit message'));
      }
      return;
    }

    const clientTempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const replyToId = replyingTo?._id || null;
    setText('');
    setReplyingTo(null);

    socket?.emit(
      'message:send',
      { roomId: room._id, content, clientTempId, replyTo: replyToId },
      (ack: any) => {
        if (ack?.status === 'ok') {
          setMessages((current) => {
            const withoutTemp = current.filter((item) => (item as any).clientTempId !== clientTempId);
            return current.some((item) => item._id === ack.data._id)
              ? current
              : [...withoutTemp, ack.data];
          });
        }
      }
    );
  };

  const handleReact = useCallback(async (messageId: string, emoji: string) => {
    try {
      const updated = await reactToMessage(messageId, emoji);
      setMessages((current) =>
        current.map((item) => (item._id === updated._id ? { ...item, ...updated } : item))
      );
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Could not react to message'));
    }
  }, []);

  const handleLongPressMessage = useCallback((msg: ChatMessage) => {
    setSelectedMessage(msg);
    setActionsVisible(true);
  }, []);

  const handlePreviewMedia = useCallback((media: MediaAttachment) => {
    setPreviewMedia(media);
  }, []);

  const handleRefresh = useCallback(async () => {
    if (!room) return;
    setRefreshing(true);
    try {
      const [roomsData, msgRes] = await Promise.all([
        fetchRooms(chatFilter),
        api.get(`/messages/room/${room._id}?limit=25`),
      ]);
      setRooms(roomsData);
      setMessages(msgRes.data.data.messages);
      setNextCursor(msgRes.data.data.nextCursor || null);
      setHasMoreMessages(Boolean(msgRes.data.data.hasMore));
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Could not refresh chat'));
    } finally {
      setRefreshing(false);
    }
  }, [room, chatFilter]);

  const keyExtractor = useCallback(
    (item: ChatMessage, index: number) => item._id || String(index),
    []
  );

  const renderMessageItem = useCallback(
    ({ item }: { item: ChatMessage }) => {
      const senderId = String(item.sender?._id || item.sender?.id || '');
      const mine = senderId === currentUserId || item.sender?.username === user?.username;
      return (
        <MessageBubble
          item={item}
          mine={mine}
          currentUserId={currentUserId}
          isHighlighted={highlightedMessageId === item._id}
          maxBubbleWidth={maxBubbleWidth}
          messageFontSize={messageFontSize}
          otherBubbleColor={colors.otherBubble}
          otherTextColor={colors.text}
          onLongPress={handleLongPressMessage}
          onReact={handleReact}
          onPreviewMedia={handlePreviewMedia}
        />
      );
    },
    [
      currentUserId,
      user?.username,
      highlightedMessageId,
      maxBubbleWidth,
      messageFontSize,
      colors.otherBubble,
      colors.text,
      handleLongPressMessage,
      handleReact,
      handlePreviewMedia,
    ]
  );

  const handleCopy = async (message: ChatMessage) => {
    await Clipboard.setStringAsync(message.content);
    showToast('Copied to clipboard');
  };

  const handleDeleteForMe = async (message: ChatMessage) => {
    try {
      await deleteMessage(message._id, 'me');
      setMessages((current) => current.filter((item) => item._id !== message._id));
      showToast('Deleted for you');
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Could not delete message'));
    }
  };

  const handleDeleteForEveryone = (message: ChatMessage) => {
    Alert.alert('Delete for everyone?', 'This message will be deleted for all participants.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMessage(message._id, 'everyone');
            setMessages((current) =>
              current.map((item) =>
                item._id === message._id
                  ? { ...item, isDeleted: true, content: 'This message was deleted', reactions: [] }
                  : item
              )
            );
          } catch (err: any) {
            setError(getApiErrorMessage(err, 'Could not delete message'));
          }
        },
      },
    ]);
  };

  const handleForwardConfirm = async (targetRoomIds: string[]) => {
    if (!forwardingMessage) return;
    try {
      await forwardMessage(forwardingMessage._id, targetRoomIds);
      showToast(`Forwarded to ${targetRoomIds.length} chat${targetRoomIds.length > 1 ? 's' : ''}`);
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Could not forward message'));
    } finally {
      setForwardingMessage(null);
    }
  };

  const isSelectedMine = useMemo(() => {
    if (!selectedMessage) return false;
    const senderId = String(selectedMessage.sender?._id || selectedMessage.sender?.id || '');
    return (
      senderId === currentUserId ||
      selectedMessage.sender?.username === user?.username
    );
  }, [selectedMessage, currentUserId, user?.username]);

  // Derive other member for direct rooms
  const otherMember =
    room?.type === 'direct'
      ? room.members?.find((m) => (m._id || m.id) !== user?.id)
      : null;
  const otherMemberId: string = otherMember?._id || otherMember?.id || '';
  const otherMemberName: string = otherMember?.username || otherMember?.name || 'User';
  const otherMemberAvatar: string | undefined = otherMember?.avatar;

  if (loading) {
    return <ChatSkeleton bgColor={colors.bg} cardColor={colors.card} />;
  }

  return (
    <SafeAreaView style={[styles.page, { backgroundColor: wallpaperColor }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={[styles.page, { backgroundColor: wallpaperColor }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 12}
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View>
            <Text style={styles.appName}>ChatApp</Text>
            <Text style={[styles.roomName, { color: colors.text }]}># {room?.name || 'Chat'}</Text>
          </View>
          <View style={styles.headerControls}>
            <Pressable onPress={() => setSearchVisible(true)} style={styles.iconBtn}>
              <Text style={styles.callBtnText}>🔍</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/settings')} style={styles.iconBtn}>
              <Text style={styles.callBtnText}>⚙️</Text>
            </Pressable>
            {room ? (
              <Pressable
                onPress={() => {
                  setActionRoom(room);
                  setChatActionsVisible(true);
                }}
                style={styles.iconBtn}
              >
                <Text style={styles.favIconText}>{room.isFavorite ? '★' : '⋯'}</Text>
              </Pressable>
            ) : null}
            {room?.type === 'direct' && otherMemberId ? (
              <>
                <Pressable
                  onPress={() =>
                    initiateCall(otherMemberId, otherMemberName, otherMemberAvatar, 'audio')
                  }
                  style={styles.callBtn}
                >
                  <Text style={styles.callBtnText}>📞</Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    initiateCall(otherMemberId, otherMemberName, otherMemberAvatar, 'video')
                  }
                  style={styles.callBtn}
                >
                  <Text style={styles.callBtnText}>📹</Text>
                </Pressable>
              </>
            ) : null}
            <Pressable onPress={() => router.push('/profile')} style={styles.profileButton}>
              <Text style={styles.profileText}>Profile</Text>
            </Pressable>
            <Pressable onPress={logout} style={styles.logout}>
              <Text style={styles.logoutText}>Logout</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.filterRow}>
          {(['all', 'unread', 'groups', 'favorites', 'archived'] as ChatFilter[]).map((f) => (
            <Pressable
              key={f}
              onPress={() => setChatFilter(f)}
              style={[styles.filterChip, chatFilter === f && styles.filterChipActive]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  chatFilter === f && styles.filterChipTextActive,
                ]}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        <FlatList
          horizontal
          data={rooms}
          keyExtractor={(item) => item._id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.roomList}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                setRoom(item);
                if (item.unreadCount && item.unreadCount > 0) {
                  setRooms((prev) =>
                    prev.map((r) => (r._id === item._id ? { ...r, unreadCount: 0 } : r))
                  );
                }
              }}
              onLongPress={() => {
                setActionRoom(item);
                setChatActionsVisible(true);
              }}
              delayLongPress={250}
              style={[styles.roomChip, room?._id === item._id && styles.roomChipActive]}
            >
              <View style={styles.roomChipInner}>
                <Text style={styles.roomChipText}>
                  {item.isPinned ? '📌 ' : ''}
                  {item.isFavorite ? '★ ' : ''}
                  {item.type === 'direct' ? '@' : '#'} {item.name || 'Direct'}
                </Text>
                {item.unreadCount && item.unreadCount > 0 ? (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>
                      {item.unreadCount > 99 ? '99+' : item.unreadCount}
                    </Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          )}
        />

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {toast ? (
          <View style={styles.toastBanner}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        ) : null}

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={keyExtractor}
          renderItem={renderMessageItem}
          contentContainerStyle={styles.messages}
          initialNumToRender={16}
          maxToRenderPerBatch={10}
          windowSize={9}
          updateCellsBatchingPeriod={40}
          removeClippedSubviews={Platform.OS === 'android'}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#6366F1"
              colors={['#6366F1']}
            />
          }
          onScrollToIndexFailed={({ index }) => {
            setTimeout(() => {
              listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
            }, 300);
          }}
          ListHeaderComponent={
            hasMoreMessages ? (
              <Pressable
                onPress={handleLoadOlder}
                disabled={loadingOlder}
                style={styles.loadOlderBtn}
              >
                {loadingOlder ? (
                  <ActivityIndicator color="#818CF8" size="small" />
                ) : (
                  <Text style={styles.loadOlderText}>Load earlier messages</Text>
                )}
              </Pressable>
            ) : undefined
          }
        />

        {(replyingTo || editingMessage) && (
          <View style={styles.composerBanner}>
            <View style={styles.composerBannerContent}>
              <Text style={styles.composerBannerTitle}>
                {editingMessage
                  ? '✏️ Editing message'
                  : `↩️ Replying to @${replyingTo?.sender?.username || 'user'}`}
              </Text>
              <Text style={styles.composerBannerPreview} numberOfLines={1}>
                {editingMessage ? editingMessage.content : replyingTo?.content}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                setReplyingTo(null);
                if (editingMessage) {
                  setEditingMessage(null);
                  setText('');
                }
              }}
              style={styles.composerBannerClose}
            >
              <Text style={styles.composerBannerCloseText}>✕</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.composer}>
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={setText}
            placeholder={
              editingMessage
                ? 'Edit your message...'
                : `Message ${room?.name || 'chat'}...`
            }
            placeholderTextColor="#64748B"
            style={styles.input}
            multiline
          />
          <Pressable
            onPress={sendOrSave}
            disabled={!text.trim()}
            style={[styles.send, !text.trim() && styles.sendDisabled]}
          >
            <Text style={styles.sendText}>{editingMessage ? t('save') : t('send')}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <MessageActionsModal
        visible={actionsVisible}
        message={selectedMessage}
        isMine={isSelectedMine}
        currentUserId={currentUserId}
        onClose={() => setActionsVisible(false)}
        onReact={(emoji) => selectedMessage && handleReact(selectedMessage._id, emoji)}
        onReply={() => {
          if (!selectedMessage) return;
          setEditingMessage(null);
          setReplyingTo(selectedMessage);
          inputRef.current?.focus();
        }}
        onCopy={() => selectedMessage && handleCopy(selectedMessage)}
        onForward={() => {
          if (!selectedMessage) return;
          setForwardingMessage(selectedMessage);
          setForwardVisible(true);
        }}
        onEdit={() => {
          if (!selectedMessage) return;
          setReplyingTo(null);
          setEditingMessage(selectedMessage);
          setText(selectedMessage.content);
          inputRef.current?.focus();
        }}
        onDeleteForMe={() => selectedMessage && handleDeleteForMe(selectedMessage)}
        onDeleteForEveryone={() =>
          selectedMessage && handleDeleteForEveryone(selectedMessage)
        }
      />

      <ForwardMessageModal
        visible={forwardVisible}
        rooms={rooms}
        currentRoomId={room?._id}
        onClose={() => {
          setForwardVisible(false);
          setForwardingMessage(null);
        }}
        onConfirm={handleForwardConfirm}
      />

      <SearchModal
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        onSelectRoom={(selectedRoom) => {
          setRooms((prev) =>
            prev.some((r) => r._id === selectedRoom._id) ? prev : [selectedRoom, ...prev]
          );
          setRoom(selectedRoom);
        }}
        onSelectMessage={handleSelectSearchMessage}
      />

      <ChatActionsModal
        visible={chatActionsVisible}
        roomName={actionRoom?.name || 'Direct Chat'}
        isFavorite={actionRoom?.isFavorite}
        isPinned={actionRoom?.isPinned}
        isArchived={actionRoom?.isArchived}
        onClose={() => setChatActionsVisible(false)}
        onToggleFavorite={() => handleToggleFavorite(actionRoom)}
        onTogglePin={() => handleTogglePin(actionRoom)}
        onToggleArchive={() => handleToggleArchive(actionRoom)}
      />

      <MediaPreviewModal
        visible={Boolean(previewMedia)}
        media={previewMedia}
        onClose={() => setPreviewMedia(null)}
      />
    </SafeAreaView>
  );
}

export default function ChatRoute() {
  return <ChatScreen />;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#020617' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#020617' },
  header: {
    height: 64,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  appName: { color: '#818CF8', fontSize: 11, fontWeight: '800' },
  roomName: { color: '#F8FAFC', fontSize: 18, fontWeight: '800' },
  logout: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#1E293B',
  },
  logoutText: { color: '#F87171', fontWeight: '700', fontSize: 12 },
  profileButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#1E293B',
  },
  profileText: { color: '#818CF8', fontWeight: '700', fontSize: 12 },
  headerControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  callBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favIconText: { fontSize: 16, color: '#FACC15' },
  callBtnText: { fontSize: 16 },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  filterChipActive: {
    backgroundColor: '#1E1B4B',
    borderColor: '#6366F1',
  },
  filterChipText: { color: '#94A3B8', fontSize: 11, fontWeight: '700' },
  filterChipTextActive: { color: '#E0E7FF' },
  loadOlderBtn: {
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 8,
  },
  loadOlderText: { color: '#818CF8', fontSize: 12, fontWeight: '700' },
  highlightedBubble: {
    borderWidth: 2,
    borderColor: '#FACC15',
  },
  roomList: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  roomChip: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'center',
  },
  roomChipActive: { backgroundColor: '#312E81', borderColor: '#6366F1' },
  roomChipInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  roomChipText: { color: '#CBD5E1', fontSize: 12, fontWeight: '700' },
  unreadBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#6366F1',
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  messages: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 6 },
  mineRow: { justifyContent: 'flex-end' },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#CBD5E1', fontWeight: '800' },
  bubbleWrapper: { maxWidth: '78%', alignItems: 'flex-start' },
  mineWrapper: { alignItems: 'flex-end' },
  bubble: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 9 },
  mineBubble: { backgroundColor: '#4F46E5', borderBottomRightRadius: 4 },
  otherBubble: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderBottomLeftRadius: 4,
  },
  deletedBubble: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  sender: { color: '#818CF8', fontSize: 10, fontWeight: '700', marginBottom: 3 },
  forwardedLabel: {
    color: '#CBD5E1',
    fontSize: 10,
    fontStyle: 'italic',
    opacity: 0.8,
    marginBottom: 4,
  },
  replyQuote: {
    borderLeftWidth: 2,
    borderLeftColor: '#A5B4FC',
    paddingLeft: 8,
    paddingVertical: 3,
    marginBottom: 6,
    backgroundColor: 'rgba(2, 6, 23, 0.25)',
    borderRadius: 6,
  },
  replyQuoteSender: { color: '#C7D2FE', fontSize: 10, fontWeight: '700' },
  replyQuoteText: { color: '#E2E8F0', fontSize: 12, opacity: 0.85 },
  messageText: { color: '#F8FAFC', fontSize: 14 },
  deletedMessageText: { color: '#64748B', fontStyle: 'italic' },
  editedLabel: {
    color: '#CBD5E1',
    fontSize: 10,
    opacity: 0.75,
    alignSelf: 'flex-end',
    marginTop: 3,
  },
  reactionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  reactionsRowMine: {
    justifyContent: 'flex-end',
  },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  reactionPillActive: {
    backgroundColor: '#312E81',
    borderColor: '#6366F1',
  },
  reactionEmoji: { fontSize: 12 },
  reactionCount: { color: '#E2E8F0', fontSize: 11, fontWeight: '700' },
  composerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  composerBannerContent: { flex: 1, paddingRight: 10 },
  composerBannerTitle: { color: '#818CF8', fontSize: 11, fontWeight: '800' },
  composerBannerPreview: { color: '#94A3B8', fontSize: 12, marginTop: 1 },
  composerBannerClose: { padding: 4 },
  composerBannerCloseText: { color: '#94A3B8', fontSize: 15, fontWeight: '700' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    backgroundColor: '#0F172A',
  },
  input: {
    flex: 1,
    maxHeight: 100,
    minHeight: 44,
    backgroundColor: '#020617',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  send: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.45 },
  sendText: { color: '#fff', fontWeight: '800' },
  errorBanner: {
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#450A0A',
  },
  errorText: { color: '#FCA5A5', fontSize: 12 },
  toastBanner: {
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#1E1B4B',
    borderWidth: 1,
    borderColor: '#6366F1',
    alignSelf: 'center',
  },
  toastText: { color: '#E0E7FF', fontSize: 12, fontWeight: '700' },
});
