import jwt from 'jsonwebtoken';
import { config } from '../config/environment.js';
import { ApiError } from '../utils/apiError.js';
import { User } from '../models/User.js';

export const authenticateToken = async (req, res, next) => {
  try {
    let token = null;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      throw ApiError.unauthorized('Access denied. No authentication token provided.');
    }

    const decoded = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(decoded.id);

    if (!user) {
      throw ApiError.unauthorized('User associated with this token no longer exists');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      next(ApiError.unauthorized('Invalid authentication token'));
    } else if (error.name === 'TokenExpiredError') {
      next(ApiError.unauthorized('Authentication token has expired'));
    } else {
      next(error);
    }
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    let token = null;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (token) {
      const decoded = jwt.verify(token, config.jwtSecret);
      const user = await User.findById(decoded.id);
      if (user) {
        req.user = user;
      }
    }
    next();
  } catch (err) {
    // If token invalid in optionalAuth, proceed as unauthenticated
    next();
  }
};
