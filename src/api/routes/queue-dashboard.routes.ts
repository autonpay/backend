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

createBullBoard({
  queues: [
    new BullMQAdapter(transactionQueue),
    new BullMQAdapter(deadLetterQueue),
    new BullMQAdapter(webhookQueue),
  ],
  serverAdapter,
});

router.use('/admin/queues', serverAdapter.getRouter());

logger.info('Queue dashboard available at /admin/queues');

export default router;
