/**
 * Transaction Queue
 *
 * BullMQ queue for processing transactions in the background.
 */

import { Queue, JobsOptions } from 'bullmq';
import { config } from '../shared/config';
import { logger } from '../shared/logger';
import Redis from 'ioredis';

// Create Redis connection for BullMQ
const connection = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null,
});

export interface TransactionJobData {
  transactionId: string;
  organizationId: string;
  agentId: string;
  amount: number;
  currency: string;
}

export interface DeadLetterQueueData extends TransactionJobData {
  failedAt: string;
  error: string;
}

/**
 * Transaction processing queue
 */
export const transactionQueue = new Queue<TransactionJobData>('transaction-processing', {
  connection,
  defaultJobOptions: {
    attempts: 3, // Default, will be overridden by dynamic retry logic
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2 seconds, then 4s, 8s, etc.
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000, // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
});

/**
 * Dead letter queue for permanently failed transactions
 */
export const deadLetterQueue = new Queue<DeadLetterQueueData>('transaction-dlq', {
  connection,
  defaultJobOptions: {
    removeOnComplete: {
      age: 30 * 24 * 3600, // Keep for 30 days
    },
  },
});

// Log queue events
transactionQueue.on('error', (error) => {
  logger.error({ err: error }, 'Transaction queue error');
});

/**
 * Add transaction to processing queue with dynamic retry configuration
 */
export async function queueTransaction(data: TransactionJobData): Promise<void> {
  // Default job options (will be used if error occurs during processing)
  const defaultOptions: JobsOptions = {
    jobId: `txn-${data.transactionId}`, // Unique job ID
    attempts: 3, // Default attempts
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2 seconds
    },
  };

  await transactionQueue.add('process-transaction', data, defaultOptions);

  logger.info({ transactionId: data.transactionId }, 'Transaction queued for processing');
}

/**
 * Move failed transaction to dead letter queue
 */
export async function moveToDeadLetterQueue(data: TransactionJobData, error: unknown): Promise<void> {
  await deadLetterQueue.add('failed-transaction', {
    ...data,
    failedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
  }, {
    jobId: `dlq-${data.transactionId}`,
  });

  logger.warn(
    { transactionId: data.transactionId, error },
    'Transaction moved to dead letter queue'
  );
}

/**
 * Get queue health status
 */
export async function getQueueStatus(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}> {
  const [waiting, active, completed, failed] = await Promise.all([
    transactionQueue.getWaitingCount(),
    transactionQueue.getActiveCount(),
    transactionQueue.getCompletedCount(),
    transactionQueue.getFailedCount(),
  ]);

  return { waiting, active, completed, failed };
}

