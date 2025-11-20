/**
 * Transaction Repository
 *
 * Data access layer for Transaction service.
 * Handles all database operations for transactions.
 */

import { prisma } from '../../database/client';
import { Transaction, CreateTransactionInput, TransactionStatus, PaymentMethod } from './transaction.types';
import { subDays, subWeeks, subMonths, subHours } from 'date-fns';

export interface ListTransactionsQuery {
  organizationId: string;
  agentId?: string;
  status?: TransactionStatus;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface SpendingInWindowQuery {
  agentId: string;
  startDate: Date;
  endDate: Date;
  category?: string;
}

export class TransactionRepository {
  /**
   * Find transaction by ID
   */
  async findById(id: string): Promise<Transaction | null> {
    const transaction = await prisma.transaction.findUnique({
      where: { id },
    });

    if (!transaction) return null;

    return this.mapToTransaction(transaction);
  }

  /**
   * List transactions with filters
   */
  async list(query: ListTransactionsQuery): Promise<Transaction[]> {
    const where: any = {
      organizationId: query.organizationId,
      ...(query.agentId && { agentId: query.agentId }),
      ...(query.status && { status: query.status }),
      ...(query.startDate || query.endDate
        ? {
            createdAt: {
              ...(query.startDate && { gte: query.startDate }),
              ...(query.endDate && { lte: query.endDate }),
            },
          }
        : {}),
    };

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query.limit || 50,
      skip: query.offset || 0,
    });

    return transactions.map(tx => this.mapToTransaction(tx));
  }

  /**
   * Create new transaction
   */
  async create(input: CreateTransactionInput & {
    organizationId: string;
    status: TransactionStatus;
    requiresApproval: boolean;
    paymentMethod?: PaymentMethod;
  }): Promise<Transaction> {
    const transaction = await prisma.transaction.create({
      data: {
        organizationId: input.organizationId,
        agentId: input.agentId,
        amount: input.amount.toString(),
        currency: input.currency || 'USD',
        merchantId: input.merchantId || null,
        merchantName: input.merchantName || null,
        category: input.category || null,
        status: input.status,
        paymentMethod: input.paymentMethod || PaymentMethod.ONCHAIN,
        requiresApproval: input.requiresApproval,
        metadata: input.metadata || {},
      },
    });

    return this.mapToTransaction(transaction);
  }

  /**
   * Update transaction status
   */
  async updateStatus(
    id: string,
    status: TransactionStatus,
    updates?: {
      blockchainTxHash?: string;
      errorMessage?: string;
      approvedBy?: string;
      rejectionReason?: string;
    }
  ): Promise<Transaction> {
    const updateData: any = {
      status,
      ...(status === TransactionStatus.COMPLETED && { completedAt: new Date() }),
      ...(updates?.blockchainTxHash && { blockchainTxHash: updates.blockchainTxHash }),
      ...(updates?.errorMessage && { errorMessage: updates.errorMessage }),
      ...(updates?.approvedBy && {
        approvedBy: updates.approvedBy,
        approvedAt: new Date(),
      }),
      ...(updates?.rejectionReason && { rejectionReason: updates.rejectionReason }),
    };

    const transaction = await prisma.transaction.update({
      where: { id },
      data: updateData,
    });

    return this.mapToTransaction(transaction);
  }

  /**
   * Get spending in time window for an agent
   */
  async getSpendingInWindow(query: SpendingInWindowQuery): Promise<number> {
    const where: any = {
      agentId: query.agentId,
      status: TransactionStatus.COMPLETED,
      createdAt: {
        gte: query.startDate,
        lte: query.endDate,
      },
      ...(query.category && { category: query.category }),
    };

    const result = await prisma.transaction.aggregate({
      where,
      _sum: {
        amount: true,
      },
    });

    return result._sum.amount ? Number(result._sum.amount) : 0;
  }

  /**
   * Get recent transaction count for velocity checks
   */
  async getRecentTransactionCount(agentId: string, timeWindowMinutes: number): Promise<number> {
    const startDate = subHours(new Date(), timeWindowMinutes / 60);

    const count = await prisma.transaction.count({
      where: {
        agentId,
        createdAt: {
          gte: startDate,
        },
        status: {
          in: [TransactionStatus.PENDING, TransactionStatus.PROCESSING, TransactionStatus.COMPLETED],
        },
      },
    });

    return count;
  }

  /**
   * Get category spending in time window
   */
  async getCategorySpending(
    agentId: string,
    category: string,
    timeWindow: string,
    startDate: Date
  ): Promise<number> {
    let endDate: Date;
    switch (timeWindow) {
      case 'hourly':
        endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
        break;
      case 'daily':
        endDate = subDays(startDate, -1);
        break;
      case 'weekly':
        endDate = subWeeks(startDate, -1);
        break;
      case 'monthly':
        endDate = subMonths(startDate, -1);
        break;
      default:
        endDate = new Date();
    }

    return this.getSpendingInWindow({
      agentId,
      category,
      startDate,
      endDate,
    });
  }

  /**
   * Get total spending for agent (for balance checks)
   */
  async getTotalSpending(agentId: string): Promise<number> {
    const result = await prisma.transaction.aggregate({
      where: {
        agentId,
        status: {
          in: [TransactionStatus.PROCESSING, TransactionStatus.COMPLETED],
        },
      },
      _sum: {
        amount: true,
      },
    });

    return result._sum.amount ? Number(result._sum.amount) : 0;
  }

  /**
   * Verify transaction belongs to organization
   */
  async verifyOwnership(id: string, organizationId: string): Promise<boolean> {
    const transaction = await prisma.transaction.findFirst({
      where: {
        id,
        organizationId,
      },
    });
    return transaction !== null;
  }

  /**
   * Count transactions by status
   */
  async countByStatus(organizationId: string, status: TransactionStatus): Promise<number> {
    return prisma.transaction.count({
      where: {
        organizationId,
        status,
      },
    });
  }

  /**
   * Map Prisma model to Transaction type
   */
  private mapToTransaction(transaction: any): Transaction {
    return {
      id: transaction.id,
      organizationId: transaction.organizationId,
      agentId: transaction.agentId,
      amount: Number(transaction.amount),
      currency: transaction.currency,
      merchantId: transaction.merchantId || undefined,
      merchantName: transaction.merchantName || undefined,
      category: transaction.category || undefined,
      status: transaction.status as TransactionStatus,
      paymentMethod: transaction.paymentMethod as PaymentMethod,
      blockchainTxHash: transaction.blockchainTxHash || undefined,
      blockchainNetwork: transaction.blockchainNetwork || undefined,
      fromAddress: transaction.fromAddress || undefined,
      toAddress: transaction.toAddress || undefined,
      requiresApproval: transaction.requiresApproval,
      approvedBy: transaction.approvedBy || undefined,
      approvedAt: transaction.approvedAt || undefined,
      rejectionReason: transaction.rejectionReason || undefined,
      metadata: transaction.metadata as Record<string, any>,
      errorMessage: transaction.errorMessage || undefined,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
      completedAt: transaction.completedAt || undefined,
    };
  }
}

