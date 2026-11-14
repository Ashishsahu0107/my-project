import { ApiError } from '../utils/apiError.js';

export const validateRegister = (req, res, next) => {
  const { username, email, password } = req.body;

  if (!username || typeof username !== 'string' || username.trim().length < 3) {
    return next(ApiError.badRequest('Username must be at least 3 characters long'));
  }

  if (username.length > 30) {
    return next(ApiError.badRequest('Username cannot exceed 30 characters'));
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
    return next(ApiError.badRequest('Username can only contain alphanumeric characters and underscores'));
  }

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return next(ApiError.badRequest('A valid email address is required'));
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    return next(ApiError.badRequest('Password must be at least 6 characters long'));
  }

  next();
};

export const validateLogin = (req, res, next) => {
  const { emailOrUsername, password } = req.body;

  if (!emailOrUsername || typeof emailOrUsername !== 'string') {
    return next(ApiError.badRequest('Email or username is required'));
  }

  if (!password || typeof password !== 'string') {
    return next(ApiError.badRequest('Password is required'));
  }

  next();
};

export const validateMessage = (req, res, next) => {
  const { content, roomId } = req.body;

  if (!roomId) {
    return next(ApiError.badRequest('Room ID is required'));
  }

  if (!content || typeof content !== 'string' || !content.trim()) {
    return next(ApiError.badRequest('Message content cannot be empty'));
  }

  if (content.length > 5000) {
    return next(ApiError.badRequest('Message content cannot exceed 5000 characters'));
  }

  next();
};

export const validateRoom = (req, res, next) => {
  const { name, type } = req.body;

  if (type === 'channel') {
    if (!name || typeof name !== 'string' || !name.trim()) {
      return next(ApiError.badRequest('Channel name is required'));
    }
    if (name.length > 50) {
      return next(ApiError.badRequest('Channel name cannot exceed 50 characters'));
    }
  }

  next();
};
