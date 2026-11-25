import mongoose from 'mongoose';

const callSchema = new mongoose.Schema(
  {
    callId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    caller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    callee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    type: {
      type: String,
      enum: ['audio', 'video'],
      required: true
    },
    status: {
      type: String,
      enum: ['initiated', 'ringing', 'accepted', 'rejected', 'missed', 'ended', 'busy', 'failed'],
      default: 'initiated',
      index: true
    },
    startedAt: {
      type: Date,
      default: Date.now
    },
    answeredAt: {
      type: Date,
      default: null
    },
    endedAt: {
      type: Date,
      default: null
    },
    duration: {
      type: Number,
      default: 0,
      comment: 'Duration in seconds'
    },
    endReason: {
      type: String,
      enum: ['completed', 'rejected', 'missed', 'busy', 'network_error', 'cancelled'],
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true }
  }
);

// Compound indexes for history queries
callSchema.index({ caller: 1, createdAt: -1 });
callSchema.index({ callee: 1, createdAt: -1 });

export const Call = mongoose.model('Call', callSchema);
