/**
 * Transaction Monitor
 *
 * Monitors on-chain transaction status.
 */

import { type PublicClient } from 'viem';
import { logger } from '../../shared/logger';
import { BlockchainError } from '../../shared/errors';
import { TransactionStatus } from './blockchain.types';

export class TransactionMonitor {
  private readonly maxConfirmations = 12; // Base L2 finality
  private readonly pollInterval = 2000; // 2 seconds
  private readonly maxPollAttempts = 60; // 2 minutes total

  constructor(private publicClient: PublicClient) {}

  /**
   * Get transaction status
   */
  async getTransactionStatus(txHash: `0x${string}`): Promise<TransactionStatus> {
    try {
      const receipt = await this.publicClient.getTransactionReceipt({ hash: txHash });
      const currentBlock = await this.publicClient.getBlockNumber();

      if (!receipt) {
        return {
          txHash,
          status: 'pending',
          confirmations: 0,
        };
      }

      const confirmations = Number(currentBlock - receipt.blockNumber);
      const status: TransactionStatus['status'] =
        receipt.status === 'success' ? 'confirmed' : receipt.status === 'reverted' ? 'reverted' : 'failed';

      return {
        txHash,
        status,
        confirmations,
        blockNumber: Number(receipt.blockNumber),
        blockHash: receipt.blockHash,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice,
      };
    } catch (error) {
      logger.error({ err: error, txHash }, 'Failed to get transaction status');
      throw new BlockchainError(
        `Failed to get transaction status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { txHash, error }
      );
    }
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForConfirmation(
    txHash: `0x${string}`,
    requiredConfirmations: number = this.maxConfirmations
  ): Promise<TransactionStatus> {
    let attempts = 0;

    while (attempts < this.maxPollAttempts) {
      const status = await this.getTransactionStatus(txHash);

      if (status.status === 'confirmed' && status.confirmations >= requiredConfirmations) {
        logger.info({ txHash, confirmations: status.confirmations }, 'Transaction confirmed');
        return status;
      }

      if (status.status === 'reverted' || status.status === 'failed') {
        logger.error({ txHash, status: status.status }, 'Transaction failed or reverted');
        return status;
      }

      attempts++;
      await this.sleep(this.pollInterval);
    }

    // Timeout - transaction still pending
    logger.warn({ txHash, attempts }, 'Transaction confirmation timeout');
    return {
      txHash,
      status: 'pending',
      confirmations: 0,
    };
  }

  /**
   * Poll transaction until confirmed or failed
   */
  async pollTransaction(
    txHash: `0x${string}`,
    onUpdate?: (status: TransactionStatus) => void
  ): Promise<TransactionStatus> {
    let lastStatus: TransactionStatus | null = null;

    while (true) {
      const status = await this.getTransactionStatus(txHash);

      // Notify listener of status update
      if (onUpdate && (!lastStatus || status.status !== lastStatus.status)) {
        onUpdate(status);
      }

      // Check if transaction is final
      if (status.status === 'confirmed' || status.status === 'reverted' || status.status === 'failed') {
        return status;
      }

      lastStatus = status;
      await this.sleep(this.pollInterval);
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

