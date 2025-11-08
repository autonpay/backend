/**
 * User Service
 *
 * Manages users (people) who belong to organizations.
 * Users can log in and manage agents.
 */

import {
  User,
  CreateUserInput,
  UpdateUserInput,
  ListUsersQuery,
  UserWithOrganization,
  UserRole,
} from './user.types';
import { UserRepository } from './user.repository';
import { NotFoundError, ConflictError, ForbiddenError } from '../../shared/errors';
import { logger } from '../../shared/logger';

export class UserService {
  constructor(
    private repository: UserRepository
  ) {}

  /**
   * Get user by ID
   */
  async getUser(id: string): Promise<User> {
    logger.debug({ userId: id }, 'Getting user');

    const user = await this.repository.findById(id);

    if (!user) {
      throw new NotFoundError('User', id);
    }

    return user;
  }

  /**
   * Get user with organization details
   */
  async getUserWithOrganization(id: string): Promise<UserWithOrganization> {
    logger.debug({ userId: id }, 'Getting user with organization');

    const user = await this.repository.findByIdWithOrganization(id);

    if (!user) {
      throw new NotFoundError('User', id);
    }

    return user;
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    logger.debug({ email }, 'Getting user by email');

    return this.repository.findByEmail(email);
  }

  /**
   * List users
   */
  async listUsers(query: ListUsersQuery): Promise<User[]> {
    logger.debug({ query }, 'Listing users');

    return this.repository.list(query);
  }

  /**
   * List users in organization
   */
  async listUsersInOrganization(
    organizationId: string,
    limit?: number,
    offset?: number
  ): Promise<User[]> {
    logger.debug({ organizationId }, 'Listing users in organization');

    return this.repository.listByOrganization(organizationId, limit, offset);
  }

  /**
   * Create new user
   *
   * Note: Password should already be hashed by Auth Service
   */
  async createUser(input: CreateUserInput): Promise<User> {
    logger.info({ input: { ...input, passwordHash: '[REDACTED]' } }, 'Creating user');

    // Validation
    if (!input.email || !this.isValidEmail(input.email)) {
      throw new Error('Valid email is required');
    }

    if (!input.passwordHash) {
      throw new Error('Password hash is required');
    }

    // Check if email is already taken
    const emailTaken = await this.repository.isEmailTaken(input.email);
    if (emailTaken) {
      throw new ConflictError(`User with email ${input.email} already exists`);
    }

    // Check if organization exists (via repository)
    // Note: We could inject OrganizationService, but that creates circular dependency
    // Better to just let database foreign key constraint handle it

    // Create user
    const user = await this.repository.create(input);

    logger.info({ userId: user.id }, 'User created successfully');

    return user;
  }

  /**
   * Update user
   */
  async updateUser(id: string, input: UpdateUserInput): Promise<User> {
    logger.info({ userId: id, input }, 'Updating user');

    // Check if user exists
    await this.getUser(id);

    // If email is being updated, check if it's taken
    if (input.email) {
      const existingUser = await this.repository.findByEmail(input.email);
      if (existingUser && existingUser.id !== id) {
        throw new ConflictError(`Email ${input.email} is already taken`);
      }
    }

    // Update user
    const user = await this.repository.update(id, input);

    logger.info({ userId: id }, 'User updated successfully');

    return user;
  }

  /**
   * Delete user
   */
  async deleteUser(id: string): Promise<void> {
    logger.info({ userId: id }, 'Deleting user');

    // Check if user exists
    const user = await this.getUser(id);

    // Check if user is the last owner
    if (user.role === UserRole.OWNER) {
      const userCount = await this.repository.countByOrganization(user.organizationId);
      if (userCount === 1) {
        throw new ConflictError(
          'Cannot delete the last owner. Delete the organization instead.'
        );
      }

      // Check if there are other owners
      const owners = await this.repository.list({
        organizationId: user.organizationId,
        role: UserRole.OWNER,
      });

      if (owners.length === 1) {
        throw new ConflictError(
          'Cannot delete the last owner. Promote another user to owner first.'
        );
      }
    }

    // Delete user
    await this.repository.delete(id);

    logger.info({ userId: id }, 'User deleted successfully');
  }

  /**
   * Change user role
   */
  async changeUserRole(userId: string, newRole: UserRole, requestingUserId: string): Promise<User> {
    logger.info({ userId, newRole, requestingUserId }, 'Changing user role');

    // Get both users
    const user = await this.getUser(userId);
    const requestingUser = await this.getUser(requestingUserId);

    // Check if requesting user is in the same organization
    if (user.organizationId !== requestingUser.organizationId) {
      throw new ForbiddenError('Cannot change role of user in different organization');
    }

    // Check if requesting user is owner or admin
    if (requestingUser.role !== UserRole.OWNER && requestingUser.role !== UserRole.ADMIN) {
      throw new ForbiddenError('Only owners and admins can change user roles');
    }

    // Owners can only be changed by other owners
    if (user.role === UserRole.OWNER && requestingUser.role !== UserRole.OWNER) {
      throw new ForbiddenError('Only owners can change owner roles');
    }

    // Update role
    const updatedUser = await this.repository.update(userId, { role: newRole });

    logger.info({ userId }, 'User role changed successfully');

    return updatedUser;
  }

  /**
   * Verify if user belongs to organization
   */
  async verifyOrganizationMembership(userId: string, organizationId: string): Promise<boolean> {
    logger.debug({ userId, organizationId }, 'Verifying organization membership');

    const user = await this.getUser(userId);
    return user.organizationId === organizationId;
  }

  /**
   * Check if user has permission
   */
  async hasPermission(userId: string, requiredRole: UserRole): Promise<boolean> {
    const user = await this.getUser(userId);

    // Owner has all permissions
    if (user.role === UserRole.OWNER) return true;

    // Admin has admin and member permissions
    if (user.role === UserRole.ADMIN && requiredRole !== UserRole.OWNER) return true;

    // Member only has member permissions
    if (user.role === UserRole.MEMBER && requiredRole === UserRole.MEMBER) return true;

    return false;
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

