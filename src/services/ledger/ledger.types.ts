/**
 * Ledger Service Types
 *
 * Double-entry accounting system for tracking all financial transactions.
 */

export interface LedgerEntry {
  id: string;
  transactionId?: string;
  account: string; // e.g., "agent:agent_123", "merchant:merchant_456"
  debit: number;
  credit: number;
  balance: number; // Running balance after this entry
  currency: string;
  description?: string;
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface CreateLedgerEntryInput {
  transactionId?: string;
  account: string;
  debit: number;
  credit: number;
  currency?: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface AgentBalance {
  agentId: string;
  available: number;
  pending: number;
  currency: string;
  lastUpdated: Date;
}

export interface RecordTransactionInput {
  transactionId: string;
  fromAccount: string; // e.g., "agent:agent_123"
  toAccount: string;   // e.g., "merchant:merchant_456"
  amount: number;
  currency?: string;
  description?: string;
}

