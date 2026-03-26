/**
 * Approval Repository
 *
 * Database operations for approvals and approval actions.
 */

import { prisma } from '../../database/client';
import { Approval, ApprovalAction, ApprovalStatus, CreateApprovalInput, ListApprovalsQuery } from './approval.types';

export class ApprovalRepository {
  /**
   * Create a new approval request
   */
  async create(input: CreateApprovalInput): Promise<Approval> {
    const approval = await prisma.approval.create({
      data: {
        transactionId: input.transactionId,
        organizationId: input.organizationId,
        status: ApprovalStatus.PENDING,
        requiredApprovers: input.requiredApprovers || 1,
        currentApprovers: 0,
        expiresAt: input.expiresAt || null,
      },
      include: {
        actions: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                role: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    return this.mapToApproval(approval);
  }

  /**
   * Find approval by ID
   */
  async findById(id: string): Promise<Approval | null> {
    const approval = await prisma.approval.findUnique({
      where: { id },
      include: {
        actions: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                role: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    return approval ? this.mapToApproval(approval) : null;
  }

  /**
   * Find approval by transaction ID
   */
  async findByTransactionId(transactionId: string): Promise<Approval | null> {
    const approval = await prisma.approval.findUnique({
      where: { transactionId },
      include: {
        actions: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                role: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    return approval ? this.mapToApproval(approval) : null;
  }

  /**
   * List approvals for organization
   */
  async list(query: ListApprovalsQuery): Promise<Approval[]> {
    const where: any = {
      organizationId: query.organizationId,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.transactionId) {
      where.transactionId = query.transactionId;
    }

    const approvals = await prisma.approval.findMany({
      where,
      include: {
        actions: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                role: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return approvals.map((approval: any) => this.mapToApproval(approval));
  }

  /**
   * Add approval action (approve or reject)
   */
  async addAction(
    approvalId: string,
    userId: string,
    action: 'approved' | 'rejected',
    comment?: string
  ): Promise<ApprovalAction> {
    const approvalAction = await prisma.approvalAction.create({
      data: {
        approvalId,
        userId,
        action,
        comment: comment || null,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return this.mapToApprovalAction(approvalAction);
  }

  /**
   * Update approval status and current approvers count
   */
  async updateStatus(
    approvalId: string,
    status: ApprovalStatus,
    currentApprovers?: number
  ): Promise<Approval> {
    const updateData: any = { status };

    if (currentApprovers !== undefined) {
      updateData.currentApprovers = currentApprovers;
    }

    const approval = await prisma.approval.update({
      where: { id: approvalId },
      data: updateData,
      include: {
        actions: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                role: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    return this.mapToApproval(approval);
  }

  /**
   * Check if user has already acted on this approval
   */
  async hasUserActed(approvalId: string, userId: string): Promise<boolean> {
    const action = await prisma.approvalAction.findFirst({
      where: {
        approvalId,
        userId,
      },
    });

    return !!action;
  }

  /**
   * Get count of approval actions for an approval
   */
  async getApprovalCount(approvalId: string): Promise<number> {
    return prisma.approvalAction.count({
      where: {
        approvalId,
        action: 'approved',
      },
    });
  }

  /**
   * Get count of rejection actions for an approval
   */
  async getRejectionCount(approvalId: string): Promise<number> {
    return prisma.approvalAction.count({
      where: {
        approvalId,
        action: 'rejected',
      },
    });
  }

  /**
   * Mark expired approvals
   */
  async markExpired(approvalIds: string[]): Promise<number> {
    const result = await prisma.approval.updateMany({
      where: {
        id: { in: approvalIds },
        status: ApprovalStatus.PENDING,
        expiresAt: {
          lte: new Date(),
        },
      },
      data: {
        status: ApprovalStatus.EXPIRED,
      },
    });

    return result.count;
  }

  /**
   * Find expired approvals
   */
  async findExpired(): Promise<Approval[]> {
    const approvals = await prisma.approval.findMany({
      where: {
        status: ApprovalStatus.PENDING,
        expiresAt: {
          lte: new Date(),
        },
      },
      include: {
        actions: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                role: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    return approvals.map((approval: any) => this.mapToApproval(approval));
  }

  /**
   * Map Prisma approval to Approval type
   */
  private mapToApproval(approval: any): Approval {
    return {
      id: approval.id,
      transactionId: approval.transactionId,
      organizationId: approval.organizationId,
      status: approval.status as ApprovalStatus,
      requiredApprovers: approval.requiredApprovers,
      currentApprovers: approval.currentApprovers,
      expiresAt: approval.expiresAt,
      createdAt: approval.createdAt,
      updatedAt: approval.updatedAt,
      actions: approval.actions?.map((action: any) => this.mapToApprovalAction(action)),
    };
  }

  /**
   * Map Prisma approval action to ApprovalAction type
   */
  private mapToApprovalAction(action: any): ApprovalAction {
    return {
      id: action.id,
      approvalId: action.approvalId,
      userId: action.userId,
      action: action.action as 'approved' | 'rejected',
      comment: action.comment,
      createdAt: action.createdAt,
      user: action.user
        ? {
            id: action.user.id,
            email: action.user.email,
            role: action.user.role,
          }
        : undefined,
    };
  }
}

