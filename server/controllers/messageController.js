import { Message } from '../models/Message.js';
import { Room } from '../models/Room.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendChatPushNotifications } from '../utils/pushNotificationService.js';

/**
 * @desc   Get paginated message history for a room
 * @route  GET /api/messages/room/:roomId
 */
export const getMessagesByRoom = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const limit = Math.min(parseInt(req.query.limit, 10) || 25, 100);
  const { before } = req.query;
  const currentUserId = req.user._id;

  const room = await Room.findById(roomId);
  if (!room) {
    throw ApiError.notFound('Room not found');
  }

  // Check if the user is a member of the room
  if (!room.members.some((id) => id.toString() === currentUserId.toString()) && !(room.type === 'channel' && !room.isPrivate)) {
    throw ApiError.forbidden('You are not a member of this room');
  }

  const query = { room: roomId, isDeleted: false };
  if (before) {
    query.createdAt = { $lt: new Date(before) };
  }

  // Fetch limit + 1 to check if older messages exist
  const rawMessages = await Message.find(query)
    .populate('sender', 'username email avatar status statusMessage lastSeen')
    .sort({ createdAt: -1 })
    .limit(limit + 1);

  const hasMore = rawMessages.length > limit;
  const messagesSlice = hasMore ? rawMessages.slice(0, limit) : rawMessages;
  const nextCursor = messagesSlice.length > 0 ? messagesSlice[messagesSlice.length - 1].createdAt : null;

  // Mark retrieved unread messages as delivered to this user
  try {
    await Message.updateMany(
      {
        room: roomId,
        sender: { $ne: currentUserId },
        'deliveredTo.user': { $ne: currentUserId }
      },
      {
        $push: { deliveredTo: { user: currentUserId, deliveredAt: new Date() } },
        $set: { status: 'delivered' }
      }
    );
  } catch (err) {
    // Non-fatal delivery tracking
  }

  res.status(200).json({
    status: 'success',
    results: messagesSlice.length,
    data: {
      messages: messagesSlice.reverse(),
      nextCursor,
      hasMore
    }
  });
});

/**
 * @desc   Send a new message to a room
 * @route  POST /api/messages
 */
export const sendMessage = asyncHandler(async (req, res) => {
  const { roomId, content, clientTempId, attachments = [], replyTo } = req.body;
  const senderId = req.user._id;

  const room = await Room.findById(roomId);
  if (!room) {
    throw ApiError.notFound('Room not found');
  }

  // Check if the user is a member of the room
  if (!room.members.some((id) => id.toString() === senderId.toString()) && !(room.type === 'channel' && !room.isPrivate)) {
    throw ApiError.forbidden('You are not a member of this room');
  }

  const message = await Message.create({
    room: roomId,
    sender: senderId,
    content: content.trim(),
    attachments,
    status: 'sent',
    replyTo
  });

  const populated = await message.populate('sender', 'username email avatar status statusMessage lastSeen');

  // Update room's last message and updatedAt timestamp
  room.lastMessage = message._id;
  room.updatedAt = new Date();
  await room.save();

  // Socket.IO real-time emission
  const io = req.app.get('io');
  if (io) {
    // Emit to room members currently inside the room
    io.to(roomId).emit('message:received', {
      ...populated.toObject(),
      clientTempId
    });

    // Notify room members outside the active room
    room.members.forEach((memberId) => {
      const memberStr = memberId.toString();
      if (memberStr !== senderId.toString()) {
        io.to(`user:${memberStr}`).emit('notification:new_message', {
          roomId,
          roomName: room.name,
          roomType: room.type,
          message: populated
        });
      }
    });
  }

  // Send push notifications for new message
  try {
    sendChatPushNotifications({
      recipientIds: room.members.filter((id) => id.toString() !== senderId.toString()),
      senderName: req.user.username,
      roomId,
      roomName: room.name,
      roomType: room.type,
      content: content.trim(),
      messageId: message._id
    }).catch((err) => console.error('Push notification error:', err));
  } catch (err) {
    console.error('Push notification error:', err);
  }

  res.status(201).json({
    status: 'success',
    data: {
      message: populated,
      clientTempId
    }
  });
});

