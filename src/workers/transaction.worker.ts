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
import { getErrorDetails, isRetryableError } from '../shared/errors';
import { moveToDeadLetterQueue } from '../queues/transaction.queue';
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
    const errorDetails = getErrorDetails(error);
    const retryable = isRetryableError(error);
    const attemptNumber = job.attemptsMade + 1;

    logger.error(
      {
        jobId: job.id,
        transactionId,
        err: error,
        errorType: errorDetails.type,
        errorCode: errorDetails.code,
        retryable,
        attemptNumber,
        maxAttempts: job.opts.attempts,
      },
      retryable
        ? 'Transaction job processing failed (will retry)'
        : 'Transaction job processing failed (non-retryable)'
    );

    // For non-retryable errors, the orchestrator already marked it as FAILED
    // No need to update again here - just log it

    // Re-throw to let BullMQ handle retry logic
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

transactionWorker.on('failed', async (job, err) => {
  const transactionId = job?.data.transactionId;
  const retryable = err ? isRetryableError(err) : false;
  const attemptsMade = job?.attemptsMade || 0;
  const maxAttempts = job?.opts.attempts || 3;

  logger.error(
    {
      jobId: job?.id,
      transactionId,
      err,
      retryable,
      attemptsMade,
      maxAttempts,
    },
    'Worker: Transaction failed'
  );

  // If job exhausted all retries or error is non-retryable, move to dead letter queue
  if (job && (!retryable || attemptsMade >= maxAttempts)) {
    try {
      await moveToDeadLetterQueue(job.data, err);
    } catch (dlqError) {
      logger.error(
        { transactionId, err: dlqError },
        'Failed to move transaction to dead letter queue'
      );
    }
  }
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

