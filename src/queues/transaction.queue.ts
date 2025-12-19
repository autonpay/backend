/**
 * Transaction Queue
 *
 * BullMQ queue for processing transactions in the background.
 */

import { Queue } from 'bullmq';
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

/**
 * Transaction processing queue
 */
export const transactionQueue = new Queue<TransactionJobData>('transaction-processing', {
  connection,
  defaultJobOptions: {
    attempts: 3,
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

// Log queue events
transactionQueue.on('error', (error) => {
  logger.error({ err: error }, 'Transaction queue error');
});

/**
 * Add transaction to processing queue
 */
export async function queueTransaction(data: TransactionJobData): Promise<void> {
  await transactionQueue.add('process-transaction', data, {
    jobId: `txn-${data.transactionId}`, // Unique job ID
  });

  logger.info({ transactionId: data.transactionId }, 'Transaction queued for processing');
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

