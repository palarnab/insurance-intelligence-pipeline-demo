import dotenv from 'dotenv';
import { log } from './logger.js';

// Load the repo-root .env for local (non-Docker) runs. In Docker Compose the
// same variables are injected via the `environment:` block, so a missing file
// here is harmless.
dotenv.config({ path: new URL('../../.env', import.meta.url) });

const hasAwsCredentials = Boolean(
  process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
);

function resolveMockMode() {
  const raw = (process.env.USE_MOCK || 'auto').toLowerCase();
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  // auto: use real AWS only when credentials are present
  return !hasAwsCredentials;
}

const useMock = resolveMockMode();

if (useMock) {
  log.warn(
    'Running in MOCK mode - Textract/Comprehend/Bedrock calls are simulated. ' +
      'Set USE_MOCK=false and provide AWS credentials to use the real services.'
  );
} else {
  log.info('Running in AWS mode - calling real Textract, Comprehend and Bedrock.');
}

export const config = {
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/insurance_db',
  concurrency: Number(process.env.WORKER_CONCURRENCY || 2),
  // MongoDB polling queue tuning.
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS || 1000),
  // Jobs stuck in "active" longer than this (e.g. worker crashed mid-job) are
  // recovered back to "pending" so another worker can retry them.
  staleLockMs: Number(process.env.STALE_LOCK_MS || 60000),
  // Base delay for exponential retry backoff.
  retryBackoffMs: Number(process.env.RETRY_BACKOFF_MS || 2000),
  maxAttempts: Number(process.env.JOB_MAX_ATTEMPTS || 3),
  useMock,
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    bedrockModelId:
      process.env.BEDROCK_MODEL_ID || 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
  },
};
