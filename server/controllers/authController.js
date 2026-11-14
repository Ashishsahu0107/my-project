import { User } from '../models/User.js';
import { Room } from '../models/Room.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const register = asyncHandler(async (req, res) => {
  const { username, email, password, avatar } = req.body;

  const existingEmail = await User.findOne({ email: email.toLowerCase() });
  if (existingEmail) {
    throw ApiError.conflict('An account with this email address already exists');
  }

  const existingUsername = await User.findOne({ username: username.toLowerCase() });
  if (existingUsername) {
    throw ApiError.conflict('This username is already taken');
  }

  const defaultAvatar = avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`;

  const user = await User.create({
    username: username.toLowerCase().trim(),
    email: email.toLowerCase().trim(),
    password,
    avatar: defaultAvatar,
    status: 'online'
  });

  // Automatically add new user to the default #general channel
  let generalRoom = await Room.findOne({ name: 'general', type: 'channel' });
  if (!generalRoom) {
    generalRoom = await Room.create({
      name: 'general',
      type: 'channel',
      description: 'The town square — general discussions and welcome area',
      creator: user._id,
      members: [user._id]
    });
  } else {
    if (!generalRoom.members.includes(user._id)) {
      generalRoom.members.push(user._id);
      await generalRoom.save();
    }
  }

  const token = user.generateAuthToken();

  res.status(201).json({
    status: 'success',
    data: {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        status: user.status,
        statusMessage: user.statusMessage,
        createdAt: user.createdAt
      },
      token
    }
  });
});

export const login = asyncHandler(async (req, res) => {
  const { emailOrUsername, password } = req.body;

  const query = emailOrUsername.includes('@')
    ? { email: emailOrUsername.toLowerCase().trim() }
    : { username: emailOrUsername.toLowerCase().trim() };

  const user = await User.findOne(query).select('+password');
  if (!user) {
    throw ApiError.unauthorized('Invalid username/email or password');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw ApiError.unauthorized('Invalid username/email or password');
  }

  user.status = 'online';
  user.lastSeen = new Date();
  await user.save();

  const token = user.generateAuthToken();

  res.status(200).json({
    status: 'success',
    data: {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        status: user.status,
        statusMessage: user.statusMessage,
        createdAt: user.createdAt
      },
      token
    }
  });
});

export const logout = asyncHandler(async (req, res) => {
  if (req.user) {
    req.user.status = 'offline';
    req.user.lastSeen = new Date();
    await req.user.save();
  }

  res.status(200).json({
    status: 'success',
    message: 'Logged out successfully'
  });
});

export const getMe = asyncHandler(async (req, res) => {
  res.status(200).json({
    status: 'success',
    data: {
      user: req.user
    }
  });
});

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
