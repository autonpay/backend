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
// Use lazyConnect to avoid immediate connection attempts
const connection = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null,
  lazyConnect: true, // Don't connect immediately
  enableReadyCheck: false, // Don't wait for ready state
  retryStrategy: (times) => {
    // Retry with exponential backoff, max 3 seconds
    const delay = Math.min(times * 50, 3000);
    return delay;
  },
  reconnectOnError: (err) => {
    // Reconnect on connection errors
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      return true;
    }
    return false;
  },
});

// Handle connection errors gracefully
connection.on('error', (err) => {
  logger.warn({ err }, 'Redis connection error (queue operations may fail)');
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
 * Created with error handling to prevent failures when Redis is unavailable
 */
let transactionQueue: Queue<TransactionJobData>;
let deadLetterQueue: Queue<DeadLetterQueueData>;

try {
  transactionQueue = new Queue<TransactionJobData>('transaction-processing', {
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
  deadLetterQueue = new Queue<DeadLetterQueueData>('transaction-dlq', {
    connection,
    defaultJobOptions: {
      removeOnComplete: {
        age: 30 * 24 * 3600, // Keep for 30 days
      },
    },
  });

  // Log queue events
  transactionQueue.on('error', (error) => {
    logger.warn({ err: error }, 'Transaction queue error (operations may fail)');
  });

  deadLetterQueue.on('error', (error) => {
    logger.warn({ err: error }, 'Dead letter queue error (operations may fail)');
  });
} catch (error) {
  // If Queue creation fails (e.g., Redis not available), create a mock queue
  // This allows the application to start even without Redis
  logger.warn({ err: error }, 'Failed to create transaction queues. Queue operations will be disabled.');

  // Create a minimal queue-like object that won't throw errors
  transactionQueue = null as any;
  deadLetterQueue = null as any;
}

export { transactionQueue, deadLetterQueue };

/**
 * Close all queue connections
 * Used for graceful shutdown and test cleanup
 */
export async function closeTransactionQueues(): Promise<void> {
  try {
    if (transactionQueue) {
      await transactionQueue.close();
    }
    if (deadLetterQueue) {
      await deadLetterQueue.close();
    }
    await connection.quit();
    logger.debug('Transaction queues closed');
  } catch (error) {
    logger.warn({ err: error }, 'Error closing transaction queues');
  }
}

/**
 * Add transaction to processing queue with dynamic retry configuration
 *
 * This function will not throw errors - it handles Redis connection failures gracefully
 * to ensure transaction creation can succeed even when Redis is unavailable.
 */
export async function queueTransaction(data: TransactionJobData): Promise<void> {
  // Check if queue is available (might be null if Redis was unavailable at startup)
  if (!transactionQueue) {
    logger.warn(
      { transactionId: data.transactionId },
      'Transaction queue not available. Transaction created but will need manual processing when Redis is available.'
    );
    return;
  }

  try {
    // Default job options (will be used if error occurs during processing)
    const defaultOptions: JobsOptions = {
      jobId: `txn-${data.transactionId}`, // Unique job ID
      attempts: 3, // Default attempts
      backoff: {
        type: 'exponential',
        delay: 2000, // Start with 2 seconds
      },
    };

    // Try to add job to queue
    // This may fail if Redis is not available, but we catch and log the error
    await transactionQueue.add('process-transaction', data, defaultOptions);

    logger.info({ transactionId: data.transactionId }, 'Transaction queued for processing');
  } catch (error: any) {
    // If Redis is unavailable or any other error occurs, log it but don't throw
    // This allows transactions to be created even when Redis is down
    // The transaction is already saved to the database, so we can process it later
    const errorMessage = error?.message || String(error);
    const errorName = error?.name || 'UnknownError';

    logger.warn(
      {
        transactionId: data.transactionId,
        err: error,
        errorName,
        errorMessage,
      },
      'Failed to add transaction to queue. Transaction created but may need manual processing when Redis is available.'
    );
    // Silently fail - don't throw error
    // This ensures transaction creation succeeds even if queueing fails
  }
}

/**
 * Move failed transaction to dead letter queue
 */
export async function moveToDeadLetterQueue(data: TransactionJobData, error: unknown): Promise<void> {
  if (!deadLetterQueue) {
    logger.warn(
      { transactionId: data.transactionId, error },
      'Dead letter queue not available. Failed transaction logged but not queued.'
    );
    return;
  }

  try {
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
  } catch (err) {
    logger.error(
      { transactionId: data.transactionId, error, err },
      'Failed to move transaction to dead letter queue'
    );
  }
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
  if (!transactionQueue) {
    return { waiting: 0, active: 0, completed: 0, failed: 0 };
  }

  try {
    const [waiting, active, completed, failed] = await Promise.all([
      transactionQueue.getWaitingCount(),
      transactionQueue.getActiveCount(),
      transactionQueue.getCompletedCount(),
      transactionQueue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
  } catch (error) {
    logger.warn({ err: error }, 'Failed to get queue status');
    return { waiting: 0, active: 0, completed: 0, failed: 0 };
  }
}

