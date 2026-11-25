import mongoose from 'mongoose';

const backupSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    version: {
      type: Number,
      default: 1
    },
    status: {
      type: String,
      enum: ['completed', 'failed'],
      default: 'completed'
    },
    autoBackupEnabled: {
      type: Boolean,
      default: false
    },
    autoBackupFrequency: {
      type: String,
      enum: ['daily', 'weekly', 'manual'],
      default: 'daily'
    },
    lastBackupAt: {
      type: Date,
      default: null
    },
    lastSyncAt: {
      type: Date,
      default: null
    },
    stats: {
      roomCount: { type: Number, default: 0 },
      messageCount: { type: Number, default: 0 },
      mediaCount: { type: Number, default: 0 },
      sizeBytes: { type: Number, default: 0 }
    },
    checksum: {
      type: String,
      default: ''
    },
    iv: {
      type: String,
      select: false,
      default: ''
    },
    authTag: {
      type: String,
      select: false,
      default: ''
    },
    ciphertext: {
      type: String,
      select: false,
      default: ''
    },
    lastError: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete ret.iv;
        delete ret.authTag;
        delete ret.ciphertext;
        delete ret.__v;
        return ret;
      }
    }
  }
);

export const Backup = mongoose.model('Backup', backupSchema);
