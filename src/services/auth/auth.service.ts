/**
 * Auth Service
 *
 * Handles authentication and authorization:
 * - User registration
 * - User login
 * - JWT generation and verification
 * - API key generation and validation
 */

import {
  LoginInput,
  LoginResult,
  RegisterInput,
  RegisterResult,
  JWTPayload,
  APIKeyResult,
  ValidatedAPIKey,
} from './auth.types';
import { UserService, UserRole } from '../users';
import { hashPassword, verifyPassword, validatePassword } from './password';
import { generateJWT, verifyJWT } from './jwt';
import { generateAPIKey, hashAPIKey, verifyAPIKey, isValidAPIKeyFormat } from './api-keys';
import { UnauthorizedError, BadRequestError } from '../../shared/errors';
import { logger } from '../../shared/logger';
import { prisma } from '../../database/client';

export class AuthService {
  constructor(
    private userService: UserService
  ) {}

  /**
   * Register new user
   */
  async register(input: RegisterInput): Promise<RegisterResult> {
    logger.info({ email: input.email }, 'Registering new user');

    // Validate password strength
    const passwordValidation = validatePassword(input.password);
    if (!passwordValidation.valid) {
      throw new BadRequestError(
        `Password validation failed: ${passwordValidation.errors.join(', ')}`
      );
    }

    // Hash password
    const passwordHash = await hashPassword(input.password);

    // Create user
    const user = await this.userService.createUser({
      organizationId: input.organizationId,
      email: input.email,
      passwordHash,
      role: input.role as UserRole,
    });

    // Generate JWT
    const token = generateJWT({
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
      email: user.email,
    });

    logger.info({ userId: user.id }, 'User registered successfully');

    return {
      user: {
        id: user.id,
        email: user.email,
        organizationId: user.organizationId,
        role: user.role,
      },
      token,
    };
  }

  /**
   * Login user
   */
  async login(input: LoginInput): Promise<LoginResult> {
    logger.info({ email: input.email }, 'User login attempt');

    // Find user by email
    const user = await this.userService.getUserByEmail(input.email);

    if (!user) {
      // Don't reveal if email exists
      throw new UnauthorizedError('Invalid email or password');
    }

    // Get password hash from database
    const userWithPassword = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });

    if (!userWithPassword) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Verify password
    const validPassword = await verifyPassword(input.password, userWithPassword.passwordHash);

    if (!validPassword) {
      logger.warn({ email: input.email }, 'Failed login attempt - invalid password');
      throw new UnauthorizedError('Invalid email or password');
    }

    // Generate JWT
    const token = generateJWT({
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
      email: user.email,
    });

    logger.info({ userId: user.id }, 'User logged in successfully');

    return {
      user: {
        id: user.id,
        email: user.email,
        organizationId: user.organizationId,
        role: user.role,
      },
      token,
    };
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string): JWTPayload {
    try {
      return verifyJWT(token);
    } catch (error) {
      logger.debug({ error }, 'JWT verification failed');
      throw new UnauthorizedError('Invalid or expired token');
    }
  }

  /**
   * Generate API key for organization
   */
  async generateAPIKey(
    organizationId: string,
    name?: string,
    prefix: 'live' | 'test' = 'live'
  ): Promise<APIKeyResult> {
    logger.info({ organizationId, name }, 'Generating API key');

    // Generate key
    const key = generateAPIKey(prefix);
    const keyHash = await hashAPIKey(key);

    // Store in database
    const apiKey = await prisma.apiKey.create({
      data: {
        organizationId,
        keyHash,
        name: name || `API Key (${new Date().toISOString().split('T')[0]})`,
        environment: prefix,
      },
    });

    logger.info({ apiKeyId: apiKey.id }, 'API key generated successfully');

    return {
      key,        // Show this to user once!
      keyHash,    // Stored in database
      id: apiKey.id,
      environment: apiKey.environment as 'live' | 'test',
    };
  }

  /**
   * Validate API key
   */
  async validateAPIKey(key: string): Promise<ValidatedAPIKey> {
    logger.debug('Validating API key');

    // Validate format
    if (!isValidAPIKeyFormat(key)) {
      throw new UnauthorizedError('Invalid API key format');
    }

    // Get all API keys and check against each hash
    // (In production, you might want to add a key prefix index for faster lookup)
    const apiKeys = await prisma.apiKey.findMany({
      select: {
        id: true,
        keyHash: true,
        organizationId: true,
        name: true,
        environment: true,
      },
    });

    for (const apiKey of apiKeys) {
      const valid = await verifyAPIKey(key, apiKey.keyHash);

      if (valid) {
        // Update last used timestamp
        await prisma.apiKey.update({
          where: { id: apiKey.id },
          data: { lastUsedAt: new Date() },
        });

        logger.debug({ apiKeyId: apiKey.id }, 'API key validated successfully');

        return {
          id: apiKey.id,
          organizationId: apiKey.organizationId,
          name: apiKey.name || undefined,
          environment: apiKey.environment as 'live' | 'test',
        };
      }
    }

    logger.warn('API key validation failed - no matching key found');
    throw new UnauthorizedError('Invalid API key');
  }

  /**
   * Revoke API key
   */
  async revokeAPIKey(apiKeyId: string, organizationId: string): Promise<void> {
    logger.info({ apiKeyId, organizationId }, 'Revoking API key');

    // Verify API key belongs to organization
    const apiKey = await prisma.apiKey.findUnique({
      where: { id: apiKeyId },
    });

    if (!apiKey) {
      throw new Error('API key not found');
    }

    if (apiKey.organizationId !== organizationId) {
      throw new UnauthorizedError('Cannot revoke API key from different organization');
    }

    // Delete API key
    await prisma.apiKey.delete({
      where: { id: apiKeyId },
    });

    logger.info({ apiKeyId }, 'API key revoked successfully');
  }

  /**
   * List API keys for organization
   */
  async listAPIKeys(organizationId: string): Promise<Array<{
    id: string;
    name: string | null;
    createdAt: Date;
    lastUsedAt: Date | null;
    environment: 'live' | 'test';
  }>> {
    logger.debug({ organizationId }, 'Listing API keys');

    const apiKeys = await prisma.apiKey.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        createdAt: true,
        lastUsedAt: true,
        environment: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return apiKeys.map((apiKey: { id: string; name: string | null; createdAt: Date; lastUsedAt: Date | null; environment: 'live' | 'test' }) => ({
      ...apiKey,
      environment: apiKey.environment,
    }));
  }

  /**
   * Change user password
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    logger.info({ userId }, 'Changing user password');

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const validPassword = await verifyPassword(currentPassword, user.passwordHash);

    if (!validPassword) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    // Validate new password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      throw new BadRequestError(
        `Password validation failed: ${passwordValidation.errors.join(', ')}`
      );
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    logger.info({ userId }, 'Password changed successfully');
  }
}

