import { User } from '../models/User.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

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
    .select('username email avatar status statusMessage lastSeen bio')
    .sort({ status: -1, username: 1 })
    .limit(50);

  res.status(200).json({
    status: 'success',
    results: users.length,
    data: {
      users
    }
  });
});

export const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select(
    'username email avatar status statusMessage lastSeen bio createdAt'
  );

  if (!user) {
    throw ApiError.notFound('User not found');
  }

  res.status(200).json({
    status: 'success',
    data: {
      user
    }
  });
});
