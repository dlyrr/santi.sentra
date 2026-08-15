/**
 * Rate limiter utility for handling Roblox API rate limits
 * Prevents rapid successive requests that trigger rate limiting
 */

export interface RateLimitConfig {
  minDelayMs?: number; // Minimum delay between requests (default: 500ms)
  maxConcurrent?: number; // Max concurrent requests (default: 1 for bulk ops)
  backoffMultiplier?: number; // Exponential backoff multiplier (default: 1.5)
  maxBackoffMs?: number; // Max backoff delay (default: 5000ms)
}

export class RateLimiter {
  private minDelayMs: number;
  private maxConcurrent: number;
  private backoffMultiplier: number;
  private maxBackoffMs: number;
  private lastRequestTime: number = 0;
  private activeRequests: number = 0;
  private queue: Array<() => Promise<any>> = [];
  private consecutiveErrors: number = 0;

  constructor(config: RateLimitConfig = {}) {
    this.minDelayMs = config.minDelayMs ?? 500;
    this.maxConcurrent = config.maxConcurrent ?? 1;
    this.backoffMultiplier = config.backoffMultiplier ?? 1.5;
    this.maxBackoffMs = config.maxBackoffMs ?? 5000;
  }

  /**
   * Execute an operation with rate limiting
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await this.executeWithDelay(operation);
          this.consecutiveErrors = 0;
          resolve(result);
        } catch (error) {
          this.consecutiveErrors++;
          reject(error);
        }
      });
      this.processQueue();
    });
  }

  /**
   * Execute operation with delay enforcement
   */
  private async executeWithDelay<T>(operation: () => Promise<T>): Promise<T> {
    while (this.activeRequests >= this.maxConcurrent) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const backoffDelay = Math.min(
      this.minDelayMs *
        Math.pow(this.backoffMultiplier, this.consecutiveErrors),
      this.maxBackoffMs,
    );
    const requiredDelay = Math.max(0, backoffDelay - timeSinceLastRequest);

    if (requiredDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, requiredDelay));
    }

    this.activeRequests++;
    this.lastRequestTime = Date.now();

    try {
      return await operation();
    } finally {
      this.activeRequests--;
      this.processQueue();
    }
  }

  /**
   * Process queued operations
   */
  private processQueue(): void {
    while (this.queue.length > 0 && this.activeRequests < this.maxConcurrent) {
      const operation = this.queue.shift();
      if (operation) {
        operation().catch(() => {
          // Errors are already handled in execute()
        });
      }
    }
  }

  /**
   * Reset the limiter state
   */
  reset(): void {
    this.lastRequestTime = 0;
    this.activeRequests = 0;
    this.queue = [];
    this.consecutiveErrors = 0;
  }
}

// Global rate limiters for different operations
export const catalogPurchaseLimiter = new RateLimiter({
  minDelayMs: 750, // 750ms minimum between purchases
  maxConcurrent: 1,
  backoffMultiplier: 1.5,
  maxBackoffMs: 3000,
});

export const bulkOperationLimiter = new RateLimiter({
  minDelayMs: 3000, // 3s minimum between bulk operations to prevent 429 rate limits
  maxConcurrent: 1,
  backoffMultiplier: 2,
  maxBackoffMs: 10000,
});

/**
 * Execute multiple operations sequentially with rate limiting
 */
export async function executeSequentially<T, R>(
  items: T[],
  operation: (item: T) => Promise<R>,
  limiter: RateLimiter = catalogPurchaseLimiter,
): Promise<R[]> {
  const results: R[] = [];
  for (const item of items) {
    const result = await limiter.execute(() => operation(item));
    results.push(result);
  }
  return results;
}

/**
 * Execute multiple operations with batch delays
 */
export async function executeBatched<T, R>(
  items: T[],
  operation: (item: T) => Promise<R>,
  batchSize: number = 2,
  delayMs: number = 1000,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(operation));
    results.push(...batchResults);

    if (i + batchSize < items.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return results;
}

export const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export const isRateLimitError = (error: unknown): boolean => {
  if (!error) return false;

  const maybeError = error as any;
  const statusCode = maybeError?.statusCode ?? maybeError?.status;
  if (statusCode === 429) return true;

  const message =
    typeof maybeError?.message === "string"
      ? maybeError.message
      : typeof error === "string"
        ? error
        : "";

  return /(?:429|rate limit|too many requests)/i.test(message);
};

export async function executeWithRetry<T>(
  limiter: RateLimiter,
  operation: () => Promise<T>,
  options?: {
    maxAttempts?: number;
    retryCondition?: (error: unknown) => boolean;
    initialDelayMs?: number;
    maxDelayMs?: number;
  },
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 10;
  const retryCondition = options?.retryCondition ?? isRateLimitError;
  const initialDelayMs = options?.initialDelayMs ?? 1000;
  const maxDelayMs = options?.maxDelayMs ?? 5000;

  let attempt = 0;
  while (true) {
    attempt += 1;
    try {
      return await limiter.execute(operation);
    } catch (error) {
      if (!retryCondition(error) || attempt >= maxAttempts) {
        throw error;
      }

      const delay = Math.min(
        initialDelayMs * Math.pow(2, attempt - 1),
        maxDelayMs,
      );
      await sleep(delay);
    }
  }
}
