/**
 * Ledger Service
 *
 * Manages double-entry accounting ledger and balance tracking.
 */

import { LedgerRepository } from './ledger.repository';
import {
  AgentBalance,
  RecordTransactionInput,
  LedgerEntry
} from './ledger.types';
import { logger } from '../../shared/logger';

export class LedgerService {
  constructor(
    private repository: LedgerRepository
  ) {}

  /**
   * Get agent balance
   */
  async getAgentBalance(agentId: string): Promise<AgentBalance> {
    logger.debug({ agentId }, 'Getting agent balance');

    const balance = await this.repository.getAgentBalance(agentId);

    return {
      agentId,
      available: balance.available,
      pending: balance.pending,
      currency: 'USD',
      lastUpdated: balance.lastUpdated,
    };
  }

  /**
   * Record a transaction in the ledger (double-entry)
   *
   * For every transaction:
   * - Debit the sender's account
   * - Credit the receiver's account
   */
  async recordTransaction(input: RecordTransactionInput): Promise<void> {
    logger.info({ input }, 'Recording transaction in ledger');

    // Entry 1: Debit from sender (decreases their balance)
    await this.repository.createEntry({
      transactionId: input.transactionId,
      account: input.fromAccount,
      debit: input.amount,
      credit: 0,
      currency: input.currency || 'USD',
      description: input.description || `Payment to ${input.toAccount}`,
    });

    // Entry 2: Credit to receiver (increases their balance)
    await this.repository.createEntry({
      transactionId: input.transactionId,
      account: input.toAccount,
      debit: 0,
      credit: input.amount,
      currency: input.currency || 'USD',
      description: input.description || `Payment from ${input.fromAccount}`,
    });

    // Update cached agent balance
    if (input.fromAccount.startsWith('agent:')) {
      const agentId = input.fromAccount.replace('agent:', '');
      const newBalance = await this.repository.getAccountBalance(input.fromAccount);
      await this.repository.updateAgentBalance(agentId, newBalance, newBalance);
    }

    logger.info({ transactionId: input.transactionId }, 'Transaction recorded in ledger');
  }

  /**
   * Add funds to an agent (deposit)
   */
  async deposit(agentId: string, amount: number, description?: string): Promise<void> {
    logger.info({ agentId, amount }, 'Depositing funds');

    const account = `agent:${agentId}`;

    // Credit the agent's account (increases balance)
    await this.repository.createEntry({
      account,
      debit: 0,
      credit: amount,
      description: description || 'Deposit',
    });

    // Update cached balance
    const newBalance = await this.repository.getAccountBalance(account);
    await this.repository.updateAgentBalance(agentId, newBalance, newBalance);

    logger.info({ agentId, newBalance }, 'Funds deposited');
  }

  /**
   * Lock funds (mark as pending)
   */
  async lockFunds(agentId: string, amount: number): Promise<void> {
    logger.debug({ agentId, amount }, 'Locking funds');

    await this.repository.incrementPending(agentId, amount);
  }

  /**
   * Unlock funds (release pending)
   */
  async unlockFunds(agentId: string, amount: number): Promise<void> {
    logger.debug({ agentId, amount }, 'Unlocking funds');

    await this.repository.decrementPending(agentId, amount);
  }

  /**
   * Get ledger entries for an account
   */
  async getAccountHistory(account: string, limit: number = 100): Promise<LedgerEntry[]> {
    return this.repository.getEntriesByAccount(account, limit);
  }

  /**
   * Get agent transaction history
   */
  async getAgentHistory(agentId: string, limit: number = 100): Promise<LedgerEntry[]> {
    const account = `agent:${agentId}`;
    return this.repository.getEntriesByAccount(account, limit);
  }

  /**
   * Reconcile agent balance (compare ledger vs cached balance)
   */
  async reconcileAgentBalance(agentId: string): Promise<{
    ledgerBalance: number;
    cachedBalance: number;
    difference: number;
    inSync: boolean;
  }> {
    logger.debug({ agentId }, 'Reconciling agent balance');

    const account = `agent:${agentId}`;

    // Get balance from ledger (source of truth)
    const ledgerBalance = await this.repository.getAccountBalance(account);

    // Get cached balance
    const cached = await this.repository.getAgentBalance(agentId);
    const cachedBalance = cached.available;

    const difference = Math.abs(ledgerBalance - cachedBalance);
    const inSync = difference < 0.01; // Allow 1 cent tolerance

    if (!inSync) {
      logger.warn({
        agentId,
        ledgerBalance,
        cachedBalance,
        difference,
      }, 'Balance mismatch detected');

      // Update cached balance to match ledger
      await this.repository.updateAgentBalance(agentId, ledgerBalance, ledgerBalance);
    }

    return {
      ledgerBalance,
      cachedBalance,
      difference,
      inSync,
    };
  }
}

