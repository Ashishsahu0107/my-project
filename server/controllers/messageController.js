import { Message } from '../models/Message.js';
import { Room } from '../models/Room.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendChatPushNotifications } from '../utils/pushNotificationService.js';

const MESSAGE_POPULATE = [
  { path: 'sender', select: 'username email avatar status statusMessage lastSeen' },
  {
    path: 'replyTo',
    select: 'content sender isDeleted createdAt',
    populate: { path: 'sender', select: 'username avatar' }
  },
  { path: 'forwardedFrom', select: 'username avatar' }
];

const hasRoomAccess = (room, userId) =>
  room.members.some((id) => id.toString() === userId.toString()) ||
  (room.type === 'channel' && !room.isPrivate);

/**
 * @desc   Get paginated message history for a room
 * @route  GET /api/messages/room/:roomId
 */
export const getMessagesByRoom = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const limit = Math.min(parseInt(req.query.limit, 10) || 25, 100);
  const { before, around } = req.query;
  const currentUserId = req.user._id;

  const room = await Room.findById(roomId);
  if (!room) {
    throw ApiError.notFound('Room not found');
  }

  if (!hasRoomAccess(room, currentUserId)) {
    throw ApiError.forbidden('You are not a member of this room');
  }

  const baseFilter = {
    room: roomId,
    deletedFor: { $ne: currentUserId }
  };

  if (around) {
    const targetMsg = await Message.findOne({ _id: around, ...baseFilter }).populate(MESSAGE_POPULATE);
    if (!targetMsg) {
      throw ApiError.notFound('Target message not found');
    }

    const half = Math.max(Math.floor(limit / 2), 5);
    const [olderRaw, newerRaw] = await Promise.all([
      Message.find({ ...baseFilter, createdAt: { $lt: targetMsg.createdAt } })
        .populate(MESSAGE_POPULATE)
        .sort({ createdAt: -1 })
        .limit(half + 1),
      Message.find({ ...baseFilter, createdAt: { $gt: targetMsg.createdAt } })
        .populate(MESSAGE_POPULATE)
        .sort({ createdAt: 1 })
        .limit(half + 1)
    ]);

    const hasMore = olderRaw.length > half;
    const hasMoreNewer = newerRaw.length > half;
    const older = (hasMore ? olderRaw.slice(0, half) : olderRaw).reverse();
    const newer = hasMoreNewer ? newerRaw.slice(0, half) : newerRaw;
    const combined = [...older, targetMsg, ...newer];
    const nextCursor = combined.length > 0 ? combined[0].createdAt : null;

    return res.status(200).json({
      status: 'success',
      results: combined.length,
      data: {
        messages: combined,
        nextCursor,
        hasMore,
        hasMoreNewer,
        targetMessageId: targetMsg._id
      }
    });
  }

  const query = { ...baseFilter };
  if (before) {
    query.createdAt = { $lt: new Date(before) };
  }

  const rawMessages = await Message.find(query)
    .populate(MESSAGE_POPULATE)
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
  const { roomId, content, clientTempId, attachments = [], replyTo, isForwarded = false, forwardedFrom = null } = req.body;
  const senderId = req.user._id;

  const room = await Room.findById(roomId);
  if (!room) {
    throw ApiError.notFound('Room not found');
  }

  if (!hasRoomAccess(room, senderId)) {
    throw ApiError.forbidden('You are not a member of this room');
  }

  if (room.type === 'direct') {
    const otherId = room.members.find((id) => id.toString() !== senderId.toString());
    if (otherId) {
      const [senderDoc, otherDoc] = await Promise.all([
        User.findById(senderId).select('blockedUsers'),
        User.findById(otherId).select('blockedUsers')
      ]);
      const blocked =
        senderDoc?.blockedUsers?.some((id) => id.toString() === otherId.toString()) ||
        otherDoc?.blockedUsers?.some((id) => id.toString() === senderId.toString());
      if (blocked) {
        throw ApiError.forbidden('Cannot send messages because a user is blocked');
      }
    }
  }

  const message = await Message.create({
    room: roomId,
    sender: senderId,
    content: content.trim(),
    attachments,
    status: 'sent',
    replyTo: replyTo || null,
    isForwarded: Boolean(isForwarded),
    forwardedFrom: forwardedFrom || null
  });

  const populated = await message.populate(MESSAGE_POPULATE);

  room.lastMessage = message._id;
  room.updatedAt = new Date();
  await room.save();

  const io = req.app.get('io');
  if (io) {
    io.to(roomId).emit('message:received', {
      ...populated.toObject(),
      clientTempId
    });

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

  try {
    sendChatPushNotifications({
      io,
      senderId,
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
  if (!hasRoomAccess(room, currentUserId)) {
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

  if (!emoji || typeof emoji !== 'string') {
    throw ApiError.badRequest('Emoji is required');
  }

  const message = await Message.findById(id);
  if (!message) {
    throw ApiError.notFound('Message not found');
  }
  if (message.isDeleted) {
    throw ApiError.badRequest('Cannot react to a deleted message');
  }

  const room = await Room.findById(message.room);
  if (!room || !hasRoomAccess(room, userId)) {
    throw ApiError.forbidden('You do not have access to this room');
  }

  const existingReactionIndex = message.reactions.findIndex(
    (r) => r.user.toString() === userId.toString() && r.emoji === emoji
  );

  if (existingReactionIndex > -1) {
    message.reactions.splice(existingReactionIndex, 1);
  } else {
    message.reactions.push({ emoji, user: userId });
  }

  await message.save();
  const populated = await message.populate(MESSAGE_POPULATE);

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
  if (message.sender.toString() !== req.user._id.toString()) {
    throw ApiError.forbidden('You can only edit your own messages');
  }
  if (message.isDeleted) {
    throw ApiError.badRequest('Deleted messages cannot be edited');
  }

  const content = req.body.content?.trim();
  if (!content) throw ApiError.badRequest('Message content cannot be empty');
  if (content.length > 5000) throw ApiError.badRequest('Message cannot exceed 5000 characters');

  message.content = content;
  message.isEdited = true;
  await message.save();
  const populated = await message.populate(MESSAGE_POPULATE);

  const io = req.app.get('io');
  io?.to(message.room.toString()).emit('message:updated', populated);
  res.status(200).json({ status: 'success', data: { message: populated } });
});

/**
 * @desc   Delete a message (for self or for everyone)
 * @route  DELETE /api/messages/:id?scope=me|everyone
 */
export const deleteMessage = asyncHandler(async (req, res) => {
  const message = await Message.findById(req.params.id);
  if (!message) throw ApiError.notFound('Message not found');

  const scope = (req.query.scope || req.body?.scope || 'everyone').toLowerCase();
  const userId = req.user._id;
  const io = req.app.get('io');

  if (scope === 'me') {
    const room = await Room.findById(message.room);
    if (!room || !hasRoomAccess(room, userId)) {
      throw ApiError.forbidden('You do not have access to this room');
    }

    await Message.findByIdAndUpdate(message._id, {
      $addToSet: { deletedFor: userId }
    });

    io?.to(`user:${userId.toString()}`).emit('message:deleted_for_me', {
      messageId: message._id,
      roomId: message.room
    });

    return res.status(200).json({
      status: 'success',
      message: 'Message deleted for you',
      data: { messageId: message._id, scope: 'me' }
    });
  }

  if (message.sender.toString() !== userId.toString()) {
    throw ApiError.forbidden('You can only delete your own messages for everyone');
  }

  message.isDeleted = true;
  message.content = 'This message was deleted';
  message.reactions = [];
  await message.save();

  io?.to(message.room.toString()).emit('message:deleted', {
    messageId: message._id,
    roomId: message.room
  });

  res.status(200).json({
    status: 'success',
    message: 'Message deleted for everyone',
    data: { messageId: message._id, scope: 'everyone' }
  });
});

/**
 * @desc   Forward a message to one or more target rooms
 * @route  POST /api/messages/:id/forward
 */
export const forwardMessage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { targetRoomIds } = req.body;
  const userId = req.user._id;

  if (!Array.isArray(targetRoomIds) || targetRoomIds.length === 0) {
    throw ApiError.badRequest('targetRoomIds array is required');
  }

  const original = await Message.findById(id);
  if (!original) throw ApiError.notFound('Original message not found');
  if (original.isDeleted) throw ApiError.badRequest('Cannot forward a deleted message');

  const sourceRoom = await Room.findById(original.room);
  if (!sourceRoom || !hasRoomAccess(sourceRoom, userId)) {
    throw ApiError.forbidden('You do not have access to the source message');
  }

  const uniqueRoomIds = [...new Set(targetRoomIds.map(String))];
  const targetRooms = await Room.find({ _id: { $in: uniqueRoomIds } });
  const io = req.app.get('io');
  const forwardedMessages = [];

  for (const targetRoom of targetRooms) {
    if (!hasRoomAccess(targetRoom, userId)) continue;

    const newMsg = await Message.create({
      room: targetRoom._id,
      sender: userId,
      content: original.content,
      attachments: original.attachments || [],
      status: 'sent',
      isForwarded: true,
      forwardedFrom: original.sender
    });

    const populated = await newMsg.populate(MESSAGE_POPULATE);
    targetRoom.lastMessage = newMsg._id;
    targetRoom.updatedAt = new Date();
    await targetRoom.save();

    forwardedMessages.push(populated);

    if (io) {
      const roomIdStr = targetRoom._id.toString();
      io.to(roomIdStr).emit('message:received', populated.toObject());

      targetRoom.members.forEach((memberId) => {
        const memberStr = memberId.toString();
        if (memberStr !== userId.toString()) {
          io.to(`user:${memberStr}`).emit('notification:new_message', {
            roomId: roomIdStr,
            roomName: targetRoom.name,
            roomType: targetRoom.type,
            message: populated
          });
        }
      });

      sendChatPushNotifications({
        io,
        senderId: userId,
        recipientIds: targetRoom.members.filter((id) => id.toString() !== userId.toString()),
        senderName: req.user.username,
        roomId: roomIdStr,
        roomName: targetRoom.name,
        roomType: targetRoom.type,
        content: original.content,
        messageId: newMsg._id
      }).catch((err) => console.error('Push notification error:', err));
    }
  }

  if (forwardedMessages.length === 0) {
    throw ApiError.forbidden('No valid target rooms accessible');
  }

  res.status(201).json({
    status: 'success',
    results: forwardedMessages.length,
    data: {
      messages: forwardedMessages
    }
  });
});

/**
 * @desc   Search messages by keyword across accessible rooms or within a specific room
 * @route  GET /api/messages/search?q=keyword&roomId=...&page=1&limit=20
 */
export const searchMessages = asyncHandler(async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) {
    throw ApiError.badRequest('Search query (q) is required');
  }

  const userId = req.user._id;
  const { roomId } = req.query;
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
  const skip = (page - 1) * limit;

  let accessibleRoomIds = [];
  if (roomId) {
    const room = await Room.findById(roomId).select('members type isPrivate');
    if (!room) throw ApiError.notFound('Room not found');
    if (!hasRoomAccess(room, userId)) {
      throw ApiError.forbidden('You do not have access to this room');
    }
    accessibleRoomIds = [room._id];
  } else {
    const rooms = await Room.find({
      $or: [{ type: 'channel', isPrivate: false }, { members: userId }]
    }).select('_id');
    accessibleRoomIds = rooms.map((r) => r._id);
  }

  if (!accessibleRoomIds.length) {
    return res.status(200).json({
      status: 'success',
      results: 0,
      data: {
        messages: [],
        pagination: { page, limit, total: 0, totalPages: 0, hasMore: false }
      }
    });
  }

  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const query = {
    room: { $in: accessibleRoomIds },
    isDeleted: false,
    deletedFor: { $ne: userId },
    content: { $regex: escaped, $options: 'i' }
  };

  const [messages, total] = await Promise.all([
    Message.find(query)
      .populate('sender', 'username avatar')
      .populate('room', 'name type members')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Message.countDocuments(query)
  ]);

  res.status(200).json({
    status: 'success',
    results: messages.length,
    data: {
      messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total
      }
    }
  });
});
