import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './shared/config';
import { logger } from './shared/logger';
import { errorHandler } from './api/middleware/error-handler';
import { requestLogger } from './api/middleware/request-logger';
import { registerRoutes } from './api/routes';

export async function createServer(): Promise<Application> {
  const app = express();

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

  // API routes
  registerRoutes(app);

  // Error handling (must be last)
  app.use(errorHandler);

  logger.info('✅ Server configured successfully');

  return app;
}

