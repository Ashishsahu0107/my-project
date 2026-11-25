import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

const handledNotificationIds = new Set<string>();
let pendingRoomId: string | null = null;

export function consumePendingNotificationRoomId(): string | null {
  const roomId = pendingRoomId;
  pendingRoomId = null;
  return roomId;
}

export const handleNotificationResponse = (
  response: Notifications.NotificationResponse,
  isAuthenticated = true
) => {
  const identifier = response.notification.request.identifier;
  if (identifier && handledNotificationIds.has(identifier)) return;
  if (identifier) {
    handledNotificationIds.add(identifier);
    if (handledNotificationIds.size > 100) {
      const first = handledNotificationIds.values().next().value;
      if (first) handledNotificationIds.delete(first);
    }
  }

  const data = response.notification.request.content.data as {
    kind?: string;
    roomId?: string;
  };

  if (data?.kind === 'chat-message' && data.roomId) {
    if (!isAuthenticated) {
      pendingRoomId = data.roomId;
      return;
    }
    router.replace({ pathname: '/chat', params: { roomId: data.roomId } });
  }
};

export function subscribeToNotificationTaps(
  onResponse?: (response: Notifications.NotificationResponse) => void,
  isAuthenticated = true
): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    onResponse?.(response);
    handleNotificationResponse(response, isAuthenticated);
  });

  Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) {
      onResponse?.(response);
      handleNotificationResponse(response, isAuthenticated);
    }
  });

  return () => {
    subscription.remove();
  };
}
