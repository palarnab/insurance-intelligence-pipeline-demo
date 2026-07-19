import dotenv from 'dotenv';

// Load the repo-root .env for local (non-Docker) runs. In Docker Compose the
// same variables are injected via the `environment:` block, so a missing file
// here is harmless.
dotenv.config({ path: new URL('../../.env', import.meta.url) });

export const config = {
  port: Number(process.env.PORT || 3000),
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/insurance_db',
  uploadDir: process.env.UPLOAD_DIR || './data/uploads',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  // Default retry budget for enqueued jobs (MongoDB polling queue).
  maxAttempts: Number(process.env.JOB_MAX_ATTEMPTS || 3),
  // Upload guard rails. Textract synchronous APIs cap at 10 MB / single page.
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES || 10 * 1024 * 1024),
  allowedMimeTypes: [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/tiff',
  ],
};
