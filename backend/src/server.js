import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { connectDb } from './db.js';
import { log } from './logger.js';
import { documentsRouter } from './routes/documents.js';
import { healthRouter } from './routes/health.js';
import { queueRouter } from './routes/queue.js';

const app = express();

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '1mb' }));

app.use((req, _res, next) => {
  log.info(`${req.method} ${req.path}`);
  next();
});

app.use('/api/health', healthRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/queue', queueRouter);

app.get('/', (_req, res) => res.json({ service: 'Insurance Intelligence Pipeline API', status: 'running' }));

// Centralised error handler (also normalises multer upload errors).
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 400);
  log.error('Request error', err.message);
  res.status(status).json({ success: false, error: err.message });
});

async function start() {
  await connectDb();
  app.listen(config.port, () => {
    log.info(`API gateway listening on port ${config.port}`);
  });
}

start().catch((err) => {
  log.error('Fatal startup error', err);
  process.exit(1);
});
