/**
 * Merchant Service Types
 */

export interface Merchant {
  id: string;
  name: string;
  category: string | null;
  walletAddress: string | null;
  website: string | null;
  verified: boolean;
  reputationScore: number; // 0-100
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMerchantInput {
  name: string;
  category?: string;
  walletAddress?: string;
  website?: string;
  verified?: boolean;
  reputationScore?: number;
}

export interface UpdateMerchantInput {
  name?: string;
  category?: string;
  walletAddress?: string;
  website?: string;
  verified?: boolean;
  reputationScore?: number;
}

export interface ListMerchantsQuery {
  verified?: boolean;
  category?: string;
  search?: string; // Search by name
}

