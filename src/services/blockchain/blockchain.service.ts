/**
 * Blockchain Service
 *
 * Main orchestrator for blockchain operations.
 * Handles on-chain transactions, wallet management, and x402 integration.
 */

import { logger } from '../../shared/logger';
import { BlockchainError } from '../../shared/errors';
import { config } from '../../shared/config';
import { Transaction } from '../transactions/transaction.types';
import { AgentService } from '../agents';
import { WalletManager } from './wallet.manager';
import { GasEstimator } from './gas.estimator';
import { TransactionMonitor } from './transaction.monitor';
import { ContractClient } from './contract.client';
import { X402Client } from './x402-client';
import {
  ExecuteSpendResult,
  WalletBalance,
  BlockchainNetwork,
  GasEstimate,
  TransactionStatus as BlockchainTxStatus,
} from './blockchain.types';

/**
 * Get the blockchain network based on environment
 * - development/staging: Use Base Sepolia (testnet)
 * - production: Use Base Mainnet
 */
function getNetworkForEnvironment(): BlockchainNetwork {
  const env = config.env.toLowerCase();

  if (env === 'production') {
    return BlockchainNetwork.BASE_MAINNET;
  }

  // Default to testnet for development and staging
  return BlockchainNetwork.BASE_SEPOLIA;
}

export class BlockchainService {
  private walletManager: WalletManager;
  private gasEstimator: GasEstimator;
  private transactionMonitor: TransactionMonitor;
  private contractClient: ContractClient;
  private x402Client: X402Client;
  private network: BlockchainNetwork;
  private merchantService?: any; // MerchantService - using any to avoid circular dependency

  constructor(
    private agentService: AgentService,
    network?: BlockchainNetwork,
    merchantService?: any // Optional merchant service for address resolution
  ) {
    this.merchantService = merchantService;
    // Use provided network or auto-detect based on environment
    this.network = network || getNetworkForEnvironment();

    logger.info(
      { network: this.network, environment: config.env },
      'Initializing BlockchainService'
    );
    this.walletManager = new WalletManager(network);
    this.gasEstimator = new GasEstimator(network);
    this.transactionMonitor = new TransactionMonitor(this.gasEstimator.getPublicClient());
    this.contractClient = new ContractClient(
      this.gasEstimator.getPublicClient(),
      this.walletManager.getWalletClient(),
      network === BlockchainNetwork.BASE_MAINNET ? 'base-mainnet' : 'base-sepolia'
    );
    this.x402Client = new X402Client();
  }

  /**
   * Execute on-chain spend transaction
   */
  async executeSpend(transaction: Transaction): Promise<ExecuteSpendResult> {
    logger.info({ transactionId: transaction.id }, 'Executing on-chain spend');

    try {
      // 1. Resolve agent wallet address
      const agent = await this.agentService.getAgent(transaction.agentId);
      let agentWalletAddress = await this.walletManager.resolveAgentWallet(agent.walletAddress);

      if (!agentWalletAddress) {
        throw new BlockchainError('Agent wallet address not found');
      }

      // Normalize agent wallet address to checksummed format
      agentWalletAddress = WalletManager.normalizeAddress(agentWalletAddress);

      // 2. Determine recipient address (async - may need to resolve from merchant)
      let recipientAddress = await this.getRecipientAddress(transaction);
      if (!WalletManager.isValidAddress(recipientAddress)) {
        throw new BlockchainError(`Invalid recipient address: ${recipientAddress}`);
      }

      // Normalize recipient address to checksummed format
      recipientAddress = WalletManager.normalizeAddress(recipientAddress);

      // 3. Convert amount to token units (USDC has 6 decimals)
      const tokenAddress = this.contractClient.getUSDCAddress();
      const amount = ContractClient.parseTokenAmount(transaction.amount.toString(), 6);

      // 4. Check if this is a merchant payment (x402)
      if (transaction.merchantId && this.x402Client.isEnabled()) {
        return await this.executeX402Payment(transaction, agentWalletAddress, recipientAddress, amount);
      }

      // 5. Execute direct ERC20 transfer
      return await this.executeDirectTransfer(transaction, agentWalletAddress, recipientAddress, amount, tokenAddress);
    } catch (error) {
      logger.error({ err: error, transactionId: transaction.id }, 'Failed to execute spend');
      throw error instanceof BlockchainError
        ? error
        : new BlockchainError(
            `Failed to execute spend: ${error instanceof Error ? error.message : 'Unknown error'}`,
            { transaction, error }
          );
    }
  }

