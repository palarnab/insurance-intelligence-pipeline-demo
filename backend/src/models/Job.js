import mongoose from 'mongoose';

// A lightweight, MongoDB-backed job queue record. Replaces Redis/BullMQ with a
// simple polling model: workers atomically claim `pending` jobs whose
// `availableAt` is due, process them, then mark `completed` or reschedule.
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

    // When the job becomes eligible to run (used for delayed retries/backoff).
    availableAt: { type: Date, default: Date.now, index: true },

    // Lock metadata set when a worker claims the job.
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

// Optimises the atomic "claim next due pending job" query.
JobSchema.index({ status: 1, availableAt: 1, priority: -1, createdAt: 1 });

export const JobModel = mongoose.model('Job', JobSchema);
