/**
 * Webhook Queue
 *
 * BullMQ queue for delivering webhooks in the background.
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
  logger.warn({ err }, 'Redis connection error (webhook queue operations may fail)');
});

export interface WebhookJobData {
  webhookId: string;
  organizationId: string;
  url: string;
  secret: string;
  event: string;
  payload: any;
  eventId: string; // Database event ID for tracking
}

/**
 * Webhook delivery queue
 * Created with error handling to prevent failures when Redis is unavailable
 */
let webhookQueue: Queue<WebhookJobData>;

try {
  webhookQueue = new Queue<WebhookJobData>('webhook-delivery', {
    connection,
    defaultJobOptions: {
      attempts: 5, // Retry up to 5 times
      backoff: {
        type: 'exponential',
        delay: 1000, // Start with 1 second, then 2s, 4s, 8s, 16s
      },
      removeOnComplete: {
        age: 24 * 3600, // Keep completed jobs for 24 hours
        count: 5000, // Keep last 5000 completed jobs
      },
      removeOnFail: {
        age: 7 * 24 * 3600, // Keep failed jobs for 7 days
      },
    },
  });

  // Log queue events
  webhookQueue.on('error', (error) => {
    logger.warn({ err: error }, 'Webhook queue error (operations may fail)');
  });
} catch (error) {
  // If Queue creation fails (e.g., Redis not available), create a mock queue
  // This allows the application to start even without Redis
  logger.warn({ err: error }, 'Failed to create webhook queue. Webhook operations will be disabled.');
  webhookQueue = null as any;
}

export { webhookQueue };

/**
 * Add webhook delivery job to queue
 * This function will not throw errors - it handles Redis connection failures gracefully
 */
export async function queueWebhookDelivery(data: WebhookJobData): Promise<void> {
  if (!webhookQueue) {
    logger.warn(
      { webhookId: data.webhookId, event: data.event, eventId: data.eventId },
      'Webhook queue not available. Webhook delivery skipped.'
    );
    return;
  }

  try {
    const jobOptions: JobsOptions = {
      jobId: `webhook-${data.eventId}`, // Unique job ID based on event
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    };

    await webhookQueue.add('deliver-webhook', data, jobOptions);

    logger.info(
      { webhookId: data.webhookId, event: data.event, eventId: data.eventId },
      'Webhook delivery queued'
    );
  } catch (error: any) {
    logger.warn(
      {
        webhookId: data.webhookId,
        event: data.event,
        eventId: data.eventId,
        err: error,
      },
      'Failed to queue webhook delivery. Webhook will be skipped.'
    );
  }
}

/**
 * Get webhook queue status
 */
export async function getWebhookQueueStatus(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}> {
  if (!webhookQueue) {
    return { waiting: 0, active: 0, completed: 0, failed: 0 };
  }

  try {
    const [waiting, active, completed, failed] = await Promise.all([
      webhookQueue.getWaitingCount(),
      webhookQueue.getActiveCount(),
      webhookQueue.getCompletedCount(),
      webhookQueue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
  } catch (error) {
    logger.warn({ err: error }, 'Failed to get webhook queue status');
    return { waiting: 0, active: 0, completed: 0, failed: 0 };
  }
}

