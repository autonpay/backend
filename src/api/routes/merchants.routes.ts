/**
 * Merchant Routes
 *
 * Endpoints for managing merchants:
 * - GET /merchants - List merchants
 * - POST /merchants - Create merchant
 * - GET /merchants/:id - Get merchant details
 * - PATCH /merchants/:id - Update merchant
 * - DELETE /merchants/:id - Delete merchant
 * - POST /merchants/:id/verify - Verify merchant
 * - POST /merchants/:id/unverify - Unverify merchant
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { container } from '../../services/container';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import * as responses from '../../shared/http/response';
import { WalletManager } from '../../services/blockchain/wallet.manager';

const router = Router();

// Schemas
const merchantIdParamsSchema = z.object({
  id: z.string().uuid('Invalid merchant ID format'),
});

const createMerchantSchema = z.object({
  name: z.string().min(1, 'Merchant name is required'),
  category: z.string().optional(),
  walletAddress: z
    .string()
    .optional()
    .refine(
      (val) => !val || WalletManager.isValidAddress(val),
      {
        message: 'walletAddress must be a valid Ethereum address',
      }
    ),
  website: z.string().url('Invalid website URL').optional().or(z.literal('')),
  verified: z.boolean().optional(),
  reputationScore: z.number().int().min(0).max(100).optional(),
});

const updateMerchantSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().optional().nullable(),
  walletAddress: z
    .string()
    .optional()
    .nullable()
    .refine(
      (val) => val === null || val === undefined || WalletManager.isValidAddress(val),
      {
        message: 'walletAddress must be a valid Ethereum address',
      }
    ),
  website: z.string().url('Invalid website URL').optional().nullable().or(z.literal('')),
  verified: z.boolean().optional(),
  reputationScore: z.number().int().min(0).max(100).optional(),
});

const listMerchantsQuerySchema = z.object({
  verified: z.string().transform((val) => val === 'true').pipe(z.boolean()).optional(),
  category: z.string().optional(),
  search: z.string().optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().positive().max(100)).optional(),
  offset: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().nonnegative()).optional(),
});

// All routes require authentication
router.use(authenticate);

router.get(
  '/',
  validate({ query: listMerchantsQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const merchants = await container.merchantService.listMerchants({
        verified: req.query.verified as boolean | undefined,
        category: req.query.category as string | undefined,
        search: req.query.search as string | undefined,
      });

      return responses.ok(res, merchants, 'Merchants retrieved successfully');
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  '/',
  validate({ body: createMerchantSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const merchant = await container.merchantService.createMerchant(req.body);

      return responses.created(res, merchant, 'Merchant created successfully');
    } catch (error) {
      return next(error);
    }
  }
);

router.get(
  '/:id',
  validate({ params: merchantIdParamsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as { id: string };

      const merchant = await container.merchantService.getMerchant(id);

      return responses.ok(res, merchant, 'Merchant retrieved successfully');
    } catch (error) {
      return next(error);
    }
  }
);

router.patch(
  '/:id',
  validate({ params: merchantIdParamsSchema, body: updateMerchantSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as { id: string };

      const merchant = await container.merchantService.updateMerchant(id, req.body);

      return responses.ok(res, merchant, 'Merchant updated successfully');
    } catch (error) {
      return next(error);
    }
  }
);

router.delete(
  '/:id',
  validate({ params: merchantIdParamsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as { id: string };

      await container.merchantService.deleteMerchant(id);

      return responses.ok(res, null, 'Merchant deleted successfully');
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  '/:id/verify',
  validate({ params: merchantIdParamsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as { id: string };

      const merchant = await container.merchantService.verifyMerchant(id);

      return responses.ok(res, merchant, 'Merchant verified successfully');
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  '/:id/unverify',
  validate({ params: merchantIdParamsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as { id: string };

      const merchant = await container.merchantService.unverifyMerchant(id);

      return responses.ok(res, merchant, 'Merchant unverified successfully');
    } catch (error) {
      return next(error);
    }
  }
);

export default router;

