import crypto from 'crypto';
import { Backup } from '../models/Backup.js';
import { Room } from '../models/Room.js';
import { Message } from '../models/Message.js';
import { config } from '../config/environment.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function getEncryptionKey() {
  return crypto.createHash('sha256').update(String(config.jwtSecret)).digest();
}

function encryptSnapshot(payloadObj) {
  const json = JSON.stringify(payloadObj);
  const checksum = crypto.createHash('sha256').update(json).digest('hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    checksum,
    sizeBytes: Buffer.byteLength(json, 'utf8'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    ciphertext: encrypted.toString('base64')
  };
}

function decryptSnapshot(backupDoc) {
  if (!backupDoc.ciphertext || !backupDoc.iv || !backupDoc.authTag) {
    throw ApiError.badRequest('Backup snapshot is empty or corrupted');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(backupDoc.iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(backupDoc.authTag, 'hex'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(backupDoc.ciphertext, 'base64')),
    decipher.final()
  ]).toString('utf8');

  const computedChecksum = crypto.createHash('sha256').update(decrypted).digest('hex');
  if (backupDoc.checksum && computedChecksum !== backupDoc.checksum) {
    throw ApiError.internal('Backup integrity verification failed');
  }

  return JSON.parse(decrypted);
}

/**
 * @desc   Get current user's backup status & settings
 * @route  GET /api/backup/status
 */
export const getBackupStatus = asyncHandler(async (req, res) => {
  const backup = await Backup.findOne({ user: req.user._id });

  res.status(200).json({
    status: 'success',
    data: {
      hasBackup: Boolean(backup?.lastBackupAt),
      status: backup?.status || 'completed',
      autoBackupEnabled: backup?.autoBackupEnabled || false,
      autoBackupFrequency: backup?.autoBackupFrequency || 'daily',
      lastBackupAt: backup?.lastBackupAt || null,
      lastSyncAt: backup?.lastSyncAt || null,
      stats: backup?.stats || { roomCount: 0, messageCount: 0, mediaCount: 0, sizeBytes: 0 },
      lastError: backup?.lastError || ''
    }
  });
});

/**
 * @desc   Update automatic backup settings
 * @route  PUT /api/backup/settings
 */
export const updateBackupSettings = asyncHandler(async (req, res) => {
  const { autoBackupEnabled, autoBackupFrequency } = req.body;
  const updates = {};

  if (typeof autoBackupEnabled === 'boolean') {
    updates.autoBackupEnabled = autoBackupEnabled;
  }
  if (['daily', 'weekly', 'manual'].includes(autoBackupFrequency)) {
    updates.autoBackupFrequency = autoBackupFrequency;
  }

  const backup = await Backup.findOneAndUpdate(
    { user: req.user._id },
    { $set: updates },
    { new: true, upsert: true }
  );

  res.status(200).json({
    status: 'success',
    data: {
      autoBackupEnabled: backup.autoBackupEnabled,
      autoBackupFrequency: backup.autoBackupFrequency
    }
  });
});

/**
 * @desc   Create encrypted backup snapshot of conversations, messages & media
 * @route  POST /api/backup/create
 */
export const createBackup = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const userIdStr = userId.toString();

  const rooms = await Room.find({
    $or: [{ type: 'channel', isPrivate: false }, { members: userId }]
  })
    .populate('members', 'username email avatar')
    .lean();

  const roomIds = rooms.map((r) => r._id);

  const messages = roomIds.length
    ? await Message.find({
        room: { $in: roomIds },
        deletedFor: { $ne: userId }
      })
        .populate('sender', 'username avatar')
        .sort({ createdAt: 1 })
        .lean()
    : [];

  // Deduplicate messages by _id and collect media attachments
  const uniqueMessagesMap = new Map();
  const media = [];

  for (const msg of messages) {
    const idStr = msg._id.toString();
    if (!uniqueMessagesMap.has(idStr)) {
      uniqueMessagesMap.set(idStr, msg);
      if (Array.isArray(msg.attachments)) {
        for (const att of msg.attachments) {
          media.push({
            messageId: idStr,
            roomId: msg.room.toString(),
            url: att.url,
            filename: att.filename,
            fileType: att.fileType,
            fileSize: att.fileSize || 0,
            createdAt: msg.createdAt
          });
        }
      }
    }
  }

  const dedupedMessages = Array.from(uniqueMessagesMap.values());

  const roomSnapshots = rooms.map((r) => ({
    ...r,
    isFavorite: Array.isArray(r.favoritedBy)
      ? r.favoritedBy.some((id) => id.toString() === userIdStr)
      : false,
    isPinned: Array.isArray(r.pinnedBy)
      ? r.pinnedBy.some((id) => id.toString() === userIdStr)
      : false,
    isArchived: Array.isArray(r.archivedBy)
      ? r.archivedBy.some((id) => id.toString() === userIdStr)
      : false
  }));

  const snapshot = {
    version: 1,
    createdAt: new Date().toISOString(),
    userId: userIdStr,
    rooms: roomSnapshots,
    messages: dedupedMessages,
    media
  };

  const encrypted = encryptSnapshot(snapshot);
  const now = new Date();
  const stats = {
    roomCount: roomSnapshots.length,
    messageCount: dedupedMessages.length,
    mediaCount: media.length,
    sizeBytes: encrypted.sizeBytes
  };

  const backup = await Backup.findOneAndUpdate(
    { user: userId },
    {
      $set: {
        status: 'completed',
        lastBackupAt: now,
        lastSyncAt: now,
        stats,
        checksum: encrypted.checksum,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        ciphertext: encrypted.ciphertext,
        lastError: ''
      }
    },
    { new: true, upsert: true }
  );

  const io = req.app.get('io');
  io?.to(`user:${userIdStr}`).emit('backup:completed', {
    lastBackupAt: now,
    stats
  });

  res.status(200).json({
    status: 'success',
    message: 'Backup completed securely',
    data: {
      lastBackupAt: backup.lastBackupAt,
      stats: backup.stats,
      checksum: backup.checksum,
      status: backup.status
    }
  });
});

