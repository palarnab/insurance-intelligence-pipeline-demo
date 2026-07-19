import { JobModel } from '../models/Job.js';
import { config } from '../config.js';

// Enqueue a job by inserting a `pending` document. The processor's polling loop
// will pick it up on its next tick.
export async function enqueueJob(type, data, { maxAttempts = config.maxAttempts, priority = 0 } = {}) {
  const job = await JobModel.create({
    type,
    data,
    status: 'pending',
    maxAttempts,
    priority,
    availableAt: new Date(),
  });
  return job;
}

const STATUSES = ['pending', 'active', 'completed', 'failed'];

export async function getQueueStats() {
  const agg = await JobModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  const stats = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const row of agg) if (row._id in stats) stats[row._id] = row.count;
  stats.total = STATUSES.reduce((sum, s) => sum + stats[s], 0);
  return stats;
}

export async function listJobs(limit = 25) {
  const jobs = await JobModel.find(
    {},
    {
      type: 1, status: 1, attempts: 1, maxAttempts: 1, priority: 1,
      availableAt: 1, lockedBy: 1, startedAt: 1, completedAt: 1, failedAt: 1,
      error: 1, createdAt: 1, updatedAt: 1, 'data.documentId': 1, 'data.originalName': 1,
    }
  )
    .sort({ createdAt: -1 })
    .limit(Math.min(limit, 100))
    .lean();
  return jobs;
}
