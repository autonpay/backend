/**
 * User Repository
 *
 * Data access layer for User service.
 * Handles all database operations for users.
 */

import { prisma } from '../../database/client';
import {
  User,
  CreateUserInput,
  UpdateUserInput,
  ListUsersQuery,
  UserRole,
  UserWithOrganization,
} from './user.types';

export class UserRepository {
  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) return null;

    return this.mapToUser(user);
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) return null;

    return this.mapToUser(user);
  }

  /**
   * Find user by ID with organization details
   */
  async findByIdWithOrganization(id: string): Promise<UserWithOrganization | null> {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        organization: true,
      },
    });

    if (!user) return null;

    return {
      ...this.mapToUser(user),
      organization: {
        id: user.organization.id,
        name: user.organization.name,
        email: user.organization.email,
      },
    };
  }

  /**
   * List users by organization
   */
  async listByOrganization(organizationId: string, limit?: number, offset?: number): Promise<User[]> {
    const users = await prisma.user.findMany({
      where: { organizationId },
      take: limit || 50,
      skip: offset || 0,
      orderBy: { createdAt: 'desc' },
    });

    return users.map(user => this.mapToUser(user));
  }

  /**
   * List all users
   */
  async list(query: ListUsersQuery): Promise<User[]> {
    const users = await prisma.user.findMany({
      where: {
        ...(query.organizationId && { organizationId: query.organizationId }),
        ...(query.role && { role: query.role }),
      },
      take: query.limit || 50,
      skip: query.offset || 0,
      orderBy: { createdAt: 'desc' },
    });

    return users.map(user => this.mapToUser(user));
  }

  /**
   * Create new user
   */
  async create(input: CreateUserInput): Promise<User> {
    const user = await prisma.user.create({
      data: {
        organizationId: input.organizationId,
        email: input.email,
        passwordHash: input.passwordHash,
        role: input.role || UserRole.MEMBER,
      },
    });

    return this.mapToUser(user);
  }

  /**
   * Update user
   */
  async update(id: string, input: UpdateUserInput): Promise<User> {
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(input.email && { email: input.email }),
        ...(input.passwordHash && { passwordHash: input.passwordHash }),
        ...(input.role && { role: input.role }),
      },
    });

    return this.mapToUser(user);
  }

  /**
   * Delete user
   */
  async delete(id: string): Promise<void> {
    await prisma.user.delete({
      where: { id },
    });
  }

  /**
   * Check if user exists
   */
  async exists(id: string): Promise<boolean> {
    const count = await prisma.user.count({
      where: { id },
    });
    return count > 0;
  }

  /**
   * Check if email is taken
   */
  async isEmailTaken(email: string): Promise<boolean> {
    const count = await prisma.user.count({
      where: { email },
    });
    return count > 0;
  }

  /**
   * Count users in organization
   */
  async countByOrganization(organizationId: string): Promise<number> {
    return prisma.user.count({
      where: { organizationId },
    });
  }

  /**
   * Get user's organization ID
   */
  async getOrganizationId(userId: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });

    return user?.organizationId || null;
  }

  /**
   * Check if user is owner of organization
   */
  async isOwner(userId: string, organizationId: string): Promise<boolean> {
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        organizationId,
        role: UserRole.OWNER,
      },
    });

    return user !== null;
  }

  /**
   * Map Prisma model to User type
   */
  private mapToUser(user: any): User {
    return {
      id: user.id,
      organizationId: user.organizationId,
      email: user.email,
      role: user.role as UserRole,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

