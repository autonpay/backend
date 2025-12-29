/**
 * Merchant Service
 *
 * Business logic for merchant management.
 */

import { logger } from '../../shared/logger';
import { NotFoundError, BadRequestError } from '../../shared/errors';
import { MerchantRepository } from './merchant.repository';
import {
  Merchant,
  CreateMerchantInput,
  UpdateMerchantInput,
  ListMerchantsQuery,
} from './merchant.types';
import { WalletManager } from '../blockchain/wallet.manager';

export class MerchantService {
  constructor(private repository: MerchantRepository) {}

  /**
   * Create a new merchant
   */
  async createMerchant(input: CreateMerchantInput): Promise<Merchant> {
    logger.info({ input }, 'Creating merchant');

    // Validate wallet address if provided
    if (input.walletAddress && !WalletManager.isValidAddress(input.walletAddress)) {
      throw new BadRequestError(`Invalid wallet address: ${input.walletAddress}`);
    }

    // Normalize wallet address if provided
    const normalizedInput = {
      ...input,
      walletAddress: input.walletAddress
        ? WalletManager.normalizeAddress(input.walletAddress)
        : undefined,
    };

    // Check if wallet address is already in use
    if (normalizedInput.walletAddress) {
      const existing = await this.repository.findByWalletAddress(normalizedInput.walletAddress);
      if (existing) {
        throw new BadRequestError(
          `Wallet address ${normalizedInput.walletAddress} is already associated with merchant ${existing.name} (${existing.id})`
        );
      }
    }

    const merchant = await this.repository.create(normalizedInput);

    logger.info({ merchantId: merchant.id, name: merchant.name }, 'Merchant created');

    return merchant;
  }

  /**
   * Get merchant by ID
   */
  async getMerchant(id: string): Promise<Merchant> {
    const merchant = await this.repository.findById(id);
    if (!merchant) {
      throw new NotFoundError('Merchant', id);
    }

    return merchant;
  }

  /**
   * Get merchant by wallet address
   */
  async getMerchantByWalletAddress(walletAddress: string): Promise<Merchant | null> {
    const normalizedAddress = WalletManager.normalizeAddress(walletAddress);
    return this.repository.findByWalletAddress(normalizedAddress);
  }

  /**
   * List merchants
   */
  async listMerchants(query: ListMerchantsQuery = {}): Promise<Merchant[]> {
    return this.repository.list(query);
  }

  /**
   * Update merchant
   */
  async updateMerchant(id: string, input: UpdateMerchantInput): Promise<Merchant> {
    logger.info({ merchantId: id, input }, 'Updating merchant');

    // Check if merchant exists
    await this.getMerchant(id);

    // Validate wallet address if provided
    if (input.walletAddress !== undefined) {
      if (input.walletAddress && !WalletManager.isValidAddress(input.walletAddress)) {
        throw new BadRequestError(`Invalid wallet address: ${input.walletAddress}`);
      }

      // Normalize wallet address
      const normalizedAddress = input.walletAddress
        ? WalletManager.normalizeAddress(input.walletAddress)
        : null;

      // Check if wallet address is already in use by another merchant
      if (normalizedAddress) {
        const existing = await this.repository.findByWalletAddress(normalizedAddress);
        if (existing && existing.id !== id) {
          throw new BadRequestError(
            `Wallet address ${normalizedAddress} is already associated with merchant ${existing.name} (${existing.id})`
          );
        }
      }

      input.walletAddress = normalizedAddress || undefined;
    }

    const merchant = await this.repository.update(id, input);

    logger.info({ merchantId: id }, 'Merchant updated');

    return merchant;
  }

  /**
   * Delete merchant
   */
  async deleteMerchant(id: string): Promise<void> {
    logger.info({ merchantId: id }, 'Deleting merchant');

    // Check if merchant exists
    await this.getMerchant(id);

    await this.repository.delete(id);

    logger.info({ merchantId: id }, 'Merchant deleted');
  }

  /**
   * Verify merchant (set verified = true)
   */
  async verifyMerchant(id: string): Promise<Merchant> {
    logger.info({ merchantId: id }, 'Verifying merchant');

    return this.updateMerchant(id, { verified: true });
  }

  /**
   * Unverify merchant (set verified = false)
   */
  async unverifyMerchant(id: string): Promise<Merchant> {
    logger.info({ merchantId: id }, 'Unverifying merchant');

    return this.updateMerchant(id, { verified: false });
  }

  /**
   * Get merchant wallet address (for payment routing)
   * Throws error if merchant doesn't have a wallet address
   */
  async getMerchantWalletAddress(merchantId: string): Promise<string> {
    const merchant = await this.getMerchant(merchantId);

    if (!merchant.walletAddress) {
      throw new BadRequestError(
        `Merchant ${merchant.name} (${merchantId}) does not have a wallet address configured`
      );
    }

    return merchant.walletAddress;
  }
}

