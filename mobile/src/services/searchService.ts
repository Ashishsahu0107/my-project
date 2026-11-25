import * as SecureStore from 'expo-secure-store';
import { api } from '../api/client';
import { ChatMessage } from './messageService';

export type ChatFilter = 'all' | 'unread' | 'groups' | 'favorites' | 'archived';

export type SearchMessageResult = ChatMessage & {
  room: {
    _id: string;
    name?: string;
    type: 'channel' | 'direct' | 'group';
    members?: any[];
  };
};

export type SearchUserResult = {
  _id: string;
  username: string;
  email?: string;
  avatar?: string;
  status?: string;
};

const RECENT_SEARCHES_KEY = 'chatapp_recent_searches';
const MAX_RECENT_SEARCHES = 10;

export async function fetchRooms(filter: ChatFilter = 'all', search = '') {
  const params = new URLSearchParams();
  if (filter) params.set('filter', filter);
  if (search.trim()) params.set('search', search.trim());
  const response = await api.get(`/rooms?${params.toString()}`);
  return response.data.data.rooms;
}

export async function toggleFavoriteRoom(
  roomId: string
): Promise<{ roomId: string; isFavorite: boolean }> {
  const response = await api.post(`/rooms/${roomId}/favorite`);
  return response.data.data;
}

export async function togglePinRoom(
  roomId: string
): Promise<{ roomId: string; isPinned: boolean }> {
  const response = await api.post(`/rooms/${roomId}/pin`);
  return response.data.data;
}

export async function toggleArchiveRoom(
  roomId: string
): Promise<{ roomId: string; isArchived: boolean }> {
  const response = await api.post(`/rooms/${roomId}/archive`);
  return response.data.data;
}

export async function searchUsers(query: string): Promise<SearchUserResult[]> {
  const response = await api.get(`/users?search=${encodeURIComponent(query.trim())}`);
  return response.data.data.users;
}

export async function searchMessages(
  query: string,
  options: { roomId?: string; page?: number; limit?: number } = {}
): Promise<{
  messages: SearchMessageResult[];
  pagination: { page: number; limit: number; total: number; totalPages: number; hasMore: boolean };
}> {
  const params = new URLSearchParams();
  params.set('q', query.trim());
  if (options.roomId) params.set('roomId', options.roomId);
  if (options.page) params.set('page', String(options.page));
  if (options.limit) params.set('limit', String(options.limit));
  const response = await api.get(`/messages/search?${params.toString()}`);
  return response.data.data;
}

export async function fetchMessagesAround(roomId: string, messageId: string, limit = 30) {
  const response = await api.get(
    `/messages/room/${roomId}?around=${encodeURIComponent(messageId)}&limit=${limit}`
  );
  return response.data.data;
}

export async function fetchOlderMessages(roomId: string, before: string, limit = 25) {
  const response = await api.get(
    `/messages/room/${roomId}?before=${encodeURIComponent(before)}&limit=${limit}`
  );
  return response.data.data;
}

export async function createOrOpenDirectRoom(recipientId: string) {
  const response = await api.post('/rooms', { type: 'direct', recipientId });
  return response.data.data.room;
}

export async function getRecentSearches(): Promise<string[]> {
  try {
    const raw = await SecureStore.getItemAsync(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function addRecentSearch(term: string): Promise<string[]> {
  const cleaned = term.trim();
  if (!cleaned) return getRecentSearches();
  const current = await getRecentSearches();
  const next = [cleaned, ...current.filter((t) => t.toLowerCase() !== cleaned.toLowerCase())].slice(
    0,
    MAX_RECENT_SEARCHES
  );
  await SecureStore.setItemAsync(RECENT_SEARCHES_KEY, JSON.stringify(next));
  return next;
}

export async function clearRecentSearches(): Promise<void> {
  await SecureStore.deleteItemAsync(RECENT_SEARCHES_KEY);
}
