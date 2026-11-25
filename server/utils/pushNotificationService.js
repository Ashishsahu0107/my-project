import Expo from 'expo-server-sdk';
import { User } from '../models/User.js';

const expo = new Expo();

export const sendChatPushNotifications = async ({ recipientIds, senderName, roomId, roomName, roomType, content, messageId }) => {
  if (!recipientIds?.length) return;

  const recipients = await User.find({ _id: { $in: recipientIds } }).select('pushTokens');
  const messages = [];
  const invalidTokens = [];

  recipients.forEach((recipient) => {
    recipient.pushTokens.forEach((entry) => {
      const token = entry.token;
      if (!Expo.isExpoPushToken(token)) {
        invalidTokens.push({ recipientId: recipient._id, token });
        return;
      }

      messages.push({
        to: token,
        sound: 'default',
        priority: 'high',
        channelId: 'chat-messages',
        title: roomType === 'direct' ? senderName : `${senderName} · ${roomName || 'Chat'}`,
        body: content?.slice(0, 180) || 'Sent a new message',
        data: {
          kind: 'chat-message',
          roomId: roomId.toString(),
          messageId: messageId?.toString() || '',
          roomName: roomName || '',
          roomType: roomType || 'channel'
        }
      });
    });
  });

  for (const invalid of invalidTokens) {
    await User.findByIdAndUpdate(invalid.recipientId, { $pull: { pushTokens: { token: invalid.token } } });
  }

  if (!messages.length) return;

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      const receipts = await expo.sendPushNotificationsAsync(chunk);
      const staleTokens = [];
      receipts.forEach((receipt, index) => {
        if (receipt.status === 'error' && receipt.details?.error === 'DeviceNotRegistered') {
          staleTokens.push(chunk[index].to);
        }
      });
      if (staleTokens.length) {
        await User.updateMany(
          { 'pushTokens.token': { $in: staleTokens } },
          { $pull: { pushTokens: { token: { $in: staleTokens } } } }
        );
      }
    } catch (error) {
      console.warn('Expo push delivery failed:', error.message);
    }
  }
};
