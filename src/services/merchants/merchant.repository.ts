/**
 * Merchant Repository
 *
 * Database operations for merchants.
 */

import { prisma } from '../../database/client';
import { Merchant, CreateMerchantInput, UpdateMerchantInput, ListMerchantsQuery } from './merchant.types';

export class MerchantRepository {
  /**
   * Create a new merchant
   */
  async create(input: CreateMerchantInput): Promise<Merchant> {
    const merchant = await prisma.merchant.create({
      data: {
        name: input.name,
        category: input.category || null,
        walletAddress: input.walletAddress || null,
        website: input.website || null,
        verified: input.verified || false,
        reputationScore: input.reputationScore || 50,
      },
    });

    return this.mapToMerchant(merchant);
  }

  /**
   * Find merchant by ID
   */
  async findById(id: string): Promise<Merchant | null> {
    const merchant = await prisma.merchant.findUnique({
      where: { id },
    });

    return merchant ? this.mapToMerchant(merchant) : null;
  }

  /**
   * Find merchant by wallet address
   */
  async findByWalletAddress(walletAddress: string): Promise<Merchant | null> {
    const merchant = await prisma.merchant.findFirst({
      where: { walletAddress },
    });

    return merchant ? this.mapToMerchant(merchant) : null;
  }

  /**
   * List merchants with optional filters
   */
  async list(query: ListMerchantsQuery = {}): Promise<Merchant[]> {
    const where: any = {};

    if (query.verified !== undefined) {
      where.verified = query.verified;
    }

    if (query.category) {
      where.category = query.category;
    }

    if (query.search) {
      where.name = {
        contains: query.search,
        mode: 'insensitive',
      };
    }

    const merchants = await prisma.merchant.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return merchants.map((merchant: any) => this.mapToMerchant(merchant));
  }

  /**
   * Update merchant
   */
  async update(id: string, input: UpdateMerchantInput): Promise<Merchant> {
    const updateData: any = {};

    if (input.name !== undefined) {
      updateData.name = input.name;
    }

    if (input.category !== undefined) {
      updateData.category = input.category || null;
    }

    if (input.walletAddress !== undefined) {
      updateData.walletAddress = input.walletAddress || null;
    }

    if (input.website !== undefined) {
      updateData.website = input.website || null;
    }

    if (input.verified !== undefined) {
      updateData.verified = input.verified;
    }

    if (input.reputationScore !== undefined) {
      updateData.reputationScore = input.reputationScore;
    }

    const merchant = await prisma.merchant.update({
      where: { id },
      data: updateData,
    });

    return this.mapToMerchant(merchant);
  }

  /**
   * Delete merchant
   */
  async delete(id: string): Promise<void> {
    await prisma.merchant.delete({
      where: { id },
    });
  }

  /**
   * Map Prisma merchant to Merchant type
   */
  private mapToMerchant(merchant: any): Merchant {
    return {
      id: merchant.id,
      name: merchant.name,
      category: merchant.category,
      walletAddress: merchant.walletAddress,
      website: merchant.website,
      verified: merchant.verified,
      reputationScore: merchant.reputationScore,
      createdAt: merchant.createdAt,
      updatedAt: merchant.updatedAt,
    };
  }
}

