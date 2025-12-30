/**
 * Webhook Worker
 *
 * Background worker that delivers webhooks from the queue.
 */

import { Worker, Job } from 'bullmq';
import { config } from '../shared/config';
import { logger } from '../shared/logger';
import { WebhookJobData } from '../queues/webhook.queue';
import { WebhookRepository } from '../services/webhooks/webhook.repository';
import crypto from 'crypto';
import Redis from 'ioredis';

// Create Redis connection for BullMQ
const connection = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null,
});

const webhookRepository = new WebhookRepository();

/**
 * Sign webhook payload with HMAC-SHA256
 */
function signPayload(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

/**
 * Deliver webhook to endpoint
 */
async function deliverWebhook(job: Job<WebhookJobData>): Promise<void> {
  const { webhookId, url, secret, event, payload, eventId } = job.data;

  logger.info({ jobId: job.id, webhookId, event, eventId }, 'Delivering webhook');

  try {
    // Create payload with timestamp
    const webhookPayload = {
      event,
      data: payload,
      timestamp: new Date().toISOString(),
    };

    // Stringify payload for signing
    const payloadString = JSON.stringify(webhookPayload);

    // Generate HMAC signature
    const signature = signPayload(payloadString, secret);

    // Deliver webhook via HTTP POST
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': `sha256=${signature}`,
        'X-Webhook-Event': event,
        'User-Agent': 'Auton-Webhook-Delivery/1.0',
      },
      body: payloadString,
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    const responseBody = await response.text().catch(() => 'Unable to read response body');

    // Update event delivery status
    await webhookRepository.updateEventDelivery(eventId, {
      responseStatus: response.status,
      responseBody: responseBody.substring(0, 1000), // Limit response body length
      delivered: response.ok, // 200-299 status codes
      attempts: job.attemptsMade + 1,
    });

    if (response.ok) {
      // Success - update webhook last triggered and reset failure count
      await webhookRepository.updateLastTriggered(webhookId);
      await webhookRepository.resetFailureCount(webhookId);

      logger.info(
        { jobId: job.id, webhookId, event, eventId, status: response.status },
        'Webhook delivered successfully'
      );
    } else {
      // Non-2xx response - increment failure count
      await webhookRepository.incrementFailureCount(webhookId);

      logger.warn(
        {
          jobId: job.id,
          webhookId,
          event,
          eventId,
          status: response.status,
          responseBody: responseBody.substring(0, 200),
        },
        'Webhook delivery returned non-OK status'
      );

      // Throw error to trigger retry
      throw new Error(`Webhook delivery failed with status ${response.status}: ${responseBody.substring(0, 200)}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const attemptsMade = job.attemptsMade + 1;

    logger.error(
      {
        jobId: job.id,
        webhookId,
        event,
        eventId,
        err: error,
        attemptNumber: attemptsMade,
      },
      'Webhook delivery failed'
    );

    // Update event delivery status with failure
    await webhookRepository.updateEventDelivery(eventId, {
      responseStatus: null, // No response received
      responseBody: errorMessage.substring(0, 1000),
      delivered: false,
      attempts: attemptsMade,
    }).catch((updateError) => {
      logger.error(
        { eventId, err: updateError },
        'Failed to update webhook event delivery status'
      );
    });

    // Increment webhook failure count
    await webhookRepository.incrementFailureCount(webhookId).catch((updateError) => {
      logger.error(
        { webhookId, err: updateError },
        'Failed to increment webhook failure count'
      );
    });

    // Re-throw to let BullMQ handle retry logic
    throw error;
  }
}

/**
 * Webhook delivery worker
 */
export const webhookWorker = new Worker<WebhookJobData>(
  'webhook-delivery',
  deliverWebhook,
  {
    connection,
    concurrency: 10, // Process up to 10 webhooks concurrently
    limiter: {
      max: 50, // Max 50 jobs
      duration: 1000, // Per second
    },
  }
);

// Worker event handlers
webhookWorker.on('completed', (job) => {
  logger.info(
    { jobId: job.id, webhookId: job.data.webhookId, event: job.data.event },
    'Worker: Webhook delivered'
  );
});

webhookWorker.on('failed', (job, err) => {
  const maxAttempts = job?.opts.attempts || 5;
  const attemptsMade = job?.attemptsMade || 0;

  logger.error(
    {
      jobId: job?.id,
      webhookId: job?.data.webhookId,
      event: job?.data.event,
      err,
      attemptsMade,
      maxAttempts,
    },
    attemptsMade >= maxAttempts
      ? 'Worker: Webhook delivery failed permanently (max attempts reached)'
      : 'Worker: Webhook delivery failed (will retry)'
  );
});

webhookWorker.on('error', (error) => {
  logger.error({ err: error }, 'Worker: Webhook Error occurred');
});

/**
 * Gracefully shutdown worker
 */
export async function shutdownWebhookWorker(): Promise<void> {
  logger.info('Shutting down webhook worker...');
  await webhookWorker.close();
  logger.info('Webhook worker shut down');
}

