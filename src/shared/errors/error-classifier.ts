/**
 * Error Classification Utilities
 *
 * Determines if errors are retryable and provides error handling strategies.
 */

import {
  AppError,
  InsufficientBalanceError,
  RuleViolationError,
  BlockchainError,
  BadRequestError,
  NotFoundError,
} from './index';

/**
 * Check if an error is retryable
 *
 * Non-retryable errors:
 * - InsufficientBalanceError (balance won't change)
 * - RuleViolationError (rule won't change)
 * - BadRequestError (validation errors)
 * - NotFoundError (resource doesn't exist)
 *
 * Retryable errors:
 * - BlockchainError (network issues, RPC errors, gas estimation failures)
 * - Database connection errors
 * - Timeout errors
 * - Rate limiting errors
 * - Generic errors (might be transient)
 */
export function isRetryableError(error: unknown): boolean {
  // Non-retryable errors
  if (error instanceof InsufficientBalanceError) {
    return false;
  }

  if (error instanceof RuleViolationError) {
    return false;
  }

  if (error instanceof BadRequestError) {
    return false;
  }

  if (error instanceof NotFoundError) {
    return false;
  }

  // Blockchain errors might be retryable (network issues) or not (invalid address)
  if (error instanceof BlockchainError) {
    return isRetryableBlockchainError(error);
  }

  // Database connection errors are retryable
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Database connection errors
    if (
      message.includes('connection') ||
      message.includes('timeout') ||
      message.includes('econnrefused') ||
      message.includes('econnreset') ||
      message.includes('etimedout')
    ) {
      return true;
    }

    // Rate limiting errors
    if (message.includes('rate limit') || message.includes('too many requests')) {
      return true;
    }

    // Generic network errors
    if (
      message.includes('network') ||
      message.includes('fetch failed') ||
      message.includes('eai_again')
    ) {
      return true;
    }
  }

  // Default: retry generic errors (might be transient)
  return true;
}

/**
 * Check if a blockchain error is retryable
 *
 * Non-retryable blockchain errors:
 * - Invalid address format
 * - Wallet not initialized
 * - Invalid transaction data
 *
 * Retryable blockchain errors:
 * - Network/RPC errors
 * - Gas estimation failures (might be transient)
 * - Transaction timeout
 * - Rate limiting
 */
function isRetryableBlockchainError(error: BlockchainError): boolean {
  const message = error.message.toLowerCase();

  // Non-retryable: configuration/validation errors
  if (
    message.includes('invalid address') ||
    message.includes('wallet not initialized') ||
    message.includes('not specified') ||
    message.includes('invalid private key') ||
    message.includes('not yet implemented')
  ) {
    return false;
  }

  // Retryable: network/transient errors
  if (
    message.includes('network') ||
    message.includes('rpc') ||
    message.includes('timeout') ||
    message.includes('connection') ||
    message.includes('gas estimation') ||
    message.includes('rate limit')
  ) {
    return true;
  }

  // Default: retry blockchain errors (might be transient network issues)
  return true;
}

/**
 * Get retry delay based on error type and attempt number
 */
export function getRetryDelay(attemptNumber: number, error: unknown): number {
  // For non-retryable errors, return 0 (don't retry)
  if (!isRetryableError(error)) {
    return 0;
  }

  // Exponential backoff: 2s, 4s, 8s, 16s, max 60s
  const baseDelay = 2000; // 2 seconds
  const maxDelay = 60000; // 60 seconds
  const delay = Math.min(baseDelay * Math.pow(2, attemptNumber - 1), maxDelay);

  return delay;
}

/**
 * Get maximum retry attempts based on error type
 */
export function getMaxRetries(error: unknown): number {
  if (!isRetryableError(error)) {
    return 0; // Don't retry non-retryable errors
  }

  // Blockchain errors: 3 retries
  if (error instanceof BlockchainError) {
    return 3;
  }

  // Network/database errors: 5 retries
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes('connection') ||
      message.includes('timeout') ||
      message.includes('network')
    ) {
      return 5;
    }
  }

  // Default: 3 retries
  return 3;
}

/**
 * Extract error details for logging
 */
export function getErrorDetails(error: unknown): {
  type: string;
  message: string;
  code?: string;
  retryable: boolean;
  details?: any;
} {
  if (error instanceof AppError) {
    return {
      type: error.constructor.name,
      message: error.message,
      code: error.code,
      retryable: isRetryableError(error),
      details: error.details,
    };
  }

  if (error instanceof Error) {
    return {
      type: error.constructor.name,
      message: error.message,
      retryable: isRetryableError(error),
    };
  }

  return {
    type: 'Unknown',
    message: String(error),
    retryable: false,
  };
}

