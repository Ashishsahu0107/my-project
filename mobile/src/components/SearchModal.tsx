import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  addRecentSearch,
  clearRecentSearches,
  createOrOpenDirectRoom,
  fetchRooms,
  getRecentSearches,
  searchMessages,
  SearchMessageResult,
  searchUsers,
  SearchUserResult,
} from '../services/searchService';
import { HighlightedText } from './HighlightedText';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelectRoom: (room: any) => void;
  onSelectMessage: (roomId: string, messageId: string) => void;
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function SearchModal({
  visible,
  onClose,
  onSelectRoom,
  onSelectMessage,
}: Props) {
  const [query, setQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [matchingRooms, setMatchingRooms] = useState<any[]>([]);
  const [matchingUsers, setMatchingUsers] = useState<SearchUserResult[]>([]);
  const [messages, setMessages] = useState<SearchMessageResult[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalMessages, setTotalMessages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (visible) {
      getRecentSearches().then(setRecentSearches);
    }
  }, [visible]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setMatchingRooms([]);
      setMatchingUsers([]);
      setMessages([]);
      setHasMore(false);
      setTotalMessages(0);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setPage(1);
      try {
        const [roomsRes, usersRes, msgRes] = await Promise.all([
          fetchRooms('all', trimmed),
          searchUsers(trimmed),
          searchMessages(trimmed, { page: 1, limit: 15 }),
        ]);
        setMatchingRooms(roomsRes);
        setMatchingUsers(usersRes);
        setMessages(msgRes.messages);
        setHasMore(msgRes.pagination.hasMore);
        setTotalMessages(msgRes.pagination.total);
      } catch {
        // Non-fatal search error
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore || !query.trim()) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const msgRes = await searchMessages(query.trim(), { page: nextPage, limit: 15 });
      setMessages((prev) => [...prev, ...msgRes.messages]);
      setPage(nextPage);
      setHasMore(msgRes.pagination.hasMore);
    } finally {
      setLoadingMore(false);
    }
  };

  const persistQuery = async () => {
    if (query.trim()) {
      const updated = await addRecentSearch(query.trim());
      setRecentSearches(updated);
    }
  };

  const handleUserPress = async (userItem: SearchUserResult) => {
    await persistQuery();
    try {
      const directRoom = await createOrOpenDirectRoom(userItem._id);
      onSelectRoom(directRoom);
      onClose();
    } catch {
      // Ignore if unable to open direct room
    }
  };

  const handleRoomPress = async (roomItem: any) => {
    await persistQuery();
    onSelectRoom(roomItem);
    onClose();
  };

  const handleMessagePress = async (msgItem: SearchMessageResult) => {
    await persistQuery();
    onSelectMessage(msgItem.room._id, msgItem._id);
    onClose();
  };

  const handleClearHistory = async () => {
    await clearRecentSearches();
    setRecentSearches([]);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
        <View style={styles.searchHeader}>
          <Pressable onPress={onClose} style={styles.backBtn}>
            <Text style={styles.backText}>←</Text>
          </Pressable>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search messages, users, groups..."
            placeholderTextColor="#64748B"
            style={styles.searchInput}
            autoFocus
            returnKeyType="search"
            onSubmitEditing={persistQuery}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} style={styles.clearBtn}>
              <Text style={styles.clearText}>✕</Text>
            </Pressable>
          )}
        </View>

        {!query.trim() ? (
          <View style={styles.recentContainer}>
            <View style={styles.recentHeader}>
              <Text style={styles.sectionTitle}>Recent Searches</Text>
              {recentSearches.length > 0 && (
                <Pressable onPress={handleClearHistory}>
                  <Text style={styles.clearHistoryText}>Clear History</Text>
                </Pressable>
              )}
            </View>
            {recentSearches.length === 0 ? (
              <Text style={styles.emptyText}>No recent searches yet</Text>
            ) : (
              <View style={styles.recentChips}>
                {recentSearches.map((term) => (
                  <Pressable
                    key={term}
                    onPress={() => setQuery(term)}
                    style={styles.recentChip}
                  >
                    <Text style={styles.recentChipText}>🕒 {term}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        ) : loading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#6366F1" />
          </View>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.resultsList}
            ListHeaderComponent={
              <View style={styles.headerSections}>
                {(matchingRooms.length > 0 || matchingUsers.length > 0) && (
                  <View style={styles.sectionBlock}>
                    <Text style={styles.sectionTitle}>Chats & Users</Text>
                    {matchingRooms.map((r) => (
                      <Pressable
                        key={`room-${r._id}`}
                        onPress={() => handleRoomPress(r)}
                        style={styles.chatRow}
                      >
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>
                            {r.type === 'direct' ? '@' : '#'}
                          </Text>
                        </View>
                        <View style={styles.rowText}>
                          <HighlightedText
                            text={r.name || 'Direct Chat'}
                            query={query}
                            style={styles.chatTitle}
                          />
                          <Text style={styles.chatMeta}>{r.type}</Text>
                        </View>
                      </Pressable>
                    ))}
                    {matchingUsers.map((u) => (
                      <Pressable
                        key={`user-${u._id}`}
                        onPress={() => handleUserPress(u)}
                        style={styles.chatRow}
                      >
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>
                            {u.username?.[0]?.toUpperCase() || '?'}
                          </Text>
                        </View>
                        <View style={styles.rowText}>
                          <HighlightedText
                            text={`@${u.username}`}
                            query={query}
                            style={styles.chatTitle}
                          />
                          <Text style={styles.chatMeta}>Direct message</Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                )}

                <Text style={styles.sectionTitle}>
                  Messages {totalMessages > 0 ? `(${totalMessages})` : ''}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleMessagePress(item)}
                style={styles.messageCard}
              >
                <View style={styles.messageCardTop}>
                  <Text style={styles.messageSender}>
                    @{item.sender?.username || 'user'} ·{' '}
                    {item.room?.type === 'direct' ? '@' : '#'}
                    {item.room?.name || 'Direct'}
                  </Text>
                  <Text style={styles.messageTime}>{formatTime(item.createdAt)}</Text>
                </View>
                <HighlightedText
                  text={item.content}
                  query={query}
                  style={styles.messagePreview}
                  numberOfLines={2}
                />
              </Pressable>
            )}
            ListEmptyComponent={
              matchingRooms.length === 0 && matchingUsers.length === 0 ? (
                <Text style={styles.emptyText}>No results found for "{query}"</Text>
              ) : undefined
            }
            ListFooterComponent={
              hasMore ? (
                <Pressable
                  onPress={handleLoadMore}
                  disabled={loadingMore}
                  style={styles.loadMoreBtn}
                >
                  {loadingMore ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.loadMoreText}>Load More Messages</Text>
                  )}
                </Pressable>
              ) : undefined
            }
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#020617' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    backgroundColor: '#0F172A',
  },
  backBtn: { padding: 8 },
  backText: { color: '#F8FAFC', fontSize: 20, fontWeight: '700' },
  searchInput: {
    flex: 1,
    height: 42,
    backgroundColor: '#020617',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#F8FAFC',
    paddingHorizontal: 12,
    fontSize: 14,
  },
  clearBtn: { padding: 8 },
  clearText: { color: '#94A3B8', fontSize: 16, fontWeight: '700' },
  recentContainer: { padding: 16, gap: 12 },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: '#818CF8',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  clearHistoryText: { color: '#F87171', fontSize: 12, fontWeight: '700' },
  recentChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  recentChip: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  recentChipText: { color: '#E2E8F0', fontSize: 13 },
  resultsList: { padding: 14, gap: 8 },
  headerSections: { gap: 12, marginBottom: 6 },
  sectionBlock: { gap: 6 },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 12,
    padding: 10,
  },
  badge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#312E81',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#E0E7FF', fontWeight: '800', fontSize: 14 },
  rowText: { flex: 1 },
  chatTitle: { color: '#F8FAFC', fontSize: 14, fontWeight: '700' },
  chatMeta: { color: '#64748B', fontSize: 11, textTransform: 'capitalize' },
  messageCard: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    gap: 4,
    marginBottom: 8,
  },
  messageCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  messageSender: { color: '#818CF8', fontSize: 11, fontWeight: '700', flex: 1 },
  messageTime: { color: '#64748B', fontSize: 11 },
  messagePreview: { color: '#E2E8F0', fontSize: 13, lineHeight: 18 },
  emptyText: { color: '#64748B', fontSize: 14, textAlign: 'center', marginTop: 24 },
  loadMoreBtn: {
    height: 42,
    borderRadius: 12,
    backgroundColor: '#312E81',
    borderWidth: 1,
    borderColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  loadMoreText: { color: '#E0E7FF', fontSize: 13, fontWeight: '700' },
});
