import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

import { config } from './config/environment.js';
import { connectDB, closeDB } from './config/db.js';
import { logger } from './utils/logger.js';
import { apiLimiter } from './middlewares/rateLimiter.js';
import { notFoundHandler, errorHandler } from './middlewares/errorMiddleware.js';
import { User } from './models/User.js';
import { Room } from './models/Room.js';
import { Message } from './models/Message.js';
import { sendChatPushNotifications } from './utils/pushNotificationService.js';

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import roomRoutes from './routes/roomRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import callRoutes from './routes/callRoutes.js';
import backupRoutes from './routes/backupRoutes.js';
import securityRoutes from './routes/securityRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import { Call } from './models/Call.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Socket.IO configuration with high performance options
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 30000,
  pingInterval: 15000,
  transports: ['websocket', 'polling']
});

app.set('io', io);

// Security & utility middleware
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);
app.use(
  cors({
    origin: '*',
    credentials: true
  })
);
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (config.env === 'development' && !process.env.TEST) {
  app.use(morgan('dev'));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    env: config.env
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    env: config.env
  });
});

// API Routes with rate limiter
app.use('/api', apiLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/settings', settingsRoutes);

// Serve static frontend build if present
const distPath = path.resolve(__dirname, '../dist');
const clientDistPath = path.resolve(__dirname, '../client/dist');

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// 404 & Global Error Middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Socket.IO Authentication Middleware
io.use(async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.query?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    const decoded = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(decoded.id).select(
      'username email avatar status statusMessage lastSeen tokenVersion privacySettings blockedUsers'
    );
    if (!user) {
      return next(new Error('User not found'));
    }
    if ((decoded.tokenVersion ?? 0) < (user.tokenVersion ?? 0)) {
      return next(new Error('Session expired'));
    }

    socket.user = user;
    next();
  } catch (err) {
    next(new Error('Authentication failed: ' + err.message));
  }
});

// Real-time Presence Map: userId -> Set of socket IDs
const onlineUserSockets = new Map();

// Active Calls Map: callId -> { callerId, calleeId, type, status, startedAt, dbId }
const activeCalls = new Map();

