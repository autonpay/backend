/**
 * Webhook Service
 *
 * Handles webhook delivery for transaction events.
 */

import { logger } from '../../shared/logger';
import { Transaction } from '../transactions/transaction.types';
import { WebhookRepository } from './webhook.repository';
import { queueWebhookDelivery } from '../../queues/webhook.queue';

export interface WebhookPayload {
  event: string;
  data: any;
  timestamp: string;
  signature?: string;
}

export interface WebhookConfig {
  url: string;
  secret: string;
  events: string[];
}

export class WebhookService {
  constructor(private repository: WebhookRepository) {}

  /**
   * Trigger a webhook event
   *
   * Finds registered webhooks for the organization that listen to the event,
   * creates event log entries, and queues webhook delivery jobs.
   */
  async trigger(event: string, data: any, organizationId: string): Promise<void> {
    logger.info({ event, dataId: data?.id, organizationId }, 'Webhook event triggered');

    try {
      // Find enabled webhooks for this organization that listen to this event
      const webhooks = await this.repository.findEnabledByEvent(organizationId, event);

      if (webhooks.length === 0) {
        logger.debug({ event, organizationId }, 'No webhooks registered for this event');
        return;
      }

      logger.info({ event, organizationId, count: webhooks.length }, 'Found webhooks for event');

      // Queue delivery for each webhook
      for (const webhook of webhooks) {
        try {
          // Create event log entry
          const eventLog = await this.repository.createEvent({
            webhookId: webhook.id,
            eventType: event,
            payload: data,
          });

          // Queue webhook delivery job
          await queueWebhookDelivery({
            webhookId: webhook.id,
            organizationId: webhook.organizationId,
            url: webhook.url,
            secret: webhook.secret,
            event,
            payload: data,
            eventId: eventLog.id,
          });

          logger.debug(
            { webhookId: webhook.id, event, eventId: eventLog.id },
            'Webhook delivery queued'
          );
        } catch (error) {
          logger.error(
            { webhookId: webhook.id, event, err: error },
            'Failed to queue webhook delivery'
          );
          // Continue with other webhooks even if one fails
        }
      }
    } catch (error) {
      logger.error({ event, organizationId, err: error }, 'Failed to trigger webhook event');
      // Don't throw - webhook failures shouldn't break the main flow
    }
  }

  /**
   * Trigger transaction completed webhook
   */
  async triggerTransactionCompleted(transaction: Transaction): Promise<void> {
    await this.trigger('transaction.completed', {
      id: transaction.id,
      organizationId: transaction.organizationId,
      agentId: transaction.agentId,
      amount: transaction.amount,
      currency: transaction.currency,
      status: transaction.status,
      paymentMethod: transaction.paymentMethod,
      blockchainTxHash: transaction.blockchainTxHash,
      blockchainNetwork: transaction.blockchainNetwork,
      fromAddress: transaction.fromAddress,
      toAddress: transaction.toAddress,
      completedAt: transaction.completedAt,
      createdAt: transaction.createdAt,
    }, transaction.organizationId);
  }

  /**
   * Trigger transaction failed webhook
   */
  async triggerTransactionFailed(transaction: Transaction, error: Error): Promise<void> {
    await this.trigger('transaction.failed', {
      id: transaction.id,
      organizationId: transaction.organizationId,
      agentId: transaction.agentId,
      amount: transaction.amount,
      currency: transaction.currency,
      status: transaction.status,
      paymentMethod: transaction.paymentMethod,
      errorMessage: transaction.errorMessage || error.message,
      failedAt: transaction.updatedAt,
      createdAt: transaction.createdAt,
    }, transaction.organizationId);
  }

  /**
   * Trigger approval created webhook
   */
  async triggerApprovalCreated(approval: { id: string; transactionId: string; organizationId: string; status: string; requiredApprovers: number; expiresAt: Date | null }): Promise<void> {
    await this.trigger('approval.created', {
      id: approval.id,
      transactionId: approval.transactionId,
      organizationId: approval.organizationId,
      status: approval.status,
      requiredApprovers: approval.requiredApprovers,
      expiresAt: approval.expiresAt,
      createdAt: new Date(),
    }, approval.organizationId);
  }

  /**
   * Trigger approval approved webhook
   */
  async triggerApprovalApproved(approval: { id: string; transactionId: string; organizationId: string; currentApprovers: number; requiredApprovers: number }): Promise<void> {
    await this.trigger('approval.approved', {
      id: approval.id,
      transactionId: approval.transactionId,
      organizationId: approval.organizationId,
      currentApprovers: approval.currentApprovers,
      requiredApprovers: approval.requiredApprovers,
      approvedAt: new Date(),
    }, approval.organizationId);
  }

  /**
   * Trigger approval rejected webhook
   */
  async triggerApprovalRejected(approval: { id: string; transactionId: string; organizationId: string; rejectionReason?: string }): Promise<void> {
    await this.trigger('approval.rejected', {
      id: approval.id,
      transactionId: approval.transactionId,
      organizationId: approval.organizationId,
      rejectionReason: approval.rejectionReason,
      rejectedAt: new Date(),
    }, approval.organizationId);
  }

  /**
   * Trigger approval expired webhook
   */
  async triggerApprovalExpired(approval: { id: string; transactionId: string; organizationId: string }): Promise<void> {
    await this.trigger('approval.expired', {
      id: approval.id,
      transactionId: approval.transactionId,
      organizationId: approval.organizationId,
      expiredAt: new Date(),
    }, approval.organizationId);
  }
}

