/**
 * Jest Test Setup
 *
 * Runs before all tests to configure the test environment
 */

import { config } from 'dotenv';

// Load environment variables from .env file
config();

// Suppress console logs during tests (optional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
// };

// Cleanup after all tests complete
afterAll(async () => {
  // Close queue connections to prevent Jest from hanging
  try {
    const { closeAllQueues } = await import('../queues');
    await closeAllQueues();
  } catch (error) {
    // Ignore errors during cleanup
  }
});

