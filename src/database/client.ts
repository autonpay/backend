/**
 * Prisma Client Singleton
 *
 * Ensures only one Prisma client instance exists.
 * Handles connection pooling and prevents connection leaks.
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../shared/logger';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma = global.prisma || new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'event' },
    { level: 'warn', emit: 'event' },
  ],
});

// Log queries in development
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query' as never, (e: any) => {
    logger.debug({
      query: e.query,
      duration: e.duration
    }, 'Database query');
  });
}

// Log errors
prisma.$on('error' as never, (e: any) => {
  logger.error({ error: e }, 'Database error');
});

// Log warnings
prisma.$on('warn' as never, (e: any) => {
  logger.warn({ warning: e }, 'Database warning');
});

// Prevent multiple instances in development (hot reload)
if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
  logger.info('Database connection closed');
});