/**
 * @desc   Restore encrypted backup snapshot & prevent duplicates
 * @route  POST /api/backup/restore
 */
export const restoreBackup = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const backup = await Backup.findOne({ user: userId }).select('+iv +authTag +ciphertext');

  if (!backup || !backup.ciphertext) {
    throw ApiError.notFound('No backup found for your account');
  }

  const snapshot = decryptSnapshot(backup);
  const restoredRooms = Array.isArray(snapshot.rooms) ? snapshot.rooms : [];
  const rawMessages = Array.isArray(snapshot.messages) ? snapshot.messages : [];
  const media = Array.isArray(snapshot.media) ? snapshot.media : [];

  // Re-apply user room preferences (favorite/pin/archive) if rooms still exist in MongoDB
  for (const r of restoredRooms) {
    if (!r._id) continue;
    const ops = { $addToSet: {}, $pull: {} };
    if (r.isFavorite) ops.$addToSet.favoritedBy = userId;
    if (r.isPinned) ops.$addToSet.pinnedBy = userId;
    if (r.isArchived) ops.$addToSet.archivedBy = userId;
    if (Object.keys(ops.$addToSet).length > 0) {
      await Room.findByIdAndUpdate(r._id, { $addToSet: ops.$addToSet }).catch(() => {});
    }
  }

  // Deduplicate messages by _id
  const seenIds = new Set();
  const dedupedMessages = [];
  for (const msg of rawMessages) {
    const id = msg?._id?.toString();
    if (!id || seenIds.has(id)) continue;
    seenIds.add(id);
    dedupedMessages.push(msg);
  }

  const now = new Date();
  backup.lastSyncAt = now;
  await backup.save();

  res.status(200).json({
    status: 'success',
    message: 'Backup restored successfully',
    data: {
      lastBackupAt: backup.lastBackupAt,
      restoredAt: now,
      stats: {
        roomCount: restoredRooms.length,
        messageCount: dedupedMessages.length,
        mediaCount: media.length
      },
      rooms: restoredRooms,
      messages: dedupedMessages,
      media
    }
  });
});

/**
 * @desc   Incremental multi-device sync since a timestamp
 * @route  GET /api/backup/sync?since=ISO8601
 */
export const syncData = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const userIdStr = userId.toString();
  const sinceDate = req.query.since ? new Date(req.query.since) : new Date(0);

  if (Number.isNaN(sinceDate.getTime())) {
    throw ApiError.badRequest('Invalid since timestamp');
  }

  const rooms = await Room.find({
    $or: [{ type: 'channel', isPrivate: false }, { members: userId }]
  })
    .populate('members', 'username email avatar status statusMessage lastSeen')
    .sort({ updatedAt: -1 })
    .lean();

  const roomIds = rooms.map((r) => r._id);

  const messages = roomIds.length
    ? await Message.find({
        room: { $in: roomIds },
        deletedFor: { $ne: userId },
        updatedAt: { $gte: sinceDate }
      })
        .populate('sender', 'username avatar')
        .populate({
          path: 'replyTo',
          select: 'content sender isDeleted createdAt',
          populate: { path: 'sender', select: 'username avatar' }
        })
        .sort({ createdAt: 1 })
        .limit(500)
        .lean()
    : [];

  const now = new Date();
  await Backup.findOneAndUpdate(
    { user: userId },
    { $set: { lastSyncAt: now } },
    { upsert: true }
  );

  const enrichedRooms = rooms.map((r) => ({
    ...r,
    isFavorite: Array.isArray(r.favoritedBy)
      ? r.favoritedBy.some((id) => id.toString() === userIdStr)
      : false,
    isPinned: Array.isArray(r.pinnedBy)
      ? r.pinnedBy.some((id) => id.toString() === userIdStr)
      : false,
    isArchived: Array.isArray(r.archivedBy)
      ? r.archivedBy.some((id) => id.toString() === userIdStr)
      : false
  }));

  res.status(200).json({
    status: 'success',
    data: {
      serverTime: now.toISOString(),
      rooms: enrichedRooms,
      messages,
      syncedCount: messages.length
    }
  });
});
