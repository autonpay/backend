/**
 * Blockchain Service Types
 */

import { Transaction } from '../transactions/transaction.types';

export interface ExecuteSpendInput {
  transaction: Transaction;
  agentWalletAddress: string;
  recipientAddress: string;
  amount: bigint; // In wei/smallest unit
  tokenAddress?: string; // ERC20 token address (default: USDC)
}

export interface ExecuteSpendResult {
  txHash: string;
  network: string;
  estimatedGas: bigint;
  gasPrice: bigint;
  blockNumber?: number;
}

export interface AgentWallet {
  agentId: string;
  walletAddress: string;
  isDeployed: boolean;
  deployedAt?: Date;
}

export interface GasEstimate {
  gasLimit: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  totalCost: bigint; // gas * price in wei
}

export interface TransactionStatus {
  txHash: string;
  status: 'pending' | 'confirmed' | 'failed' | 'reverted';
  confirmations: number;
  blockNumber?: number;
  blockHash?: string;
  gasUsed?: bigint;
  effectiveGasPrice?: bigint;
}

export interface X402PaymentIntent {
  intentId: string;
  merchantId: string;
  amount: bigint;
  currency: string;
  recipientAddress: string;
  expiresAt: Date;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
}

export interface X402PaymentRequest {
  requestId: string;
  intentId: string;
  signature: string;
  txHash?: string;
}

export interface WalletBalance {
  address: string;
  balance: bigint; // Native token (ETH) balance in wei
  tokenBalance?: bigint; // ERC20 token balance (e.g., USDC)
  tokenAddress?: string;
}

export enum BlockchainNetwork {
  BASE_MAINNET = 'base-mainnet',
  BASE_SEPOLIA = 'base-sepolia',
}

