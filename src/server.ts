import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { config } from './shared/config';
import { logger } from './shared/logger';
import { errorHandler } from './api/middleware/error-handler';
import { requestLogger } from './api/middleware/request-logger';
import { registerRoutes } from './api/routes';
import { swaggerSpec } from './api/swagger';
import queueDashboardRoutes from './api/routes/queue-dashboard.routes';
import { prisma } from './database/client';

export async function createServer(): Promise<Application> {
  const app = express();

  // Warm up database connection on startup
  try {
    await prisma.$connect();
    logger.info('✅ Database connected');
  } catch (error) {
    logger.warn({ err: error }, 'Database connection warmup failed — will retry on first request');
  }

  // Security middleware
  app.use(helmet());
  app.use(cors({
    origin: config.corsOrigin,
    credentials: true
  }));

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Logging
  app.use(requestLogger);

  // Health check
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.1.0'
    });
  });

  // Swagger documentation
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Auton API Documentation',
  }));

  // Swagger JSON
  app.get('/api-docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // Queue Dashboard (Bull Board UI)
  app.use(queueDashboardRoutes);

  // API routes
  registerRoutes(app);

  // Error handling (must be last)
  app.use(errorHandler);

  logger.info('✅ Server configured successfully');

  return app;
}

