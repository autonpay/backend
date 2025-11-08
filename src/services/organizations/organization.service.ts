/**
 * Organization Service
 *
 * Manages organizations (companies/teams) that own AI agents.
 * Organizations are the root entity in Auton's hierarchy.
 */

import {
  Organization,
  CreateOrganizationInput,
  UpdateOrganizationInput,
  ListOrganizationsQuery,
} from './organization.types';
import { OrganizationRepository } from './organization.repository';
import { NotFoundError, ConflictError } from '../../shared/errors';
import { logger } from '../../shared/logger';
import { prisma } from '../../database/client';

export class OrganizationService {
  constructor(
    private repository: OrganizationRepository
  ) {}

  /**
   * Get organization by ID
   */
  async getOrganization(id: string): Promise<Organization> {
    logger.debug({ organizationId: id }, 'Getting organization');

    const org = await this.repository.findById(id);

    if (!org) {
      throw new NotFoundError('Organization', id);
    }

    return org;
  }

  /**
   * Get organization by email
   */
  async getOrganizationByEmail(email: string): Promise<Organization | null> {
    logger.debug({ email }, 'Getting organization by email');

    return this.repository.findByEmail(email);
  }

  /**
   * List organizations
   */
  async listOrganizations(query: ListOrganizationsQuery): Promise<Organization[]> {
    logger.debug({ query }, 'Listing organizations');

    return this.repository.list(query);
  }

  /**
   * Create new organization
   */
  async createOrganization(input: CreateOrganizationInput): Promise<Organization> {
    logger.info({ input }, 'Creating organization');

    // Validation
    if (!input.name || input.name.trim().length === 0) {
      throw new Error('Organization name is required');
    }

    if (!input.email || !this.isValidEmail(input.email)) {
      throw new Error('Valid email is required');
    }

    // Check if email is already taken
    const emailTaken = await this.repository.isEmailTaken(input.email);
    if (emailTaken) {
      throw new ConflictError(`Organization with email ${input.email} already exists`);
    }

    // Create organization
    const org = await this.repository.create(input);

    logger.info({ organizationId: org.id }, 'Organization created successfully');

    return org;
  }

  /**
   * Update organization
   */
  async updateOrganization(id: string, input: UpdateOrganizationInput): Promise<Organization> {
    logger.info({ organizationId: id, input }, 'Updating organization');

    // Check if organization exists
    await this.getOrganization(id);

    // If email is being updated, check if it's taken
    if (input.email) {
      const existingOrg = await this.repository.findByEmail(input.email);
      if (existingOrg && existingOrg.id !== id) {
        throw new ConflictError(`Email ${input.email} is already taken`);
      }
    }

    // Update organization
    const org = await this.repository.update(id, input);

    logger.info({ organizationId: id }, 'Organization updated successfully');

    return org;
  }

  /**
   * Delete organization
   */
  async deleteOrganization(id: string): Promise<void> {
    logger.info({ organizationId: id }, 'Deleting organization');

    // Check if organization exists
    await this.getOrganization(id);

    // Check if organization has agents
    const stats = await this.repository.getStats(id);
    if (stats.agentCount > 0) {
      throw new ConflictError(
        `Cannot delete organization with ${stats.agentCount} agents. Delete agents first.`
      );
    }

    // Delete organization
    await this.repository.delete(id);

    logger.info({ organizationId: id }, 'Organization deleted successfully');
  }

  /**
   * Get organization statistics
   */
  async getOrganizationStats(id: string): Promise<{
    agentCount: number;
    userCount: number;
    totalSpent: number;
  }> {
    logger.debug({ organizationId: id }, 'Getting organization stats');

    // Check if organization exists
    await this.getOrganization(id);

    return this.repository.getStats(id);
  }

  /**
   * Verify if a user belongs to an organization
   */
  async verifyMembership(organizationId: string, userId: string): Promise<boolean> {
    logger.debug({ organizationId, userId }, 'Verifying organization membership');

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    return user?.organizationId === organizationId;
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

