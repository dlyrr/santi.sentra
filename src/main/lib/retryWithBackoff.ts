export interface RetryOptions {
  retries?: number;
  minDelay?: number;
  maxDelay?: number;
  factor?: number;
}

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const retries = opts.retries ?? 5;
  const minDelay = opts.minDelay ?? 200;
  const maxDelay = opts.maxDelay ?? 20000;
  const factor = opts.factor ?? 2;

  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt > retries) throw err;

      const base = Math.min(maxDelay, minDelay * Math.pow(factor, attempt));
      const jitter = Math.random() * base * 0.1;
      const delay = Math.max(minDelay, base + jitter);
      await sleep(delay);
    }
  }
}

export default retryWithBackoff;
