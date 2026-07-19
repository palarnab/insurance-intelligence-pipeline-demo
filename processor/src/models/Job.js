import mongoose from 'mongoose';

// Kept in sync with backend/src/models/Job.js. See that file for field docs.
const JobSchema = new mongoose.Schema(
  {
    type: { type: String, default: 'process-document', index: true },
    status: {
      type: String,
      enum: ['pending', 'active', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    data: mongoose.Schema.Types.Mixed,

    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 },
    priority: { type: Number, default: 0 },

    availableAt: { type: Date, default: Date.now, index: true },

    lockedAt: Date,
    lockedBy: String,

    startedAt: Date,
    completedAt: Date,
    failedAt: Date,

    result: mongoose.Schema.Types.Mixed,
    error: String,
  },
  { timestamps: true }
);

JobSchema.index({ status: 1, availableAt: 1, priority: -1, createdAt: 1 });

export const JobModel = mongoose.model('Job', JobSchema);
