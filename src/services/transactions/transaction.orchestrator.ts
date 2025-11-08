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
import { AgentService } from '../agents';
import { RulesService, SpendRequest } from '../rules';
import { LedgerService } from '../ledger';
import { logger } from '../../shared/logger';
import { InsufficientBalanceError, RuleViolationError } from '../../shared/errors';

export class TransactionOrchestrator {
  constructor(
    private agentService: AgentService,
    private rulesService: RulesService,
    private ledgerService: LedgerService
    // private blockchainService: BlockchainService,  // TODO: Inject when created
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
      // TODO: Queue for processing
      // await this.queueTransaction(transaction);
      logger.info({ transactionId: transaction.id }, 'Transaction queued for processing');
    }

    return transaction;
  }

  /**
   * Create transaction record in database
   */
  private async createTransaction(data: any): Promise<Transaction> {
    // TODO: Implement Prisma query
    // return prisma.transaction.create({ data });

    // Placeholder for now
    return {
      id: `txn_${Date.now()}`,
      ...data,
      currency: data.currency || 'USD',
      paymentMethod: PaymentMethod.ONCHAIN,
      metadata: data.metadata || {},
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Transaction;
  }

  /**
   * Process transaction (called by worker)
   *
   * This is called by the BullMQ worker to actually execute the transaction.
   */
  async processTransaction(transactionId: string): Promise<void> {
    logger.info({ transactionId }, 'Processing transaction');

    // TODO: Get transaction from database
    // const transaction = await this.getTransaction(transactionId);

    // TODO: Update status to PROCESSING
    // await this.updateTransactionStatus(transactionId, TransactionStatus.PROCESSING);

    try {
      // TODO: Determine payment method and route accordingly
      // if (transaction.paymentMethod === PaymentMethod.ONCHAIN) {
      //   await this.blockchainService.executeSpend(transaction);
      // } else {
      //   await this.cardBridgeService.processCardPayment(transaction);
      // }

      // TODO: Update status to COMPLETED
      // await this.updateTransactionStatus(transactionId, TransactionStatus.COMPLETED);

      // TODO: Trigger webhook
      // await this.webhookService.trigger('transaction.completed', transaction);

      logger.info({ transactionId }, 'Transaction completed successfully');
    } catch (error) {
      logger.error({ transactionId, error }, 'Transaction processing failed');

      // TODO: Update status to FAILED
      // await this.updateTransactionStatus(transactionId, TransactionStatus.FAILED, {
      //   errorMessage: error.message,
      // });

      // TODO: Trigger webhook
      // await this.webhookService.trigger('transaction.failed', transaction);

      throw error;
    }
  }
}

