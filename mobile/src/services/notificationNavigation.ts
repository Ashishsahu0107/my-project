import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

export const handleNotificationResponse = (response: Notifications.NotificationResponse) => {
  const data = response.notification.request.content.data as {
    kind?: string;
    roomId?: string;
  };

  if (data?.kind === 'chat-message' && data.roomId) {
    router.replace({ pathname: '/chat', params: { roomId: data.roomId } });
  }
};

export function subscribeToNotificationTaps() {
  const subscription = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

  Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) handleNotificationResponse(response);
  });

  return subscription;
}
