/**
 * Transaction Service Types
 */

export interface Transaction {
  id: string;
  organizationId: string;
  agentId: string;
  amount: number;
  currency: string;
  merchantId?: string;
  merchantName?: string;
  category?: string;
  status: TransactionStatus;
  paymentMethod: PaymentMethod;
  blockchainTxHash?: string;
  blockchainNetwork?: string;
  fromAddress?: string;
  toAddress?: string;
  requiresApproval: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  rejectionReason?: string;
  metadata: Record<string, any>;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export enum TransactionStatus {
  PENDING = 'pending',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REJECTED = 'rejected',
}

export enum PaymentMethod {
  ONCHAIN = 'onchain',
  CARD = 'card',
}

export interface CreateTransactionInput {
  agentId: string;
  amount: number;
  currency?: string;
  merchantId?: string;
  merchantName?: string;
  category?: string;
  toAddress?: string;
  metadata?: Record<string, any>;
}

export interface ProcessTransactionInput {
  transactionId: string;
  paymentMethod: PaymentMethod;
}

