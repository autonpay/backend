/**
 * Organization Routes
 *
 * Organization management endpoints:
 * - GET /organizations/:id - Get organization
 * - PATCH /organizations/:id - Update organization
 * - GET /organizations/:id/stats - Get organization statistics
 * - GET /organizations/:id/users - List users in organization
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { container } from '../../services/container';
import { authenticate } from '../middleware/authenticate';
import { UnauthorizedError } from '../../shared/errors';
import { validate } from '../middleware/validate';
import * as responses from '../../shared/http/response';

const router = Router();

const organizationIdParamsSchema = z.object({
  id: z.string().uuid('Invalid organization ID format'),
});

const updateOrganizationSchema = z
  .object({
    name: z.string().min(1, 'Name cannot be empty').optional(),
    email: z.string().email('Invalid email').optional(),
  })
  .refine((data) => data.name !== undefined || data.email !== undefined, {
    message: 'At least one field (name or email) must be provided',
    path: ['name'],
  });

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /v1/organizations/{id}:
 *   get:
 *     summary: Get organization details
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Organization ID (use "me" for current organization)
 *     responses:
 *       200:
 *         description: Organization details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Organization'
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Organization not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  '/:id',
  validate({ params: organizationIdParamsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as { id: string };
      const userOrgId = req.user?.organizationId || req.apiKey?.organizationId;

      // Verify user has access to this organization
      if (userOrgId !== id) {
        throw new UnauthorizedError('Cannot access this organization');
      }

      const organization = await container.organizationService.getOrganization(id);

      return responses.ok(res, organization, 'Organization retrieved successfully');
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * PATCH /organizations/:id
 * Update organization
 */
router.patch(
  '/:id',
  validate({ params: organizationIdParamsSchema, body: updateOrganizationSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as { id: string };
      const userOrgId = req.user?.organizationId || req.apiKey?.organizationId;
      const userRole = req.user?.role;

      // Verify user has access to this organization
      if (userOrgId !== id) {
        throw new UnauthorizedError('Cannot access this organization');
      }

      // Only owners can update organization
      if (userRole !== 'owner') {
        throw new UnauthorizedError('Only organization owners can update organization details');
      }

      const { name, email } = req.body as { name?: string; email?: string };

      const updated = await container.organizationService.updateOrganization(id, {
        name,
        email,
      });

      return responses.ok(res, updated, 'Organization updated successfully');
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * GET /organizations/:id/stats
 * Get organization statistics
 */
router.get(
  '/:id/stats',
  validate({ params: organizationIdParamsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as { id: string };
      const userOrgId = req.user?.organizationId || req.apiKey?.organizationId;

      // Verify user has access to this organization
      if (userOrgId !== id) {
        throw new UnauthorizedError('Cannot access this organization');
      }

      const stats = await container.organizationService.getOrganizationStats(id);

      return responses.ok(res, stats, 'Organization statistics retrieved successfully');
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * GET /organizations/:id/users
 * List users in organization
 */
router.get(
  '/:id/users',
  validate({ params: organizationIdParamsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as { id: string };
      const userOrgId = req.user?.organizationId || req.apiKey?.organizationId;

      // Verify user has access to this organization
      if (userOrgId !== id) {
        throw new UnauthorizedError('Cannot access this organization');
      }

      const users = await container.userService.listUsersInOrganization(id);

      return responses.ok(res, users, 'Users retrieved successfully');
    } catch (error) {
      return next(error);
    }
  }
);

export default router;

