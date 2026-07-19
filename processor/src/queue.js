import os from 'node:os';
import { JobModel } from './models/Job.js';
import { config } from './config.js';
import { log } from './logger.js';

// A minimal, dependency-free job queue built on MongoDB polling.
//
// - Workers atomically claim the next due `pending` job via findOneAndUpdate
//   (safe across multiple worker replicas - only one wins the document).
// - Failures retry with exponential backoff until `maxAttempts`, then the job
//   is marked `failed` (dead-letter state) for auditing.
// - Jobs whose lock goes stale (crashed worker) are recovered to `pending`.
export class PollingQueue {
  constructor({ handler }) {
    this.handler = handler;
    this.workerId = `${os.hostname()}#${process.pid}`;
    this.concurrency = config.concurrency;
    this.active = 0;
    this.running = false;
    this.pollTimer = null;
    this.staleTimer = null;
  }

  start() {
    this.running = true;
    log.info(
      `Polling queue online. workerId=${this.workerId} concurrency=${this.concurrency} ` +
        `interval=${config.pollIntervalMs}ms provider=${config.useMock ? 'mock' : 'aws'}`
    );
    const loop = async () => {
      if (!this.running) return;
      try {
        await this.drain();
      } catch (err) {
        log.error('Poll loop error', err.message);
      }
      this.pollTimer = setTimeout(loop, config.pollIntervalMs);
    };
    loop();

    // Periodic stale-lock recovery.
    this.staleTimer = setInterval(() => this.recoverStale().catch(() => {}), Math.max(config.staleLockMs / 2, 5000));
  }

  async stop() {
    this.running = false;
    clearTimeout(this.pollTimer);
    clearInterval(this.staleTimer);
  }

  // Claim and dispatch as many jobs as free concurrency slots allow.
  async drain() {
    while (this.running && this.active < this.concurrency) {
      const job = await this.claim();
      if (!job) break;
      this.dispatch(job);
    }
  }

  // Atomically claim the next due pending job.
  async claim() {
    const now = new Date();
    return JobModel.findOneAndUpdate(
      { status: 'pending', availableAt: { $lte: now } },
      {
        $set: { status: 'active', lockedAt: now, lockedBy: this.workerId, startedAt: now },
        $inc: { attempts: 1 },
      },
      { sort: { priority: -1, availableAt: 1, createdAt: 1 }, new: true }
    );
  }

  dispatch(job) {
    this.active += 1;
    this.processJob(job)
      .catch((err) => log.error(`Unhandled job error ${job._id}`, err.message))
      .finally(() => {
        this.active -= 1;
        // Immediately try to top up the pipeline.
        if (this.running) this.drain().catch(() => {});
      });
  }

  async processJob(job) {
    const id = job._id;
    try {
      const result = await this.handler(job);
      await JobModel.updateOne(
        { _id: id },
        { $set: { status: 'completed', completedAt: new Date(), result, error: null, lockedBy: null } }
      );
      log.info(`Job ${id} completed.`);
    } catch (err) {
      await this.handleFailure(job, err);
    }
  }

  async handleFailure(job, err) {
    const id = job._id;
    const attempts = job.attempts; // already incremented at claim time
    const maxAttempts = job.maxAttempts || config.maxAttempts;

    if (attempts >= maxAttempts) {
      log.error(`Job ${id} failed permanently (attempt ${attempts}/${maxAttempts}): ${err.message}`);
      log.error(`[DLQ] Document ${job.data?.documentId} exhausted retries. Marking failed.`);
      await JobModel.updateOne(
        { _id: id },
        { $set: { status: 'failed', failedAt: new Date(), error: err.message, lockedBy: null } }
      );
      return { deadLettered: true };
    }

    const delay = config.retryBackoffMs * Math.pow(2, attempts - 1);
    const availableAt = new Date(Date.now() + delay);
    log.warn(`Job ${id} failed (attempt ${attempts}/${maxAttempts}): ${err.message}. Retrying in ${delay}ms.`);
    await JobModel.updateOne(
      { _id: id },
      { $set: { status: 'pending', availableAt, error: err.message, lockedAt: null, lockedBy: null } }
    );
    return { retryAt: availableAt };
  }

  async recoverStale() {
    const cutoff = new Date(Date.now() - config.staleLockMs);
    const res = await JobModel.updateMany(
      { status: 'active', lockedAt: { $lt: cutoff } },
      { $set: { status: 'pending', lockedAt: null, lockedBy: null, availableAt: new Date() } }
    );
    if (res.modifiedCount > 0) {
      log.warn(`Recovered ${res.modifiedCount} stale job(s) back to pending.`);
    }
  }
}
