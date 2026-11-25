import rateLimit from 'express-rate-limit';
import { config } from '../config/environment.js';

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.env === 'development' ? 5000 : config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Too many requests from this IP. Please try again later.'
  }
});

// Stricter rate limiter for sensitive authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.env === 'development' ? 200 : 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Too many authentication attempts, please try again in 15 minutes.'
  }
});

// Rate limiter for OTP dispatch
export const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: config.env === 'development' ? 50 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Too many OTP requests, please wait a few minutes before trying again.'
  }
});
