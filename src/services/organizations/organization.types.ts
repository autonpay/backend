/**
 * Organization Service Types
 *
 * Organizations are companies/teams that own AI agents.
 * They are the root entity in Auton's hierarchy.
 */

export interface Organization {
  id: string;
  name: string;
  email: string;
  kycStatus: KycStatus;
  createdAt: Date;
  updatedAt: Date;
}

export enum KycStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export interface CreateOrganizationInput {
  name: string;
  email: string;
}

export interface UpdateOrganizationInput {
  name?: string;
  email?: string;
  kycStatus?: KycStatus;
}

export interface ListOrganizationsQuery {
  kycStatus?: KycStatus;
  limit?: number;
  offset?: number;
}

