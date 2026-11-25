import { User } from '../models/User.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const applyPrivacyProjection = (userDoc) => {
  const obj = userDoc.toObject ? userDoc.toObject() : { ...userDoc };
  const privacy = obj.privacySettings || {};
  if (privacy.lastSeenVisibility === 'nobody') obj.lastSeen = null;
  if (privacy.onlineStatusVisibility === 'nobody') obj.status = 'offline';
  if (privacy.profilePhotoVisibility === 'nobody') obj.avatar = '';
  if (privacy.statusVisibility === 'nobody') obj.statusMessage = '';
  delete obj.privacySettings;
  return obj;
};

export const getAllUsers = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id;
  const { search } = req.query;

  const query = { _id: { $ne: currentUserId } };
  if (search && search.trim()) {
    query.$or = [
      { username: { $regex: search.trim(), $options: 'i' } },
      { email: { $regex: search.trim(), $options: 'i' } }
    ];
  }

  const users = await User.find(query)
    .select('username displayName email avatar status statusMessage lastSeen bio privacySettings')
    .sort({ status: -1, username: 1 })
    .limit(50);

  const sanitizedUsers = users.map(applyPrivacyProjection);

  res.status(200).json({
    status: 'success',
    results: sanitizedUsers.length,
    data: {
      users: sanitizedUsers
    }
  });
});

export const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select(
    'username displayName email avatar status statusMessage lastSeen bio createdAt privacySettings'
  );

  if (!user) {
    throw ApiError.notFound('User not found');
  }

  res.status(200).json({
    status: 'success',
    data: {
      user: applyPrivacyProjection(user)
    }
  });
});
