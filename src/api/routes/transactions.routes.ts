/**
 * Transaction Routes
 *
 * Transaction management endpoints:
 * - GET /transactions - List transactions
 * - GET /transactions/:id - Get transaction details
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { container } from '../../services/container';
import { authenticate } from '../middleware/authenticate';
import { BadRequestError } from '../../shared/errors';
import { validate } from '../middleware/validate';
import * as responses from '../../shared/http/response';

const router = Router();

// Schemas

const transactionIdParamsSchema = z.object({
  id: z.string().uuid('Invalid transaction ID format'),
});

const listTransactionsQuerySchema = z.object({
  agentId: z.string().uuid().optional(),
  status: z.enum(['pending', 'pending_approval', 'approved', 'processing', 'completed', 'failed', 'rejected']).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().positive().max(100)).optional(),
  offset: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().nonnegative()).optional(),
});

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /v1/transactions:
 *   get:
 *     summary: List transactions for organization
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - in: query
 *         name: agentId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, pending_approval, approved, processing, completed, failed, rejected]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: List of transactions
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  validate({ query: listTransactionsQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;

      if (!organizationId) {
        throw new BadRequestError('Organization ID is required');
      }

      const transactions = await container.transactionOrchestrator.listTransactions({
        organizationId,
        agentId: req.query.agentId as string | undefined,
        status: req.query.status as any,
        limit: req.query.limit as number | undefined,
        offset: req.query.offset as number | undefined,
      });

      return responses.ok(res, transactions, 'Transactions retrieved successfully');
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * @swagger
 * /v1/transactions/{id}:
 *   get:
 *     summary: Get transaction details
 *     tags: [Transactions]
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
 *         description: Transaction details
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Transaction not found
 */
router.get(
  '/:id',
  validate({ params: transactionIdParamsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as { id: string };
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;

      if (!organizationId) {
        throw new BadRequestError('Organization ID is required');
      }

      // Verify ownership first
      await container.transactionOrchestrator.verifyOwnership(id, organizationId);

      const transaction = await container.transactionOrchestrator.getTransaction(id);

      return responses.ok(res, transaction, 'Transaction retrieved successfully');
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * @swagger
 * /v1/transactions/{id}/approval:
 *   get:
 *     summary: Get approval for a transaction
 *     tags: [Transactions]
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
 *         description: Approval details (or null if no approval exists)
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Transaction not found
 */
router.get(
  '/:id/approval',
  validate({ params: transactionIdParamsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: transactionId } = req.params as { id: string };
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;

      if (!organizationId) {
        throw new BadRequestError('Organization ID is required');
      }

      // Verify transaction ownership first
      await container.transactionOrchestrator.verifyOwnership(transactionId, organizationId);

      const approval = await container.approvalService.getApprovalByTransaction(
        transactionId,
        organizationId
      );

      return responses.ok(res, approval, 'Approval retrieved successfully');
    } catch (error) {
      return next(error);
    }
  }
);

export default router;

