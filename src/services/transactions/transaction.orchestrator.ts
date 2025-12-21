/**
 * Transaction Orchestrator
 *
 * Coordinates the entire transaction flow across multiple services.
 * This is the "conductor" that orchestrates agents, rules, blockchain, etc.
 */

import {
  Transaction,
  CreateTransactionInput,
  TransactionStatus,
  PaymentMethod
} from './transaction.types';
import { TransactionRepository } from './transaction.repository';
import { AgentService } from '../agents';
import { RulesService, SpendRequest } from '../rules';
import { LedgerService } from '../ledger';
import { BlockchainService } from '../blockchain';
import { WebhookService } from '../webhooks';
import { NotFoundError } from '../../shared/errors';
import { logger } from '../../shared/logger';
import { InsufficientBalanceError, RuleViolationError, getErrorDetails, isRetryableError } from '../../shared/errors';
import { queueTransaction } from '../../queues/transaction.queue';

export class TransactionOrchestrator {
  constructor(
    private repository: TransactionRepository,
    private agentService: AgentService,
    private rulesService: RulesService,
    private ledgerService: LedgerService,
    private blockchainService?: BlockchainService,
    private webhookService?: WebhookService
  ) {}

  /**
   * Orchestrate a spend request
   *
   * This is the main entry point for initiating a transaction.
   * It coordinates all the steps:
   * 1. Validate agent
   * 2. Check balance
   * 3. Evaluate rules
   * 4. Create transaction record
   * 5. Queue for processing (or create approval)
   */
  async initiateSpend(input: CreateTransactionInput): Promise<Transaction> {
    logger.info({ input }, 'Initiating spend');

    // Step 1: Validate agent exists and is active
    const agent = await this.agentService.getAgent(input.agentId);

    if (agent.status !== 'active') {
      throw new Error(`Agent ${agent.id} is not active`);
    }

    // Step 2: Check balance (via Ledger Service)
    const balance = await this.ledgerService.getAgentBalance(input.agentId);

    if (balance.available < input.amount) {
      throw new InsufficientBalanceError(balance.available, input.amount);
    }

    // Step 3: Evaluate spending rules
    const spendRequest: SpendRequest = {
      agentId: input.agentId,
      amount: input.amount,
      currency: input.currency || 'USD',
      merchantId: input.merchantId,
      merchantName: input.merchantName,
      category: input.category,
      metadata: input.metadata,
    };

    const ruleResult = await this.rulesService.evaluateSpend(spendRequest);

    // Step 4a: If rule violation, reject
    if (!ruleResult.approved && !ruleResult.requiresApproval) {
      throw new RuleViolationError(
        ruleResult.reason || 'Transaction violates spending rules',
        ruleResult.violatedRule
      );
    }

    // Step 4b: Create transaction record
    const transaction = await this.createTransaction({
      ...input,
      organizationId: agent.organizationId,
      status: ruleResult.requiresApproval
        ? TransactionStatus.PENDING_APPROVAL
        : TransactionStatus.PENDING,
      requiresApproval: ruleResult.requiresApproval || false,
    });

    // Step 5: Either queue for processing or create approval
    if (ruleResult.requiresApproval) {
      // TODO: Create approval request
      // await this.approvalService.createApproval(transaction);
      logger.info({ transactionId: transaction.id }, 'Transaction requires approval');
    } else {
      // Queue for background processing
      await queueTransaction({
        transactionId: transaction.id,
        organizationId: agent.organizationId,
        agentId: transaction.agentId,
        amount: transaction.amount,
        currency: transaction.currency,
      });
      logger.info({ transactionId: transaction.id }, 'Transaction queued for processing');
    }

    return transaction;
  }

  /**
   * Create transaction record in database
   */
  private async createTransaction(data: CreateTransactionInput & {
    organizationId: string;
    status: TransactionStatus;
    requiresApproval: boolean;
  }): Promise<Transaction> {
    return this.repository.create({
      ...data,
      paymentMethod: PaymentMethod.ONCHAIN,
    });
  }

  /**
   * Get transaction by ID
   */
  async getTransaction(id: string): Promise<Transaction> {
    const transaction = await this.repository.findById(id);
    if (!transaction) {
      throw new NotFoundError('Transaction', id);
    }
    return transaction;
  }

  /**
   * List transactions for organization
   */
  async listTransactions(query: {
    organizationId: string;
    agentId?: string;
    status?: TransactionStatus;
    limit?: number;
    offset?: number;
  }): Promise<Transaction[]> {
    return this.repository.list(query);
  }

