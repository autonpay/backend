/**
 * Gas Estimator
 *
 * Estimates gas costs for transactions.
 */

import { createPublicClient, http, type PublicClient, type Chain } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { config } from '../../shared/config';
import { logger } from '../../shared/logger';
import { BlockchainError } from '../../shared/errors';
import { GasEstimate, BlockchainNetwork } from './blockchain.types';

export class GasEstimator {
  private publicClient!: PublicClient;
  private network: BlockchainNetwork;

  constructor(network: BlockchainNetwork = BlockchainNetwork.BASE_MAINNET) {
    this.network = network;
    this.initializeClient();
  }

  /**
   * Initialize public client for reading chain data
   */
  private initializeClient(): void {
    const chain: Chain = this.network === BlockchainNetwork.BASE_MAINNET ? base : baseSepolia;
    const rpcUrl = this.getRpcUrl();

    this.publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
    });
  }

  /**
   * Get RPC URL based on network
   */
  private getRpcUrl(): string {
    return this.network === BlockchainNetwork.BASE_MAINNET
      ? config.blockchain.baseRpcUrl
      : config.blockchain.baseSepoliaRpcUrl;
  }

  /**
   * Estimate gas for a transaction
   */
  async estimateGas(transaction: {
    to: `0x${string}`;
    value?: bigint;
    data?: `0x${string}`;
    from?: `0x${string}`;
  }): Promise<GasEstimate> {
    try {
      // Get current gas prices
      const [gasPrice, block] = await Promise.all([
        this.publicClient.getGasPrice(),
        this.publicClient.getBlock({ blockTag: 'latest' }),
      ]);

      // Estimate gas limit
      const gasLimit = await this.publicClient.estimateGas({
        ...transaction,
        account: transaction.from as `0x${string}`,
      });

      // Calculate max fee per gas (EIP-1559)
      // Use base fee + priority fee
      const baseFee = block.baseFeePerGas || gasPrice;
      const maxPriorityFeePerGas = (gasPrice * BigInt(110)) / BigInt(100); // 10% above current
      const maxFeePerGas = baseFee + maxPriorityFeePerGas;

      // Calculate total cost
      const totalCost = gasLimit * maxFeePerGas;

      logger.debug(
        {
          gasLimit: gasLimit.toString(),
          maxFeePerGas: maxFeePerGas.toString(),
          maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
          totalCost: totalCost.toString(),
        },
        'Gas estimate calculated'
      );

      return {
        gasLimit,
        maxFeePerGas,
        maxPriorityFeePerGas,
        totalCost,
      };
    } catch (error) {
      logger.error({ err: error, transaction }, 'Gas estimation failed');
      throw new BlockchainError(
        `Failed to estimate gas: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { transaction, error }
      );
    }
  }

  /**
   * Get current gas price
   */
  async getGasPrice(): Promise<bigint> {
    try {
      return await this.publicClient.getGasPrice();
    } catch (error) {
      logger.error({ err: error }, 'Failed to get gas price');
      throw new BlockchainError(
        `Failed to get gas price: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get public client for direct access
   */
  getPublicClient(): PublicClient {
    return this.publicClient;
  }
}

