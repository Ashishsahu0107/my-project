import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const VISIBILITY_OPTIONS = ['everyone', 'contacts', 'nobody'];

/**
 * @desc   Get privacy, 2FA, blocked users & active sessions overview
 * @route  GET /api/security/overview
 */
export const getSecurityOverview = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate('blockedUsers', 'username avatar')
    .select('twoStepVerification.enabled privacySettings blockedUsers activeSessions');

  if (!user) throw ApiError.notFound('User not found');

  res.status(200).json({
    status: 'success',
    data: {
      twoStepEnabled: Boolean(user.twoStepVerification?.enabled),
      privacySettings: user.privacySettings || {
        lastSeenVisibility: 'everyone',
        onlineStatusVisibility: 'everyone',
        profilePhotoVisibility: 'everyone',
        statusVisibility: 'everyone'
      },
      blockedUsers: user.blockedUsers || [],
      activeSessions: user.activeSessions || [],
      currentSessionId: req.sessionId || null
    }
  });
});

/**
 * @desc   Enable or update Two-Step Verification PIN
 * @route  POST /api/security/two-step/enable
 */
export const enableTwoStepPin = asyncHandler(async (req, res) => {
  const { pin } = req.body;
  if (!pin || typeof pin !== 'string' || !/^\d{4,6}$/.test(pin.trim())) {
    throw ApiError.badRequest('PIN must be 4 to 6 digits');
  }

  const salt = await bcrypt.genSalt(10);
  const pinHash = await bcrypt.hash(pin.trim(), salt);

  await User.findByIdAndUpdate(req.user._id, {
    $set: {
      'twoStepVerification.enabled': true,
      'twoStepVerification.pinHash': pinHash,
      'twoStepVerification.updatedAt': new Date()
    }
  });

  res.status(200).json({
    status: 'success',
    message: 'Two-step verification enabled',
    data: { twoStepEnabled: true }
  });
});

/**
 * @desc   Disable Two-Step Verification PIN (requires current PIN)
 * @route  POST /api/security/two-step/disable
 */
export const disableTwoStepPin = asyncHandler(async (req, res) => {
  const { pin } = req.body;
  const user = await User.findById(req.user._id).select('+twoStepVerification.pinHash');
  if (!user) throw ApiError.notFound('User not found');

  if (!user.twoStepVerification?.enabled) {
    return res.status(200).json({
      status: 'success',
      message: 'Two-step verification is already disabled',
      data: { twoStepEnabled: false }
    });
  }

  if (!pin || typeof pin !== 'string') {
    throw ApiError.badRequest('Current PIN is required to disable two-step verification');
  }

  const isMatch = await bcrypt.compare(pin.trim(), user.twoStepVerification.pinHash || '');
  if (!isMatch) {
    throw ApiError.unauthorized('Invalid two-step verification PIN');
  }

  user.twoStepVerification.enabled = false;
  user.twoStepVerification.pinHash = '';
  user.twoStepVerification.updatedAt = new Date();
  await user.save();

  res.status(200).json({
    status: 'success',
    message: 'Two-step verification disabled',
    data: { twoStepEnabled: false }
  });
});

/**
 * @desc   Verify Two-Step PIN
 * @route  POST /api/security/two-step/verify
 */
export const verifyTwoStepPin = asyncHandler(async (req, res) => {
  const { pin } = req.body;
  if (!pin || typeof pin !== 'string') {
    throw ApiError.badRequest('PIN is required');
  }

  const user = await User.findById(req.user._id).select('+twoStepVerification.pinHash');
  if (!user || !user.twoStepVerification?.enabled) {
    throw ApiError.badRequest('Two-step verification is not enabled');
  }

  const isMatch = await bcrypt.compare(pin.trim(), user.twoStepVerification.pinHash || '');
  if (!isMatch) {
    throw ApiError.unauthorized('Incorrect PIN');
  }

  res.status(200).json({
    status: 'success',
    message: 'PIN verified'
  });
});

