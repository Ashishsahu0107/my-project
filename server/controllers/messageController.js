import { Message } from '../models/Message.js';
import { Room } from '../models/Room.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getMessagesByRoom = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const { limit = 50, before } = req.query;

  const room = await Room.findById(roomId);
  if (!room) {
    throw ApiError.notFound('Room not found');
  }

  const query = { room: roomId, isDeleted: false };
  if (before) {
    query.createdAt = { $lt: new Date(before) };
  }

  const messages = await Message.find(query)
    .populate('sender', 'username email avatar status')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit, 10));

  res.status(200).json({
    status: 'success',
    results: messages.length,
    data: {
      messages: messages.reverse()
    }
  });
});

export const sendMessage = asyncHandler(async (req, res) => {
  const { roomId, content, attachments = [] } = req.body;
  const senderId = req.user._id;

  const room = await Room.findById(roomId);
  if (!room) {
    throw ApiError.notFound('Room not found');
  }

  const message = await Message.create({
    room: roomId,
    sender: senderId,
    content: content.trim(),
    attachments
  });

  const populated = await message.populate('sender', 'username email avatar status');

  // Update room's last message and timestamp
  room.lastMessage = message._id;
  room.updatedAt = new Date();
  await room.save();

  // Socket.IO event can be emitted if io attached to req.app
  const io = req.app.get('io');
  if (io) {
    io.to(roomId).emit('message:received', populated);
  }

  res.status(201).json({
    status: 'success',
    data: {
      message: populated
    }
  });
});

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