  /**
   * Execute direct ERC20 token transfer
   */
  private async executeDirectTransfer(
    transaction: Transaction,
    fromAddress: string,
    toAddress: string,
    amount: bigint,
    tokenAddress: `0x${string}`
  ): Promise<ExecuteSpendResult> {
      logger.info(
        {
          transactionId: transaction.id,
          from: fromAddress,
          to: toAddress,
          amount: amount.toString(),
          token: tokenAddress,
        },
        'Executing direct token transfer'
      );

    // Check on-chain balance before attempting transfer
    // If balance check fails (e.g., contract doesn't exist), log warning but continue
    // This allows development on networks where USDC might not be deployed
    try {
      const onChainBalance = await this.contractClient.getTokenBalance(
        tokenAddress as `0x${string}`,
        fromAddress as `0x${string}`
      );

      if (onChainBalance < amount) {
        const balanceFormatted = ContractClient.formatTokenAmount(onChainBalance, 6);
        const amountFormatted = ContractClient.formatTokenAmount(amount, 6);
        throw new BlockchainError(
          `Insufficient on-chain balance. Available: ${balanceFormatted} USDC, Required: ${amountFormatted} USDC. ` +
          `Please fund wallet ${fromAddress} with USDC tokens.`
        );
      }
    } catch (error) {
      // If balance check fails due to contract not existing, log and continue
      // This allows testing on networks where the token contract might not be deployed
      if (error instanceof BlockchainError && error.message.includes('contract not found')) {
        logger.warn(
          { tokenAddress, fromAddress, error: error.message },
          'Token contract not found on network - balance check skipped. Transaction will proceed but may fail.'
        );
      } else {
        // Re-throw if it's a different error (e.g., insufficient balance)
        throw error;
      }
    }

    // Estimate gas
    const gasEstimate = await this.estimateGasForTransfer(tokenAddress, toAddress, amount, fromAddress);

    // Execute transfer
    const txHash = await this.contractClient.transferToken(tokenAddress, toAddress as `0x${string}`, amount);

    // Get transaction details
    const tx = await this.gasEstimator.getPublicClient().getTransaction({ hash: txHash });
    const gasPrice = await this.gasEstimator.getGasPrice();

    return {
      txHash,
      network: this.network,
      estimatedGas: gasEstimate.gasLimit,
      gasPrice,
      blockNumber: tx.blockNumber ? Number(tx.blockNumber) : undefined,
    };
  }

  /**
   * Execute x402 payment
   */
  private async executeX402Payment(
    transaction: Transaction,
    agentWalletAddress: string,
    recipientAddress: string,
    amount: bigint
  ): Promise<ExecuteSpendResult> {
    logger.info(
      {
        transactionId: transaction.id,
        merchantId: transaction.merchantId,
        agentWallet: agentWalletAddress,
      },
      'Executing x402 payment'
    );

    // Create payment intent
    const intent = await this.x402Client.createPaymentIntent({
      merchantId: transaction.merchantId!,
      amount,
      currency: transaction.currency,
      recipientAddress,
    });

    // Sign payment request message
    // The message includes all payment details to prove authorization
    const messageToSign = this.createPaymentRequestMessage({
      intentId: intent.intentId,
      fromAddress: agentWalletAddress,
      recipientAddress,
      amount: amount.toString(),
      currency: transaction.currency,
      merchantId: transaction.merchantId!,
      transactionId: transaction.id,
    });

    // Sign with hot wallet (for now, until agent wallets are fully implemented)
    // TODO: When agent wallets are deployed, sign with agent wallet private key
    const signature = await this.walletManager.signMessage(messageToSign);

    logger.debug(
      { intentId: intent.intentId, fromAddress: agentWalletAddress },
      'Payment request message signed'
    );

    // Submit payment request
    const paymentRequest = await this.x402Client.submitPaymentRequest({
      intentId: intent.intentId,
      signature,
      fromAddress: agentWalletAddress,
    });

    // Return result (x402 will handle on-chain execution)
    return {
      txHash: paymentRequest.txHash || 'pending',
      network: this.network,
      estimatedGas: BigInt(0), // x402 handles gas
      gasPrice: BigInt(0),
    };
  }

