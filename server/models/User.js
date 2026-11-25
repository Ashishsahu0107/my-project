import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/environment.js';

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
      match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain alphanumeric characters and underscores'],
      index: true
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
      index: true
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false
    },
    avatar: {
      type: String,
      default: ''
    },
    displayName: {
      type: String,
      trim: true,
      maxlength: [60, 'Name cannot exceed 60 characters'],
      default: ''
    },
    phoneNumber: {
      type: String,
      trim: true,
      maxlength: [25, 'Phone number cannot exceed 25 characters'],
      default: ''
    },
    bio: {
      type: String,
      maxlength: [160, 'Bio cannot exceed 160 characters'],
      default: ''
    },
    status: {
      type: String,
      enum: ['online', 'offline', 'away', 'busy'],
      default: 'offline'
    },
    statusMessage: {
      type: String,
      maxlength: [100, 'Status message cannot exceed 100 characters'],
      default: ''
    },
    lastSeen: {
      type: Date,
      default: Date.now
    },
    isVerified: {
      type: Boolean,
      default: false,
      index: true
    },
    otp: {
      code: { type: String, select: false },
      expiresAt: { type: Date, select: false },
      attempts: { type: Number, default: 0, select: false }
    },
    resetOtp: {
      code: { type: String, select: false },
      expiresAt: { type: Date, select: false },
      attempts: { type: Number, default: 0, select: false }
    },
    emailChangeOtp: {
      newEmail: { type: String, default: '' },
      code: { type: String, select: false },
      expiresAt: { type: Date, select: false },
      attempts: { type: Number, default: 0, select: false }
    },
    refreshToken: {
      type: String,
      select: false,
      default: ''
    },
    pushTokens: [
      {
        token: { type: String, required: true },
        platform: { type: String, enum: ['android', 'ios', 'web', 'unknown'], default: 'unknown' },
        deviceId: { type: String, default: '' },
        updatedAt: { type: Date, default: Date.now }
      }
    ],
    twoStepVerification: {
      enabled: { type: Boolean, default: false },
      pinHash: { type: String, select: false, default: '' },
      updatedAt: { type: Date, default: null }
    },
    privacySettings: {
      lastSeenVisibility: {
        type: String,
        enum: ['everyone', 'contacts', 'nobody'],
        default: 'everyone'
      },
      onlineStatusVisibility: {
        type: String,
        enum: ['everyone', 'contacts', 'nobody'],
        default: 'everyone'
      },
      profilePhotoVisibility: {
        type: String,
        enum: ['everyone', 'contacts', 'nobody'],
        default: 'everyone'
      },
      statusVisibility: {
        type: String,
        enum: ['everyone', 'contacts', 'nobody'],
        default: 'everyone'
      }
    },
    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    activeSessions: [
      {
        sessionId: { type: String, required: true },
        deviceName: { type: String, default: 'Mobile Device' },
        platform: { type: String, default: 'unknown' },
        ipAddress: { type: String, default: '' },
        lastActiveAt: { type: Date, default: Date.now },
        createdAt: { type: Date, default: Date.now }
      }
    ],
    tokenVersion: {
      type: Number,
      default: 0
    },
    appSettings: {
      theme: { type: String, enum: ['light', 'dark', 'system'], default: 'dark' },
      language: { type: String, enum: ['en', 'hi', 'es', 'fr'], default: 'en' },
      notificationsEnabled: { type: Boolean, default: true },
      soundEnabled: { type: Boolean, default: true },
      vibrationEnabled: { type: Boolean, default: true },
      chatWallpaper: { type: String, default: 'default' },
      fontSize: { type: String, enum: ['small', 'medium', 'large'], default: 'medium' },
      autoDownloadMedia: { type: Boolean, default: true }
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete ret.password;
        delete ret.refreshToken;
        delete ret.otp;
        delete ret.resetOtp;
        delete ret.emailChangeOtp;
        delete ret.pushTokens;
        if (ret.twoStepVerification) {
          delete ret.twoStepVerification.pinHash;
        }
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(config.bcryptSaltRounds);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Instance method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Instance method to generate JWT Access Token
userSchema.methods.generateAccessToken = function (sessionId = null) {
  return jwt.sign(
    {
      id: this._id,
      username: this.username,
      email: this.email,
      tokenVersion: this.tokenVersion || 0,
      ...(sessionId ? { sessionId } : {})
    },
    config.jwtSecret,
    {
      expiresIn: config.jwtExpiresIn
    }
  );
};

// Instance method to generate JWT Refresh Token
userSchema.methods.generateRefreshToken = function (sessionId = null) {
  return jwt.sign(
    {
      id: this._id,
      type: 'refresh',
      tokenVersion: this.tokenVersion || 0,
      ...(sessionId ? { sessionId } : {})
    },
    config.jwtRefreshSecret,
    {
      expiresIn: config.jwtRefreshExpiresIn
    }
  );
};

// Backward-compatible auth token generator
userSchema.methods.generateAuthToken = function () {
  return this.generateAccessToken();
};

export const User = mongoose.model('User', userSchema);