/**
 * @desc   Update privacy visibility settings
 * @route  PUT /api/security/privacy
 */
export const updatePrivacySettings = asyncHandler(async (req, res) => {
  const allowedFields = [
    'lastSeenVisibility',
    'onlineStatusVisibility',
    'profilePhotoVisibility',
    'statusVisibility'
  ];

  const updates = {};
  for (const field of allowedFields) {
    const val = req.body[field];
    if (val !== undefined) {
      if (!VISIBILITY_OPTIONS.includes(val)) {
        throw ApiError.badRequest(`Invalid value for ${field}`);
      }
      updates[`privacySettings.${field}`] = val;
    }
  }

  const updated = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updates },
    { new: true }
  ).select('privacySettings');

  const io = req.app.get('io');
  io?.emit('user:privacy_updated', {
    userId: req.user._id,
    privacySettings: updated.privacySettings
  });

  res.status(200).json({
    status: 'success',
    data: { privacySettings: updated.privacySettings }
  });
});

/**
 * @desc   Block a user
 * @route  POST /api/security/block/:userId
 */
export const blockUser = asyncHandler(async (req, res) => {
  const targetId = req.params.userId;
  if (targetId === req.user._id.toString()) {
    throw ApiError.badRequest('You cannot block yourself');
  }

  const target = await User.findById(targetId).select('_id username');
  if (!target) throw ApiError.notFound('User not found');

  const updated = await User.findByIdAndUpdate(
    req.user._id,
    { $addToSet: { blockedUsers: targetId } },
    { new: true }
  ).populate('blockedUsers', 'username avatar');

  res.status(200).json({
    status: 'success',
    message: `@${target.username} has been blocked`,
    data: { blockedUsers: updated.blockedUsers }
  });
});

/**
 * @desc   Unblock a user
 * @route  DELETE /api/security/block/:userId
 */
export const unblockUser = asyncHandler(async (req, res) => {
  const targetId = req.params.userId;
  const updated = await User.findByIdAndUpdate(
    req.user._id,
    { $pull: { blockedUsers: targetId } },
    { new: true }
  ).populate('blockedUsers', 'username avatar');

  res.status(200).json({
    status: 'success',
    message: 'User unblocked',
    data: { blockedUsers: updated.blockedUsers }
  });
});

/**
 * @desc   List active sessions / linked devices
 * @route  GET /api/security/sessions
 */
export const getActiveSessions = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('activeSessions');
  res.status(200).json({
    status: 'success',
    data: {
      sessions: user?.activeSessions || [],
      currentSessionId: req.sessionId || null
    }
  });
});

/**
 * @desc   Revoke a specific device session
 * @route  DELETE /api/security/sessions/:sessionId
 */
export const revokeSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const updated = await User.findByIdAndUpdate(
    req.user._id,
    { $pull: { activeSessions: { sessionId } } },
    { new: true }
  ).select('activeSessions');

  const io = req.app.get('io');
  io?.to(`user:${req.user._id.toString()}`).emit('auth:session_revoked', { sessionId });

  res.status(200).json({
    status: 'success',
    message: 'Device session revoked',
    data: { sessions: updated?.activeSessions || [] }
  });
});

/**
 * @desc   Securely logout from all devices (revokes all JWTs & sessions)
 * @route  POST /api/security/logout-all
 */
export const logoutAllDevices = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  await User.findByIdAndUpdate(userId, {
    $set: {
      activeSessions: [],
      refreshToken: '',
      status: 'offline',
      lastSeen: new Date()
    },
    $inc: { tokenVersion: 1 }
  });

  const io = req.app.get('io');
  io?.to(`user:${userId.toString()}`).emit('auth:force_logout', {
    reason: 'Logged out from all devices'
  });

  res.status(200).json({
    status: 'success',
    message: 'Logged out from all devices securely'
  });
});
