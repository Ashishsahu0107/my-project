import { api } from '../api/client';

export type MessageReaction = {
  emoji: string;
  user: string;
};

export type ChatMessage = {
  _id: string;
  room?: string;
  content: string;
  sender?: {
    _id?: string;
    id?: string;
    username?: string;
    avatar?: string;
  };
  createdAt: string;
  status?: string;
  reactions?: MessageReaction[];
  isEdited?: boolean;
  isDeleted?: boolean;
  isForwarded?: boolean;
  forwardedFrom?: {
    _id?: string;
    username?: string;
  } | null;
  replyTo?: {
    _id: string;
    content: string;
    isDeleted?: boolean;
    sender?: {
      _id?: string;
      username?: string;
    };
  } | null;
};

export async function reactToMessage(messageId: string, emoji: string): Promise<ChatMessage> {
  const response = await api.post(`/messages/${messageId}/react`, { emoji });
  return response.data.data.message;
}

export async function editMessage(messageId: string, content: string): Promise<ChatMessage> {
  const response = await api.patch(`/messages/${messageId}`, { content });
  return response.data.data.message;
}

export async function deleteMessage(
  messageId: string,
  scope: 'me' | 'everyone'
): Promise<{ messageId: string; scope: 'me' | 'everyone' }> {
  const response = await api.delete(`/messages/${messageId}?scope=${scope}`);
  return response.data.data;
}

export async function forwardMessage(
  messageId: string,
  targetRoomIds: string[]
): Promise<ChatMessage[]> {
  const response = await api.post(`/messages/${messageId}/forward`, { targetRoomIds });
  return response.data.data.messages;
}
