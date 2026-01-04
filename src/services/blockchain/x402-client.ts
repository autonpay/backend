/**
 * x402 Client
 *
 * Integrates with x402 protocol for payment intents and merchant payments.
 */

import { logger } from '../../shared/logger';
import { BlockchainError } from '../../shared/errors';
import { config } from '../../shared/config';
import { X402PaymentIntent, X402PaymentRequest } from './blockchain.types';

interface X402ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export class X402Client {
  private readonly apiKey: string;
  private readonly apiBaseUrl: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly retryDelay: number;
  private readonly pollingInterval: number;
  private readonly maxPollingAttempts: number;

  constructor() {
    this.apiKey = config.x402.apiKey;
    this.apiBaseUrl = config.x402.apiBaseUrl;
    this.timeout = config.x402.timeout;
    this.maxRetries = config.x402.maxRetries;
    this.retryDelay = config.x402.retryDelay;
    this.pollingInterval = config.x402.pollingInterval;
    this.maxPollingAttempts = config.x402.maxPollingAttempts;

    if (!this.apiKey) {
      logger.warn('X402_API_KEY not set, x402 features will be disabled');
    }
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: unknown, statusCode?: number): boolean {
    // Don't retry 4xx errors (client errors)
    if (statusCode && statusCode >= 400 && statusCode < 500) {
      return false;
    }

    // Don't retry BlockchainError that are not network-related
    if (error instanceof BlockchainError) {
      const message = error.message.toLowerCase();
      // Retry network errors, timeouts, and 5xx errors
      if (
        message.includes('timeout') ||
        message.includes('network') ||
        message.includes('fetch failed') ||
        message.includes('connection')
      ) {
        return true;
      }
      // Don't retry validation/configuration errors
      return false;
    }

    // Retry generic errors (might be transient network issues)
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('timeout') ||
        message.includes('network') ||
        message.includes('fetch failed') ||
        message.includes('connection') ||
        error.name === 'AbortError'
      );
    }

    return false;
  }

  /**
   * Sleep for a given number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Make HTTP request to x402 API with retry logic
   */
  private async request<T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      body?: any;
      headers?: Record<string, string>;
    } = {}
  ): Promise<T> {
    const url = `${this.apiBaseUrl}${endpoint}`;
    const { method = 'GET', body, headers = {} } = options;

    let lastError: unknown;
    let lastStatusCode: number | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        ...headers,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      try {
        const response = await fetch(url, {
          method,
          headers: requestHeaders,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        lastStatusCode = response.status;

        if (!response.ok) {
          let errorData: X402ApiResponse<never>;
          try {
            errorData = (await response.json()) as X402ApiResponse<never>;
          } catch {
            errorData = {
              success: false,
              error: { code: 'HTTP_ERROR', message: `HTTP ${response.status}: ${response.statusText}` },
            };
          }

          const error = new BlockchainError(
            errorData.error?.message || `x402 API error: ${response.statusText}`,
            { status: response.status, endpoint, error: errorData.error }
          );

          // If not retryable or last attempt, throw
          if (!this.isRetryableError(error, response.status) || attempt === this.maxRetries) {
            throw error;
          }

          lastError = error;
          // Will retry
        } else {
          const data = (await response.json()) as X402ApiResponse<T>;

          if (!data.success || !data.data) {
            const error = new BlockchainError(
              data.error?.message || 'x402 API returned unsuccessful response',
              { endpoint, error: data.error }
            );

            // If not retryable or last attempt, throw
            if (!this.isRetryableError(error) || attempt === this.maxRetries) {
              throw error;
            }

            lastError = error;
            // Will retry
          } else {
            // Success - return data
            return data.data;
          }
        }
      } catch (error) {
        clearTimeout(timeoutId);

        // If this is the last attempt, throw the error
        if (attempt === this.maxRetries) {
          if (error instanceof BlockchainError) {
            throw error;
          }

          if (error instanceof Error && error.name === 'AbortError') {
            throw new BlockchainError(`x402 API request timeout after ${this.timeout}ms`, {
              endpoint,
              timeout: this.timeout,
            });
          }

          logger.error({ err: error, endpoint, url, attempt: attempt + 1 }, 'x402 API request failed after all retries');
          throw new BlockchainError(
            `x402 API request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            { endpoint, error, attempts: attempt + 1 }
          );
        }

        // Check if error is retryable
        if (!this.isRetryableError(error, lastStatusCode)) {
          throw error;
        }

        lastError = error;

        // Calculate exponential backoff delay
        const delay = this.retryDelay * Math.pow(2, attempt);
        logger.warn(
          { endpoint, attempt: attempt + 1, maxRetries: this.maxRetries, delay, err: error },
          'x402 API request failed, retrying'
        );

        // Wait before retrying
        await this.sleep(delay);
      }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError || new BlockchainError('x402 API request failed', { endpoint });
  }

  /**
   * Create payment intent
   */
  async createPaymentIntent(input: {
    merchantId: string;
    amount: bigint;
    currency: string;
    recipientAddress: string;
    expiresIn?: number; // seconds
  }): Promise<X402PaymentIntent> {
    if (!this.apiKey) {
      throw new BlockchainError('x402 API key not configured');
    }

    try {
      logger.info({ input }, 'Creating x402 payment intent');

      const requestBody = {
        merchantId: input.merchantId,
        amount: input.amount.toString(), // Convert bigint to string for JSON
        currency: input.currency,
        recipientAddress: input.recipientAddress,
        expiresIn: input.expiresIn || 3600, // Default 1 hour
        network: config.x402.network,
      };

      const response = await this.request<X402PaymentIntent>('/v1/payment-intents', {
        method: 'POST',
        body: requestBody,
      });

      logger.info(
        { intentId: response.intentId, merchantId: input.merchantId },
        'x402 payment intent created'
      );

      return response;
    } catch (error) {
      logger.error({ err: error, input }, 'Failed to create x402 payment intent');
      throw error instanceof BlockchainError
        ? error
        : new BlockchainError(
            `Failed to create payment intent: ${error instanceof Error ? error.message : 'Unknown error'}`,
            { input, error }
          );
    }
  }

  /**
   * Submit payment request
   */
  async submitPaymentRequest(input: {
    intentId: string;
    signature: string;
    fromAddress: string;
  }): Promise<X402PaymentRequest> {
    if (!this.apiKey) {
      throw new BlockchainError('x402 API key not configured');
    }

    try {
      logger.info({ intentId: input.intentId, fromAddress: input.fromAddress }, 'Submitting x402 payment request');

      const requestBody = {
        intentId: input.intentId,
        signature: input.signature,
        fromAddress: input.fromAddress,
        network: config.x402.network,
      };

      const response = await this.request<X402PaymentRequest>('/v1/payment-requests', {
        method: 'POST',
        body: requestBody,
      });

      logger.info(
        { requestId: response.requestId, intentId: input.intentId, txHash: response.txHash },
        'x402 payment request submitted'
      );

      return response;
    } catch (error) {
      logger.error({ err: error, input }, 'Failed to submit x402 payment request');
      throw error instanceof BlockchainError
        ? error
        : new BlockchainError(
            `Failed to submit payment request: ${error instanceof Error ? error.message : 'Unknown error'}`,
            { input, error }
          );
    }
  }

  /**
   * Get payment intent status
   */
  async getPaymentIntentStatus(intentId: string): Promise<X402PaymentIntent['status']> {
    if (!this.apiKey) {
      throw new BlockchainError('x402 API key not configured');
    }

    try {
      logger.debug({ intentId }, 'Getting x402 payment intent status');

      const response = await this.request<{ status: X402PaymentIntent['status'] }>(
        `/v1/payment-intents/${intentId}/status`,
        {
          method: 'GET',
        }
      );

      return response.status;
    } catch (error) {
      logger.error({ err: error, intentId }, 'Failed to get payment intent status');
      throw error instanceof BlockchainError
        ? error
        : new BlockchainError(
            `Failed to get payment intent status: ${error instanceof Error ? error.message : 'Unknown error'}`,
            { intentId, error }
          );
    }
  }

  /**
   * Get payment intent details
   */
  async getPaymentIntent(intentId: string): Promise<X402PaymentIntent> {
    if (!this.apiKey) {
      throw new BlockchainError('x402 API key not configured');
    }

    try {
      logger.debug({ intentId }, 'Getting x402 payment intent details');

      const response = await this.request<X402PaymentIntent>(`/v1/payment-intents/${intentId}`, {
        method: 'GET',
      });

      return response;
    } catch (error) {
      logger.error({ err: error, intentId }, 'Failed to get payment intent');
      throw error instanceof BlockchainError
        ? error
        : new BlockchainError(
            `Failed to get payment intent: ${error instanceof Error ? error.message : 'Unknown error'}`,
            { intentId, error }
          );
    }
  }

  /**
   * Poll payment intent status until completion or failure
   * Returns the final payment intent with transaction hash
   */
  async waitForPaymentCompletion(
    intentId: string,
    options?: {
      onStatusChange?: (status: X402PaymentIntent['status']) => void;
      timeout?: number; // Maximum time to poll (milliseconds)
    }
  ): Promise<X402PaymentIntent> {
    const startTime = Date.now();
    const timeout = options?.timeout || this.pollingInterval * this.maxPollingAttempts;
    let attempt = 0;

    while (attempt < this.maxPollingAttempts) {
      // Check timeout
      if (Date.now() - startTime > timeout) {
        throw new BlockchainError(`Payment polling timeout after ${timeout}ms`, {
          intentId,
          attempts: attempt,
        });
      }

      try {
        const intent = await this.getPaymentIntent(intentId);

        // Call status change callback if provided
        if (options?.onStatusChange) {
          options.onStatusChange(intent.status);
        }

        // Check if payment is complete (approved or rejected/expired)
        if (intent.status === 'approved') {
          logger.info({ intentId, status: intent.status, attempts: attempt + 1 }, 'Payment approved');
          return intent;
        }

        if (intent.status === 'rejected' || intent.status === 'expired') {
          throw new BlockchainError(`Payment ${intent.status}`, {
            intentId,
            status: intent.status,
            attempts: attempt + 1,
          });
        }

        // Still pending, wait and retry
        if (intent.status === 'pending') {
          attempt++;
          if (attempt < this.maxPollingAttempts) {
            logger.debug(
              { intentId, status: intent.status, attempt: attempt + 1, maxAttempts: this.maxPollingAttempts },
              'Payment still pending, polling again'
            );
            await this.sleep(this.pollingInterval);
            continue;
          }
        }

        // Unknown status
        throw new BlockchainError(`Unknown payment status: ${intent.status}`, {
          intentId,
          status: intent.status,
        });
      } catch (error) {
        // If it's a BlockchainError about rejection/expiration, throw it
        if (
          error instanceof BlockchainError &&
          (error.message.includes('rejected') || error.message.includes('expired'))
        ) {
          throw error;
        }

        // For other errors, log and continue polling (might be transient)
        logger.warn({ err: error, intentId, attempt: attempt + 1 }, 'Error polling payment status, will retry');

        attempt++;
        if (attempt < this.maxPollingAttempts) {
          await this.sleep(this.pollingInterval);
          continue;
        }

        // Last attempt failed
        throw error instanceof BlockchainError
          ? error
          : new BlockchainError(
              `Failed to poll payment status: ${error instanceof Error ? error.message : 'Unknown error'}`,
              { intentId, error, attempts: attempt }
            );
      }
    }

    throw new BlockchainError(`Payment polling exceeded max attempts (${this.maxPollingAttempts})`, {
      intentId,
      attempts: attempt,
    });
  }

  /**
   * Check if x402 is enabled
   */
  isEnabled(): boolean {
    return !!this.apiKey;
  }
}
