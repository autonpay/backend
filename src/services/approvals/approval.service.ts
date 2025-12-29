/**
 * Approval Service
 *
 * Business logic for transaction approvals.
 */

import { logger } from '../../shared/logger';
import { NotFoundError, BadRequestError } from '../../shared/errors';
import { ApprovalRepository } from './approval.repository';
import {
  Approval,
  ApprovalStatus,
  CreateApprovalInput,
  ApproveTransactionInput,
  RejectTransactionInput,
  ListApprovalsQuery,
} from './approval.types';
import { TransactionRepository } from '../transactions/transaction.repository';
import { TransactionStatus } from '../transactions/transaction.types';
import { queueTransaction } from '../../queues/transaction.queue';
import { WebhookService } from '../webhooks';

export class ApprovalService {
  constructor(
    private repository: ApprovalRepository,
    private transactionRepository: TransactionRepository,
    private webhookService?: WebhookService
  ) {}

  /**
   * Create an approval request for a transaction
   */
  async createApproval(input: CreateApprovalInput): Promise<Approval> {
    logger.info({ input }, 'Creating approval request');

    // Check if transaction exists and is in pending_approval status
    const transaction = await this.transactionRepository.findById(input.transactionId);
    if (!transaction) {
      throw new NotFoundError('Transaction', input.transactionId);
    }

    if (transaction.status !== TransactionStatus.PENDING_APPROVAL) {
      throw new BadRequestError(
        `Transaction is not in pending_approval status. Current status: ${transaction.status}`
      );
    }

    // Check if approval already exists
    const existingApproval = await this.repository.findByTransactionId(input.transactionId);
    if (existingApproval) {
      throw new BadRequestError('Approval already exists for this transaction');
    }

    // Determine required approvers from rule conditions or use default
    const requiredApprovers = input.requiredApprovers || 1;

    // Create approval with optional expiration (default: 7 days)
    const expiresAt = input.expiresAt || this.getDefaultExpiration();

    const approval = await this.repository.create({
      transactionId: input.transactionId,
      organizationId: input.organizationId,
      requiredApprovers,
      expiresAt,
    });

    logger.info({ approvalId: approval.id, transactionId: input.transactionId }, 'Approval created');

    // Trigger webhook
    if (this.webhookService) {
      await this.webhookService.triggerApprovalCreated(approval);
    }

    return approval;
  }

  /**
   * Get approval by ID
   */
  async getApproval(id: string, organizationId: string): Promise<Approval> {
    const approval = await this.repository.findById(id);
    if (!approval) {
      throw new NotFoundError('Approval', id);
    }

    if (approval.organizationId !== organizationId) {
      throw new NotFoundError('Approval', id);
    }

    return approval;
  }

  /**
   * List approvals for organization
   */
  async listApprovals(query: ListApprovalsQuery): Promise<Approval[]> {
    return this.repository.list(query);
  }

