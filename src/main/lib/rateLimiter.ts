export interface RateLimiterOptions {
  concurrency?: number;
  minTime?: number;
}

type Task<T> = {
  run: () => Promise<T>;
  resolve: (v: T) => void;
  reject: (e: any) => void;
};

export class RateLimiter {
  private concurrency: number;
  private minTime: number;
  private active = 0;
  private queue: Task<any>[] = [];
  private lastStart = 0;

  constructor(opts: RateLimiterOptions = {}) {
    this.concurrency = opts.concurrency ?? 4;
    this.minTime = opts.minTime ?? 250;
  }

  schedule<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ run: fn, resolve, reject });
      this.process();
    });
  }

  private process() {
    if (this.active >= this.concurrency) return;
    const task = this.queue.shift();
    if (!task) return;

    const now = Date.now();
    const elapsed = now - this.lastStart;
    const wait = Math.max(0, this.minTime - elapsed);

    this.active++;
    setTimeout(async () => {
      this.lastStart = Date.now();
      try {
        const res = await task.run();
        task.resolve(res);
      } catch (err) {
        task.reject(err);
      } finally {
        this.active--;

        if (this.queue.length > 0) {
          setImmediate(() => this.process());
        }
      }
    }, wait);
  }

  drain(): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        if (this.active === 0 && this.queue.length === 0) return resolve();
        setTimeout(check, 50);
      };
      check();
    });
  }
}

export default RateLimiter;
