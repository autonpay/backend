/**
 * Queue Dashboard Routes
 *
 * Bull Board UI for monitoring queues and workers
 */

import { Router } from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { transactionQueue, deadLetterQueue } from '../../queues/transaction.queue';
import { webhookQueue } from '../../queues/webhook.queue';
import { logger } from '../../shared/logger';

const router = Router();

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

// Only add queues that are available (not null)
const queues = [];
if (transactionQueue) {
  queues.push(new BullMQAdapter(transactionQueue));
}
if (deadLetterQueue) {
  queues.push(new BullMQAdapter(deadLetterQueue));
}
if (webhookQueue) {
  queues.push(new BullMQAdapter(webhookQueue));
}

if (queues.length > 0) {
  createBullBoard({
    queues,
    serverAdapter,
  });

  router.use('/admin/queues', serverAdapter.getRouter());
  logger.info('Queue dashboard available at /admin/queues');
} else {
  logger.warn('No queues available for dashboard (Redis may be unavailable)');
}

logger.info('Queue dashboard available at /admin/queues');

export default router;