  /**
   * Approve a transaction
   */
  async approveTransaction(
    approvalId: string,
    userId: string,
    organizationId: string,
    input: ApproveTransactionInput = {}
  ): Promise<Approval> {
    logger.info({ approvalId, userId }, 'Approving transaction');

    const approval = await this.getApproval(approvalId, organizationId);

    // Check if approval is in a valid state
    if (approval.status !== ApprovalStatus.PENDING) {
      throw new BadRequestError(`Approval is not pending. Current status: ${approval.status}`);
    }

    // Check if approval has expired
    if (approval.expiresAt && approval.expiresAt < new Date()) {
      await this.repository.updateStatus(approvalId, ApprovalStatus.EXPIRED);
      throw new BadRequestError('Approval has expired');
    }

    // Check if user has already acted on this approval
    const hasActed = await this.repository.hasUserActed(approvalId, userId);
    if (hasActed) {
      throw new BadRequestError('You have already acted on this approval');
    }

    // Add approval action
    await this.repository.addAction(approvalId, userId, 'approved', input.comment);

    // Get updated approval count
    const approvalCount = await this.repository.getApprovalCount(approvalId);

    // Update current approvers count
    await this.repository.updateStatus(approvalId, ApprovalStatus.PENDING, approvalCount);

    // Check if we have enough approvers
    if (approvalCount >= approval.requiredApprovers) {
      // Mark approval as approved
      await this.repository.updateStatus(approvalId, ApprovalStatus.APPROVED, approvalCount);

      // Update transaction status to pending and queue for processing
      await this.transactionRepository.updateStatus(approval.transactionId, TransactionStatus.PENDING, {
        approvedBy: userId,
      });

      // Queue transaction for processing
      const transaction = await this.transactionRepository.findById(approval.transactionId);
      if (transaction) {
        await queueTransaction({
          transactionId: transaction.id,
          organizationId: transaction.organizationId,
          agentId: transaction.agentId,
          amount: transaction.amount,
          currency: transaction.currency,
        });

        logger.info(
          { approvalId, transactionId: approval.transactionId },
          'Transaction approved and queued for processing'
        );

        // Trigger webhook
        if (this.webhookService) {
          await this.webhookService.triggerApprovalApproved({
            id: approvalId,
            transactionId: approval.transactionId,
            organizationId: approval.organizationId,
            currentApprovers: approvalCount,
            requiredApprovers: approval.requiredApprovers,
          });
        }
      }
    }

    // Return updated approval
    const updatedApproval = await this.repository.findById(approvalId);
    if (!updatedApproval) {
      throw new NotFoundError('Approval', approvalId);
    }

    return updatedApproval;
  }

  /**
   * Reject a transaction
   */
  async rejectTransaction(
    approvalId: string,
    userId: string,
    organizationId: string,
    input: RejectTransactionInput
  ): Promise<Approval> {
    logger.info({ approvalId, userId, reason: input.reason }, 'Rejecting transaction');

    const approval = await this.getApproval(approvalId, organizationId);

    // Check if approval is in a valid state
    if (approval.status !== ApprovalStatus.PENDING) {
      throw new BadRequestError(`Approval is not pending. Current status: ${approval.status}`);
    }

    // Check if approval has expired
    if (approval.expiresAt && approval.expiresAt < new Date()) {
      await this.repository.updateStatus(approvalId, ApprovalStatus.EXPIRED);
      throw new BadRequestError('Approval has expired');
    }

    // Check if user has already acted on this approval
    const hasActed = await this.repository.hasUserActed(approvalId, userId);
    if (hasActed) {
      throw new BadRequestError('You have already acted on this approval');
    }

    // Add rejection action
    await this.repository.addAction(approvalId, userId, 'rejected', input.comment);

    // Mark approval as rejected (single rejection = rejected)
    await this.repository.updateStatus(approvalId, ApprovalStatus.REJECTED);

    // Update transaction status to rejected
    await this.transactionRepository.updateStatus(approval.transactionId, TransactionStatus.REJECTED, {
      rejectionReason: input.reason,
    });

    logger.info(
      { approvalId, transactionId: approval.transactionId },
      'Transaction rejected'
    );

    // Trigger webhook
    if (this.webhookService) {
      await this.webhookService.triggerApprovalRejected({
        id: approvalId,
        transactionId: approval.transactionId,
        organizationId: approval.organizationId,
        rejectionReason: input.reason,
      });
    }

    // Return updated approval
    const updatedApproval = await this.repository.findById(approvalId);
    if (!updatedApproval) {
      throw new NotFoundError('Approval', approvalId);
    }

    return updatedApproval;
  }

  /**
   * Get approval for a transaction
   */
  async getApprovalByTransaction(transactionId: string, organizationId: string): Promise<Approval | null> {
    const approval = await this.repository.findByTransactionId(transactionId);
    if (!approval) {
      return null;
    }

    if (approval.organizationId !== organizationId) {
      return null;
    }

    return approval;
  }

  /**
   * Get default expiration date (7 days from now)
   */
  private getDefaultExpiration(): Date {
    const expiration = new Date();
    expiration.setDate(expiration.getDate() + 7);
    return expiration;
  }
}