/**
 * @desc   Mark all unread messages in a room as read
 * @route  POST /api/messages/room/:roomId/read
 */
export const markRoomMessagesRead = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const currentUserId = req.user._id;

  const room = await Room.findById(roomId);
  if (!room) throw ApiError.notFound('Room not found');
  if (!room.members.some((id) => id.toString() === currentUserId.toString()) && !(room.type === 'channel' && !room.isPrivate)) {
    throw ApiError.forbidden('You are not a member of this room');
  }

  const result = await Message.updateMany(
    {
      room: roomId,
      sender: { $ne: currentUserId },
      'readBy.user': { $ne: currentUserId }
    },
    {
      $push: { readBy: { user: currentUserId, readAt: new Date() } },
      $set: { status: 'read' }
    }
  );

  const io = req.app.get('io');
  if (io) {
    io.to(roomId).emit('message:read_receipt', {
      roomId,
      readerId: currentUserId,
      readAt: new Date()
    });
  }

  res.status(200).json({
    status: 'success',
    message: 'Messages marked as read',
    data: {
      modifiedCount: result.modifiedCount
    }
  });
});

/**
 * @desc   Add/toggle reaction on a message
 * @route  POST /api/messages/:id/react
 */
export const reactToMessage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { emoji } = req.body;
  const userId = req.user._id;

  if (!emoji) {
    throw ApiError.badRequest('Emoji is required');
  }

  const message = await Message.findById(id);
  if (!message) {
    throw ApiError.notFound('Message not found');
  }

  const existingReactionIndex = message.reactions.findIndex(
    (r) => r.user.toString() === userId.toString() && r.emoji === emoji
  );

  if (existingReactionIndex > -1) {
    // Toggle off reaction
    message.reactions.splice(existingReactionIndex, 1);
  } else {
    // Add reaction
    message.reactions.push({ emoji, user: userId });
  }

  await message.save();
  const populated = await message.populate('sender', 'username email avatar status');

  const io = req.app.get('io');
  if (io) {
    io.to(message.room.toString()).emit('message:updated', populated);
  }

  res.status(200).json({
    status: 'success',
    data: {
      message: populated
    }
  });
});

/**
 * @desc   Edit an existing message
 * @route  PATCH /api/messages/:id
 */
export const editMessage = asyncHandler(async (req, res) => {
  const message = await Message.findById(req.params.id);
  if (!message) throw ApiError.notFound('Message not found');
  if (message.sender.toString() !== req.user._id.toString()) throw ApiError.forbidden('You can only edit your own messages');

  const content = req.body.content?.trim();
  if (!content) throw ApiError.badRequest('Message content cannot be empty');
  if (content.length > 5000) throw ApiError.badRequest('Message cannot exceed 5000 characters');

  message.content = content;
  message.isEdited = true;
  await message.save();
  const populated = await message.populate('sender', 'username email avatar status');

  const io = req.app.get('io');
  io?.to(message.room.toString()).emit('message:updated', populated);
  res.status(200).json({ status: 'success', data: { message: populated } });
});

/**
 * @desc   Soft-delete a message
 * @route  DELETE /api/messages/:id
 */
export const deleteMessage = asyncHandler(async (req, res) => {
  const message = await Message.findById(req.params.id);
  if (!message) throw ApiError.notFound('Message not found');
  if (message.sender.toString() !== req.user._id.toString()) throw ApiError.forbidden('You can only delete your own messages');

  message.isDeleted = true;
  message.content = 'This message was deleted';
  await message.save();

  const io = req.app.get('io');
  io?.to(message.room.toString()).emit('message:deleted', { messageId: message._id, roomId: message.room });
  res.status(200).json({ status: 'success', message: 'Message deleted successfully' });
});
