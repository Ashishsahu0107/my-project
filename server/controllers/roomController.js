import { Room } from '../models/Room.js';
import { Message } from '../models/Message.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getRooms = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const userIdStr = userId.toString();
  const filter = (req.query.filter || 'all').toLowerCase();
  const search = (req.query.search || '').trim().toLowerCase();

  const baseQuery = {
    $or: [
      { type: 'channel', isPrivate: false },
      { members: userId }
    ]
  };

  if (filter === 'archived') {
    baseQuery.archivedBy = userId;
  } else {
    baseQuery.archivedBy = { $ne: userId };
    if (filter === 'groups') {
      baseQuery.type = 'group';
    } else if (filter === 'favorites') {
      baseQuery.favoritedBy = userId;
    }
  }

  // Find channels (public) or rooms where user is a member
  const rooms = await Room.find(baseQuery)
    .populate('members', 'username email avatar status statusMessage lastSeen')
    .populate({
      path: 'lastMessage',
      populate: { path: 'sender', select: 'username avatar' }
    })
    .sort({ updatedAt: -1 });

  const roomIds = rooms.map((r) => r._id);
  const unreadAgg = roomIds.length
    ? await Message.aggregate([
        {
          $match: {
            room: { $in: roomIds },
            sender: { $ne: userId },
            isDeleted: false,
            deletedFor: { $ne: userId },
            'readBy.user': { $ne: userId }
          }
        },
        { $group: { _id: '$room', count: { $sum: 1 } } }
      ])
    : [];

  const unreadMap = new Map(unreadAgg.map((item) => [item._id.toString(), item.count]));

  let enrichedRooms = rooms.map((roomDoc) => {
    const obj = roomDoc.toObject();
    obj.unreadCount = unreadMap.get(roomDoc._id.toString()) || 0;
    obj.isFavorite = Array.isArray(roomDoc.favoritedBy)
      ? roomDoc.favoritedBy.some((id) => id.toString() === userIdStr)
      : false;
    obj.isPinned = Array.isArray(roomDoc.pinnedBy)
      ? roomDoc.pinnedBy.some((id) => id.toString() === userIdStr)
      : false;
    obj.isArchived = Array.isArray(roomDoc.archivedBy)
      ? roomDoc.archivedBy.some((id) => id.toString() === userIdStr)
      : false;
    return obj;
  });

  // Keep pinned chats at the top, preserving updatedAt descending order
  enrichedRooms.sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  if (filter === 'unread') {
    enrichedRooms = enrichedRooms.filter((r) => r.unreadCount > 0);
  }

  if (search) {
    enrichedRooms = enrichedRooms.filter((r) => {
      if (r.name && r.name.toLowerCase().includes(search)) return true;
      if (r.type === 'direct' && Array.isArray(r.members)) {
        return r.members.some(
          (m) =>
            m._id?.toString() !== userIdStr &&
            m.username?.toLowerCase().includes(search)
        );
      }
      return false;
    });
  }

  res.status(200).json({
    status: 'success',
    results: enrichedRooms.length,
    data: { rooms: enrichedRooms }
  });
});

export const toggleFavoriteRoom = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const room = await Room.findById(id);
  if (!room) {
    throw ApiError.notFound('Room not found');
  }

  const hasAccess =
    room.members.some((m) => m.toString() === userId.toString()) ||
    (room.type === 'channel' && !room.isPrivate);
  if (!hasAccess) {
    throw ApiError.forbidden('You do not have access to this room');
  }

  const alreadyFav = room.favoritedBy.some((uid) => uid.toString() === userId.toString());
  if (alreadyFav) {
    room.favoritedBy = room.favoritedBy.filter((uid) => uid.toString() !== userId.toString());
  } else {
    room.favoritedBy.push(userId);
  }
  await room.save();

  const io = req.app.get('io');
  io?.to(`user:${userId.toString()}`).emit('room:preference_updated', {
    roomId: room._id,
    isFavorite: !alreadyFav
  });

  res.status(200).json({
    status: 'success',
    data: {
      roomId: room._id,
      isFavorite: !alreadyFav
    }
  });
});

