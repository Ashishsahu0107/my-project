import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { Room } from '../models/Room.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { config } from '../config/environment.js';
import { sendVerificationOTP, sendPasswordResetOTP } from '../utils/emailService.js';

// Helper to generate secure 6-digit numeric OTP
const generateNumericOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Helper to ensure user joins general channel
const ensureJoinedGeneral = async (userId) => {
  try {
    let generalRoom = await Room.findOne({ name: 'general', type: 'channel' });
    if (!generalRoom) {
      generalRoom = await Room.create({
        name: 'general',
        type: 'channel',
        description: 'The town square — general discussions and welcome area',
        creator: userId,
        members: [userId]
      });
    } else if (!generalRoom.members.includes(userId)) {
      generalRoom.members.push(userId);
      await generalRoom.save();
    }
  } catch (err) {
    // Non-fatal if room joining fails during auth
    console.error('Failed to join general room:', err.message);
  }
};

/**
 * @desc   Register a new user & trigger Email OTP verification
 * @route  POST /api/auth/register
 */
export const register = asyncHandler(async (req, res) => {
  const { username, email, password, avatar } = req.body;
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedUsername = username.toLowerCase().trim();

  // Check if an existing verified user matches
  const existingUser = await User.findOne({
    $or: [{ email: normalizedEmail }, { username: normalizedUsername }]
  }).select('+otp.code +otp.expiresAt');

  const otpCode = generateNumericOTP();
  const salt = await bcrypt.genSalt(10);
  const hashedOtp = await bcrypt.hash(otpCode, salt);
  const otpExpiry = new Date(Date.now() + config.otpExpiryMinutes * 60 * 1000);

  let user;

  if (existingUser) {
    if (existingUser.isVerified) {
      if (existingUser.email === normalizedEmail) {
        throw ApiError.conflict('An account with this email address already exists');
      }
      throw ApiError.conflict('This username is already taken');
    }

    // User exists but has not verified their email yet - allow them to update details and retry OTP
    existingUser.username = normalizedUsername;
    existingUser.email = normalizedEmail;
    existingUser.password = password;
    if (avatar) existingUser.avatar = avatar;
    existingUser.otp = {
      code: hashedOtp,
      expiresAt: otpExpiry,
      attempts: 0
    };
    await existingUser.save();
    user = existingUser;
  } else {
    // Create new unverified user
    const defaultAvatar = avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(normalizedUsername)}`;

    user = await User.create({
      username: normalizedUsername,
      email: normalizedEmail,
      password,
      avatar: defaultAvatar,
      isVerified: false,
      status: 'offline',
      otp: {
        code: hashedOtp,
        expiresAt: otpExpiry,
        attempts: 0
      }
    });
  }

  // Dispatch Email OTP
  await sendVerificationOTP(user.email, user.username, otpCode);

  res.status(201).json({
    status: 'success',
    message: 'Registration successful! Verification code sent to your email.',
    data: {
      userId: user._id,
      email: user.email,
      username: user.username,
      isVerified: false,
      expiresInMinutes: config.otpExpiryMinutes,
      ...(config.env === 'development' && { devOtp: otpCode })
    }
  });
});

/**
 * @desc   Verify 6-digit email OTP after registration
 * @route  POST /api/auth/verify-otp
 */
export const verifyOTP = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  const normalizedEmail = email.toLowerCase().trim();

  const user = await User.findOne({ email: normalizedEmail }).select(
    '+otp.code +otp.expiresAt +otp.attempts +refreshToken'
  );

  if (!user) {
    throw ApiError.notFound('Account not found with this email address');
  }

  if (user.isVerified) {
    // If already verified, issue tokens directly
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    user.status = 'online';
    user.lastSeen = new Date();
    await user.save();

    return res.status(200).json({
      status: 'success',
      message: 'Account is already verified. Logged in successfully.',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          status: user.status,
          statusMessage: user.statusMessage,
          isVerified: user.isVerified,
          createdAt: user.createdAt
        },
        accessToken,
        refreshToken,
        token: accessToken
      }
    });
  }

  if (!user.otp || !user.otp.code) {
    throw ApiError.badRequest('No verification code pending. Please request a new code.');
  }

  // Check code expiration
  if (new Date() > new Date(user.otp.expiresAt)) {
    throw ApiError.badRequest('Verification code has expired. Please request a new code.');
  }

  // Check attempt limit
  if (user.otp.attempts >= 5) {
    throw ApiError.badRequest('Too many failed attempts. Please request a new verification code.');
  }

  // Compare candidate OTP with hashed OTP
  const isMatch = await bcrypt.compare(otp.trim(), user.otp.code);
  if (!isMatch) {
    user.otp.attempts = (user.otp.attempts || 0) + 1;
    await user.save();
    throw ApiError.badRequest(`Invalid verification code. ${5 - user.otp.attempts} attempt(s) remaining.`);
  }

  // Mark user verified and clear OTP
  user.isVerified = true;
  user.otp = undefined;
  user.status = 'online';
  user.lastSeen = new Date();

  // Generate tokens
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();
  user.refreshToken = refreshToken;
  await user.save();

  // Add user to default room
  await ensureJoinedGeneral(user._id);

  res.status(200).json({
    status: 'success',
    message: 'Email verified successfully! Welcome to ChatApp.',
    data: {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        status: user.status,
        statusMessage: user.statusMessage,
        isVerified: user.isVerified,
        createdAt: user.createdAt
      },
      accessToken,
      refreshToken,
      token: accessToken
    }
  });
});

/**
 * @desc   Resend Email OTP
 * @route  POST /api/auth/resend-otp
 */
export const resendOTP = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const normalizedEmail = email.toLowerCase().trim();

  const user = await User.findOne({ email: normalizedEmail }).select('+otp.code +otp.expiresAt');
  if (!user) {
    throw ApiError.notFound('Account not found with this email address');
  }

  if (user.isVerified) {
    throw ApiError.badRequest('This account is already verified. You can log in directly.');
  }

  const otpCode = generateNumericOTP();
  const salt = await bcrypt.genSalt(10);
  const hashedOtp = await bcrypt.hash(otpCode, salt);
  const otpExpiry = new Date(Date.now() + config.otpExpiryMinutes * 60 * 1000);

  user.otp = {
    code: hashedOtp,
    expiresAt: otpExpiry,
    attempts: 0
  };
  await user.save();

  await sendVerificationOTP(user.email, user.username, otpCode);

  res.status(200).json({
    status: 'success',
    message: 'A fresh verification code has been dispatched to your email.',
    data: {
      email: user.email,
      expiresInMinutes: config.otpExpiryMinutes,
      ...(config.env === 'development' && { devOtp: otpCode })
    }
  });
});

/**
 * @desc   User Login
 * @route  POST /api/auth/login
 */
export const login = asyncHandler(async (req, res) => {
  const { emailOrUsername, password } = req.body;

  const query = emailOrUsername.includes('@')
    ? { email: emailOrUsername.toLowerCase().trim() }
    : { username: emailOrUsername.toLowerCase().trim() };

  const user = await User.findOne(query).select('+password +refreshToken');
  if (!user) {
    throw ApiError.unauthorized('Invalid username/email or password');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw ApiError.unauthorized('Invalid username/email or password');
  }

  // Check if email OTP verification is required
  if (!user.isVerified) {
    return res.status(403).json({
      status: 'unverified',
      requiresVerification: true,
      email: user.email,
      message: 'Your email address is not yet verified. Please verify your OTP to continue.'
    });
  }

  // Update status & timestamps
  user.status = 'online';
  user.lastSeen = new Date();

  // Generate JWT access & refresh tokens
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();
  user.refreshToken = refreshToken;
  await user.save();

  await ensureJoinedGeneral(user._id);

  res.status(200).json({
    status: 'success',
    message: 'Logged in successfully',
    data: {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        status: user.status,
        statusMessage: user.statusMessage,
        bio: user.bio,
        isVerified: user.isVerified,
        createdAt: user.createdAt
      },
      accessToken,
      refreshToken,
      token: accessToken
    }
  });
});

/**
 * @desc   Refresh JWT access token using refresh token
 * @route  POST /api/auth/refresh-token
 */
export const refreshTokenHandler = asyncHandler(async (req, res) => {
  const token = req.body.refreshToken || req.headers['x-refresh-token'];

  if (!token) {
    throw ApiError.unauthorized('Refresh token is required');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, config.jwtRefreshSecret);
  } catch (err) {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const user = await User.findById(decoded.id).select('+refreshToken');
  if (!user || user.refreshToken !== token) {
    throw ApiError.unauthorized('Refresh token is no longer valid. Please log in again.');
  }

  // Rotate tokens: issue new access token and new refresh token
  const newAccessToken = user.generateAccessToken();
  const newRefreshToken = user.generateRefreshToken();
  user.refreshToken = newRefreshToken;
  await user.save();

  res.status(200).json({
    status: 'success',
    data: {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      token: newAccessToken
    }
  });
});

/**
 * @desc   Request Password Reset (Sends 6-digit OTP to Email)
 * @route  POST /api/auth/forgot-password
 */
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const normalizedEmail = email.toLowerCase().trim();

  const user = await User.findOne({ email: normalizedEmail }).select('+resetOtp.code');

  // Generic message for privacy protection
  if (!user) {
    return res.status(200).json({
      status: 'success',
      message: 'If an account with that email exists, a password reset code has been sent.'
    });
  }

  const otpCode = generateNumericOTP();
  const salt = await bcrypt.genSalt(10);
  const hashedOtp = await bcrypt.hash(otpCode, salt);
  const otpExpiry = new Date(Date.now() + config.otpExpiryMinutes * 60 * 1000);

  user.resetOtp = {
    code: hashedOtp,
    expiresAt: otpExpiry,
    attempts: 0
  };
  await user.save();

  await sendPasswordResetOTP(user.email, user.username, otpCode);

  res.status(200).json({
    status: 'success',
    message: 'Password reset code has been sent to your email.',
    data: {
      email: user.email,
      expiresInMinutes: config.otpExpiryMinutes,
      ...(config.env === 'development' && { devOtp: otpCode })
    }
  });
});

/**
 * @desc   Reset Password using OTP
 * @route  POST /api/auth/reset-password
 */
export const resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const normalizedEmail = email.toLowerCase().trim();

  const user = await User.findOne({ email: normalizedEmail }).select(
    '+resetOtp.code +resetOtp.expiresAt +resetOtp.attempts +refreshToken'
  );

  if (!user || !user.resetOtp || !user.resetOtp.code) {
    throw ApiError.badRequest('No password reset request found for this email address.');
  }

  if (new Date() > new Date(user.resetOtp.expiresAt)) {
    throw ApiError.badRequest('Password reset code has expired. Please request a new one.');
  }

  if (user.resetOtp.attempts >= 5) {
    throw ApiError.badRequest('Too many failed attempts. Please request a new password reset code.');
  }

  const isMatch = await bcrypt.compare(otp.trim(), user.resetOtp.code);
  if (!isMatch) {
    user.resetOtp.attempts = (user.resetOtp.attempts || 0) + 1;
    await user.save();
    throw ApiError.badRequest(`Invalid reset code. ${5 - user.resetOtp.attempts} attempt(s) remaining.`);
  }

  // Update password (pre('save') hook will hash with bcrypt)
  user.password = newPassword;
  user.resetOtp = undefined;
  // If user was unverified, resetting password via email OTP also verifies ownership
  user.isVerified = true;

  // Revoke previous refresh token & issue new tokens
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();
  user.refreshToken = refreshToken;
  user.status = 'online';
  user.lastSeen = new Date();
  await user.save();

  res.status(200).json({
    status: 'success',
    message: 'Password has been reset successfully. You are now logged in.',
    data: {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        status: user.status,
        statusMessage: user.statusMessage,
        isVerified: user.isVerified,
        createdAt: user.createdAt
      },
      accessToken,
      refreshToken,
      token: accessToken
    }
  });
});

/**
 * @desc   Logout User & Revoke Session
 * @route  POST /api/auth/logout
 */
export const logout = asyncHandler(async (req, res) => {
  if (req.user) {
    const user = await User.findById(req.user._id).select('+refreshToken');
    if (user) {
      user.status = 'offline';
      user.lastSeen = new Date();
      user.refreshToken = '';
      await user.save();
    }
  }

  res.status(200).json({
    status: 'success',
    message: 'Logged out successfully'
  });
});

/**
 * @desc   Get Current Authenticated User
 * @route  GET /api/auth/me
 */
export const getMe = asyncHandler(async (req, res) => {
  res.status(200).json({
    status: 'success',
    data: {
      user: req.user
    }
  });
});

/**
 * @desc   Update User Profile
 * @route  PUT /api/auth/profile
 */
export const updateProfile = asyncHandler(async (req, res) => {
  const allowedUpdates = ['avatar', 'bio', 'statusMessage', 'status'];
  const updates = {};

  allowedUpdates.forEach((field) => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  });

  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updates },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser
    }
  });
});
