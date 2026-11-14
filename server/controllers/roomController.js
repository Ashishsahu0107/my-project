import { Room } from '../models/Room.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getRooms = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Find channels (public) or rooms where user is a member
  const rooms = await Room.find({
    $or: [
      { type: 'channel', isPrivate: false },
      { members: userId }
    ]
  })
    .populate('members', 'username email avatar status statusMessage lastSeen')
    .populate({
      path: 'lastMessage',
      populate: { path: 'sender', select: 'username avatar' }
    })
    .sort({ updatedAt: -1 });

  res.status(200).json({
    status: 'success',
    results: rooms.length,
    data: { rooms }
  });
});

export const getRoomById = asyncHandler(async (req, res) => {
  const room = await Room.findById(req.params.id)
    .populate('members', 'username email avatar status statusMessage lastSeen')
    .populate('creator', 'username email avatar');

  if (!room) {
    throw ApiError.notFound('Room not found');
  }

  res.status(200).json({
    status: 'success',
    data: { room }
  });
});

export const createRoom = asyncHandler(async (req, res) => {
  const { name, type = 'channel', description, recipientId } = req.body;
  const currentUserId = req.user._id;

  if (type === 'direct') {
    if (!recipientId) {
      throw ApiError.badRequest('Recipient user ID is required for direct conversations');
    }

    // Check if direct room already exists between these two users
    let existingDirect = await Room.findOne({
      type: 'direct',
      members: { $all: [currentUserId, recipientId], $size: 2 }
    })
      .populate('members', 'username email avatar status statusMessage lastSeen')
      .populate('lastMessage');

    if (existingDirect) {
      return res.status(200).json({
        status: 'success',
        data: { room: existingDirect }
      });
    }

    const directRoom = await Room.create({
      type: 'direct',
      creator: currentUserId,
      members: [currentUserId, recipientId]
    });

    const populated = await directRoom.populate(
      'members',
      'username email avatar status statusMessage lastSeen'
    );

    return res.status(201).json({
      status: 'success',
      data: { room: populated }
    });
  }

  // Type === 'channel'
  const normalizedName = name.trim().toLowerCase().replace(/\s+/g, '-');
  const existingChannel = await Room.findOne({ name: normalizedName, type: 'channel' });
  if (existingChannel) {
    throw ApiError.conflict('A channel with this name already exists');
  }

  const newChannel = await Room.create({
    name: normalizedName,
    type: 'channel',
    description: description || '',
    creator: currentUserId,
    members: [currentUserId]
  });

  const populatedChannel = await newChannel.populate(
    'members',
    'username email avatar status statusMessage lastSeen'
  );

  res.status(201).json({
    status: 'success',
    data: { room: populatedChannel }
  });
});

export const joinRoom = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const room = await Room.findById(id);
  if (!room) {
    throw ApiError.notFound('Room not found');
  }

  if (!room.members.includes(userId)) {
    room.members.push(userId);
    await room.save();
  }

  const updatedRoom = await Room.findById(id).populate(
    'members',
    'username email avatar status statusMessage lastSeen'
  );

  res.status(200).json({
    status: 'success',
    data: { room: updatedRoom }
  });
});
