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

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import roomRoutes from './routes/roomRoutes.js';
import messageRoutes from './routes/messageRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Socket.IO configuration
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
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
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    const decoded = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(decoded.id).select('username email avatar status');
    if (!user) {
      return next(new Error('User not found'));
    }

    socket.user = user;
    next();
  } catch (err) {
    next(new Error('Authentication failed'));
  }
});

// Socket.IO Real-time Events
const onlineUsers = new Map();

io.on('connection', async (socket) => {
  const userId = socket.user._id.toString();
  logger.info(`Socket client connected: ${socket.user.username} (${socket.id})`);

  onlineUsers.set(userId, socket.id);
  io.emit('user:status', { userId, status: 'online' });

  await User.findByIdAndUpdate(userId, { status: 'online', lastSeen: new Date() }).catch(() => {});

  socket.on('room:join', (roomId) => {
    socket.join(roomId);
    logger.debug(`User ${socket.user.username} joined room ${roomId}`);
  });

  socket.on('room:leave', (roomId) => {
    socket.leave(roomId);
    logger.debug(`User ${socket.user.username} left room ${roomId}`);
  });

  socket.on('typing:start', ({ roomId }) => {
    socket.to(roomId).emit('typing:status', {
      roomId,
      user: { id: socket.user._id, username: socket.user.username },
      isTyping: true
    });
  });

  socket.on('typing:stop', ({ roomId }) => {
    socket.to(roomId).emit('typing:status', {
      roomId,
      user: { id: socket.user._id, username: socket.user.username },
      isTyping: false
    });
  });

  socket.on('disconnect', async () => {
    logger.info(`Socket client disconnected: ${socket.user.username}`);
    onlineUsers.delete(userId);
    io.emit('user:status', { userId, status: 'offline' });
    await User.findByIdAndUpdate(userId, { status: 'offline', lastSeen: new Date() }).catch(() => {});
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
