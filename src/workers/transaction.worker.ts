/**
 * Transaction Worker
 *
 * Background worker that processes transactions from the queue.
 */

import { Worker, Job } from 'bullmq';
import { config } from '../shared/config';
import { logger } from '../shared/logger';
import { container } from '../services/container';
import { TransactionJobData } from '../queues/transaction.queue';
import Redis from 'ioredis';

// Create Redis connection for BullMQ
const connection = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null,
});

/**
 * Process a transaction job
 */
async function processTransaction(job: Job<TransactionJobData>): Promise<void> {
  const { transactionId } = job.data;

  logger.info({ jobId: job.id, transactionId }, 'Processing transaction job');

  try {
    // Process the transaction (this will execute on-chain payment)
    await container.transactionOrchestrator.processTransaction(transactionId);

    logger.info({ jobId: job.id, transactionId }, 'Transaction job completed successfully');
  } catch (error) {
    logger.error(
      { jobId: job.id, transactionId, err: error },
      'Transaction job processing failed'
    );

    // Re-throw to mark job as failed
    throw error;
  }
}

/**
 * Transaction processing worker
 */
export const transactionWorker = new Worker<TransactionJobData>(
  'transaction-processing',
  processTransaction,
  {
    connection,
    concurrency: 5, // Process up to 5 transactions concurrently
    limiter: {
      max: 10, // Max 10 jobs
      duration: 1000, // Per second
    },
  }
);

// Worker event handlers
transactionWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, transactionId: job.data.transactionId }, 'Worker: Transaction completed');
});

transactionWorker.on('failed', (job, err) => {
  logger.error(
    { jobId: job?.id, transactionId: job?.data.transactionId, err },
    'Worker: Transaction failed'
  );
});

transactionWorker.on('error', (error) => {
  logger.error({ err: error }, 'Worker: Transaction Error occurred');
});

/**
 * Gracefully shutdown worker
 */
export async function shutdownWorker(): Promise<void> {
  logger.info('Shutting down transaction worker...');
  await transactionWorker.close();
  logger.info('Transaction worker shut down');
}