  /**
   * Create payment request message for signing
   * This message proves the agent authorized the payment
   */
  private createPaymentRequestMessage(params: {
    intentId: string;
    fromAddress: string;
    recipientAddress: string;
    amount: string;
    currency: string;
    merchantId: string;
    transactionId: string;
  }): string {
    // Create a structured message that includes all payment details
    // This follows a standard format for payment authorization signatures
    return JSON.stringify({
      intentId: params.intentId,
      fromAddress: params.fromAddress,
      recipientAddress: params.recipientAddress,
      amount: params.amount,
      currency: params.currency,
      merchantId: params.merchantId,
      transactionId: params.transactionId,
      network: this.network,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get agent's on-chain balance
   */
  async getAgentBalance(agentId: string, tokenAddress?: `0x${string}`): Promise<WalletBalance> {
    try {
      const agent = await this.agentService.getAgent(agentId);
      const walletAddress = await this.walletManager.resolveAgentWallet(agent.walletAddress);

      if (!walletAddress) {
        throw new BlockchainError('Agent wallet address not found');
      }

      const address = walletAddress as `0x${string}`;

      // Get native balance
      const balance = await this.contractClient.getNativeBalance(address);

      // Get token balance if token address provided
      const tokenAddr = tokenAddress || this.contractClient.getUSDCAddress();
      const tokenBalance = await this.contractClient.getTokenBalance(tokenAddr, address);

      return {
        address: walletAddress,
        balance,
        tokenBalance,
        tokenAddress: tokenAddr,
      };
    } catch (error) {
      logger.error({ err: error, agentId }, 'Failed to get agent balance');
      throw error instanceof BlockchainError
        ? error
        : new BlockchainError(
            `Failed to get agent balance: ${error instanceof Error ? error.message : 'Unknown error'}`,
            { agentId, error }
          );
    }
  }

  /**
   * Estimate gas for a transaction
   */
  async estimateGas(transaction: Transaction): Promise<GasEstimate> {
    try {
      const agent = await this.agentService.getAgent(transaction.agentId);
      const agentWalletAddress = await this.walletManager.resolveAgentWallet(agent.walletAddress);
      const recipientAddress = await this.getRecipientAddress(transaction);
      const tokenAddress = this.contractClient.getUSDCAddress();
      const amount = ContractClient.parseTokenAmount(transaction.amount.toString(), 6);

      return await this.estimateGasForTransfer(
        tokenAddress,
        recipientAddress,
        amount,
        agentWalletAddress as `0x${string}`
      );
    } catch (error) {
      logger.error({ err: error, transactionId: transaction.id }, 'Failed to estimate gas');
      throw error instanceof BlockchainError
        ? error
        : new BlockchainError(
            `Failed to estimate gas: ${error instanceof Error ? error.message : 'Unknown error'}`,
            { transaction, error }
          );
    }
  }

  /**
   * Estimate gas for token transfer
   */
  private async estimateGasForTransfer(
    tokenAddress: `0x${string}`,
    toAddress: string,
    amount: bigint,
    fromAddress: string
  ): Promise<GasEstimate> {
    // Encode transfer function
    const { encodeFunctionData } = await import('viem');
    const { erc20Abi } = await import('viem');
    const data = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [toAddress as `0x${string}`, amount],
    });

    return await this.gasEstimator.estimateGas({
      to: tokenAddress,
      data,
      from: fromAddress as `0x${string}`,
    });
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(txHash: string): Promise<BlockchainTxStatus> {
    return await this.transactionMonitor.getTransactionStatus(txHash as `0x${string}`);
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForConfirmation(txHash: string, requiredConfirmations?: number): Promise<BlockchainTxStatus> {
    return await this.transactionMonitor.waitForConfirmation(txHash as `0x${string}`, requiredConfirmations);
  }

  /**
   * Deploy agent wallet (Phase 3 - smart wallets)
   * TODO: Implement when factory contract is ready
   */
  async deployAgentWallet(agentId: string): Promise<string> {
    logger.info({ agentId }, 'Deploying agent wallet (not yet implemented)');
    throw new BlockchainError('Agent wallet deployment not yet implemented. Use hot wallet for now.');
  }

  /**
   * Get recipient address from transaction
   */
  private async getRecipientAddress(transaction: Transaction): Promise<string> {
    // Priority: toAddress > metadata.recipientAddress > merchantId
    if (transaction.toAddress) {
      return transaction.toAddress;
    }

    if (transaction.metadata?.recipientAddress) {
      return transaction.metadata.recipientAddress;
    }

    // For merchant payments, resolve wallet address from merchant record
    if (transaction.merchantId) {
      if (!this.merchantService) {
        throw new BlockchainError(
          'Merchant service not available. Cannot resolve merchant wallet address.'
        );
      }

      try {
        const walletAddress = await this.merchantService.getMerchantWalletAddress(
          transaction.merchantId
        );
        return walletAddress;
      } catch (error) {
        throw new BlockchainError(
          `Failed to resolve merchant wallet address: ${error instanceof Error ? error.message : 'Unknown error'}`,
          { merchantId: transaction.merchantId, error }
        );
      }
    }

    throw new BlockchainError('Recipient address not specified in transaction');
  }

  /**
   * Validate address format
   */
  static isValidAddress(address: string): boolean {
    return WalletManager.isValidAddress(address);
  }
}

