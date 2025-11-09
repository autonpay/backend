/**
 * Auth Routes
 *
 * Public authentication endpoints:
 * - POST /auth/register - Register new user + create organization
 * - POST /auth/login - Login existing user
 * - POST /auth/logout - Logout (optional, for token blacklisting)
 * - POST /auth/refresh - Refresh JWT token
 * - POST /auth/forgot-password - Request password reset
 * - POST /auth/reset-password - Reset password with token
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { container } from '../../services/container';
import { authenticate } from '../middleware/authenticate';
import { logger } from '../../shared/logger';
import { validate } from '../middleware/validate';
import * as responses from '../../shared/http/response';
import { UnauthorizedError } from '../../shared/errors';

const router = Router();

// Schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  organizationName: z.string().min(1, 'Organization name is required'),
  organizationEmail: z.string().email().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

const apiKeyBodySchema = z.object({
  name: z.string().min(1, 'Name cannot be empty').optional(),
  prefix: z.enum(['live', 'test']).optional(),

});

const apiKeyParamsSchema = z.object({
  id: z.string().min(1, 'API key ID is required'),
});

/**
 * POST /auth/register
 * Register new user and create organization
 */
router.post(
  '/register',
  validate({ body: registerSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, organizationName, organizationEmail } = req.body;

      logger.info({ email, organizationName }, 'New user registration attempt');

      // Step 1: Create organization
      const organization = await container.organizationService.createOrganization({
        name: organizationName,
        email: organizationEmail || email,
      });

      logger.info({ organizationId: organization.id }, 'Organization created');

      // Step 2: Register user as owner
      const result = await container.authService.register({
        email,
        password,
        organizationId: organization.id,
        role: 'owner',
      });

      logger.info({ userId: result.user.id }, 'User registered successfully');

      return responses.created(
        res,
        {
          user: result.user,
          organization: {
            id: organization.id,
            name: organization.name,
            email: organization.email,
          },
          token: result.token,
        },
        'Account created successfully'
      );
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * POST /auth/login
 * Login existing user
 */
router.post(
  '/login',
  validate({ body: loginSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;

      logger.info({ email }, 'User login attempt');

      const result = await container.authService.login({
        email,
        password,
      });

      return responses.ok(
        res,
        {
          user: result.user,
          token: result.token,
        },
        'Login successful'
      );
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * GET /auth/me
 * Get current user profile
 */
router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user) {
      const user = await container.userService.getUser(req.user.id);
      return responses.ok(res, user);
    }

    if (req.apiKey) {
      return responses.ok(res, {
        id: req.apiKey.id,
        organizationId: req.apiKey.organizationId,
        name: req.apiKey.name ?? null,
        type: 'api_key',
        environment: req.apiKey.environment,
      });
    }

    throw new UnauthorizedError();
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /auth/change-password
 * Change user password
 */
router.post(
  '/change-password',
  authenticate,
  validate({ body: changePasswordSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { currentPassword, newPassword } = req.body;

      await container.authService.changePassword(userId, currentPassword, newPassword);

      return responses.ok(res, null, 'Password changed successfully');
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * POST /auth/api-keys
 * Generate new API key
 */
router.post(
  '/api-keys',
  authenticate,
  validate({ body: apiKeyBodySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const organizationId = req.user!.organizationId;
      const { name, prefix } = req.body as { name?: string; prefix?: 'live' | 'test' };

      const apiKey = await container.authService.generateAPIKey(
        organizationId,
        name,
        prefix || 'live'
      );

      return responses.created(
        res,
        apiKey,
        "API key generated successfully. Save it now - you won't see it again!"
      );
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * GET /auth/api-keys
 * List all API keys for organization
 */
router.get('/api-keys', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;

    const apiKeys = await container.authService.listAPIKeys(organizationId);

    return responses.ok(res, apiKeys);
  } catch (error) {
    return next(error);
  }
});

/**
 * DELETE /auth/api-keys/:id
 * Revoke an API key
 */
router.delete(
  '/api-keys/:id',
  authenticate,
  validate({ params: apiKeyParamsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const organizationId = req.user!.organizationId;
      const { id } = req.params;

      await container.authService.revokeAPIKey(id, organizationId);

      return responses.ok(res, null, 'API key revoked successfully');
    } catch (error) {
      return next(error);
    }
  }
);

export default router;

