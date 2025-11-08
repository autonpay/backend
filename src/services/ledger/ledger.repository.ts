/**
 * Ledger Repository
 *
 * Data access for ledger entries and balance calculations.
 */

import { prisma } from '../../database/client';
import { LedgerEntry, CreateLedgerEntryInput } from './ledger.types';
import { Decimal } from '@prisma/client/runtime/library';

export class LedgerRepository {
  /**
   * Create a ledger entry
   */
  async createEntry(input: CreateLedgerEntryInput): Promise<LedgerEntry> {
    // Get current balance for this account
    const currentBalance = await this.getAccountBalance(input.account);

    // Calculate new balance (debit decreases, credit increases)
    const newBalance = currentBalance - input.debit + input.credit;

    const entry = await prisma.ledgerEntry.create({
      data: {
        transactionId: input.transactionId,
        account: input.account,
        debit: new Decimal(input.debit),
        credit: new Decimal(input.credit),
        balance: new Decimal(newBalance),
        currency: input.currency || 'USD',
        description: input.description,
        metadata: input.metadata || {},
      },
    });

    return this.mapToLedgerEntry(entry);
  }

  /**
   * Get ledger entries for an account
   */
  async getEntriesByAccount(account: string, limit: number = 100): Promise<LedgerEntry[]> {
    const entries = await prisma.ledgerEntry.findMany({
      where: { account },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return entries.map(entry => this.mapToLedgerEntry(entry));
  }

  /**
   * Get account balance from latest ledger entry
   */
  async getAccountBalance(account: string): Promise<number> {
    const latestEntry = await prisma.ledgerEntry.findFirst({
      where: { account },
      orderBy: { createdAt: 'desc' },
    });

    return latestEntry ? Number(latestEntry.balance) : 0;
  }

  /**
   * Get agent balance (cached value)
   */
  async getAgentBalance(agentId: string): Promise<{
    available: number;
    pending: number;
    lastUpdated: Date;
  }> {
    const balance = await prisma.agentBalance.findUnique({
      where: { agentId },
    });

    if (!balance) {
      return {
        available: 0,
        pending: 0,
        lastUpdated: new Date(),
      };
    }

    return {
      available: Number(balance.balanceUsd),
      pending: Number(balance.pendingUsd),
      lastUpdated: balance.lastUpdatedAt,
    };
  }

  /**
   * Update agent balance (cached value)
   */
  async updateAgentBalance(
    agentId: string,
    balanceUsd: number,
    balanceUsdc: number,
    pendingUsd: number = 0
  ): Promise<void> {
    await prisma.agentBalance.upsert({
      where: { agentId },
      update: {
        balanceUsd: new Decimal(balanceUsd),
        balanceUsdc: new Decimal(balanceUsdc),
        pendingUsd: new Decimal(pendingUsd),
        lastUpdatedAt: new Date(),
      },
      create: {
        agentId,
        balanceUsd: new Decimal(balanceUsd),
        balanceUsdc: new Decimal(balanceUsdc),
        pendingUsd: new Decimal(pendingUsd),
        lastUpdatedAt: new Date(),
      },
    });
  }

  /**
   * Increment pending balance
   */
  async incrementPending(agentId: string, amount: number): Promise<void> {
    await prisma.agentBalance.update({
      where: { agentId },
      data: {
        pendingUsd: { increment: new Decimal(amount) },
        lastUpdatedAt: new Date(),
      },
    });
  }

  /**
   * Decrement pending balance
   */
  async decrementPending(agentId: string, amount: number): Promise<void> {
    await prisma.agentBalance.update({
      where: { agentId },
      data: {
        pendingUsd: { decrement: new Decimal(amount) },
        lastUpdatedAt: new Date(),
      },
    });
  }

  /**
   * Map Prisma model to LedgerEntry type
   */
  private mapToLedgerEntry(entry: any): LedgerEntry {
    return {
      id: entry.id,
      transactionId: entry.transactionId,
      account: entry.account,
      debit: Number(entry.debit),
      credit: Number(entry.credit),
      balance: Number(entry.balance),
      currency: entry.currency,
      description: entry.description,
      metadata: entry.metadata as Record<string, any>,
      createdAt: entry.createdAt,
    };
  }
}

