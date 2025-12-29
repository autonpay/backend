/**
 * Approval Routes
 *
 * Endpoints for managing transaction approvals:
 * - GET /approvals - List approvals
 * - GET /approvals/:id - Get approval details
 * - POST /approvals/:id/approve - Approve a transaction
 * - POST /approvals/:id/reject - Reject a transaction
 * - GET /transactions/:id/approval - Get approval for a transaction
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { container } from '../../services/container';
import { authenticate } from '../middleware/authenticate';
import { BadRequestError } from '../../shared/errors';
import { validate } from '../middleware/validate';
import * as responses from '../../shared/http/response';
import { ApprovalStatus } from '../../services/approvals/approval.types';

const router = Router();

// Schemas
const approvalIdParamsSchema = z.object({
  id: z.string().uuid('Invalid approval ID format'),
});

const listApprovalsQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'expired']).optional(),
  transactionId: z.string().uuid().optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().positive().max(100)).optional(),
  offset: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().nonnegative()).optional(),
});

const approveSchema = z.object({
  comment: z.string().optional(),
});

const rejectSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required'),
  comment: z.string().optional(),
});

// All routes require authentication
router.use(authenticate);

router.get(
  '/',
  validate({ query: listApprovalsQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;

      if (!organizationId) {
        throw new BadRequestError('Organization ID is required');
      }

      const approvals = await container.approvalService.listApprovals({
        organizationId,
        status: req.query.status as ApprovalStatus | undefined,
        transactionId: req.query.transactionId as string | undefined,
      });

      return responses.ok(res, approvals, 'Approvals retrieved successfully');
    } catch (error) {
      return next(error);
    }
  }
);

router.get(
  '/:id',
  validate({ params: approvalIdParamsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as { id: string };
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;

      if (!organizationId) {
        throw new BadRequestError('Organization ID is required');
      }

      const approval = await container.approvalService.getApproval(id, organizationId);

      return responses.ok(res, approval, 'Approval retrieved successfully');
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  '/:id/approve',
  validate({ params: approvalIdParamsSchema, body: approveSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as { id: string };
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;
      const userId = req.user?.id;

      if (!organizationId) {
        throw new BadRequestError('Organization ID is required');
      }

      if (!userId) {
        throw new BadRequestError('User ID is required');
      }

      const approval = await container.approvalService.approveTransaction(
        id,
        userId,
        organizationId,
        req.body
      );

      return responses.ok(res, approval, 'Transaction approved successfully');
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  '/:id/reject',
  validate({ params: approvalIdParamsSchema, body: rejectSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as { id: string };
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;
      const userId = req.user?.id;

      if (!organizationId) {
        throw new BadRequestError('Organization ID is required');
      }

      if (!userId) {
        throw new BadRequestError('User ID is required');
      }

      const approval = await container.approvalService.rejectTransaction(
        id,
        userId,
        organizationId,
        req.body
      );

      return responses.ok(res, approval, 'Transaction rejected successfully');
    } catch (error) {
      return next(error);
    }
  }
);


export default router;

