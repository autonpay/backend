/**
 * Rules Routes
 *
 * Spending rules management endpoints:
 * - GET /rules - List all rules in organization
 * - POST /rules - Create new rule
 * - GET /rules/:id - Get rule details
 * - PATCH /rules/:id - Update rule
 * - DELETE /rules/:id - Delete rule
 * - GET /rules/agent/:agentId - Get rules for specific agent
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { container } from '../../services/container';
import { authenticate } from '../middleware/authenticate';
import { BadRequestError } from '../../shared/errors';
import { validate } from '../middleware/validate';
import { RuleType, TimeWindow } from '../../services/rules';
import * as responses from '../../shared/http/response';

const router = Router();

// Schemas
const conditionsSchema = z.record(z.any());

const createRuleSchema = z.object({
  agentId: z.string().uuid('Invalid agent ID format').optional(),
  ruleType: z.nativeEnum(RuleType),
  limitAmount: z.number().positive('Limit amount must be positive').optional(),
  limitCurrency: z.string().min(3).max(3).default('USD').optional(),
  timeWindow: z.nativeEnum(TimeWindow).optional(),
  category: z.string().optional(),
  conditions: conditionsSchema.optional(),
  priority: z.number().int().min(0).max(1000).default(100).optional(),
});

const updateRuleSchema = z
  .object({
    ruleType: z.nativeEnum(RuleType).optional(),
    limitAmount: z.number().positive().optional(),
    limitCurrency: z.string().min(3).max(3).optional(),
    timeWindow: z.nativeEnum(TimeWindow).optional(),
    category: z.string().optional(),
    conditions: conditionsSchema.optional(),
    priority: z.number().int().min(0).max(1000).optional(),
    enabled: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'At least one field must be provided',
    path: ['ruleType'],
  });

const ruleIdParamsSchema = z.object({
  id: z.string().uuid('Invalid rule ID format'),
});

const agentIdParamsSchema = z.object({
  agentId: z.string().uuid('Invalid agent ID format'),
});

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /v1/rules:
 *   get:
 *     summary: List all rules in organization
 *     tags: [Rules]
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     responses:
 *       200:
 *         description: List of rules
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user?.organizationId || req.apiKey?.organizationId;

    if (!organizationId) {
      throw new BadRequestError('Organization ID is required');
    }

    const rules = await container.rulesService.listRules(organizationId);

    return responses.ok(res, rules, 'Rules retrieved successfully');
  } catch (error) {
    return next(error);
  }
});

/**
 * @swagger
 * /v1/rules:
 *   post:
 *     summary: Create new spending rule
 *     tags: [Rules]
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
 *               - ruleType
 *             properties:
 *               agentId:
 *                 type: string
 *                 format: uuid
 *                 description: Agent ID (omit for org-wide rule)
 *               ruleType:
 *                 type: string
 *                 enum: [per_transaction, daily, weekly, monthly, category, velocity, merchant_whitelist, merchant_blacklist]
 *               limitAmount:
 *                 type: number
 *               limitCurrency:
 *                 type: string
 *                 default: USD
 *               timeWindow:
 *                 type: string
 *                 enum: [hourly, daily, weekly, monthly]
 *               category:
 *                 type: string
 *               conditions:
 *                 type: object
 *               priority:
 *                 type: number
 *                 default: 100
 *     responses:
 *       201:
 *         description: Rule created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/',
  validate({ body: createRuleSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;

      if (!organizationId) {
        throw new BadRequestError('Organization ID is required');
      }

      const rule = await container.rulesService.createRule({
        ...req.body,
        organizationId,
      });

      return responses.created(res, rule, 'Rule created successfully');
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * @swagger
 * /v1/rules/{id}:
 *   get:
 *     summary: Get rule details
 *     tags: [Rules]
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
 *         description: Rule details
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Rule not found
 */
router.get(
  '/:id',
  validate({ params: ruleIdParamsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as { id: string };
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;

      if (!organizationId) {
        throw new BadRequestError('Organization ID is required');
      }

      // Get rule first (throws NotFoundError if doesn't exist)
      const rule = await container.rulesService.getRule(id);

      // Then verify ownership
      await container.rulesService.verifyOwnership(id, organizationId);

      return responses.ok(res, rule, 'Rule retrieved successfully');
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * @swagger
 * /v1/rules/{id}:
 *   patch:
 *     summary: Update rule
 *     tags: [Rules]
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
 *               ruleType:
 *                 type: string
 *               limitAmount:
 *                 type: number
 *               limitCurrency:
 *                 type: string
 *               timeWindow:
 *                 type: string
 *               category:
 *                 type: string
 *               conditions:
 *                 type: object
 *               priority:
 *                 type: number
 *               enabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Rule updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Rule not found
 */
router.patch(
  '/:id',
  validate({ params: ruleIdParamsSchema, body: updateRuleSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as { id: string };
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;

      if (!organizationId) {
        throw new BadRequestError('Organization ID is required');
      }

      // Verify ownership
      await container.rulesService.verifyOwnership(id, organizationId);

      const rule = await container.rulesService.updateRule(id, req.body);

      return responses.ok(res, rule, 'Rule updated successfully');
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * @swagger
 * /v1/rules/{id}:
 *   delete:
 *     summary: Delete rule
 *     tags: [Rules]
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
 *         description: Rule deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Rule not found
 */
router.delete(
  '/:id',
  validate({ params: ruleIdParamsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as { id: string };
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;

      if (!organizationId) {
        throw new BadRequestError('Organization ID is required');
      }

      // Get rule first (throws NotFoundError if doesn't exist)
      await container.rulesService.getRule(id);

      // Then verify ownership
      await container.rulesService.verifyOwnership(id, organizationId);

      await container.rulesService.deleteRule(id);

      return responses.ok(res, null, 'Rule deleted successfully');
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * @swagger
 * /v1/rules/agent/{agentId}:
 *   get:
 *     summary: Get rules for specific agent
 *     tags: [Rules]
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: List of rules for agent
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Agent not found
 */
router.get(
  '/agent/:agentId',
  validate({ params: agentIdParamsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { agentId } = req.params as { agentId: string };
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;

      if (!organizationId) {
        throw new BadRequestError('Organization ID is required');
      }

      // Verify agent ownership
      await container.agentService.verifyOwnership(agentId, organizationId);

      const rules = await container.rulesService.getRulesForAgent(agentId);

      return responses.ok(res, rules, 'Rules retrieved successfully');
    } catch (error) {
      return next(error);
    }
  }
);

export default router;

