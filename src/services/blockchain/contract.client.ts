/**
 * Contract Client
 *
 * Handles smart contract interactions on Base L2.
 */

import { type PublicClient, type WalletClient, encodeFunctionData, parseUnits } from 'viem';
import { logger } from '../../shared/logger';
import { BlockchainError } from '../../shared/errors';

// Standard ERC20 ABI (minimal for transfer)
const ERC20_ABI = [
  {
    constant: false,
    inputs: [
      { name: '_to', type: 'address' },
      { name: '_value', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function',
  },
] as const;

// USDC on Base Mainnet
const USDC_BASE_MAINNET = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`;
// USDC on Base Sepolia (testnet)
const USDC_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`;

export class ContractClient {
  constructor(
    private publicClient: PublicClient,
    private walletClient: WalletClient,
    private network: 'base-mainnet' | 'base-sepolia' = 'base-mainnet'
  ) {}

  /**
   * Get USDC token address for current network
   */
  getUSDCAddress(): `0x${string}` {
    return this.network === 'base-mainnet' ? USDC_BASE_MAINNET : USDC_BASE_SEPOLIA;
  }

  /**
   * Get ERC20 token balance
   */
  async getTokenBalance(tokenAddress: `0x${string}`, address: `0x${string}`): Promise<bigint> {
    try {
      const balance = await this.publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address],
      });

      return balance as bigint;
    } catch (error) {
      logger.error({ err: error, tokenAddress, address }, 'Failed to get token balance');
      throw new BlockchainError(
        `Failed to get token balance: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { tokenAddress, address, error }
      );
    }
  }

  /**
   * Get native token (ETH) balance
   */
  async getNativeBalance(address: `0x${string}`): Promise<bigint> {
    try {
      return await this.publicClient.getBalance({ address });
    } catch (error) {
      logger.error({ err: error, address }, 'Failed to get native balance');
      throw new BlockchainError(
        `Failed to get native balance: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { address, error }
      );
    }
  }

  /**
   * Transfer ERC20 tokens
   */
  async transferToken(
    tokenAddress: `0x${string}`,
    to: `0x${string}`,
    amount: bigint
  ): Promise<`0x${string}`> {
    try {
      // Encode transfer function call
      const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [to, amount],
      });

      // Get account from wallet client
      const account = this.walletClient.account;
      if (!account) {
        throw new BlockchainError('Wallet account not available');
      }

      // Send transaction (chain is already configured in walletClient)
      const hash = await this.walletClient.sendTransaction({
        account,
        to: tokenAddress,
        data,
      } as any); // Type assertion needed due to viem type strictness

      logger.info({ hash, tokenAddress, to, amount: amount.toString() }, 'Token transfer initiated');
      return hash;
    } catch (error) {
      logger.error({ err: error, tokenAddress, to, amount: amount.toString() }, 'Token transfer failed');
      throw new BlockchainError(
        `Token transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { tokenAddress, to, amount, error }
      );
    }
  }

  /**
   * Transfer native token (ETH)
   */
  async transferNative(to: `0x${string}`, amount: bigint): Promise<`0x${string}`> {
    try {
      const account = this.walletClient.account;
      if (!account) {
        throw new BlockchainError('Wallet account not available');
      }

      const hash = await this.walletClient.sendTransaction({
        account,
        to,
        value: amount,
      } as any); // Type assertion needed due to viem type strictness

      logger.info({ hash, to, amount: amount.toString() }, 'Native transfer initiated');
      return hash;
    } catch (error) {
      logger.error({ err: error, to, amount: amount.toString() }, 'Native transfer failed');
      throw new BlockchainError(
        `Native transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { to, amount, error }
      );
    }
  }

  /**
   * Validate wallet address format
   */
  static isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * Parse token amount to wei/smallest unit
   */
  static parseTokenAmount(amount: string, decimals: number = 6): bigint {
    return parseUnits(amount, decimals);
  }

  /**
   * Format token amount from wei/smallest unit
   */
  static formatTokenAmount(amount: bigint, decimals: number = 6): string {
    const divisor = BigInt(10 ** decimals);
    const whole = amount / divisor;
    const fraction = amount % divisor;
    return fraction === BigInt(0) ? whole.toString() : `${whole}.${fraction.toString().padStart(decimals, '0')}`;
  }
}

