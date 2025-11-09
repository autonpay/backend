import { Application, Router, type Request, type Response } from 'express';
import { logger } from '../shared/logger';
import * as responses from '../shared/http/response';

// Import route modules
import authRoutes from './routes/auth.routes';
import dashboardRoutes from './routes/dashboard.routes';
import organizationRoutes from './routes/organizations.routes';
import agentRoutes from './routes/agents.routes';

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

  // TODO: Transaction routes
  // v1Router.use('/transactions', transactionRoutes);

  // TODO: Rules routes
  // v1Router.use('/rules', rulesRoutes);

  // TODO: Webhook routes
  // v1Router.use('/webhooks', webhookRoutes);

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
