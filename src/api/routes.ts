import { Application, Router } from 'express';
import { authenticate } from './middleware/authenticate';

// Import endpoint routers (will be created)
// import { authRouter } from './endpoints/auth';
// import { agentsRouter } from './endpoints/agents';
// import { transactionsRouter } from './endpoints/transactions';
// import { rulesRouter } from './endpoints/rules';
// import { webhooksRouter } from './endpoints/webhooks';

export function registerRoutes(app: Application) {
  const v1Router = Router();

  // Public routes (no auth required)
  // v1Router.use('/auth', authRouter);

  // Protected routes (authentication required)
  // v1Router.use('/agents', authenticate, agentsRouter);
  // v1Router.use('/transactions', authenticate, transactionsRouter);
  // v1Router.use('/rules', authenticate, rulesRouter);
  // v1Router.use('/webhooks', authenticate, webhooksRouter);

  // Placeholder route for now
  v1Router.get('/', (req, res) => {
    res.json({
      message: 'Auton API v1',
      version: '0.1.0',
      documentation: '/docs'
    });
  });

  // Mount v1 routes
  app.use('/v1', v1Router);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.method} ${req.path} not found`
    });
  });
}

