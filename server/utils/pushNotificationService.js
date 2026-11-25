import Expo from 'expo-server-sdk';
import { User } from '../models/User.js';

const expo = new Expo();

/**
 * Collect user IDs of sockets currently viewing the given Socket.IO room.
 */
export function getActiveRoomUserIds(io, roomId) {
  const activeUserIds = new Set();
  if (!io || !roomId) return activeUserIds;

  const socketIds = io.sockets?.adapter?.rooms?.get(roomId.toString());
  if (!socketIds) return activeUserIds;

  for (const socketId of socketIds) {
    const sock = io.sockets.sockets.get(socketId);
    const uid = sock?.user?._id?.toString();
    if (uid) activeUserIds.add(uid);
  }
  return activeUserIds;
}

export const sendChatPushNotifications = async ({
  io,
  recipientIds,
  senderId,
  senderName,
  roomId,
  roomName,
  roomType,
  content,
  messageId
}) => {
  if (!recipientIds?.length) return;

  // Exclude sender and anyone currently active in this room
  const activeRoomUserIds = getActiveRoomUserIds(io, roomId);
  const filteredRecipientIds = recipientIds.filter((id) => {
    const idStr = id.toString();
    if (senderId && idStr === senderId.toString()) return false;
    if (activeRoomUserIds.has(idStr)) return false;
    return true;
  });

  if (!filteredRecipientIds.length) return;

  const recipients = await User.find({ _id: { $in: filteredRecipientIds } }).select('pushTokens');
  const messages = [];
  const invalidTokens = [];
  const seenTokens = new Set();

  recipients.forEach((recipient) => {
    recipient.pushTokens.forEach((entry) => {
      const token = entry.token;
      if (!token || seenTokens.has(token)) return;
      seenTokens.add(token);

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
    await User.findByIdAndUpdate(invalid.recipientId, {
      $pull: { pushTokens: { token: invalid.token } }
    });
  }

  if (!messages.length) return;

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      const receipts = await expo.sendPushNotificationsAsync(chunk);
      const staleTokens = [];
      receipts.forEach((receipt, index) => {
        if (
          receipt.status === 'error' &&
          (receipt.details?.error === 'DeviceNotRegistered' ||
            receipt.details?.error === 'InvalidCredentials')
        ) {
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
