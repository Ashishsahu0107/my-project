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

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import roomRoutes from './routes/roomRoutes.js';
import messageRoutes from './routes/messageRoutes.js';

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
    const user = await User.findById(decoded.id).select('username email avatar status statusMessage lastSeen');
    if (!user) {
      return next(new Error('User not found'));
    }

    socket.user = user;
    next();
  } catch (err) {
    next(new Error('Authentication failed: ' + err.message));
  }
});

// Real-time Presence Map: userId -> Set of socket IDs
const onlineUserSockets = new Map();

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

  // Broadcast online status on first active connection
  if (onlineUserSockets.get(userId).size === 1) {
    io.emit('user:status', { userId, status: 'online' });
    await User.findByIdAndUpdate(userId, { status: 'online', lastSeen: new Date() }).catch(() => {});
  }

  logger.info(`Socket connected: @${username} [socket: ${socket.id}] (active sockets: ${onlineUserSockets.get(userId).size})`);

  // Send current online user IDs to the newly connected client
  socket.emit('users:online_list', Array.from(onlineUserSockets.keys()));

  // 1. Join Room
  socket.on('room:join', async (roomId) => {
    if (!roomId) return;
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
      const { roomId, content, clientTempId, attachments = [] } = data;
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

      // Create message in MongoDB
      const message = await Message.create({
        room: roomId,
        sender: socket.user._id,
        content: content.trim(),
        attachments,
        status: 'sent'
      });

      const populated = await message.populate('sender', 'username email avatar status statusMessage lastSeen');

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

  // 7. Disconnection
  socket.on('disconnect', async () => {
    logger.info(`Socket disconnected: @${username} [socket: ${socket.id}]`);
    const userSockets = onlineUserSockets.get(userId);
    if (userSockets) {
      userSockets.delete(socket.id);
      if (userSockets.size === 0) {
        onlineUserSockets.delete(userId);
        io.emit('user:status', { userId, status: 'offline', lastSeen: new Date() });
        await User.findByIdAndUpdate(userId, { status: 'offline', lastSeen: new Date() }).catch(() => {});
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
