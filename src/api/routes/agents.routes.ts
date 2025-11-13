/**
 * Agent Routes
 *
 * AI agent management endpoints:
 * - GET /agents - List all agents in organization
 * - POST /agents - Create new agent
 * - GET /agents/:id - Get agent details
 * - PATCH /agents/:id - Update agent
 * - DELETE /agents/:id - Delete agent
 * - GET /agents/:id/balance - Get agent balance
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { container } from '../../services/container';
import { authenticate } from '../middleware/authenticate';
import { BadRequestError } from '../../shared/errors';
import { validate } from '../middleware/validate';
import { AgentStatus } from '../../services/agents';
import * as responses from '../../shared/http/response';

const router = Router();

// Schemas
const metadataSchema = z.record(z.any());

const createAgentSchema = z.object({
  name: z.string().min(1, 'Agent name is required'),
  description: z.string().max(1000, 'Description is too long').optional(),
  metadata: metadataSchema.optional(),
});

const updateAgentSchema = z
  .object({
    name: z.string().min(1, 'Agent name cannot be empty').optional(),
    description: z.string().max(1000).optional(),
    status: z.enum(['active', 'paused', 'deleted']).optional(),
    metadata: metadataSchema.optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'At least one field must be provided',
    path: ['name'],
  });

const agentIdParamsSchema = z.object({
  id: z.string().uuid('Invalid agent ID format'),
});

// All routes require authentication
router.use(authenticate);

/**
 * GET /agents
 * List all agents in organization
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user?.organizationId || req.apiKey?.organizationId;

    if (!organizationId) {
      throw new BadRequestError('Organization ID is required');
    }

    const agents = await container.agentService.listAgents({ organizationId });

    return responses.ok(res, agents, 'Agents retrieved successfully');
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /agents
 * Create new agent
 */
router.post(
  '/',
  validate({ body: createAgentSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;

      if (!organizationId) {
        throw new BadRequestError('Organization ID is required');
      }

      const { name, description, metadata } = req.body as {
        name: string;
        description?: string;
        metadata?: Record<string, unknown>;
      };

      const agent = await container.agentService.createAgent({
        organizationId,
        name,
        description,
        metadata,
      });

      return responses.created(res, agent, 'Agent created successfully');
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * GET /agents/:id
 * Get agent details
 */
router.get(
  '/:id',
  validate({ params: agentIdParamsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as { id: string };
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;

      if (!organizationId) {
        throw new BadRequestError('Organization ID is required');
      }

      // Verify ownership
      await container.agentService.verifyOwnership(id, organizationId);

      const agent = await container.agentService.getAgent(id);

      return responses.ok(res, agent, 'Agent retrieved successfully');
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * PATCH /agents/:id
 * Update agent
 */
router.patch(
  '/:id',
  validate({ params: agentIdParamsSchema, body: updateAgentSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as { id: string };
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;

      if (!organizationId) {
        throw new BadRequestError('Organization ID is required');
      }

      // Verify ownership
      await container.agentService.verifyOwnership(id, organizationId);

      const { name, description, status, metadata } = req.body as {
        name?: string;
        description?: string;
        status?: 'active' | 'paused' | 'deleted';
        metadata?: Record<string, unknown>;
      };

      const agentStatus = status ? (status as AgentStatus) : undefined;

      const updated = await container.agentService.updateAgent(id, {
        name,
        description,
        status: agentStatus,
        metadata,
      });

      return responses.ok(res, updated, 'Agent updated successfully');
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * DELETE /agents/:id
 * Delete agent
 */
router.delete(
  '/:id',
  validate({ params: agentIdParamsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as { id: string };
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;

      if (!organizationId) {
        throw new BadRequestError('Organization ID is required');
      }

      // Verify ownership
      await container.agentService.verifyOwnership(id, organizationId);

      await container.agentService.deleteAgent(id);

      return responses.ok(res, null, 'Agent deleted successfully');
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * GET /agents/:id/balance
 * Get agent balance
 */
router.get(
  '/:id/balance',
  validate({ params: agentIdParamsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as { id: string };
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;

      if (!organizationId) {
        throw new BadRequestError('Organization ID is required');
      }

      // Verify ownership
      await container.agentService.verifyOwnership(id, organizationId);

      const balance = await container.agentService.getAgentBalance(id);

      return responses.ok(res, balance, 'Agent balance retrieved successfully');
    } catch (error) {
      return next(error);
    }
  }
);

export default router;

