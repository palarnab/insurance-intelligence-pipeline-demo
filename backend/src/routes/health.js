import { Router } from 'express';
import mongoose from 'mongoose';
import { getQueueStats } from '../services/jobs.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  const mongoUp = mongoose.connection.readyState === 1;

  let queue = {};
  try {
    queue = await getQueueStats();
  } catch {
    queue = {};
  }

  const healthy = mongoUp;
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    service: 'iip-backend',
    dependencies: { mongo: mongoUp },
    queue,
    time: new Date().toISOString(),
  });
});
