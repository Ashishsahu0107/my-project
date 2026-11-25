import { User } from '../models/User.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const DEFAULT_SETTINGS = {
  theme: 'dark',
  language: 'en',
  notificationsEnabled: true,
  soundEnabled: true,
  vibrationEnabled: true,
  chatWallpaper: 'default',
  fontSize: 'medium',
  autoDownloadMedia: true
};

/**
 * @desc   Get user app settings
 * @route  GET /api/settings
 */
export const getAppSettings = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('appSettings');
  res.status(200).json({
    status: 'success',
    data: {
      settings: {
        ...DEFAULT_SETTINGS,
        ...(user?.appSettings?.toObject ? user.appSettings.toObject() : user?.appSettings || {})
      }
    }
  });
});

/**
 * @desc   Update user app settings & sync across devices
 * @route  PUT /api/settings
 */
export const updateAppSettings = asyncHandler(async (req, res) => {
  const updates = {};

  if (req.body.theme !== undefined) {
    if (!['light', 'dark', 'system'].includes(req.body.theme)) {
      throw ApiError.badRequest('Invalid theme');
    }
    updates['appSettings.theme'] = req.body.theme;
  }

  if (req.body.language !== undefined) {
    if (!['en', 'hi', 'es', 'fr'].includes(req.body.language)) {
      throw ApiError.badRequest('Unsupported language');
    }
    updates['appSettings.language'] = req.body.language;
  }

  if (req.body.fontSize !== undefined) {
    if (!['small', 'medium', 'large'].includes(req.body.fontSize)) {
      throw ApiError.badRequest('Invalid font size');
    }
    updates['appSettings.fontSize'] = req.body.fontSize;
  }

  if (req.body.chatWallpaper !== undefined) {
    updates['appSettings.chatWallpaper'] = String(req.body.chatWallpaper).slice(0, 120);
  }

  for (const boolField of [
    'notificationsEnabled',
    'soundEnabled',
    'vibrationEnabled',
    'autoDownloadMedia'
  ]) {
    if (req.body[boolField] !== undefined) {
      updates[`appSettings.${boolField}`] = Boolean(req.body[boolField]);
    }
  }

  const updated = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updates },
    { new: true }
  ).select('appSettings');

  const settings = {
    ...DEFAULT_SETTINGS,
    ...(updated?.appSettings?.toObject ? updated.appSettings.toObject() : updated?.appSettings || {})
  };

  const io = req.app.get('io');
  io?.to(`user:${req.user._id.toString()}`).emit('user:settings_updated', { settings });

  res.status(200).json({
    status: 'success',
    data: { settings }
  });
});
