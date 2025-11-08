/**
 * API Key Utilities
 *
 * API key generation and hashing.
 */

import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * Generate a new API key
 *
 * Format: sk_live_<random_string> or sk_test_<random_string>
 */
export function generateAPIKey(prefix: string = 'live'): string {
  const randomBytes = crypto.randomBytes(32);
  const randomString = randomBytes.toString('base64url'); // URL-safe base64

  return `sk_${prefix}_${randomString}`;
}

/**
 * Hash an API key for storage
 */
export async function hashAPIKey(key: string): Promise<string> {
  return bcrypt.hash(key, SALT_ROUNDS);
}

/**
 * Verify an API key against a hash
 */
export async function verifyAPIKey(key: string, hash: string): Promise<boolean> {
  return bcrypt.compare(key, hash);
}

/**
 * Extract prefix from API key
 */
export function getAPIKeyPrefix(key: string): string | null {
  const match = key.match(/^sk_(live|test)_/);
  return match ? match[1] : null;
}

/**
 * Validate API key format
 */
export function isValidAPIKeyFormat(key: string): boolean {
  return /^sk_(live|test)_[A-Za-z0-9_-]+$/.test(key);
}

