/**
 * Webhook Service
 *
 * Handles webhook delivery for transaction events.
 */

import { logger } from '../../shared/logger';
import { Transaction } from '../transactions/transaction.types';

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
  /**
   * Trigger a webhook event
   *
   * For now, this just logs the event. In the future, this will:
   * - Find registered webhooks for the organization
   * - Queue webhook delivery jobs
   * - Sign payloads
   * - Handle retries
   */
  async trigger(event: string, data: any): Promise<void> {
    logger.info({ event, dataId: data?.id }, 'Webhook event triggered');

    // TODO: Implement actual webhook delivery
    // 1. Get webhook configs for organization
    // 2. Queue webhook delivery jobs
    // 3. Sign payloads with webhook secret
    // 4. Handle retries and failures

    // For now, just log
    logger.debug({ event, payload: data }, 'Webhook would be sent here');
  }

  /**
   * Trigger transaction completed webhook
   */
  async triggerTransactionCompleted(transaction: Transaction): Promise<void> {
    await this.trigger('transaction.completed', {
      id: transaction.id,
      agentId: transaction.agentId,
      amount: transaction.amount,
      currency: transaction.currency,
      status: transaction.status,
      blockchainTxHash: transaction.blockchainTxHash,
      blockchainNetwork: transaction.blockchainNetwork,
      completedAt: transaction.completedAt,
    });
  }

  /**
   * Trigger transaction failed webhook
   */
  async triggerTransactionFailed(transaction: Transaction, error: Error): Promise<void> {
    await this.trigger('transaction.failed', {
      id: transaction.id,
      agentId: transaction.agentId,
      amount: transaction.amount,
      currency: transaction.currency,
      status: transaction.status,
      errorMessage: transaction.errorMessage || error.message,
      failedAt: transaction.updatedAt,
    });
  }

  /**
   * Sign webhook payload
   * TODO: Implement HMAC signature when webhook delivery is implemented
   */
  // private signPayload(payload: WebhookPayload, secret: string): string {
  //   const crypto = require('crypto');
  //   const signature = crypto
  //     .createHmac('sha256', secret)
  //     .update(JSON.stringify(payload))
  //     .digest('hex');
  //   return signature;
  // }
}