export const togglePinRoom = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const room = await Room.findById(id);
  if (!room) throw ApiError.notFound('Room not found');

  const hasAccess =
    room.members.some((m) => m.toString() === userId.toString()) ||
    (room.type === 'channel' && !room.isPrivate);
  if (!hasAccess) throw ApiError.forbidden('You do not have access to this room');

  const alreadyPinned = room.pinnedBy.some((uid) => uid.toString() === userId.toString());
  if (alreadyPinned) {
    room.pinnedBy = room.pinnedBy.filter((uid) => uid.toString() !== userId.toString());
  } else {
    room.pinnedBy.push(userId);
  }
  await room.save();

  const io = req.app.get('io');
  io?.to(`user:${userId.toString()}`).emit('room:preference_updated', {
    roomId: room._id,
    isPinned: !alreadyPinned
  });

  res.status(200).json({
    status: 'success',
    data: {
      roomId: room._id,
      isPinned: !alreadyPinned
    }
  });
});

export const toggleArchiveRoom = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const room = await Room.findById(id);
  if (!room) throw ApiError.notFound('Room not found');

  const hasAccess =
    room.members.some((m) => m.toString() === userId.toString()) ||
    (room.type === 'channel' && !room.isPrivate);
  if (!hasAccess) throw ApiError.forbidden('You do not have access to this room');

  const alreadyArchived = room.archivedBy.some((uid) => uid.toString() === userId.toString());
  if (alreadyArchived) {
    room.archivedBy = room.archivedBy.filter((uid) => uid.toString() !== userId.toString());
  } else {
    room.archivedBy.push(userId);
  }
  await room.save();

  const io = req.app.get('io');
  io?.to(`user:${userId.toString()}`).emit('room:preference_updated', {
    roomId: room._id,
    isArchived: !alreadyArchived
  });

  res.status(200).json({
    status: 'success',
    data: {
      roomId: room._id,
      isArchived: !alreadyArchived
    }
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
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw ApiError.badRequest('Channel name is required');
  }
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

const isMember = (room, userId) => room.members.some((id) => id.toString() === userId.toString());
const isAdmin = (room, userId) => room.admins?.some((id) => id.toString() === userId.toString()) || room.creator?.toString() === userId.toString();

export const createGroup = asyncHandler(async (req, res) => {
  const { name, description = '', avatar = '', memberIds = [] } = req.body;
  const creatorId = req.user._id;

  if (!name?.trim()) throw ApiError.badRequest('Group name is required');

  const uniqueMemberIds = [...new Set([creatorId.toString(), ...memberIds.map(String)])];
  const group = await Room.create({
    name: name.trim(),
    type: 'group',
    description: description.trim(),
    avatar,
    creator: creatorId,
    members: uniqueMemberIds,
    admins: [creatorId]
  });

  const populated = await Room.findById(group._id)
    .populate('members', 'username email avatar status statusMessage lastSeen')
    .populate('creator', 'username email avatar')
    .populate('admins', 'username email avatar');

  res.status(201).json({ status: 'success', data: { room: populated } });
});

export const updateGroup = asyncHandler(async (req, res) => {
  const room = await Room.findById(req.params.id);
  if (!room) throw ApiError.notFound('Group not found');
  if (room.type !== 'group') throw ApiError.badRequest('This room is not a group');
  if (!isAdmin(room, req.user._id)) throw ApiError.forbidden('Only group admins can update the group');

  if (req.body.name?.trim()) room.name = req.body.name.trim();
  if (typeof req.body.description === 'string') room.description = req.body.description.trim();
  if (typeof req.body.avatar === 'string') room.avatar = req.body.avatar;
  await room.save();

  const populated = await Room.findById(room._id)
    .populate('members', 'username email avatar status statusMessage lastSeen')
    .populate('creator', 'username email avatar')
    .populate('admins', 'username email avatar');

  res.status(200).json({ status: 'success', data: { room: populated } });
});

export const addGroupMembers = asyncHandler(async (req, res) => {
  const room = await Room.findById(req.params.id);
  if (!room || room.type !== 'group') throw ApiError.notFound('Group not found');
  if (!isAdmin(room, req.user._id)) throw ApiError.forbidden('Only group admins can add members');

  const memberIds = Array.isArray(req.body.memberIds) ? req.body.memberIds : [];
  if (!memberIds.length) throw ApiError.badRequest('Member IDs are required');

  memberIds.forEach((id) => {
    if (!room.members.some((memberId) => memberId.toString() === id)) room.members.push(id);
  });
  await room.save();

  const populated = await Room.findById(room._id).populate('members', 'username email avatar status statusMessage lastSeen');
  res.status(200).json({ status: 'success', data: { room: populated } });
});

export const removeGroupMember = asyncHandler(async (req, res) => {
  const room = await Room.findById(req.params.id);
  if (!room || room.type !== 'group') throw ApiError.notFound('Group not found');
  if (!isAdmin(room, req.user._id)) throw ApiError.forbidden('Only group admins can remove members');

  const memberId = req.body.memberId || req.params.memberId;
  if (memberId === room.creator.toString()) throw ApiError.badRequest('The group creator cannot be removed');
  room.members = room.members.filter((id) => id.toString() !== memberId);
  room.admins = room.admins.filter((id) => id.toString() !== memberId);
  await room.save();

  const populated = await Room.findById(room._id).populate('members', 'username email avatar status statusMessage lastSeen').populate('admins', 'username email avatar');
  res.status(200).json({ status: 'success', data: { room: populated } });
});

export const setGroupAdmin = asyncHandler(async (req, res) => {
  const room = await Room.findById(req.params.id);
  if (!room || room.type !== 'group') throw ApiError.notFound('Group not found');
  if (room.creator.toString() !== req.user._id.toString()) throw ApiError.forbidden('Only the group creator can change admin roles');

  const memberId = req.body.memberId || req.params.memberId;
  if (!room.members.some((id) => id.toString() === memberId)) throw ApiError.badRequest('User is not a group member');
  const makeAdmin = req.body.makeAdmin !== false;

  if (makeAdmin && !room.admins.some((id) => id.toString() === memberId)) room.admins.push(memberId);
  if (!makeAdmin) room.admins = room.admins.filter((id) => id.toString() !== memberId);
  await room.save();

  const populated = await Room.findById(room._id).populate('members', 'username email avatar status statusMessage lastSeen').populate('admins', 'username email avatar');
  res.status(200).json({ status: 'success', data: { room: populated } });
});

export const leaveGroup = asyncHandler(async (req, res) => {
  const room = await Room.findById(req.params.id);
  if (!room || room.type !== 'group') throw ApiError.notFound('Group not found');
  if (!isMember(room, req.user._id)) throw ApiError.badRequest('You are not a member of this group');
  if (room.creator.toString() === req.user._id.toString()) throw ApiError.badRequest('The creator must delete the group instead of leaving');

  room.members = room.members.filter((id) => id.toString() !== req.user._id.toString());
  room.admins = room.admins.filter((id) => id.toString() !== req.user._id.toString());
  await room.save();
  res.status(200).json({ status: 'success', message: 'Left group successfully' });
});

export const deleteGroup = asyncHandler(async (req, res) => {
  const room = await Room.findById(req.params.id);
  if (!room || room.type !== 'group') throw ApiError.notFound('Group not found');
  if (room.creator.toString() !== req.user._id.toString()) throw ApiError.forbidden('Only the group creator can delete the group');

  await Message.deleteMany({ room: room._id });
  await Room.findByIdAndDelete(room._id);
  res.status(200).json({ status: 'success', message: 'Group deleted successfully' });
});
