/**
 * Dashboard Routes
 *
 * Protected routes for the dashboard UI:
 * - GET /dashboard/overview - Dashboard overview stats
 * - GET /dashboard/activity - Recent activity feed
 * - GET /dashboard/analytics - Analytics data
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { container } from '../../services/container';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import * as responses from '../../shared/http/response';
import { logger } from '../../shared/logger';

const router = Router();

// Schemas
const activityQuerySchema = z.object({
  limit: z
    .coerce
    .number({ invalid_type_error: 'Limit must be a number' })
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .optional(),
});

const analyticsQuerySchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  granularity: z.enum(['hour', 'day', 'week', 'month']).optional(),
});

// All dashboard routes require authentication
router.use(authenticate);

/**
 * GET /dashboard/overview
 * Get dashboard overview with key metrics
 */
router.get('/overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user?.organizationId || req.apiKey?.organizationId;

    if (!organizationId) {
      return next(new Error('Organization ID is required'));
    }

    // Get organization stats
    const stats = await container.organizationService.getOrganizationStats(organizationId);

    // Get organization details
    const organization = await container.organizationService.getOrganization(organizationId);

    return responses.ok(res, {
      organization: {
        id: organization.id,
        name: organization.name,
        email: organization.email,
        kycStatus: organization.kycStatus,
      },
      stats: {
        agents: stats.agentCount,
        users: stats.userCount,
        totalSpent: stats.totalSpent,
      },
    }, 'Organization retrieved successfully');
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /dashboard/activity
 * Get recent activity for the organization
 */
router.get(
  '/activity',
  validate({ query: activityQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;
      const { limit } = req.query as { limit?: number };
      const activityLimit = limit ?? 20;

      logger.debug({ organizationId, activityLimit }, 'Getting activities');
      logger.debug({ req }, 'Request');

      // TODO: Implement activity feed
      // For now, return empty array
      const activities: any[] = [];

      return responses.ok(res, activities, 'Activities retrieved successfully');
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * GET /dashboard/analytics
 * Get analytics data for charts
 */
router.get(
  '/analytics',
  validate({ query: analyticsQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;
      const { startDate, endDate, granularity } = req.query as {
        startDate?: Date;
        endDate?: Date;
        granularity?: 'hour' | 'day' | 'week' | 'month';
      };

      logger.debug({ organizationId, startDate, endDate, granularity }, 'Getting analytics');
      logger.debug({ req }, 'Request');

      // TODO: Implement analytics
      // For now, return mock data structure
      const analytics = {
        timeframe: {
          startDate: startDate?.toISOString() ?? null,
          endDate: endDate?.toISOString() ?? null,
          granularity: granularity ?? 'day',
        },
        spending: {
          total: 0,
          byDay: [],
          byCategory: [],
        },
        agents: {
          active: 0,
          total: 0,
        },
        transactions: {
          successful: 0,
          failed: 0,
          pending: 0,
        },
      };

      return responses.ok(res, analytics, 'Analytics retrieved successfully');
    } catch (error) {
      return next(error);
    }
  }
);

export default router;

