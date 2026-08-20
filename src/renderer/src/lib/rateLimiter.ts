export interface RateLimitConfig {
  minDelayMs?: number;
  maxConcurrent?: number;
  backoffMultiplier?: number;
  maxBackoffMs?: number;
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

  private processQueue(): void {
    while (this.queue.length > 0 && this.activeRequests < this.maxConcurrent) {
      const operation = this.queue.shift();
      if (operation) {
        operation().catch(() => {});
      }
    }
  }

  reset(): void {
    this.lastRequestTime = 0;
    this.activeRequests = 0;
    this.queue = [];
    this.consecutiveErrors = 0;
  }
}

export const catalogPurchaseLimiter = new RateLimiter({
  minDelayMs: 750,
  maxConcurrent: 1,
  backoffMultiplier: 1.5,
  maxBackoffMs: 3000,
});

export const bulkOperationLimiter = new RateLimiter({
  minDelayMs: 800,
  maxConcurrent: 1,
  backoffMultiplier: 1.7,
  maxBackoffMs: 6000,
});

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
