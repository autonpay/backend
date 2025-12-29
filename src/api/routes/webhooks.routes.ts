/**
 * Webhook Routes
 *
 * Webhook management endpoints:
 * - GET /webhooks - List all webhooks in organization
 * - POST /webhooks - Create new webhook
 * - GET /webhooks/:id - Get webhook details
 * - PATCH /webhooks/:id - Update webhook
 * - DELETE /webhooks/:id - Delete webhook
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { container } from '../../services/container';
import { authenticate } from '../middleware/authenticate';
import { BadRequestError, NotFoundError } from '../../shared/errors';
import { validate } from '../middleware/validate';
import * as responses from '../../shared/http/response';

const router = Router();

// Valid webhook events
const VALID_WEBHOOK_EVENTS = ['transaction.completed', 'transaction.failed'] as const;

// Schemas
const createWebhookSchema = z.object({
  url: z.string().url('Invalid webhook URL'),
  events: z
    .array(z.enum(VALID_WEBHOOK_EVENTS))
    .min(1, 'At least one event must be specified'),
  secret: z.string().min(16, 'Secret must be at least 16 characters').optional(),
});

const updateWebhookSchema = z
  .object({
    url: z.string().url('Invalid webhook URL').optional(),
    events: z
      .array(z.enum(VALID_WEBHOOK_EVENTS))
      .min(1, 'At least one event must be specified')
      .optional(),
    enabled: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'At least one field must be provided',
    path: ['url'],
  });

const webhookIdParamsSchema = z.object({
  id: z.string().uuid('Invalid webhook ID format'),
});

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /v1/webhooks:
 *   get:
 *     summary: List all webhooks in organization
 *     tags: [Webhooks]
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - in: query
 *         name: enabled
 *         schema:
 *           type: boolean
 *         description: Filter by enabled status
 *     responses:
 *       200:
 *         description: List of webhooks
 */
router.get(
  '/',
  validate({
    query: z.object({
      enabled: z.string().transform((val) => val === 'true').optional(),
    }).optional(),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;

      if (!organizationId) {
        throw new BadRequestError('Organization ID is required');
      }

      const enabled = req.query.enabled as boolean | undefined;

      const webhooks = await container.webhookRepository.findByOrganization({
        organizationId,
        enabled,
      });

      // Remove secrets from response
      const webhooksWithoutSecrets = webhooks.map(({ secret, ...webhook }) => webhook);

      return responses.ok(res, webhooksWithoutSecrets);
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * @swagger
 * /v1/webhooks:
 *   post:
 *     summary: Create new webhook
 *     tags: [Webhooks]
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *               - events
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *               events:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [transaction.completed, transaction.failed]
 *               secret:
 *                 type: string
 *                 description: Optional secret (will be generated if not provided)
 *     responses:
 *       201:
 *         description: Webhook created
 */
router.post(
  '/',
  validate({ body: createWebhookSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;

      if (!organizationId) {
        throw new BadRequestError('Organization ID is required');
      }

      const { url, events, secret } = req.body as {
        url: string;
        events: string[];
        secret?: string;
      };

      const webhook = await container.webhookRepository.create({
        organizationId,
        url,
        events,
        secret,
      });

      // Return webhook without secret for security
      const { secret: _, ...webhookWithoutSecret } = webhook;

      return responses.created(res, webhookWithoutSecret, 'Webhook created successfully');
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * @swagger
 * /v1/webhooks/{id}:
 *   get:
 *     summary: Get webhook details
 *     tags: [Webhooks]
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
 *     responses:
 *       200:
 *         description: Webhook details
 *       404:
 *         description: Webhook not found
 */
router.get(
  '/:id',
  validate({ params: webhookIdParamsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as { id: string };
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;

      if (!organizationId) {
        throw new BadRequestError('Organization ID is required');
      }

      // Verify ownership
      const owned = await container.webhookRepository.verifyOwnership(id, organizationId);
      if (!owned) {
        throw new NotFoundError('Webhook not found');
      }

      const webhook = await container.webhookRepository.findById(id);

      if (!webhook) {
        throw new NotFoundError('Webhook not found');
      }

      // Return webhook without secret for security
      const { secret: _, ...webhookWithoutSecret } = webhook;

      return responses.ok(res, webhookWithoutSecret);
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * @swagger
 * /v1/webhooks/{id}:
 *   patch:
 *     summary: Update webhook
 *     tags: [Webhooks]
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *               events:
 *                 type: array
 *                 items:
 *                   type: string
 *               enabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Webhook updated
 *       404:
 *         description: Webhook not found
 */
router.patch(
  '/:id',
  validate({
    params: webhookIdParamsSchema,
    body: updateWebhookSchema,
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as { id: string };
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;

      if (!organizationId) {
        throw new BadRequestError('Organization ID is required');
      }

      // Verify ownership
      const owned = await container.webhookRepository.verifyOwnership(id, organizationId);
      if (!owned) {
        throw new NotFoundError('Webhook not found');
      }

      const updateData = req.body as {
        url?: string;
        events?: string[];
        enabled?: boolean;
      };

      const webhook = await container.webhookRepository.update(id, updateData);

      // Return webhook without secret for security
      const { secret: _, ...webhookWithoutSecret } = webhook;

      return responses.ok(res, webhookWithoutSecret, 'Webhook updated successfully');
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * @swagger
 * /v1/webhooks/{id}:
 *   delete:
 *     summary: Delete webhook
 *     tags: [Webhooks]
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
 *     responses:
 *       200:
 *         description: Webhook deleted
 *       404:
 *         description: Webhook not found
 */
router.delete(
  '/:id',
  validate({ params: webhookIdParamsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as { id: string };
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;

      if (!organizationId) {
        throw new BadRequestError('Organization ID is required');
      }

      // Verify ownership
      const owned = await container.webhookRepository.verifyOwnership(id, organizationId);
      if (!owned) {
        throw new NotFoundError('Webhook not found');
      }

      await container.webhookRepository.delete(id);

      return responses.ok(res, null, 'Webhook deleted successfully');
    } catch (error) {
      return next(error);
    }
  }
);

export default router;

