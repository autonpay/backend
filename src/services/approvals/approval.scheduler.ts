/**
 * Approval Scheduler
 *
 * Scheduled task to handle expired approvals.
 * Runs periodically to:
 * - Find approvals that have expired
 * - Mark them as expired
 * - Update associated transactions to rejected status
 * - Trigger webhooks
 *
 * TODO: Add email/push notifications for expired approvals
 */

import { logger } from '../../shared/logger';
import { ApprovalRepository } from './approval.repository';
import { ApprovalStatus } from './approval.types';
import { TransactionRepository } from '../transactions/transaction.repository';
import { TransactionStatus } from '../transactions/transaction.types';
import { WebhookService } from '../webhooks';

export class ApprovalScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private approvalRepository: ApprovalRepository,
    private transactionRepository: TransactionRepository,
    private webhookService?: WebhookService
  ) {}

  /**
   * Start the scheduler
   * @param intervalMs - Interval in milliseconds (default: 1 hour)
   */
  start(intervalMs: number = 60 * 60 * 1000): void {
    if (this.isRunning) {
      logger.warn('Approval scheduler is already running');
      return;
    }

    logger.info({ intervalMs }, 'Starting approval expiration scheduler');

    // Run immediately on start
    this.processExpiredApprovals().catch((error) => {
      logger.error({ err: error }, 'Error in initial expired approvals check');
    });

    // Then run periodically
    this.intervalId = setInterval(() => {
      this.processExpiredApprovals().catch((error) => {
        logger.error({ err: error }, 'Error processing expired approvals');
      });
    }, intervalMs);

    this.isRunning = true;
    logger.info('Approval expiration scheduler started');
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    logger.info('Approval expiration scheduler stopped');
  }

  /**
   * Process expired approvals
   */
  async processExpiredApprovals(): Promise<void> {
    logger.debug('Checking for expired approvals');

    try {
      // Find all expired approvals
      const expiredApprovals = await this.approvalRepository.findExpired();

      if (expiredApprovals.length === 0) {
        logger.debug('No expired approvals found');
        return;
      }

      logger.info(
        { count: expiredApprovals.length },
        'Found expired approvals to process'
      );

      const approvalIds = expiredApprovals.map((approval) => approval.id);

      // Mark approvals as expired
      const updatedCount = await this.approvalRepository.markExpired(approvalIds);

      logger.info(
        { count: updatedCount },
        'Marked approvals as expired'
      );

      // Update associated transactions and trigger webhooks
      for (const approval of expiredApprovals) {
        try {
          // Update transaction status to rejected
          await this.transactionRepository.updateStatus(
            approval.transactionId,
            TransactionStatus.REJECTED,
            {
              rejectionReason: 'Approval expired',
            }
          );

          logger.info(
            {
              approvalId: approval.id,
              transactionId: approval.transactionId,
            },
            'Transaction rejected due to expired approval'
          );

          // Trigger webhook
          // TODO: Add email/push notifications for expired approvals
          if (this.webhookService) {
            await this.webhookService.triggerApprovalExpired({
              id: approval.id,
              transactionId: approval.transactionId,
              organizationId: approval.organizationId,
            });
          }
        } catch (error) {
          logger.error(
            {
              approvalId: approval.id,
              transactionId: approval.transactionId,
              err: error,
            },
            'Error processing expired approval'
          );
          // Continue with other approvals even if one fails
        }
      }

      logger.info(
        { processed: expiredApprovals.length },
        'Finished processing expired approvals'
      );
    } catch (error) {
      logger.error({ err: error }, 'Failed to process expired approvals');
      throw error;
    }
  }

  /**
   * Check if scheduler is running
   */
  isActive(): boolean {
    return this.isRunning;
  }
}

