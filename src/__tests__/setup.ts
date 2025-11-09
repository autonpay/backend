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

