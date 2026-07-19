import { Router } from 'express';
import { getQueueStats, listJobs } from '../services/jobs.js';

export const queueRouter = Router();

// GET /api/queue -> { stats, jobs } for the frontend queue/status viewer
queueRouter.get('/', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 25, 100);
  const [stats, jobs] = await Promise.all([getQueueStats(), listJobs(limit)]);
  res.json({ success: true, stats, jobs });
});

// GET /api/queue/stats -> counts only (cheap poll)
queueRouter.get('/stats', async (_req, res) => {
  res.json({ success: true, stats: await getQueueStats() });
});
