import { config } from './config.js';
import { connectDb } from './db.js';
import { log } from './logger.js';
import { DocumentModel } from './models/Document.js';
import { PollingQueue } from './queue.js';
import { analyzeDocument } from './services/pipeline.js';

async function updateDoc(documentId, patch) {
  await DocumentModel.updateOne({ documentId }, { $set: patch });
}

// The unit of work: run one document through the intelligence pipeline.
async function handleJob(job) {
  const { documentId } = job.data || {};
  log.info(`Picked up job ${job._id} for document ${documentId} (attempt ${job.attempts}/${job.maxAttempts})`);

  if (!job.data?.storagePath || !documentId) {
    throw new Error('Invalid job payload: missing documentId or storagePath.');
  }

  await updateDoc(documentId, { status: 'processing', stage: 'ocr', error: null });

  const result = await analyzeDocument(job.data, async (stage, patch) => {
    await updateDoc(documentId, { stage, ...patch });
  });

  await updateDoc(documentId, {
    status: 'completed',
    stage: 'done',
    provider: result.provider,
    ocr: result.ocr,
    comprehend: result.comprehend,
    extraction: result.extraction,
    conflicts: result.conflicts,
    riskScore: result.riskScore,
    summary: result.summary,
    timings: result.timings,
  });

  log.info(`Completed document ${documentId}: ${result.conflicts.length} conflict(s), risk=${result.riskScore}`);
  return { documentId, conflicts: result.conflicts.length, riskScore: result.riskScore };
}

// When a job is permanently dead-lettered, reflect it on the document too.
async function markDocFailedIfNeeded(job, err) {
  if (job.attempts >= (job.maxAttempts || config.maxAttempts) && job.data?.documentId) {
    await updateDoc(job.data.documentId, { status: 'failed', stage: 'error', error: err.message }).catch(() => {});
  }
}

async function main() {
  await connectDb();

  const queue = new PollingQueue({
    handler: async (job) => {
      try {
        return await handleJob(job);
      } catch (err) {
        await markDocFailedIfNeeded(job, err);
        throw err; // let the queue handle retry/backoff/DLQ bookkeeping
      }
    },
  });

  const shutdown = async () => {
    log.info('Shutting down processor...');
    await queue.stop();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  queue.start();
}

main().catch((err) => {
  log.error('Fatal worker error', err);
  process.exit(1);
});