  /**
   * Verify transaction ownership
   */
  async verifyOwnership(transactionId: string, organizationId: string): Promise<void> {
    const hasAccess = await this.repository.verifyOwnership(transactionId, organizationId);
    if (!hasAccess) {
      throw new NotFoundError('Transaction', transactionId);
    }
  }

  /**
   * Process transaction (called by worker)
   *
   * This is called by the BullMQ worker to actually execute the transaction.
   */
  async processTransaction(transactionId: string): Promise<void> {
    logger.info({ transactionId }, 'Processing transaction');

    const transaction = await this.getTransaction(transactionId);

    // Update status to PROCESSING
    await this.repository.updateStatus(transactionId, TransactionStatus.PROCESSING);

    try {
      // Determine payment method and route accordingly
      if (transaction.paymentMethod === PaymentMethod.ONCHAIN) {
        if (!this.blockchainService) {
          throw new Error('Blockchain service not available');
        }

        // Execute on-chain transaction
        const result = await this.blockchainService.executeSpend(transaction);

        // Wait for transaction confirmation (wait for at least 1 confirmation)
        logger.info({ transactionId, txHash: result.txHash }, 'Waiting for transaction confirmation');
        const confirmation = await this.blockchainService.waitForConfirmation(result.txHash, 1);

        // Check if transaction was successful
        if (confirmation.status === 'reverted' || confirmation.status === 'failed') {
          throw new Error(`Transaction reverted or failed: ${confirmation.status}`);
        }

        // Update transaction with blockchain details
        await this.repository.update(transactionId, {
          blockchainTxHash: result.txHash,
          blockchainNetwork: result.network,
          fromAddress: transaction.fromAddress,
          toAddress: transaction.toAddress,
        });

        logger.info(
          { transactionId, txHash: result.txHash, confirmations: confirmation.confirmations },
          'On-chain transaction confirmed'
        );
      } else {
        // TODO: Card payment processing
        logger.debug({ transactionId, paymentMethod: transaction.paymentMethod }, 'Card payment not yet implemented');
      }

      // Update ledger (double-entry accounting)
      const toAccount = transaction.merchantId
        ? `merchant:${transaction.merchantId}`
        : transaction.toAddress
          ? `external:${transaction.toAddress}`
          : 'external:unknown';

      await this.ledgerService.recordTransaction({
        transactionId: transaction.id,
        fromAccount: `agent:${transaction.agentId}`,
        toAccount,
        amount: transaction.amount,
        currency: transaction.currency,
        description: transaction.merchantName || transaction.category || 'Payment',
      });

      // Update status to COMPLETED
      await this.repository.updateStatus(transactionId, TransactionStatus.COMPLETED);

      // Get updated transaction for webhook
      const completedTransaction = await this.getTransaction(transactionId);

      // Trigger webhook
      if (this.webhookService) {
        await this.webhookService.triggerTransactionCompleted(completedTransaction);
      }

      logger.info({ transactionId }, 'Transaction completed successfully');
    } catch (error) {
      const errorDetails = getErrorDetails(error);
      const retryable = isRetryableError(error);

      logger.error(
        {
          transactionId,
          err: error,
          errorType: errorDetails.type,
          errorCode: errorDetails.code,
          retryable,
        },
        'Transaction processing failed'
      );

      // Determine final status based on error type
      // If retryable, keep as PROCESSING (will be retried by worker)
      // If not retryable, mark as FAILED
      const finalStatus = retryable ? TransactionStatus.PROCESSING : TransactionStatus.FAILED;

      // Update status
      await this.repository.updateStatus(transactionId, finalStatus, {
        errorMessage: errorDetails.message,
      });

      // Get updated transaction for webhook
      const failedTransaction = await this.getTransaction(transactionId);

      // Trigger webhook only for non-retryable errors (permanent failures)
      if (!retryable && this.webhookService) {
        try {
          await this.webhookService.triggerTransactionFailed(
            failedTransaction,
            error instanceof Error ? error : new Error('Unknown error')
          );
        } catch (webhookError) {
          // Don't fail the transaction if webhook fails
          logger.error(
            { transactionId, err: webhookError },
            'Failed to trigger transaction failed webhook'
          );
        }
      }

      // Re-throw error so worker can decide on retry
      throw error;
    }
  }
}

