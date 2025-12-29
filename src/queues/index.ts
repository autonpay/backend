/**
 * Queue Exports
 */

export { transactionQueue, queueTransaction, getQueueStatus, closeTransactionQueues } from './transaction.queue';
export { webhookQueue, queueWebhookDelivery, getWebhookQueueStatus, closeWebhookQueue } from './webhook.queue';

/**
 * Close all queue connections
 * Used for graceful shutdown and test cleanup
 */
export async function closeAllQueues(): Promise<void> {
  const { closeTransactionQueues } = await import('./transaction.queue');
  const { closeWebhookQueue } = await import('./webhook.queue');

  await Promise.all([
    closeTransactionQueues(),
    closeWebhookQueue(),
  ]);
}

