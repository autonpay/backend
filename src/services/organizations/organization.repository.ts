/**
 * Organization Repository
 *
 * Data access layer for Organization service.
 * Handles all database operations for organizations.
 */

import { prisma } from '../../database/client';
import {
  Organization,
  CreateOrganizationInput,
  UpdateOrganizationInput,
  ListOrganizationsQuery,
  KycStatus,
} from './organization.types';

export class OrganizationRepository {
  /**
   * Find organization by ID
   */
  async findById(id: string): Promise<Organization | null> {
    const org = await prisma.organization.findUnique({
      where: { id },
    });

    if (!org) return null;

    return this.mapToOrganization(org);
  }

  /**
   * Find organization by email
   */
  async findByEmail(email: string): Promise<Organization | null> {
    const org = await prisma.organization.findUnique({
      where: { email },
    });

    if (!org) return null;

    return this.mapToOrganization(org);
  }

  /**
   * List all organizations
   */
  async list(query: ListOrganizationsQuery): Promise<Organization[]> {
    const orgs = await prisma.organization.findMany({
      where: {
        ...(query.kycStatus && { kycStatus: query.kycStatus }),
      },
      take: query.limit || 50,
      skip: query.offset || 0,
      orderBy: { createdAt: 'desc' },
    });

    return orgs.map(org => this.mapToOrganization(org));
  }

  /**
   * Create new organization
   */
  async create(input: CreateOrganizationInput): Promise<Organization> {
    const org = await prisma.organization.create({
      data: {
        name: input.name,
        email: input.email,
        kycStatus: KycStatus.PENDING,
      },
    });

    return this.mapToOrganization(org);
  }

  /**
   * Update organization
   */
  async update(id: string, input: UpdateOrganizationInput): Promise<Organization> {
    const org = await prisma.organization.update({
      where: { id },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.email && { email: input.email }),
        ...(input.kycStatus && { kycStatus: input.kycStatus }),
      },
    });

    return this.mapToOrganization(org);
  }

  /**
   * Delete organization
   */
  async delete(id: string): Promise<void> {
    await prisma.organization.delete({
      where: { id },
    });
  }

  /**
   * Check if organization exists
   */
  async exists(id: string): Promise<boolean> {
    const count = await prisma.organization.count({
      where: { id },
    });
    return count > 0;
  }

  /**
   * Check if email is taken
   */
  async isEmailTaken(email: string): Promise<boolean> {
    const count = await prisma.organization.count({
      where: { email },
    });
    return count > 0;
  }

  /**
   * Get organization stats
   */
  async getStats(id: string): Promise<{
    agentCount: number;
    userCount: number;
    totalSpent: number;
  }> {
    const [agentCount, userCount, transactions] = await Promise.all([
      prisma.agent.count({ where: { organizationId: id } }),
      prisma.user.count({ where: { organizationId: id } }),
      prisma.transaction.aggregate({
        where: {
          organizationId: id,
          status: 'completed',
        },
        _sum: {
          amount: true,
        },
      }),
    ]);

    return {
      agentCount,
      userCount,
      totalSpent: Number(transactions._sum.amount || 0),
    };
  }

  /**
   * Map Prisma model to Organization type
   */
  private mapToOrganization(org: any): Organization {
    return {
      id: org.id,
      name: org.name,
      email: org.email,
      kycStatus: org.kycStatus as KycStatus,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
    };
  }
}

