/**
 * Approval Service Types
 */

export interface Approval {
  id: string;
  transactionId: string;
  organizationId: string;
  status: ApprovalStatus;
  requiredApprovers: number;
  currentApprovers: number;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  actions?: ApprovalAction[];
}

export interface ApprovalAction {
  id: string;
  approvalId: string;
  userId: string;
  action: 'approved' | 'rejected';
  comment: string | null;
  createdAt: Date;
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

export interface CreateApprovalInput {
  transactionId: string;
  organizationId: string;
  requiredApprovers?: number; // Defaults to 1 if not provided
  expiresAt?: Date; // Optional expiration
}

export interface ApproveTransactionInput {
  comment?: string;
}

export interface RejectTransactionInput {
  reason: string;
  comment?: string;
}

export interface ListApprovalsQuery {
  organizationId: string;
  status?: ApprovalStatus;
  transactionId?: string;
}

