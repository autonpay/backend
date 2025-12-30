import 'dotenv/config';
import { createServer } from './server';
import { logger } from './shared/logger';
import { config } from './shared/config';

async function bootstrap() {
  try {
    const app = await createServer();

    // Optionally start workers (if ENABLE_WORKER=true)
    let workerShutdown: (() => Promise<void>)[] = [];
    let schedulerShutdown: (() => void) | null = null;

    if (process.env.ENABLE_WORKER === 'true') {
      const { shutdownWorker } = await import('./workers/transaction.worker');
      const { shutdownWebhookWorker } = await import('./workers/webhook.worker');
      workerShutdown = [shutdownWorker, shutdownWebhookWorker];
      logger.info('Transaction and webhook workers started');

      // Start approval expiration scheduler
      const { ApprovalScheduler } = await import('./services/approvals');
      const { ApprovalRepository } = await import('./services/approvals');
      const { TransactionRepository } = await import('./services/transactions');
      const { container } = await import('./services/container');

      const approvalScheduler = new ApprovalScheduler(
        new ApprovalRepository(),
        new TransactionRepository(),
        container.webhookService
      );

      // Start scheduler (runs every hour by default, configurable via env)
      const intervalMs = process.env.APPROVAL_EXPIRATION_CHECK_INTERVAL_MS
        ? parseInt(process.env.APPROVAL_EXPIRATION_CHECK_INTERVAL_MS, 10)
        : 60 * 60 * 1000; // Default: 1 hour

      approvalScheduler.start(intervalMs);
      schedulerShutdown = () => approvalScheduler.stop();
      logger.info({ intervalMs }, 'Approval expiration scheduler started');
    }

    const server = app.listen(config.port, () => {
      logger.info(`Auton API Server running on port ${config.port}`);
      logger.info(`Environment: ${config.env}`);
      logger.info(`API Base URL: ${config.apiBaseUrl}`);
      if (process.env.ENABLE_WORKER === 'true') {
        logger.info('Transaction and webhook workers are active');
      }
    });

    const shutdown = async () => {
      logger.info('Shutting down gracefully...');

      // Stop scheduler first
      if (schedulerShutdown) {
        schedulerShutdown();
      }

      // Shutdown workers
      if (workerShutdown.length > 0) {
        await Promise.all(workerShutdown.map(shutdown => shutdown()));
      }

      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });

      // Force close after 10 seconds
      setTimeout(() => {
        logger.error('Forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    logger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
}

bootstrap();

