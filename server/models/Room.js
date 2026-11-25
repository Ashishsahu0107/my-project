import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      maxlength: [50, 'Room name cannot exceed 50 characters']
    },
    type: {
      type: String,
      enum: ['channel', 'direct', 'group'],
      default: 'channel',
      index: true
    },
    description: {
      type: String,
      maxlength: [250, 'Description cannot exceed 250 characters'],
      default: ''
    },
    isPrivate: {
      type: Boolean,
      default: false
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    admins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    },
    avatar: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true }
  }
);

// Index to quickly query rooms for a specific user
roomSchema.index({ members: 1 });
roomSchema.index({ updatedAt: -1 });

export const Room = mongoose.model('Room', roomSchema);
