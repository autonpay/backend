/**
 * Wallet Manager
 *
 * Manages hot wallet and agent wallet operations.
 */

import { createWalletClient, http, type WalletClient, type PrivateKeyAccount, getAddress, isAddress } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { config } from '../../shared/config';
import { logger } from '../../shared/logger';
import { BlockchainError } from '../../shared/errors';
import { BlockchainNetwork } from './blockchain.types';

export class WalletManager {
  private hotWallet: PrivateKeyAccount | null = null;
  private walletClient: WalletClient | null = null;
  private network: BlockchainNetwork;

  constructor(network: BlockchainNetwork = BlockchainNetwork.BASE_MAINNET) {
    this.network = network;
    this.initializeHotWallet();
  }

  /**
   * Initialize hot wallet from private key
   */
  private initializeHotWallet(): void {
    const privateKey = config.blockchain.walletPrivateKey;

    if (!privateKey) {
      logger.warn('WALLET_PRIVATE_KEY not set, blockchain operations will be disabled');
      return;
    }

    if (!privateKey.startsWith('0x')) {
      throw new BlockchainError('Invalid private key format. Must start with 0x');
    }

    try {
      this.hotWallet = privateKeyToAccount(privateKey as `0x${string}`);
      const chain = this.network === BlockchainNetwork.BASE_MAINNET ? base : baseSepolia;
      this.walletClient = createWalletClient({
        account: this.hotWallet,
        chain,
        transport: http(this.getRpcUrl()),
      });

      logger.info(
        { address: this.hotWallet.address, network: this.network },
        'Hot wallet initialized'
      );
    } catch (error) {
      throw new BlockchainError(
        `Failed to initialize hot wallet: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
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
   * Get hot wallet address
   */
  getHotWalletAddress(): string {
    if (!this.hotWallet) {
      throw new BlockchainError('Hot wallet not initialized');
    }
    return this.hotWallet.address;
  }

  /**
   * Get wallet client for signing transactions
   */
  getWalletClient(): WalletClient {
    if (!this.walletClient) {
      throw new BlockchainError('Wallet client not initialized');
    }
    return this.walletClient;
  }

  /**
   * Get account for signing
   */
  getAccount(): PrivateKeyAccount {
    if (!this.hotWallet) {
      throw new BlockchainError('Hot wallet not initialized');
    }
    return this.hotWallet;
  }

  /**
   * Resolve agent wallet address
   * For now, uses agent's stored walletAddress or returns hot wallet
   * TODO: Implement smart wallet deployment via factory contract
   */
  async resolveAgentWallet(agentWalletAddress?: string): Promise<string> {
    if (agentWalletAddress) {
      return agentWalletAddress;
    }

    // Fallback to hot wallet for now
    // In Phase 3, this will deploy/retrieve smart wallet via factory
    logger.debug('No agent wallet address, using hot wallet');
    return this.getHotWalletAddress();
  }

  /**
   * Validate wallet address format using viem
   * Checks both format and checksum validity
   */
  static isValidAddress(address: string): boolean {
    try {
      return isAddress(address);
    } catch {
      return false;
    }
  }

  /**
   * Normalize address to checksummed format
   * This ensures the address matches EIP-55 checksum requirements
   */
  static normalizeAddress(address: string): string {
    try {
      return getAddress(address);
    } catch (error) {
      throw new BlockchainError(
        `Invalid address format: ${address}. ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Validate private key format
   */
  static isValidPrivateKey(privateKey: string): boolean {
    return /^0x[a-fA-F0-9]{64}$/.test(privateKey);
  }

  /**
   * Sign a message with the hot wallet
   * Used for x402 payment request signing
   */
  async signMessage(message: string): Promise<`0x${string}`> {
    if (!this.walletClient || !this.hotWallet) {
      throw new BlockchainError('Wallet client not initialized');
    }

    try {
      // Use walletClient.signMessage which is available on WalletClient
      const signature = await this.walletClient.signMessage({
        account: this.hotWallet,
        message,
      });

      logger.debug({ message, signature }, 'Message signed with hot wallet');
      return signature;
    } catch (error) {
      logger.error({ err: error, message }, 'Failed to sign message');
      throw new BlockchainError(
        `Failed to sign message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { error }
      );
    }
  }

  /**
   * Sign a message with a specific account (for agent wallets)
   * This will be used when we have agent wallet private keys
   */
  async signMessageWithAccount(account: PrivateKeyAccount, message: string): Promise<`0x${string}`> {
    if (!this.walletClient) {
      throw new BlockchainError('Wallet client not initialized');
    }

    try {
      const signature = await this.walletClient.signMessage({
        account,
        message,
      });

      logger.debug({ account: account.address, message, signature }, 'Message signed with account');
      return signature;
    } catch (error) {
      logger.error({ err: error, account: account.address, message }, 'Failed to sign message with account');
      throw new BlockchainError(
        `Failed to sign message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { error }
      );
    }
  }
}

