import express from 'express';
import {
  register,
  login,
  verifyOTP,
  resendOTP,
  refreshTokenHandler,
  forgotPassword,
  resetPassword,
  logout,
  getMe,
  updateProfile
} from '../controllers/authController.js';
import {
  validateRegister,
  validateLogin,
  validateVerifyOtp,
  validateResendOtp,
  validateRefreshToken,
  validateForgotPassword,
  validateResetPassword
} from '../middlewares/validationMiddleware.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';
import { authLimiter, otpLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

// Public Authentication Endpoints
router.post('/register', authLimiter, validateRegister, register);
router.post('/verify-otp', otpLimiter, validateVerifyOtp, verifyOTP);
router.post('/resend-otp', otpLimiter, validateResendOtp, resendOTP);
router.post('/login', authLimiter, validateLogin, login);
router.post('/refresh-token', validateRefreshToken, refreshTokenHandler);
router.post('/forgot-password', otpLimiter, validateForgotPassword, forgotPassword);
router.post('/reset-password', authLimiter, validateResetPassword, resetPassword);

// Protected Authentication Endpoints
router.post('/logout', authenticateToken, logout);
router.get('/me', authenticateToken, getMe);
router.put('/profile', authenticateToken, updateProfile);

export default router;
