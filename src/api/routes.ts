import { Application, Router, type Request, type Response } from 'express';
import { logger } from '../shared/logger';
import * as responses from '../shared/http/response';

// Import route modules
import authRoutes from './routes/auth.routes';
import dashboardRoutes from './routes/dashboard.routes';
import organizationRoutes from './routes/organizations.routes';
import agentRoutes from './routes/agents.routes';
import rulesRoutes from './routes/rules.routes';
import transactionRoutes from './routes/transactions.routes';
import webhookRoutes from './routes/webhooks.routes';
import approvalRoutes from './routes/approvals.routes';
import merchantRoutes from './routes/merchants.routes';

export function registerRoutes(app: Application) {
  const v1Router = Router();

  // ==========================================================================
  // PUBLIC ROUTES (No authentication required)
  // ==========================================================================

  // Auth routes (login, register)
  v1Router.use('/auth', authRoutes);

  // ==========================================================================
  // PROTECTED ROUTES (Authentication handled in each route file)
  // ==========================================================================

  // Dashboard routes
  v1Router.use('/dashboard', dashboardRoutes);

  // Organization routes
  v1Router.use('/organizations', organizationRoutes);

  // Agent routes
  v1Router.use('/agents', agentRoutes);

  // Rules routes
  v1Router.use('/rules', rulesRoutes);

  // Transaction routes (transaction management)
  v1Router.use('/transactions', transactionRoutes);

  // Webhook routes
  v1Router.use('/webhooks', webhookRoutes);

  // Approval routes
  v1Router.use('/approvals', approvalRoutes);

  // Merchant routes
  v1Router.use('/merchants', merchantRoutes);

  // API info endpoint
  v1Router.get('/', (res: Response) => {
    return responses.ok(res, {
      message: 'Auton API v1',
      version: '0.1.0',
      endpoints: {
        auth: '/v1/auth',
        dashboard: '/v1/dashboard',
        organizations: '/v1/organizations',
        agents: '/v1/agents',
        rules: '/v1/rules',
        transactions: '/v1/transactions',
        webhooks: '/v1/webhooks',
        approvals: '/v1/approvals',
        merchants: '/v1/merchants',
      },
    });
  });

  // Mount v1 routes
  app.use('/v1', v1Router);

  // 404 handler
  app.use((req: Request, res: Response) => {
    return responses.notFound(res, `Route ${req.method} ${req.path} not found`);
  });

  logger.info('✅ API routes registered');
}
