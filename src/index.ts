import 'dotenv/config';
import { createServer } from './server';
import { logger } from './shared/logger';
import { config } from './shared/config';

async function bootstrap() {
  try {
    // Create and start server
    const app = await createServer();

    const server = app.listen(config.port, () => {
      logger.info(`🚀 Auton API Server running on port ${config.port}`);
      logger.info(`📝 Environment: ${config.env}`);
      logger.info(`🔗 API Base URL: ${config.apiBaseUrl}`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('🛑 Shutting down gracefully...');

      server.close(() => {
        logger.info('✅ Server closed');
        process.exit(0);
      });

      // Force close after 10 seconds
      setTimeout(() => {
        logger.error('⚠️  Forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    logger.error({ err: error }, '❌ Failed to start server');
    process.exit(1);
  }
}

bootstrap();

