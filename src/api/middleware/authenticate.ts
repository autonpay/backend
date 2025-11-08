import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../../shared/errors';
import { container } from '../../services/container';
import { logger } from '../../shared/logger';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        organizationId: string;
        role: string;
        email: string;
      };
      apiKey?: {
        id: string;
        organizationId: string;
        name?: string;
      };
    }
  }
}

/**
 * Authentication middleware
 *
 * Validates JWT or API keys on protected routes.
 * Supports two authentication methods:
 * 1. Bearer token (JWT) - for user authentication
 * 2. API key - for programmatic access
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedError('Missing authorization header');
    }

    const authService = container.authService;

    // Check if it's a Bearer token (JWT)
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7); // Remove "Bearer " prefix

      try {
        const payload = authService.verifyToken(token);

        req.user = {
          id: payload.userId,
          organizationId: payload.organizationId,
          role: payload.role,
          email: payload.email,
        };

        logger.debug({ userId: payload.userId }, 'User authenticated via JWT');
        return next();
      } catch (error) {
        throw new UnauthorizedError('Invalid or expired token');
      }
    }

    // Otherwise, treat as API key
    const apiKey = authHeader;

    try {
      const validatedKey = await authService.validateAPIKey(apiKey);

      req.apiKey = {
        id: validatedKey.id,
        organizationId: validatedKey.organizationId,
        name: validatedKey.name,
      };

      logger.debug({ apiKeyId: validatedKey.id }, 'Request authenticated via API key');
      next();
    } catch (error) {
      throw new UnauthorizedError('Invalid API key');
    }

  } catch (error) {
    if (error instanceof UnauthorizedError) {
      next(error);
    } else {
      next(new UnauthorizedError('Authentication failed'));
    }
  }
}

/**
 * Optional authentication middleware
 *
 * Tries to authenticate, but doesn't fail if no credentials are provided.
 * Useful for endpoints that have different behavior for authenticated vs anonymous users.
 */
export async function optionalAuthenticate(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return next(); // No credentials, continue as anonymous
    }

    // If credentials are provided, they must be valid
    await authenticate(req, res, next);
  } catch (error) {
    next(error);
  }
}