io.on('connection', async (socket) => {
  const userId = socket.user._id.toString();
  const username = socket.user.username;

  // Manage multi-tab socket tracking
  if (!onlineUserSockets.has(userId)) {
    onlineUserSockets.set(userId, new Set());
  }
  onlineUserSockets.get(userId).add(socket.id);

  // Automatically join personal user notification room
  socket.join(`user:${userId}`);

  // Broadcast online status on first active connection (respecting privacy)
  if (onlineUserSockets.get(userId).size === 1) {
    const hideOnline = socket.user.privacySettings?.onlineStatusVisibility === 'nobody';
    if (!hideOnline) {
      io.emit('user:status', { userId, status: 'online' });
      await User.findByIdAndUpdate(userId, { status: 'online', lastSeen: new Date() }).catch(() => {});
    }
  }

  logger.info(`Socket connected: @${username} [socket: ${socket.id}] (active sockets: ${onlineUserSockets.get(userId).size})`);

  // Send current online user IDs to the newly connected client
  socket.emit('users:online_list', Array.from(onlineUserSockets.keys()));

  // 1. Join Room
  socket.on('room:join', async (roomId) => {
    if (!roomId) return;
    const room = await Room.findById(roomId).select('members type isPrivate');
    if (!room) return;
    const isMember = room.members.some((id) => id.toString() === socket.user._id.toString());
    if (!isMember && !(room.type === 'channel' && !room.isPrivate)) return;
    socket.join(roomId);
    logger.debug(`User @${username} joined room ${roomId}`);

    // Mark messages in this room as delivered
    try {
      await Message.updateMany(
        {
          room: roomId,
          sender: { $ne: socket.user._id },
          'deliveredTo.user': { $ne: socket.user._id }
        },
        {
          $push: { deliveredTo: { user: socket.user._id, deliveredAt: new Date() } },
          $set: { status: 'delivered' }
        }
      );
      socket.to(roomId).emit('message:delivered_receipt', {
        roomId,
        userId: socket.user._id,
        deliveredAt: new Date()
      });
    } catch (err) {
      // Non-fatal
    }
  });

  // 2. Leave Room
  socket.on('room:leave', (roomId) => {
    if (!roomId) return;
    socket.leave(roomId);
    logger.debug(`User @${username} left room ${roomId}`);
  });

  // 3. Instant Message Send (Socket path)
  socket.on('message:send', async (data, callback) => {
    try {
      const {
        roomId,
        content,
        clientTempId,
        attachments = [],
        replyTo = null,
        isForwarded = false,
        forwardedFrom = null
      } = data;
      if (!roomId || !content || !content.trim()) {
        if (typeof callback === 'function') {
          callback({ status: 'error', message: 'Room and content are required' });
        }
        return;
      }

      const room = await Room.findById(roomId);
      if (!room) {
        if (typeof callback === 'function') {
          callback({ status: 'error', message: 'Room not found' });
        }
        return;
      }

      const isMember = room.members.some((id) => id.toString() === socket.user._id.toString());
      if (!isMember && !(room.type === 'channel' && !room.isPrivate)) {
        if (typeof callback === 'function') {
          callback({ status: 'error', message: 'You are not a room member' });
        }
        return;
      }

      if (room.type === 'direct') {
        const otherId = room.members.find((id) => id.toString() !== userId);
        if (otherId) {
          const otherDoc = await User.findById(otherId).select('blockedUsers');
          const blocked =
            socket.user.blockedUsers?.some((id) => id.toString() === otherId.toString()) ||
            otherDoc?.blockedUsers?.some((id) => id.toString() === userId);
          if (blocked) {
            if (typeof callback === 'function') {
              callback({ status: 'error', message: 'Cannot send message to a blocked user' });
            }
            return;
          }
        }
      }

      // Create message in MongoDB
      const message = await Message.create({
        room: roomId,
        sender: socket.user._id,
        content: content.trim(),
        attachments,
        status: 'sent',
        replyTo: replyTo || null,
        isForwarded: Boolean(isForwarded),
        forwardedFrom: forwardedFrom || null
      });

      const populated = await message.populate([
        { path: 'sender', select: 'username email avatar status statusMessage lastSeen' },
        {
          path: 'replyTo',
          select: 'content sender isDeleted createdAt',
          populate: { path: 'sender', select: 'username avatar' }
        },
        { path: 'forwardedFrom', select: 'username avatar' }
      ]);

      // Update room lastMessage & timestamp
      room.lastMessage = message._id;
      room.updatedAt = new Date();
      await room.save();

      const messageObj = {
        ...populated.toObject(),
        clientTempId
      };

      // Broadcast to room
      io.to(roomId).emit('message:received', messageObj);

      // Notify other room members who are not currently viewing this room
      room.members.forEach((memberId) => {
        const memberStr = memberId.toString();
        if (memberStr !== userId) {
          io.to(`user:${memberStr}`).emit('notification:new_message', {
            roomId,
            roomName: room.name,
            roomType: room.type,
            message: populated
          });
        }
      });

      // Send push notifications for mobile devices
      sendChatPushNotifications({
        io,
        senderId: userId,
        recipientIds: room.members.filter((id) => id.toString() !== userId),
        senderName: socket.user.username,
        roomId,
        roomName: room.name,
        roomType: room.type,
        content: content.trim(),
        messageId: message._id
      }).catch((err) => logger.warn(`Push notification error: ${err.message}`));

      if (typeof callback === 'function') {
        callback({ status: 'ok', data: messageObj });
      }
    } catch (err) {
      logger.error(`Error in message:send: ${err.message}`);
      if (typeof callback === 'function') {
        callback({ status: 'error', message: err.message });
      }
    }
  });

  // 4. Typing Indicators
  socket.on('typing:start', ({ roomId }) => {
    if (!roomId) return;
    socket.to(roomId).emit('typing:status', {
      roomId,
      user: { id: socket.user._id, username: socket.user.username },
      isTyping: true
    });
  });

  socket.on('typing:stop', ({ roomId }) => {
    if (!roomId) return;
    socket.to(roomId).emit('typing:status', {
      roomId,
      user: { id: socket.user._id, username: socket.user.username },
      isTyping: false
    });
  });

  // 5. Read Receipts
  socket.on('message:read', async ({ roomId, messageIds }) => {
    if (!roomId) return;
    try {
      const query = {
        room: roomId,
        sender: { $ne: socket.user._id },
        'readBy.user': { $ne: socket.user._id }
      };
      if (messageIds && messageIds.length > 0) {
        query._id = { $in: messageIds };
      }

      await Message.updateMany(query, {
        $push: { readBy: { user: socket.user._id, readAt: new Date() } },
        $set: { status: 'read' }
      });

      io.to(roomId).emit('message:read_receipt', {
        roomId,
        readerId: socket.user._id,
        messageIds,
        readAt: new Date()
      });
    } catch (err) {
      logger.error(`Error processing read receipt: ${err.message}`);
    }
  });

  // 6. Delivered Receipts
  socket.on('message:delivered', async ({ roomId, messageIds }) => {
    if (!messageIds || messageIds.length === 0) return;
    try {
      await Message.updateMany(
        {
          _id: { $in: messageIds },
          sender: { $ne: socket.user._id },
          'deliveredTo.user': { $ne: socket.user._id }
        },
        {
          $push: { deliveredTo: { user: socket.user._id, deliveredAt: new Date() } },
          $set: { status: 'delivered' }
        }
      );

      if (roomId) {
        io.to(roomId).emit('message:delivered_receipt', {
          roomId,
          userId: socket.user._id,
          messageIds,
          deliveredAt: new Date()
        });
      }
    } catch (err) {
      // Non-fatal
    }
  });

  // ─── Call Signaling Events ─────────────────────────────────────────────────

  // 7. Initiate a call
  socket.on('call:initiate', async ({ calleeId, type, callId }) => {
    try {
      if (!calleeId || !type || !callId) return;

      const calleeIdStr = calleeId.toString();
      const isCalleeOnline = onlineUserSockets.has(calleeIdStr);

      // Check if either user has blocked the other
      const calleeDoc = await User.findById(calleeIdStr).select('blockedUsers');
      const isBlocked =
        socket.user.blockedUsers?.some((id) => id.toString() === calleeIdStr) ||
        calleeDoc?.blockedUsers?.some((id) => id.toString() === userId);
      if (isBlocked) {
        socket.emit('call:failed', { callId, reason: 'user_blocked' });
        return;
      }

      // Check if callee is already in an active call
      const calleeAlreadyInCall = Array.from(activeCalls.values()).some(
        (c) => (c.callerId === calleeIdStr || c.calleeId === calleeIdStr) && c.status !== 'ended'
      );

      if (calleeAlreadyInCall) {
        socket.emit('call:busy', { callId, reason: 'User is already in a call' });
        return;
      }

      if (!isCalleeOnline) {
        // Create missed call record
        const callDoc = await Call.create({
          callId,
          caller: userId,
          callee: calleeId,
          type,
          status: 'missed',
          startedAt: new Date(),
          endedAt: new Date(),
          endReason: 'missed'
        });
        socket.emit('call:failed', { callId, reason: 'user_offline' });
        logger.info(`Call ${callId}: callee ${calleeIdStr} is offline — marked missed`);
        return;
      }

      // Create ringing call record in DB
      const callDoc = await Call.create({
        callId,
        caller: userId,
        callee: calleeId,
        type,
        status: 'ringing',
        startedAt: new Date()
      });

      // Track in memory
      activeCalls.set(callId, {
        callerId: userId,
        calleeId: calleeIdStr,
        type,
        status: 'ringing',
        startedAt: new Date(),
        dbId: callDoc._id
      });

      // Notify callee
      io.to(`user:${calleeIdStr}`).emit('call:incoming', {
        callId,
        callerId: userId,
        callerName: socket.user.username,
        callerAvatar: socket.user.avatar,
        type
      });

      // Confirm to caller
      socket.emit('call:ringing', { callId });
      logger.info(`Call ${callId}: @${username} → ${calleeIdStr} [${type}]`);
    } catch (err) {
      logger.error(`call:initiate error: ${err.message}`);
      socket.emit('call:failed', { callId, reason: 'server_error' });
    }
  });

  // 8. Accept a call
  socket.on('call:accept', async ({ callId }) => {
    try {
      if (!callId) return;
      const call = activeCalls.get(callId);
      if (!call || call.calleeId !== userId) return;

      const now = new Date();
      await Call.findOneAndUpdate(
        { callId },
        { status: 'accepted', answeredAt: now }
      );

      call.status = 'accepted';
      call.answeredAt = now;
      activeCalls.set(callId, call);

      io.to(`user:${call.callerId}`).emit('call:accepted', { callId });
      logger.info(`Call ${callId}: accepted by @${username}`);
    } catch (err) {
      logger.error(`call:accept error: ${err.message}`);
    }
  });

  // 9. Reject a call
  socket.on('call:reject', async ({ callId, reason = 'rejected' }) => {
    try {
      if (!callId) return;
      const call = activeCalls.get(callId);
      if (!call || call.calleeId !== userId) return;

      const now = new Date();
      const dbStatus = reason === 'busy' ? 'busy' : 'rejected';
      const endReason = reason === 'busy' ? 'busy' : 'rejected';

      await Call.findOneAndUpdate(
        { callId },
        { status: dbStatus, endedAt: now, endReason }
      );

      activeCalls.delete(callId);

      io.to(`user:${call.callerId}`).emit('call:rejected', { callId, reason });
      logger.info(`Call ${callId}: rejected by @${username} (reason: ${reason})`);
    } catch (err) {
      logger.error(`call:reject error: ${err.message}`);
    }
  });

  // 10. End a call (either party)
  socket.on('call:end', async ({ callId, duration }) => {
    try {
      if (!callId) return;
      const call = activeCalls.get(callId);
      if (!call) return;
      if (call.callerId !== userId && call.calleeId !== userId) return;

      const now = new Date();
      const finalDuration =
        duration != null
          ? duration
          : call.answeredAt
          ? Math.floor((now - new Date(call.answeredAt)) / 1000)
          : 0;

      await Call.findOneAndUpdate(
        { callId },
        { status: 'ended', endedAt: now, duration: finalDuration, endReason: 'completed' }
      );

      activeCalls.delete(callId);

      // Notify the OTHER party
      const otherUserId = call.callerId === userId ? call.calleeId : call.callerId;
      io.to(`user:${otherUserId}`).emit('call:ended', { callId });
      logger.info(`Call ${callId}: ended by @${username} (duration: ${finalDuration}s)`);
    } catch (err) {
      logger.error(`call:end error: ${err.message}`);
    }
  });

  // 11. Cancel a call (caller cancels before callee answers)
  socket.on('call:cancel', async ({ callId }) => {
    try {
      if (!callId) return;
      const call = activeCalls.get(callId);
      if (!call || call.callerId !== userId) return;

      await Call.findOneAndUpdate(
        { callId },
        { status: 'missed', endedAt: new Date(), endReason: 'cancelled' }
      );

      activeCalls.delete(callId);

      io.to(`user:${call.calleeId}`).emit('call:cancelled', { callId });
      logger.info(`Call ${callId}: cancelled by caller @${username}`);
    } catch (err) {
      logger.error(`call:cancel error: ${err.message}`);
    }
  });

  // 12. No answer (timeout, typically 45s — emitted by caller client)
  socket.on('call:no_answer', async ({ callId }) => {
    try {
      if (!callId) return;
      const call = activeCalls.get(callId);
      if (!call || call.callerId !== userId) return;

      await Call.findOneAndUpdate(
        { callId },
        { status: 'missed', endedAt: new Date(), endReason: 'missed' }
      );

      activeCalls.delete(callId);

      io.to(`user:${call.calleeId}`).emit('call:missed', {
        callId,
        callerName: socket.user.username
      });
      logger.info(`Call ${callId}: no answer — marked missed`);
    } catch (err) {
      logger.error(`call:no_answer error: ${err.message}`);
    }
  });

  // 13. WebRTC Offer relay
  socket.on('call:webrtc_offer', ({ callId, offer, targetUserId }) => {
    if (!callId || !offer || !targetUserId) return;
    io.to(`user:${targetUserId}`).emit('call:webrtc_offer', {
      callId,
      offer,
      fromUserId: userId
    });
  });

  // 14. WebRTC Answer relay
  socket.on('call:webrtc_answer', ({ callId, answer, targetUserId }) => {
    if (!callId || !answer || !targetUserId) return;
    io.to(`user:${targetUserId}`).emit('call:webrtc_answer', {
      callId,
      answer,
      fromUserId: userId
    });
  });

  // 15. WebRTC ICE Candidate relay
  socket.on('call:webrtc_ice', ({ callId, candidate, targetUserId }) => {
    if (!callId || !candidate || !targetUserId) return;
    io.to(`user:${targetUserId}`).emit('call:webrtc_ice', {
      callId,
      candidate,
      fromUserId: userId
    });
  });

  // ─── Disconnection ─────────────────────────────────────────────────────────

  // 16. Disconnection
  socket.on('disconnect', async () => {
    logger.info(`Socket disconnected: @${username} [socket: ${socket.id}]`);
    const userSockets = onlineUserSockets.get(userId);
    if (userSockets) {
      userSockets.delete(socket.id);
      if (userSockets.size === 0) {
        onlineUserSockets.delete(userId);
        io.emit('user:status', { userId, status: 'offline', lastSeen: new Date() });
        await User.findByIdAndUpdate(userId, { status: 'offline', lastSeen: new Date() }).catch(() => {});

        // Handle any active calls involving this user
        for (const [callId, call] of activeCalls.entries()) {
          if (call.callerId === userId || call.calleeId === userId) {
            try {
              await Call.findOneAndUpdate(
                { callId },
                { status: 'ended', endedAt: new Date(), endReason: 'network_error' }
              );
              activeCalls.delete(callId);

              const otherUserId = call.callerId === userId ? call.calleeId : call.callerId;
              io.to(`user:${otherUserId}`).emit('call:ended', {
                callId,
                reason: 'network_error'
              });
              logger.warn(`Call ${callId}: ended due to disconnect of @${username}`);
            } catch (err) {
              logger.error(`Error cleaning up call ${callId} on disconnect: ${err.message}`);
            }
          }
        }
      }
    }
  });
});

// Start Server
export const startServer = async (port = config.port) => {
  await connectDB();
  return new Promise((resolve) => {
    server.listen(port, () => {
      logger.success(`Server running on port ${port} in [${config.env}] mode`);
      logger.info(`API Base URL: http://localhost:${port}/api`);
      resolve(server);
    });
  });
};

// Graceful Shutdown
const handleShutdown = async (signal) => {
  logger.warn(`Received ${signal}. Gracefully terminating server...`);
  server.close(async () => {
    await closeDB();
    logger.success('Server terminated cleanly.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

// Auto-start if run directly
const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith('server.js') ||
  process.argv[1].endsWith('server')
);

if (isDirectRun && !process.env.TEST) {
  startServer();
}

export { app, server };
